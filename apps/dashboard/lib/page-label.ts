/**
 * How a page is shown: its path (and query) when it's on the site's plain domain, otherwise host + path, so
 * www.shop.com/a or localhost:3000/a stay distinguishable. No database access: safe in client components too.
 */
export function pageLabel(url: string, siteDomain: string): string {
  const u = new URL(url);
  const path = `${u.pathname}${u.search}`;
  return u.host === siteDomain ? path : `${u.host}${path}`;
}
