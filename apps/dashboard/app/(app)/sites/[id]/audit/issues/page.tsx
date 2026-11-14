import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { getSitePages } from "@/lib/pages";
import { pageLabel } from "@/lib/page-label";
import { countByImpact, filterByPageAndSearch, groupByRule, issuesHref, readIssueParams } from "@/lib/issues";
import { IssueFilters } from "@/components/IssueFilters";
import { IssueDetail } from "@/components/IssueDetail";
import { ImpactPill } from "@/components/ImpactPill";

export const metadata: Metadata = { title: "Issues · Audit" };

/**
 * Audit › Issues: every listed page's current issues (from its latest scan), as problems (one per rule) with a
 * detail panel: where it is, one place at a time, and how to fix it. Filters and selection live in the URL:
 * ?impact=&page=&q=&rule=&place=
 */
export default function IssuesPage({ params, searchParams }: PageProps<"/sites/[id]/audit/issues">) {
  return (
    <>
      <h2 className="mt-0">Issues</h2>
      <Suspense fallback={<p>Loading issues…</p>}>
        <Issues params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Issues({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const p = readIssueParams(await searchParams);
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const [{ rows, pagesChecked }, sitePages] = await Promise.all([getLatestAudit(site.id), getSitePages(site.id)]);
  const base = `/sites/${site.id}/audit/issues`;

  if (pagesChecked === 0) {
    return (
      <p>
        No pages checked yet. <Link href={`/sites/${site.id}/audit/pages`}>Choose pages to scan</Link>.
      </p>
    );
  }

  const pageUrl = sitePages.find((page) => page.id === p.page)?.url;
  const searched = filterByPageAndSearch(rows, pageUrl, p.q);
  const counts = countByImpact(searched);
  const groups = groupByRule(p.impact ? searched.filter((r) => r.impact === p.impact) : searched);

  const filters = { impact: p.impact, page: pageUrl ? p.page : undefined, q: p.q };
  const selected = groups.find((g) => g.ruleId === p.rule) ?? groups[0];
  const place = selected ? Math.min(p.place ?? 1, selected.places.length) : 1;

  return (
    <div className="flex flex-col gap-5">
      <p className="-mt-1 text-muted">
        {rows.length} {rows.length === 1 ? "issue" : "issues"} across the {pagesChecked} {pagesChecked === 1 ? "page" : "pages"} checked,
        grouped by problem. Choose one to see where it is and how to fix it.
      </p>

      <IssueFilters
        base={base}
        params={filters}
        counts={counts}
        pages={sitePages.map((page) => ({ id: page.id, label: pageLabel(page.url, site.domain) }))}
      />

      {groups.length === 0 ? (
        <p>
          {rows.length === 0 ? "No issues found on the checked pages." : "No issues match these filters."}{" "}
          {rows.length > 0 && (
            <Link href={base} scroll={false}>
              Clear filters
            </Link>
          )}
        </p>
      ) : (
        // Side by side from 1280px; stacked below (list first, then the detail)
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
          <nav aria-label="Problems">
            <p className="mb-2 text-small text-muted">
              {groups.length} {groups.length === 1 ? "problem" : "problems"}
            </p>
            <ul className="overflow-hidden rounded-xl border border-line">
              {groups.map((g, i) => {
                const current = g === selected;
                return (
                  <li key={g.ruleId} className={i > 0 ? "border-t border-line" : ""}>
                    <Link
                      href={issuesHref(base, { ...filters, rule: g.ruleId })}
                      scroll={false}
                      aria-current={current ? "true" : undefined}
                      className={`flex flex-col items-start gap-1 px-4 py-3 text-ink no-underline ${
                        current ? "bg-subtle shadow-[inset_4px_0_0_var(--color-state)]" : "hover:bg-subtle"
                      }`}
                    >
                      <ImpactPill impact={g.impact} />
                      <span className="font-bold wrap-anywhere">{g.title}</span>
                      <span className="text-small text-muted">
                        {g.places.length} {g.places.length === 1 ? "place" : "places"} · {g.pages} {g.pages === 1 ? "page" : "pages"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected && (
            <IssueDetail
              group={selected}
              place={place}
              domain={site.domain}
              placeHref={(n) => issuesHref(base, { ...filters, rule: selected.ruleId, place: n })}
              focus={!!(p.rule || p.place)}
            />
          )}
        </div>
      )}
    </div>
  );
}
