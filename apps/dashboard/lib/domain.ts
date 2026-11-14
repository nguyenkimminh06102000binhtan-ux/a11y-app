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

export type PageUrlResult = { url: string } | { error: "invalid" | "subdomain" | "domain" };

/**
 * A pasted page address, checked against its site and stored the way scans store it: full URL, no #fragment
 * (same page), "https://" added when missing. Only the site's own domain (with or without www.) is accepted.
 */
export function normalizePageUrl(input: string, siteDomain: string): PageUrlResult {
  let s = input.trim();
  if (!s) return { error: "invalid" };
  // Another scheme (ftp://, mailto:…) isn't a web page. "localhost:3000/x" is: a host and port, no scheme.
  if (/^(?!https?:)[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(mailto|tel|javascript|data):/i.test(s)) return { error: "invalid" };
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { error: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "invalid" };
  if (!isSameSite(url.hostname, siteDomain)) {
    return { error: isSubdomainOf(url.hostname, siteDomain) ? "subdomain" : "domain" };
  }
  url.hash = "";
  return { url: url.toString() };
}
