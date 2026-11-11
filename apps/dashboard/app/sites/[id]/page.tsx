import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, sites, scans, issues, eq, and, desc } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { CopyButton } from "@/components/CopyButton";

const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Issue = typeof issues.$inferSelect;

export default function SitePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main>
      <p><Link href="/">← All sites</Link></p>
      <Suspense fallback={<p>Loading site…</p>}>
        <SiteDetails params={params} />
      </Suspense>
    </main>
  );
}

async function SiteDetails({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound(); // a malformed id would otherwise crash the database query

  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id))); // ownership check
  if (!site) notFound();

  const [scan] = await db
    .select()
    .from(scans)
    .where(eq(scans.siteId, site.id))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  const rows: Issue[] = scan
    ? await db.select().from(issues).where(eq(issues.scanId, scan.id))
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

      {!scan ? (
        <p>No scans yet.</p>
      ) : (
        <>
          <section aria-labelledby="scan-heading">
            <h2 id="scan-heading">Latest scan</h2>
            <p>
              {scan.url} · {scan.status}
              {scan.finishedAt &&
                ` · ${scan.finishedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`}
            </p>
            {scan.status === "failed" && <p role="alert">Scan failed: {scan.error}</p>}
            <ul>
              {["critical", "serious", "moderate", "minor"].map((level) => (
                <li key={level}>{level}: {counts[level] ?? 0}</li>
              ))}
            </ul>
          </section>

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
        </>
      )}
    </>
  );
}
