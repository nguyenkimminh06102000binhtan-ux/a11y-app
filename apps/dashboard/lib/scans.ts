import { cache } from "react";
import { db, sql } from "@app/db";

/*
 * Scan history for Audit › Scans. A run = the pages started together by one "Scan N pages" click (scans sharing a
 * batch_id); an older scan without a batch is a run of one. A run's key is its batch id, or the scan id.
 *
 * New / fixed: each page in a run is compared with that page's previous successful scan, by issue fingerprint
 * (same issue = same fingerprint across scans). A page with no earlier scan is "first scanned", not "new issues".
 */

export type ScanStatus = "queued" | "running" | "done" | "failed";

export type RunChanges = {
  compared: number; // pages that had an earlier successful scan to compare with
  added: number; // issues not there last time
  fixed: number; // issues there last time, gone now
};

export type RunSummary = {
  key: string;
  startedAt: Date;
  finishedAt: Date | null; // null while it's still going
  total: number;
  done: number;
  failed: number;
  active: boolean;
  issues: number; // found on the pages checked
  changes: RunChanges;
};

export type RunPage = {
  scanId: string;
  url: string;
  status: ScanStatus;
  issues: number;
  error: string | null;
  firstScan: boolean; // done, with no earlier successful scan of this page
  added: number;
  fixed: number;
};

export const RUNS_PER_PAGE = 25;

const NO_CHANGES: RunChanges = { compared: 0, added: 0, fixed: 0 };

type ScanChangeRow = { key: string; scan_id: string; first_scan: boolean; added: number; fixed: number };

/**
 * New and fixed issues for the successful scans in these runs, per scan. Only these runs' scans are compared
 * (each against its page's previous successful scan), so the cost follows what's on screen.
 */
async function scanChanges(siteId: string, keys: string[]): Promise<ScanChangeRow[]> {
  if (keys.length === 0) return [];
  const list = sql.join(
    keys.map((k) => sql`${k}::uuid`),
    sql`, `
  );
  const rows = await db.execute<ScanChangeRow>(sql`
    with cur as (
      select s.id, s.url, s.created_at, coalesce(s.batch_id, s.id) as key
      from scans s
      where s.site_id = ${siteId} and s.status = 'done' and coalesce(s.batch_id, s.id) in (${list})
    ),
    pairs as (
      select c.key, c.id as cur_id, p.id as prev_id
      from cur c
      left join lateral (
        select s.id from scans s
        where s.site_id = ${siteId} and s.url = c.url and s.status = 'done' and s.created_at < c.created_at
        order by s.created_at desc
        limit 1
      ) p on true
    )
    select pr.key::text as key,
           pr.cur_id::text as scan_id,
           pr.prev_id is null as first_scan,
           case when pr.prev_id is null then 0 else (
             select count(distinct i.fingerprint) from issues i
             where i.scan_id = pr.cur_id
               and not exists (select 1 from issues j where j.scan_id = pr.prev_id and j.fingerprint = i.fingerprint)
           ) end::int as added,
           case when pr.prev_id is null then 0 else (
             select count(distinct j.fingerprint) from issues j
             where j.scan_id = pr.prev_id
               and not exists (select 1 from issues i where i.scan_id = pr.cur_id and i.fingerprint = j.fingerprint)
           ) end::int as fixed
    from pairs pr`);
  return [...rows];
}

const toDate = (value: Date | string | null) => (value === null ? null : new Date(value));

/** One page of a site's runs, newest first. Call only after the ownership check (getOwnedSite). */
export const getRunsPage = cache(async (siteId: string, requestedPage: number) => {
  const [{ total }] = await db.execute<{ total: number }>(sql`
    select count(distinct coalesce(batch_id, id))::int as total from scans where site_id = ${siteId}`);
  const pages = Math.max(1, Math.ceil(total / RUNS_PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), pages);

  const rows = await db.execute<{
    key: string;
    started_at: Date | string;
    finished_at: Date | string | null;
    total: number;
    done: number;
    failed: number;
    active: number;
    issues: number;
  }>(sql`
    select coalesce(batch_id, id)::text as key,
           min(coalesce(started_at, created_at)) as started_at,
           max(finished_at) as finished_at,
           count(*)::int as total,
           (count(*) filter (where status = 'done'))::int as done,
           (count(*) filter (where status = 'failed'))::int as failed,
           (count(*) filter (where status in ('queued', 'running')))::int as active,
           coalesce(sum(issue_count) filter (where status = 'done'), 0)::int as issues
    from scans
    where site_id = ${siteId}
    group by coalesce(batch_id, id)
    order by min(created_at) desc, coalesce(batch_id, id)
    limit ${RUNS_PER_PAGE} offset ${(page - 1) * RUNS_PER_PAGE}`);

  const changes = new Map<string, RunChanges>();
  for (const c of await scanChanges(siteId, rows.map((r) => r.key))) {
    const sum = changes.get(c.key) ?? { ...NO_CHANGES };
    if (!c.first_scan) {
      sum.compared += 1;
      sum.added += c.added;
      sum.fixed += c.fixed;
    }
    changes.set(c.key, sum);
  }

  const runs: RunSummary[] = rows.map((r) => ({
    key: r.key,
    startedAt: new Date(r.started_at),
    finishedAt: r.active > 0 ? null : toDate(r.finished_at),
    total: r.total,
    done: r.done,
    failed: r.failed,
    active: r.active > 0,
    issues: r.issues,
    changes: changes.get(r.key) ?? NO_CHANGES,
  }));
  return { runs, total, page, pages, perPage: RUNS_PER_PAGE };
});

/** One run with its pages, or null if this site has no run with that key. Call only after the ownership check. */
export const getRun = cache(async (siteId: string, key: string) => {
  const scans = await db.execute<{
    id: string;
    url: string;
    status: ScanStatus;
    issue_count: number;
    error: string | null;
    created_at: Date | string;
    started_at: Date | string | null;
    finished_at: Date | string | null;
  }>(sql`
    select id::text, url, status, issue_count, error, created_at, started_at, finished_at
    from scans
    where site_id = ${siteId} and coalesce(batch_id, id) = ${key}::uuid
    order by created_at, url`);
  if (scans.length === 0) return null;

  const byScan = new Map((await scanChanges(siteId, [key])).map((c) => [c.scan_id, c]));
  const pages: RunPage[] = scans.map((s) => {
    const c = byScan.get(s.id);
    return {
      scanId: s.id,
      url: s.url,
      status: s.status,
      issues: s.status === "done" ? s.issue_count : 0,
      error: s.error,
      firstScan: c?.first_scan ?? false,
      added: c?.added ?? 0,
      fixed: c?.fixed ?? 0,
    };
  });

  const active = pages.some((p) => p.status === "queued" || p.status === "running");
  const finished = scans.map((s) => toDate(s.finished_at)).filter((d): d is Date => d !== null);
  const changes = pages.reduce<RunChanges>(
    (sum, p) =>
      p.status === "done" && !p.firstScan
        ? { compared: sum.compared + 1, added: sum.added + p.added, fixed: sum.fixed + p.fixed }
        : sum,
    { ...NO_CHANGES }
  );
  const summary: RunSummary = {
    key,
    startedAt: new Date(Math.min(...scans.map((s) => new Date(s.started_at ?? s.created_at).getTime()))),
    finishedAt: active || finished.length === 0 ? null : new Date(Math.max(...finished.map((d) => d.getTime()))),
    total: pages.length,
    done: pages.filter((p) => p.status === "done").length,
    failed: pages.filter((p) => p.status === "failed").length,
    active,
    issues: pages.reduce((n, p) => n + p.issues, 0),
    changes,
  };
  return { summary, pages };
});

/** "Nov 15, 2026, 9:40 AM UTC" */
export function formatRunTime(date: Date): string {
  return `${date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;
}

/** "Done", "Some pages failed"… */
export function runStatus(run: RunSummary): string {
  if (run.active) return "Scanning now…";
  if (run.failed === run.total) return "Failed";
  if (run.failed > 0) return "Some pages failed";
  return "Done";
}

/** "6 new · 11 fixed", "No changes", "First scan" (nothing earlier to compare with), or null while nothing's done */
export function changesText(run: RunSummary): string | null {
  if (run.done === 0) return null;
  const { compared, added, fixed } = run.changes;
  if (compared === 0) return "First scan";
  if (added === 0 && fixed === 0) return "No changes";
  return `${added} new · ${fixed} fixed`;
}

/** "2 min 10 s", "45 s" */
export function formatDuration(from: Date, to: Date): string {
  const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
