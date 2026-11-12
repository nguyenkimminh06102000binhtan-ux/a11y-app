import { FALLBACK_CONFIG, parseConfig, type WidgetConfig } from "@app/widget-config";

/*
 * The site owner's config from the dashboard (GET /api/widget/config): whether the widget may show on this
 * domain, their brand color, and settings on by default.
 * - The last answer is kept in localStorage, so a returning visitor gets the right colors and defaults at once.
 * - Never blocks the widget for long, and never fails it: no answer in time means the cached one, or our defaults.
 */
const CACHE_KEY = "a11yw:config:v1";
const WAIT_MS = 3000; // after this, show the widget with what we have; a late answer is still saved for next time

type Cached = { account: string; host: string; config: WidgetConfig };

/** The answer from the last page view on this site, if it was for this account and hostname. */
export function cachedConfig(account: string): WidgetConfig | null {
    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as Partial<Cached> | null;
        if (!saved || saved.account !== account || saved.host !== location.hostname) return null;
        return parseConfig(saved.config); // validated again: the page's own scripts can write to localStorage
    } catch {
        return null;
    }
}

/** Ask the dashboard. Resolves within WAIT_MS with the fresh answer, else the cached one, else our defaults. */
export function fetchConfig(account: string): Promise<WidgetConfig> {
    const fallback = cachedConfig(account) ?? FALLBACK_CONFIG;
    const url = `${__API_BASE__}/api/widget/config?account=${encodeURIComponent(account)}&host=${encodeURIComponent(location.hostname)}`;

    const fresh = fetch(url, { credentials: "omit" })
        .then((response) => (response.ok ? response.json() : null))
        .then((json) => {
            const config = parseConfig(json);
            if (!config) return fallback;
            saveConfig(account, config);
            return config;
        })
        .catch(() => fallback); // offline, blocked by an extension, server down…

    const timeout = new Promise<WidgetConfig>((resolve) => setTimeout(() => resolve(fallback), WAIT_MS));
    return Promise.race([fresh, timeout]);
}

function saveConfig(account: string, config: WidgetConfig): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ account, host: location.hostname, config } satisfies Cached));
    } catch {
        // Storage unavailable: we'll ask again on the next page view.
    }
}
