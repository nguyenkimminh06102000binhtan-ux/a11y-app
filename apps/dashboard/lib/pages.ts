import { cache } from "react";
import { db, pages, scans, eq, and, gte, inArray } from "@app/db";
import { monthStartUtc } from "./month";

export type Page = typeof pages.$inferSelect;

/** A site's Pages list, homepage first (alphabetical by URL). Call only after getOwnedSite(). */
export const getSitePages = cache(async (siteId: string): Promise<Page[]> => {
  return db.select().from(pages).where(eq(pages.siteId, siteId)).orderBy(pages.url);
});

/**
 * The page URLs of a site scanned this month (UTC), counting queued, running and finished scans: a page whose
 * scans this month all failed doesn't count. These pages use the month's quota and can't be removed until it resets.
 */
export const getPagesScannedThisMonth = cache(async (siteId: string): Promise<Set<string>> => {
  const rows = await db
    .selectDistinct({ url: scans.url })
    .from(scans)
    .where(
      and(eq(scans.siteId, siteId), gte(scans.createdAt, monthStartUtc()), inArray(scans.status, ["queued", "running", "done"]))
    );
  return new Set(rows.map((r) => r.url));
});

/** How a page is shown: its path (and query), or host + path when the host isn't the site's plain domain (www.). */
export function pageLabel(url: string, siteDomain: string): string {
  const u = new URL(url);
  const path = `${u.pathname}${u.search}`;
  return u.hostname === siteDomain ? path : `${u.hostname}${path}`;
}
