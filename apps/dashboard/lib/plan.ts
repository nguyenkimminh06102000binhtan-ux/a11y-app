/**
 * Which plan a site is on: the ONE place that decides it.
 * PLACEHOLDER until billing exists: every site is on Free. When billing is built, read the site's subscription
 * here (a cancelled subscription keeps the site on its paid plan until the paid period ends).
 */
export type SitePlan = { free: true } | { free: false; name: string };

export function getSitePlan(site: { id: string }): SitePlan {
  void site; // billing will look up this site's subscription
  return { free: true };
}

/**
 * Only sites on Free can be deleted: owners cancel the subscription first. That way deleting and re-adding a site
 * can't reset a paid plan's monthly page quota.
 */
export function canDeleteSite(site: { id: string }): boolean {
  return getSitePlan(site).free;
}
