import { cache } from "react";
import { db, scans, eq, and, gte, inArray } from "@app/db";
import { monthStartUtc, nextMonthStartUtc } from "./month";

/**
 * PLACEHOLDER until plans exist: the monthly page limit of a site with no limit of its own. Plans will set the real
 * numbers (there will be several); change getMonthlyPageLimit() then, and never write a number in screens or messages.
 */
export const DEFAULT_MONTHLY_PAGE_LIMIT = 25;

/** How many different pages this site may scan per month (UTC). The one place that decides it. */
export function getMonthlyPageLimit(site: { monthlyPageLimit: number | null }): number {
  return site.monthlyPageLimit ?? DEFAULT_MONTHLY_PAGE_LIMIT;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The page URLs a site has used this month (UTC): those with a queued, running or finished scan. A page whose scans
 * this month all failed hasn't used a slot. Pages used this month rescan for free, can't be removed, and don't
 * free their slot until the month ends. Pass the transaction when checking before starting a scan.
 */
export async function pagesUsedThisMonth(executor: typeof db | Tx, siteId: string): Promise<Set<string>> {
  const rows = await executor
    .selectDistinct({ url: scans.url })
    .from(scans)
    .where(
      and(eq(scans.siteId, siteId), gte(scans.createdAt, monthStartUtc()), inArray(scans.status, ["queued", "running", "done"]))
    );
  return new Set(rows.map((r) => r.url));
}

export type Quota = { limit: number; used: Set<string>; left: number; resetsOn: Date };

/** The site's quota right now. cache() = once per request. Call only after getOwnedSite(). */
export const getQuota = cache(async (site: { id: string; monthlyPageLimit: number | null }): Promise<Quota> => {
  const limit = getMonthlyPageLimit(site);
  const used = await pagesUsedThisMonth(db, site.id);
  return { limit, used, left: Math.max(0, limit - used.size), resetsOn: nextMonthStartUtc() };
});
