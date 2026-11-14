import { cache } from "react";
import { db, scans, issues, eq, and, desc, inArray } from "@app/db";
import { getSitePages } from "./pages";

export type Issue = typeof issues.$inferSelect;

// Enough history for any site today (each page needs only its last two successful scans).
const HISTORY_LIMIT = 1000;

/**
 * The site's audit as of now, across the pages on its Pages list: for every one that has been checked, the issues
 * from its latest successful scan. So scanning one page never hides the others' issues, and a page removed from
 * the list drops out of the results.
 *   latest / inProgress: the newest scan of any status (progress card)
 *   lastFinished:        the newest finished scan (the "didn't finish" card when it failed)
 *   rows:                current issues of every checked page
 *   comparison:          fixed / new since each page's previous successful check (null until a page is re-checked)
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

  // Successful scans, newest first: the first one per page is its current state, the second its previous check
  const done = await db
    .select({ id: scans.id, url: scans.url, finishedAt: scans.finishedAt })
    .from(scans)
    .where(and(eq(scans.siteId, siteId), eq(scans.status, "done")))
    .orderBy(desc(scans.createdAt))
    .limit(HISTORY_LIMIT);

  const onList = new Set((await getSitePages(siteId)).map((p) => p.url));
  const current = new Map<string, (typeof done)[number]>();
  const previous = new Map<string, (typeof done)[number]>();
  for (const scan of done) {
    if (!onList.has(scan.url)) continue;
    if (!current.has(scan.url)) current.set(scan.url, scan);
    else if (!previous.has(scan.url)) previous.set(scan.url, scan);
  }

  const currentIds = [...current.values()].map((s) => s.id);
  const rows: Issue[] = currentIds.length ? await db.select().from(issues).where(inArray(issues.scanId, currentIds)) : [];

  const lastCheckedAt = [...current.values()]
    .map((s) => s.finishedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    latest,
    lastFinished,
    inProgress: latest?.status === "queued" || latest?.status === "running",
    rows,
    pagesChecked: current.size,
    lastCheckedAt,
    /** When each checked page was last scanned successfully, by URL (Audit › Pages) */
    lastCheckedByUrl: new Map([...current].map(([url, scan]) => [url, scan.finishedAt])),
    comparison: await compareWithPrevious(current, previous, rows),
  };
});

/**
 * Fixed and new issues on the pages that have been checked more than once, each page against its own previous
 * successful check, matched by fingerprint (the scanner gives the same issue the same fingerprint every time).
 */
async function compareWithPrevious(
  current: Map<string, { id: string }>,
  previous: Map<string, { id: string }>,
  rows: Issue[]
) {
  if (previous.size === 0) return null;

  const previousIds = [...previous.values()].map((s) => s.id);
  const before = await db
    .select({ scanId: issues.scanId, fingerprint: issues.fingerprint })
    .from(issues)
    .where(inArray(issues.scanId, previousIds));

  let fixed = 0;
  let added = 0;
  for (const [url, prev] of previous) {
    const was = new Set(before.filter((r) => r.scanId === prev.id).map((r) => r.fingerprint));
    const scanId = current.get(url)!.id;
    const now = new Set(rows.filter((r) => r.scanId === scanId).map((r) => r.fingerprint));
    fixed += [...was].filter((f) => !now.has(f)).length;
    added += [...now].filter((f) => !was.has(f)).length;
  }
  return { fixed, new: added, pagesCompared: previous.size };
}
