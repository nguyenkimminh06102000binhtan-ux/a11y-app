import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedSite } from "@/lib/site";
import { getSitePages, pageLabel } from "@/lib/pages";
import { getLatestRun, describeScanError } from "@/lib/runs";
import { changesText, formatDuration, formatRunTime, getRun, runStatus, type RunPage } from "@/lib/scans";
import { isUuid } from "@/lib/ids";
import { ScanProgress } from "@/components/ScanProgress";
import { NotYet } from "@/components/RunList";

export const metadata: Metadata = { title: "Scan · Audit" };

/** Audit › Scans › one run: when, how long, the totals, then each page's result and what changed on it. */
export default function RunPageRoute({ params }: PageProps<"/sites/[id]/audit/scans/[run]">) {
  return (
    <Suspense fallback={<p>Loading scan…</p>}>
      <Run params={params} />
    </Suspense>
  );
}

function pageResult(page: RunPage): string {
  if (page.status === "queued") return "Waiting";
  if (page.status === "running") return "Checking now…";
  if (page.status === "failed") return `Failed: ${describeScanError(page.error)}`;
  return `${page.issues.toLocaleString("en-US")} ${page.issues === 1 ? "issue" : "issues"}`;
}

function pageChanges(page: RunPage): string | null {
  if (page.status !== "done") return null;
  if (page.firstScan) return "First scan";
  if (page.added === 0 && page.fixed === 0) return "No changes";
  return `${page.added} new · ${page.fixed} fixed`;
}

async function Run({ params }: { params: Promise<{ id: string; run: string }> }) {
  const { id, run: key } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  if (!isUuid(key)) notFound();
  const [found, sitePages, latest] = await Promise.all([getRun(site.id, key), getSitePages(site.id), getLatestRun(site.id)]);
  if (!found) notFound(); // not a run of this site
  const { summary, pages } = found;

  const scansHref = `/sites/${site.id}/audit/scans`;
  const pageIds = new Map(sitePages.map((p) => [p.url, p.id]));
  const label = (url: string) => pageLabel(url, site.domain);

  const facts: [string, React.ReactNode][] = [
    ["Status", runStatus(summary)],
    ["Took", summary.finishedAt ? formatDuration(summary.startedAt, summary.finishedAt) : "Still going"],
    [
      "Pages",
      `${summary.done} of ${summary.total} checked${summary.failed > 0 ? ` · ${summary.failed} failed` : ""}`,
    ],
    ["Issues found", summary.done > 0 ? summary.issues.toLocaleString("en-US") : <NotYet key="n" />],
    ["Changes", changesText(summary) ?? <NotYet key="c" />],
  ];

  /** The page's current issues on Audit › Issues, if it's still on the Pages list */
  const issuesLink = (page: RunPage) => {
    const pageId = pageIds.get(page.url);
    if (!pageId || page.status !== "done") return null;
    return (
      <Link href={`/sites/${site.id}/audit/issues?page=${pageId}`} className="inline-flex min-h-11 items-center font-bold">
        <span>
          See current issues<span className="sr-only"> on {label(page.url)}</span>
        </span>
      </Link>
    );
  };

  return (
    <section aria-labelledby="run-heading" className="flex flex-col gap-5">
      <div>
        <Link href={scansHref} className="inline-flex min-h-11 items-center">
          <span aria-hidden="true">‹&nbsp;</span>All scans
        </Link>
        <h2 id="run-heading" className="mt-1 mb-0">
          Scan from {formatRunTime(summary.startedAt)}
        </h2>
      </div>

      {latest?.key === summary.key && latest.active && (
        <ScanProgress siteId={site.id} domain={site.domain} initial={latest} />
      )}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 sm:grid-cols-[repeat(5,auto)] sm:grid-rows-[auto_auto] sm:grid-flow-col sm:justify-start">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-small text-muted">{term}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-lg">Pages in this scan</h3>
        <p className="m-0 text-small text-muted">
          New and fixed compare each page with its previous scan. &ldquo;See current issues&rdquo; shows what&apos;s open on
          the page now, which can differ if it was scanned again later.
        </p>

        <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
          <table className="w-full text-left">
            <caption className="sr-only">Pages in this scan</caption>
            <thead className="bg-subtle text-small text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Page</th>
                <th scope="col" className="px-4 py-3 font-normal">Result</th>
                <th scope="col" className="px-4 py-3 font-normal">Changes</th>
                <th scope="col" className="px-4 py-3 font-normal">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.scanId} className="border-t border-line align-middle">
                  <th scope="row" className="px-4 py-3 font-bold wrap-anywhere">{label(page.url)}</th>
                  <td className="px-4 py-3">{pageResult(page)}</td>
                  <td className="px-4 py-3 text-small">{pageChanges(page) ?? <NotYet />}</td>
                  <td className="px-4 py-1">{issuesLink(page)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="flex flex-col gap-3 lg:hidden" aria-label="Pages in this scan">
          {pages.map((page) => (
            <li key={page.scanId} className="rounded-xl border border-line bg-surface p-4">
              <h4 className="m-0 text-base wrap-anywhere">{label(page.url)}</h4>
              <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
                <dt className="text-muted">Result</dt>
                <dd>{pageResult(page)}</dd>
                <dt className="text-muted">Changes</dt>
                <dd>{pageChanges(page) ?? <NotYet />}</dd>
              </dl>
              {issuesLink(page) && <div className="mt-1">{issuesLink(page)}</div>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
