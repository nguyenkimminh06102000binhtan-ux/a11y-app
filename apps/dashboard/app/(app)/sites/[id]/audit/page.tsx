import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit, type Issue } from "@/lib/audit";
import { ScanProgress } from "@/components/ScanProgress";
import { RunScanForm } from "@/components/RunScanForm";
import { FocusedAlert } from "@/components/FocusedAlert";
import { ImpactPill } from "@/components/ImpactPill";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Overview · Audit" };

/** Why a scan didn't start (?error=… from requestScan), worded for this site. */
function scanError(error: string | undefined, domain: string): React.ReactNode {
  switch (error) {
    case "url":
      return "Enter a full page address starting with https://";
    case "domain":
      return `That page isn't on ${domain}. Enter a page on ${domain}.`;
    case "subdomain":
      return (
        <>
          That page is on a subdomain. Subdomains are separate sites with their own plan: to scan it,{" "}
          <Link href="/">add it from Sites</Link> first.
        </>
      );
    case "busy":
      return "A scan is already queued or running for this site.";
    default:
      return null;
  }
}
const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Audit › Overview: how the site is doing, what to fix first, and the running scan. Scans start from Audit › Pages (chunk 11); until then, from the cards here. */
export default function OverviewPage({ params, searchParams }: PageProps) {
  return (
    <>
      <h2 className="mt-0">Overview</h2>
      <Suspense fallback={<p>Loading scans…</p>}>
        <Overview params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Overview({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const { latest, lastFinished, rows, inProgress, comparison, pagesChecked, lastCheckedAt } = await getLatestAudit(site.id);
  const homepage = `https://${site.domain}/`;
  const errorMessage = scanError(error, site.domain);

  return (
    <div className="flex flex-col gap-6">
      {/* Run scan (the cards below) posts back here with ?error= when it can't start; focus moves to the reason */}
      {errorMessage && <FocusedAlert>{errorMessage}</FocusedAlert>}

      {pagesChecked > 0 && (
        <p className="-mt-1 text-muted">
          Across the {pagesChecked} {pagesChecked === 1 ? "page" : "pages"} checked so far, each from its latest scan
          {lastCheckedAt &&
            ` (most recent: ${lastCheckedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC)`}
          . Automated checks find part of the issues; a manual review covers the rest.
        </p>
      )}

      {latest && (
        <ScanProgress
          siteId={site.id}
          initial={{ id: latest.id, status: latest.status, url: latest.url, issueCount: latest.issueCount, error: latest.error }}
        />
      )}

      {!latest && (
        <Card>
          <p className="font-bold">No scans yet</p>
          <p className="mt-1 mb-4">
            Run your first scan to find accessibility issues on <span className="wrap-anywhere">{homepage}</span>.
          </p>
          <RunScanForm siteId={site.id} url={homepage} label="Run your first scan" />
        </Card>
      )}

      {lastFinished?.status === "failed" && !inProgress && (
        <div className="rounded-xl border-[1.5px] border-state p-4 sm:p-5">
          <p className="font-bold">The last scan didn&apos;t finish</p>
          <p className="mt-1 mb-4 wrap-anywhere">{lastFinished.error ?? "Something went wrong while checking the page."}</p>
          <RunScanForm siteId={site.id} url={lastFinished.url} label="Try again" variant="secondary" />
        </div>
      )}

      {pagesChecked > 0 && (
        <>
          <StatCards rows={rows} comparison={comparison} pagesChecked={pagesChecked} />
          <FixFirst rows={rows} issuesHref={`/sites/${site.id}/audit/issues`} />
        </>
      )}

    </div>
  );
}

type Comparison = { fixed: number; new: number; pagesCompared: number } | null;

/** The four numbers, across all checked pages. A list; each card reads as one phrase ("Critical: 7. Fix these first."). */
function StatCards({ rows, comparison, pagesChecked }: { rows: Issue[]; comparison: Comparison; pagesChecked: number }) {
  const pagesWord = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  const count = (level: string) => rows.filter((r) => r.impact === level).length;
  const critical = count("critical");
  const lesser = count("moderate") + count("minor");

  const cards = [
    {
      label: "Open issues",
      value: String(rows.length),
      note: `on ${pagesWord(pagesChecked)}${comparison?.new ? `, ${comparison.new} new since the previous check` : ""}`,
    },
    { label: "Critical", value: String(critical), note: critical ? "Fix these first" : "None: well done", strong: critical > 0 },
    { label: "Serious", value: String(count("serious")), note: `${lesser} moderate or minor` },
    {
      label: "Fixed since previous check",
      value: comparison ? String(comparison.fixed) : null,
      note: comparison ? `on ${pagesWord(comparison.pagesCompared)} checked again` : "Shows when a page is checked again",
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <li
          key={card.label}
          className={`flex flex-col gap-1 rounded-xl p-4 ${card.strong ? "border-[1.5px] border-state bg-state-tint" : "border border-line"}`}
        >
          <span className={`text-small ${card.strong ? "font-bold text-state" : "text-muted"}`}>
            {card.label}
            <span className="sr-only">:</span>
          </span>
          <span className="text-3xl font-bold">
            {card.value ?? (
              <>
                <span aria-hidden="true">–</span>
                <span className="sr-only">not yet</span>
              </>
            )}
            <span className="sr-only">.</span>
          </span>
          <span className="text-caption">{card.note}</span>
        </li>
      ))}
    </ul>
  );
}

/** Up to five rules to start with, across all pages: critical before serious, then the most pages, then most places. */
function FixFirst({ rows, issuesHref }: { rows: Issue[]; issuesHref: string }) {
  const byRule = new Map<string, { ruleId: string; title: string; impact: string | null; places: number; pages: Set<string> }>();
  for (const row of rows) {
    if (row.impact !== "critical" && row.impact !== "serious") continue;
    const entry = byRule.get(row.ruleId) ?? { ruleId: row.ruleId, title: row.help ?? row.ruleId, impact: row.impact, places: 0, pages: new Set() };
    entry.places += 1;
    entry.pages.add(row.pageUrl);
    byRule.set(row.ruleId, entry);
  }
  const top = [...byRule.values()]
    .sort(
      (a, b) =>
        (IMPACT_ORDER[a.impact ?? ""] ?? 9) - (IMPACT_ORDER[b.impact ?? ""] ?? 9) || b.pages.size - a.pages.size || b.places - a.places
    )
    .slice(0, 5);

  return (
    <section aria-labelledby="fix-first-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="fix-first-heading">Fix these first</h3>
        {rows.length > 0 && <Link href={issuesHref}>All {rows.length} issues</Link>}
      </div>
      {top.length === 0 ? (
        <p>No critical or serious issues in the latest scan.</p>
      ) : (
        <ol className="rounded-xl border border-line">
          {top.map((rule, i) => (
            <li key={rule.ruleId} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <ImpactPill impact={rule.impact} />
              <span className="min-w-0 flex-1 basis-56 font-bold">{rule.title}</span>
              <span className="text-small text-muted">
                {rule.places} {rule.places === 1 ? "place" : "places"} on {rule.pages.size} {rule.pages.size === 1 ? "page" : "pages"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
