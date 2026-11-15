import { db, sql } from "@app/db";

export { STALE_AFTER_DAYS, widgetHealth, type WidgetHealth } from "./widget-health";

/*
 * "Is the widget installed?" The widget asks GET /api/widget/config on every page view; when that request comes
 * from a browser on the site itself (its Origin is the site's own domain, www. or not), we note the time on the
 * site. One timestamp per site, nothing about visitors.
 * Limits: a script outside a browser can fake an Origin; at worst it makes "seen" look more recent (it can't
 * change or read anything). Quiet sites show older times: "seen" only moves when someone visits.
 */

/** The page's Origin header ("https://www.shop.com") names the same site as `host` (already without "www."). */
export function originMatches(origin: string | null, host: string): boolean {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
    return hostname === host;
  } catch {
    return false; // "null" (sandboxed iframes, file://) or garbage
  }
}

/**
 * Notes "seen now" on the account's site with this exact domain. At most one write a minute per site, and no
 * write at all for a key or domain that isn't one of the account's sites.
 */
export async function markWidgetSeen(widgetKey: string, host: string): Promise<void> {
  await db.execute(sql`
    update sites set widget_seen_at = now()
    where domain = ${host}
      and account_id = (select id from accounts where widget_key = ${widgetKey})
      and (widget_seen_at is null or widget_seen_at < now() - interval '1 minute')`);
}

export type Onboarding = {
  firstSiteId: string | null; // A–Z, where the "scan" and "customize" steps link
  installed: boolean;
  scanned: boolean;
  customized: boolean;
};

/** The Getting started steps for an account, in one query. */
export async function getOnboarding(accountId: string): Promise<Onboarding> {
  const [row] = await db.execute<{ first_site: string | null; installed: boolean; scanned: boolean; customized: boolean }>(sql`
    select (select id::text from sites where account_id = ${accountId} order by domain limit 1) as first_site,
           exists (select 1 from sites where account_id = ${accountId} and widget_seen_at is not null) as installed,
           exists (select 1 from scans sc join sites s on s.id = sc.site_id
                   where s.account_id = ${accountId} and sc.status = 'done') as scanned,
           exists (select 1 from widget_settings w join sites s on s.id = w.site_id
                   where s.account_id = ${accountId}) as customized`);
  return { firstSiteId: row.first_site, installed: row.installed, scanned: row.scanned, customized: row.customized };
}
