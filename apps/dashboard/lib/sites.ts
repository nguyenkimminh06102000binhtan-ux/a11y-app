import { cache } from "react";
import { redirect } from "next/navigation";
import { db, sites, eq, and, sql, ilike, count } from "@app/db";
import { getCurrentUser } from "./auth";

export type SiteSummary = {
  id: string;
  domain: string;
  pagesChecked: number; // pages on the list with a successful scan
  open: number; // current issues on those pages (each page's latest successful scan), as on Overview
  critical: number;
  scanning: boolean; // a scan is queued or running
  lastScan: { status: "queued" | "running" | "done" | "failed"; at: Date } | null; // the newest scan, any status
};

export const SITES_PER_PAGE = 25;

export type SitesPage = {
  sites: SiteSummary[];
  total: number; // sites matching the search, all pages
  page: number; // 1-based, clamped to the pages that exist
  pages: number;
  perPage: number;
};

/** "50%_off" typed in search must match literally: escape LIKE's wildcards. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * One page of the signed-in account's sites (A–Z, optionally only domains containing `search`), with the numbers
 * the Sites list shows. The numbers are worked out for that page's sites only, so the cost doesn't grow with the
 * number of sites. Same rules as getLatestAudit(): only pages on the site's Pages list count, each by its latest
 * successful scan. cache() = once per request.
 */
export const getSitesPage = cache(async (requestedPage: number, search: string): Promise<SitesPage> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const where = search
    ? and(eq(sites.accountId, user.id), ilike(sites.domain, likePattern(search)))
    : eq(sites.accountId, user.id);
  const [{ total }] = await db.select({ total: count() }).from(sites).where(where);
  const pages = Math.max(1, Math.ceil(total / SITES_PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), pages);

  const siteRows = await db
    .select({ id: sites.id, domain: sites.domain })
    .from(sites)
    .where(where)
    .orderBy(sites.domain)
    .limit(SITES_PER_PAGE)
    .offset((page - 1) * SITES_PER_PAGE);
  if (siteRows.length === 0) return { sites: [], total, page, pages, perPage: SITES_PER_PAGE };

  // Only this page's sites (their ids come from the account-scoped query above)
  const ids = sql.join(
    siteRows.map((s) => sql`${s.id}::uuid`),
    sql`, `
  );
  const [issueRows, scanRows] = await Promise.all([
    db.execute<{ site_id: string; pages_checked: number; open: number; critical: number }>(sql`
      with current_scans as (
        select distinct on (sc.site_id, sc.url) sc.id, sc.site_id
        from scans sc
        join pages p on p.site_id = sc.site_id and p.url = sc.url
        where sc.site_id in (${ids}) and sc.status = 'done'
        order by sc.site_id, sc.url, sc.created_at desc
      )
      select c.site_id,
             count(distinct c.id)::int as pages_checked,
             count(i.id)::int as open,
             (count(i.id) filter (where i.impact = 'critical'))::int as critical
      from current_scans c
      left join issues i on i.scan_id = c.id
      group by c.site_id`),

    db.execute<{ site_id: string; status: "queued" | "running" | "done" | "failed"; at: Date | string; scanning: boolean }>(sql`
      select distinct on (sc.site_id) sc.site_id, sc.status,
             coalesce(sc.finished_at, sc.created_at) as at,
             exists (select 1 from scans a where a.site_id = sc.site_id and a.status in ('queued', 'running')) as scanning
      from scans sc
      where sc.site_id in (${ids})
      order by sc.site_id, sc.created_at desc`),
  ]);

  const issuesBySite = new Map([...issueRows].map((r) => [r.site_id, r]));
  const scanBySite = new Map([...scanRows].map((r) => [r.site_id, r]));
  return {
    total,
    page,
    pages,
    perPage: SITES_PER_PAGE,
    sites: siteRows.map((site) => {
      const i = issuesBySite.get(site.id);
      const s = scanBySite.get(site.id);
      return {
        ...site,
        pagesChecked: i?.pages_checked ?? 0,
        open: i?.open ?? 0,
        critical: i?.critical ?? 0,
        scanning: !!s?.scanning,
        lastScan: s ? { status: s.status, at: new Date(s.at) } : null,
      };
    }),
  };
});

/** How many sites the account has (the Sites header). cache() = once per request. */
export const getSiteCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ total }] = await db.select({ total: count() }).from(sites).where(eq(sites.accountId, user.id));
  return total;
});
