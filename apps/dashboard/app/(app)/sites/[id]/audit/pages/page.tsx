import { Suspense } from "react";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { getSitePages, getPagesScannedThisMonth, pageLabel } from "@/lib/pages";
import { nextMonthStartUtc, formatResetDate } from "@/lib/month";
import { AddPagesPanel } from "@/components/AddPagesPanel";
import { RemovePageButton } from "@/components/RemovePageButton";
import { FocusedAlert } from "@/components/FocusedAlert";

export const metadata: Metadata = { title: "Pages · Audit" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ removed?: string; n?: string; error?: string }>;
};

/** Audit › Pages: the pages the owner wants checked. Scanning from here (checkboxes, quota) comes next. */
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

type Row = {
  id: string;
  label: string;
  open: number;
  critical: number;
  lastChecked: string | null;
  locked: boolean; // scanned this month: stays until the quota resets
};

async function PagesContent({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { removed, n, error } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const [pages, scannedThisMonth, audit] = await Promise.all([
    getSitePages(site.id),
    getPagesScannedThisMonth(site.id),
    getLatestAudit(site.id),
  ]);
  const resetsOn = formatResetDate(nextMonthStartUtc());

  const rows: Row[] = pages.map((page) => {
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
      locked: scannedThisMonth.has(page.url),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="-mt-1 text-muted">
        The pages you want checked on {site.domain}. Add as many as you like: your plan limits how many different pages
        you scan each month.
      </p>

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
        <>
          {/* Wide screens: a table, so screen readers announce the column for each value. "relative" keeps the
              visually hidden caption and header text inside this scroll box (otherwise they widen the page). */}
          <div className="relative hidden overflow-x-auto rounded-xl border border-line md:block">
            <table className="w-full text-left">
              <caption className="sr-only">Pages on {site.domain}</caption>
              <thead className="bg-subtle text-small text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">Page</th>
                  <th scope="col" className="px-4 py-3 font-normal">Open issues</th>
                  <th scope="col" className="px-4 py-3 font-normal">Critical</th>
                  <th scope="col" className="px-4 py-3 font-normal">Last checked</th>
                  <th scope="col" className="px-4 py-3 font-normal"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line align-middle">
                    <th scope="row" className="px-4 py-3 font-bold wrap-anywhere">{row.label}</th>
                    <td className="px-4 py-3">{row.lastChecked ? row.open : <NotYet />}</td>
                    <td className="px-4 py-3">{row.lastChecked ? row.critical : <NotYet />}</td>
                    <td className="px-4 py-3 text-small text-muted">{row.lastChecked ?? "Not checked yet"}</td>
                    <td className="px-4 py-2 text-right">
                      <RowAction row={row} resetsOn={resetsOn} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one labelled card per page */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label={`Pages on ${site.domain}`}>
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-line p-4">
                <p className="font-bold wrap-anywhere">{row.label}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-small">
                  <dt className="text-muted">Open issues</dt>
                  <dd>{row.lastChecked ? row.open : "–"}</dd>
                  <dt className="text-muted">Critical</dt>
                  <dd>{row.lastChecked ? row.critical : "–"}</dd>
                  <dt className="text-muted">Last checked</dt>
                  <dd>{row.lastChecked ?? "Not checked yet"}</dd>
                </dl>
                <div className="mt-2">
                  <RowAction row={row} resetsOn={resetsOn} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NotYet() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">not checked yet</span>
    </>
  );
}

/** Remove, or why it can't be removed yet (pages scanned this month stay until the quota resets). */
function RowAction({ row, resetsOn }: { row: Row; resetsOn: string }) {
  if (row.locked) {
    return <span className="text-caption text-muted">Scanned this month: removable from {resetsOn}</span>;
  }
  return <RemovePageButton pageId={row.id} label={row.label} />;
}
