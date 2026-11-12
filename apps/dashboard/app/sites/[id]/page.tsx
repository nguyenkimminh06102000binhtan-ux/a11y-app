import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, sites, scans, issues, eq, and, desc, inArray } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requestScan } from "@/app/actions";

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

export default function SitePage({ params, searchParams }: PageProps) {
  return (
    <main>
      <p><Link href="/">← All sites</Link></p>
      <Suspense fallback={<p>Loading site…</p>}>
        <SiteDetails params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SiteDetails({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound(); // a malformed id would otherwise crash the database query

  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id))); // ownership check
  if (!site) notFound();

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
      <h1>{site.domain}</h1>

      <section aria-labelledby="run-heading">
        <h2 id="run-heading">Run a scan</h2>
        {error && ERRORS[error] && <p role="alert">{ERRORS[error]}</p>}
        <form action={requestScan}>
          <input type="hidden" name="siteId" value={site.id} />
          <label htmlFor="url">Page to scan</label>
          <input id="url" name="url" type="url" defaultValue={`https://${site.domain}/`} required />
          <button type="submit" disabled={inProgress}>Scan now</button>
        </form>
        {inProgress && latest && (
          <>
            <p role="status">
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
              <ul>
                {["critical", "serious", "moderate", "minor"].map((level) => (
                  <li key={level}>{level}: {counts[level] ?? 0}</li>
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
                  <details key={first.ruleId}>
                    <summary>
                      <strong>[{first.impact ?? "unknown"}]</strong> {first.help ?? first.ruleId} ({group.length})
                    </summary>
                    {first.helpUrl && (
                      <p><a href={first.helpUrl} target="_blank" rel="noreferrer">How to fix this rule (opens in new tab)</a></p>
                    )}
                    <ol>
                      {group.map((issue) => (
                        <li key={issue.id}>
                          <p>Page: <a href={issue.pageUrl} target="_blank" rel="noreferrer">{issue.pageUrl}</a></p>
                          <p>
                            Element: <code>{issue.selector}</code>{" "}
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