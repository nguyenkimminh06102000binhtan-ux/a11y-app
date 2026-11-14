import { cache } from "react";
import { db, pages, eq } from "@app/db";
import { pagesUsedThisMonth } from "./quota";

export type Page = typeof pages.$inferSelect;

/** A site's Pages list, homepage first (alphabetical by URL). Call only after getOwnedSite(). */
export const getSitePages = cache(async (siteId: string): Promise<Page[]> => {
  return db.select().from(pages).where(eq(pages.siteId, siteId)).orderBy(pages.url);
});

/** The page URLs this site has used this month (see pagesUsedThisMonth in quota.ts). cache() = once per request. */
export const getPagesScannedThisMonth = cache((siteId: string) => pagesUsedThisMonth(db, siteId));

export { pageLabel } from "./page-label";
