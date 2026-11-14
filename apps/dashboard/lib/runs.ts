import { cache } from "react";
import { db, scans, eq, desc } from "@app/db";

/**
 * A scan run: the pages started together by one "Scan N pages" click (scans sharing a batch_id). Older scans
 * without a batch are a run of one. Shared by the progress card and /api/sites/:id/scan-status.
 */
export type Run = {
  key: string; // the batch id (or the scan id for a run of one): a new key = a new run
  total: number;
  done: number;
  failed: number;
  current: string | null; // the page being checked now
  issueCount: number; // found so far, on the pages done
  active: boolean;
  failures: { url: string; error: string | null }[];
};

/** The site's latest run, or null when it has never been scanned. Call only after the ownership check. */
export const getLatestRun = cache(async (siteId: string): Promise<Run | null> => {
  const [latest] = await db.select().from(scans).where(eq(scans.siteId, siteId)).orderBy(desc(scans.createdAt)).limit(1);
  if (!latest) return null;
  const members = latest.batchId ? await db.select().from(scans).where(eq(scans.batchId, latest.batchId)) : [latest];

  const done = members.filter((s) => s.status === "done");
  const failed = members.filter((s) => s.status === "failed");
  return {
    key: latest.batchId ?? latest.id,
    total: members.length,
    done: done.length,
    failed: failed.length,
    current: members.find((s) => s.status === "running")?.url ?? null,
    issueCount: done.reduce((n, s) => n + s.issueCount, 0),
    active: members.some((s) => s.status === "queued" || s.status === "running"),
    failures: failed.map((s) => ({ url: s.url, error: s.error })),
  };
});

/**
 * A scan error in plain words for site owners. The worker stores the browser's raw message ("page.goto:
 * net::ERR_NAME_NOT_RESOLVED at … Call log: …"); show what it means, not the stack.
 */
export function describeScanError(error: string | null): string {
  if (!error) return "Something went wrong while checking it.";
  const known: [RegExp, string][] = [
    [/ERR_NAME_NOT_RESOLVED/, "The address couldn't be found. Check the page address and the domain's DNS."],
    [/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED/, "The site refused the connection or closed it."],
    [/ERR_CERT|SSL|certificate/i, "The site's HTTPS certificate isn't valid."],
    [/Timeout|timed out/i, "The page took too long to load."],
    [/ERR_UNSAFE_PORT|ERR_ADDRESS_INVALID|ERR_INVALID_URL/, "That address can't be opened by a browser."],
    [/ERR_TOO_MANY_REDIRECTS/, "The page redirects in a loop."],
    [/is not on /, "That page isn't on this site's domain."],
  ];
  for (const [pattern, text] of known) if (pattern.test(error)) return text;
  // Unknown: the first line, without the browser's prefix and call log
  return error.split("\n")[0].replace(/^page\.\w+:\s*/, "").slice(0, 200);
}
