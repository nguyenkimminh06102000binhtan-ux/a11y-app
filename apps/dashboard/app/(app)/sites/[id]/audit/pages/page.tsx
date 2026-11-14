import { Suspense } from "react";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { getLatestRun } from "@/lib/runs";
import { getSitePages, pageLabel } from "@/lib/pages";
import { getQuota } from "@/lib/quota";
import { formatResetDate } from "@/lib/month";
import { AddPagesPanel } from "@/components/AddPagesPanel";
import { PageScanList, type PageRow } from "@/components/PageScanList";
import { ScanProgress } from "@/components/ScanProgress";
import { FocusedAlert } from "@/components/FocusedAlert";

export const metadata: Metadata = { title: "Pages · Audit" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ removed?: string; n?: string; error?: string; started?: string }>;
};

/** Audit › Pages: the pages the owner wants checked; tick some and scan them, within the monthly limit. */
export default function PagesPage({ params, searchParams }: PageProps) {
  return (
    <>
      <h2 className="mt-0">Pages</h2>
      <Suspense fallback={<p>Loading pages…</p>}>
        <PagesContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PagesContent({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { removed, n, error, started } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const [pages, quota, audit, run] = await Promise.all([
    getSitePages(site.id),
    getQuota(site),
    getLatestAudit(site.id),
    getLatestRun(site.id),
  ]);
  const resetsOn = formatResetDate(quota.resetsOn);

  const rows: PageRow[] = pages.map((page) => {
    const issues = audit.rows.filter((r) => r.pageUrl === page.url);
    const checkedAt = audit.lastCheckedByUrl.get(page.url);
    return {
      id: page.id,
      label: pageLabel(page.url, site.domain),
      open: issues.length,
      critical: issues.filter((r) => r.impact === "critical").length,
      lastChecked: checkedAt
        ? `${checkedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`
        : null,
      usedThisMonth: quota.used.has(page.url),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="-mt-1 text-muted">
        The pages you want checked on {site.domain}. Add as many as you like, then tick the ones to scan.
      </p>

      {/* This month's usage. The text says it all, so the bar is decoration. */}
      <div className="flex flex-col gap-2">
        <p>
          <span className="font-bold">
            {quota.used.size} of {quota.limit} pages
          </span>{" "}
          scanned this month · resets {resetsOn}
        </p>
        <div aria-hidden="true" className="h-2 max-w-md overflow-hidden rounded-full bg-state-tint">
          <div className="h-full bg-state" style={{ width: `${Math.min(100, Math.round((quota.used.size / Math.max(quota.limit, 1)) * 100))}%` }} />
        </div>
      </div>

      {run && <ScanProgress siteId={site.id} domain={site.domain} initial={run} started={started} />}

      {error === "locked" && (
        <FocusedAlert>That page was scanned this month, so it stays on the list until {resetsOn}.</FocusedAlert>
      )}
      {removed && (
        <FocusedAlert key={n} tone="success">
          Removed {pageLabel(removed, site.domain)} from the list.
        </FocusedAlert>
      )}

      <AddPagesPanel siteId={site.id} domain={site.domain} />

      {rows.length === 0 ? (
        <p>No pages yet. Add the pages you want checked.</p>
      ) : (
        <PageScanList
          siteId={site.id}
          domain={site.domain}
          rows={rows}
          left={quota.left}
          resetsOn={resetsOn}
          running={run?.active ?? false}
        />
      )}
    </div>
  );
}
