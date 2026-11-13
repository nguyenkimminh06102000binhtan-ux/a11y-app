import { cache } from "react";
import { db, scans, issues, eq, and, desc, inArray } from "@app/db";

export type Issue = typeof issues.$inferSelect;

/**
 * What the Audit pages show for a site: the latest scan (any status, for progress), the latest finished scan
 * (whose results we show) and that scan's issues.
 * cache() = once per request, shared by the Audit layout (the Issues count) and its pages.
 * Call it only after getOwnedSite(), which checks the site is this account's.
 */
export const getLatestAudit = cache(async (siteId: string) => {
  const [latest] = await db
    .select()
    .from(scans)
    .where(eq(scans.siteId, siteId))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  const [lastFinished] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.siteId, siteId), inArray(scans.status, ["done", "failed"])))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  const rows: Issue[] =
    lastFinished?.status === "done" ? await db.select().from(issues).where(eq(issues.scanId, lastFinished.id)) : [];

  return {
    latest,
    lastFinished,
    rows,
    inProgress: latest?.status === "queued" || latest?.status === "running",
  };
});
