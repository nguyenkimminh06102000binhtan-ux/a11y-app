import { cacheLife, cacheTag } from "next/cache";
import { db, accounts, sites, widgetSettings, eq, and } from "@app/db";
import { CONFIG_VERSION, readSiteSettings, toWidgetConfig, type WidgetConfig } from "@app/widget-config";
import { isLocalHost } from "@/lib/domain";


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

    // Same rule as scans: exactly the site's domain ("www." was already dropped from host). A subdomain such as
    // blog.shop.com is a separate site with its own plan, so it shows only once it's added as a site.
    // One row by (account, domain), however many sites the account has.
    const [site] = await db
        .select({ settings: widgetSettings.settings })
        .from(sites)
        .leftJoin(widgetSettings, eq(widgetSettings.siteId, sites.id)) // no settings row = our defaults
        .where(and(eq(sites.accountId, account.id), eq(sites.domain, host)));
    if (site) return toWidgetConfig(readSiteSettings(site.settings), true);

    // Local development without a "localhost" site: still shows, with our defaults
    return isLocalHost(host) ? { ...disabled, enabled: true } : disabled;

}
