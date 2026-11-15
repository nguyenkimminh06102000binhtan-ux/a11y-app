import { db, sites, pages } from "@app/db";

/**
 * Adds a site to an account (domain already normalized), with its homepage on Audit › Pages. Returns its id, or
 * null when the account already has that domain. The caller clears the widget config cache.
 */
export async function createSite(accountId: string, domain: string): Promise<string | null> {
  const [site] = await db.insert(sites).values({ accountId, domain }).onConflictDoNothing().returning({ id: sites.id });
  if (!site) return null;
  await db.insert(pages).values({ siteId: site.id, url: `https://${domain}/` }).onConflictDoNothing();
  return site.id;
}
