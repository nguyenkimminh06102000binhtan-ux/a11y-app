import { cacheLife, cacheTag } from "next/cache";
import { db, accounts, sites, eq } from "@app/db";
import { CONFIG_VERSION, type WidgetConfig } from "@app/widget-config";

/** Cache tag for one account's widget configs. Expire it (updateTag) whenever a config input changes: sites, settings. */
export function widgetConfigTag(accountId: string): string {
  return `widget-config:${accountId}`;
}

const WIDGET_KEY = /^acct_[0-9a-f]{32}$/; // the accounts.widget_key format
const HOSTNAME = /^[a-z0-9.-]{1,253}$/;

export function isWidgetKey(value: string): boolean {
  return WIDGET_KEY.test(value);
}

/** The page's hostname as the widget sends it (location.hostname), normalized like stored domains (no "www."). */
export function normalizeHost(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  return HOSTNAME.test(host) ? host : null;
}

/** Local development: the widget always shows there, with our defaults. */
function isLocal(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

/**
 * The config for one account's widget on one hostname. Cached per (key, host); an account's entries are
 * expired together by widgetConfigTag when its sites or settings change, so `hours` is only a safety net.
 */
export async function getWidgetConfig(widgetKey: string, host: string): Promise<WidgetConfig> {
  "use cache";
  cacheLife("hours");

  const disabled: WidgetConfig = { v: CONFIG_VERSION, enabled: false, theme: {}, defaults: {} };

  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.widgetKey, widgetKey));
  if (!account) return disabled; // same answer as an unregistered domain: doesn't reveal which keys exist
  cacheTag(widgetConfigTag(account.id));

  if (isLocal(host)) return { ...disabled, enabled: true };

  // Same rule as scans: the site's domain or any subdomain of it
  const rows = await db.select({ domain: sites.domain }).from(sites).where(eq(sites.accountId, account.id));
  const enabled = rows.some(({ domain }) => host === domain || host.endsWith(`.${domain}`));
  return { ...disabled, enabled };
}
