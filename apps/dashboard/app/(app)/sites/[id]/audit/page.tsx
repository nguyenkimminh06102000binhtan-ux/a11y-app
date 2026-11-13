import { Suspense } from "react";
import { db, scans, issues, eq, and, desc, inArray } from "@app/db";
import { getOwnedSite } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requestScan } from "@/app/actions";
import { ImpactPill } from "@/components/ImpactPill";

const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const ERRORS: Record<string, string> = {
  url: "Enter a full page address starting with https://",
  domain: "That page isn't on this site's domain.",
  busy: "A scan is already queued or running for this site.",
};

type Issue = typeof issues.$inferSelect;
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** A site's Audit section: run a scan, follow its progress, and the latest results. Header and tabs: ../layout.tsx */
export default function AuditPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<p>Loading scans…</p>}>
      <AuditDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditDetails({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site

  // latest scan of any status, for the progress message
  const [latest] = await db
    .select()
    .from(scans)
    .where(eq(scans.siteId, site.id))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  // latest finished scan, whose results we show
  const [lastFinished] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.siteId, site.id), inArray(scans.status, ["done", "failed"])))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  const inProgress = latest?.status === "queued" || latest?.status === "running";

  const rows: Issue[] =
    lastFinished?.status === "done"
      ? await db.select().from(issues).where(eq(issues.scanId, lastFinished.id))
      : [];

  // group by rule, most severe first
  const groups = new Map<string, Issue[]>();
  for (const row of rows) {
    const list = groups.get(row.ruleId) ?? [];
    list.push(row);
    groups.set(row.ruleId, list);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => (IMPACT_ORDER[a[0].impact ?? ""] ?? 9) - (IMPACT_ORDER[b[0].impact ?? ""] ?? 9)
  );

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.impact ?? "unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <section aria-labelledby="run-heading">
        <h2 id="run-heading" className="mt-0">Run a scan</h2>
        {error && ERRORS[error] && <p role="alert">{ERRORS[error]}</p>}
        <form action={requestScan}>
          <input type="hidden" name="siteId" value={site.id} />
          <label htmlFor="url">Page to scan</label>
          <input id="url" name="url" type="url" defaultValue={`https://${site.domain}/`} required />
          <button type="submit" disabled={inProgress}>Scan now</button>
        </form>
        {inProgress && latest && (
          <>
            <p role="status" className="mt-3">
              Scan {latest.status} for {latest.url}. This page updates automatically.
            </p>
            <AutoRefresh />
          </>
        )}
      </section>

      {!lastFinished ? (
        <p>No finished scans yet.</p>
      ) : (
        <>
          <section aria-labelledby="scan-heading">
            <h2 id="scan-heading">Latest results</h2>
            <p>
              {lastFinished.url} · {lastFinished.status}
              {lastFinished.finishedAt &&
                ` · ${lastFinished.finishedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`}
            </p>
            {lastFinished.status === "failed" && <p role="alert">Scan failed: {lastFinished.error}</p>}
            {lastFinished.status === "done" && (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {["critical", "serious", "moderate", "minor"].map((level) => (
                  <li
                    key={level}
                    className={`rounded-xl border-2 p-4 ${level === "critical" && counts[level] ? "border-state" : "border-frame"}`}
                  >
                    <span className="block text-sm capitalize">{level}</span>
                    <span className="block text-3xl font-bold">{counts[level] ?? 0}</span>
                  </li>
                ))}
              </ul>

            )}
          </section>

          {lastFinished.status === "done" && (
            <section aria-labelledby="issues-heading">
              <h2 id="issues-heading">Issues to fix ({rows.length})</h2>
              {sorted.map((group) => {
                const first = group[0];
                return (
                  <details key={first.ruleId} className="mb-3 rounded-xl border border-line px-4">
                    <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <ImpactPill impact={first.impact} />
                      <span className="font-bold">{first.help ?? first.ruleId}</span>
                      <span className="text-sm">
                        {group.length} {group.length === 1 ? "place" : "places"}
                      </span>
                    </summary>
                    {first.helpUrl && (
                      <p className="mb-3"><a href={first.helpUrl} target="_blank" rel="noreferrer">How to fix this rule (opens in new tab)</a></p>
                    )}
                    <ol className="mb-4 flex flex-col gap-3">
                      {group.map((issue) => (
                        <li key={issue.id} className="border-t border-line pt-3">
                          <p>Page: <a href={issue.pageUrl} target="_blank" rel="noreferrer" className="break-all">{issue.pageUrl}</a></p>
                          <p>
                            Where to fix: <code className="break-all">{issue.selector}</code>{" "}
                            <CopyButton text={issue.selector} label="Copy selector" />{" "}
                            <CopyButton
                              text={`inspect(document.querySelector(${JSON.stringify(issue.selector)}))`}
                              label="Copy DevTools command"
                            />
                          </p>
                          <pre><code>{issue.html}</code></pre>
                          <p style={{ whiteSpace: "pre-line" }}>{issue.summary}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );
}