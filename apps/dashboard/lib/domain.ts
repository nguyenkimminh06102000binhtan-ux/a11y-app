/** Local development hosts. They can be added as sites, so owners can try the widget on their own machine. */
export function isLocalHost(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";
}

export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    if (isLocalHost(host)) return host; // the port isn't part of a site: localhost:4000 → localhost
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Whether a page's hostname belongs to a site: the same domain, with or without "www.".
 * A subdomain (blog.shop.com) is NOT part of shop.com: it's a separate site with its own plan.
 */
export function isSameSite(hostname: string, siteDomain: string): boolean {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "") === siteDomain;
}

/** A subdomain of the site (blog.shop.com for shop.com): to tell owners it needs its own site. */
export function isSubdomainOf(hostname: string, siteDomain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  return host.endsWith(`.${siteDomain}`);
}
