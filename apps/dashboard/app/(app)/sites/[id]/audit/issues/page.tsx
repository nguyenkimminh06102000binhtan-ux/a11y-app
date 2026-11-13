import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit, type Issue } from "@/lib/audit";
import { CopyButton } from "@/components/CopyButton";
import { ImpactPill } from "@/components/ImpactPill";

export const metadata: Metadata = { title: "Issues · Audit" };

const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/** Audit › Issues: every checked page's current issues (from its latest scan), grouped by rule, most severe first. */
export default function IssuesPage({ params }: PageProps<"/sites/[id]/audit/issues">) {
  return (
    <Suspense
      fallback={
        <>
          <h2 className="mt-0">Issues</h2>
          <p>Loading issues…</p>
        </>
      }
    >
      <Issues params={params} />
    </Suspense>
  );
}

async function Issues({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const { rows, pagesChecked } = await getLatestAudit(site.id);

  if (pagesChecked === 0) {
    return (
      <>
        <h2 className="mt-0">Issues</h2>
        <p>
          No finished scan yet. <Link href={`/sites/${site.id}/audit`}>Run a scan from Overview</Link>.
        </p>
      </>
    );
  }

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

  return (
    <>
      <h2 className="mt-0">Issues ({rows.length})</h2>
      <p className="mb-4 text-muted">
        Across the {pagesChecked} {pagesChecked === 1 ? "page" : "pages"} checked so far, each from its latest scan.
      </p>
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
    </>
  );
}
