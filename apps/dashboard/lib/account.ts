import { revalidateTag } from "next/cache";
import { db, accounts } from "@app/db";
import { normalizeDomain } from "./domain";
import { createSite } from "./site-create";
import { widgetConfigTag } from "./widget-config";

type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

/**
 * The dashboard account for a signed-in user (same id as the auth user), made on their first sign-in whichever way
 * they signed in. Returns true when it was just made.
 */
export async function ensureAccount(user: { id: string; email?: string | null; name?: string | null }): Promise<boolean> {
  if (!user.email) return false;
  const inserted = await db
    .insert(accounts)
    .values({ id: user.id, email: user.email, name: user.name?.trim().slice(0, 100) || null })
    .onConflictDoNothing() // only inserts the first time
    .returning({ id: accounts.id });
  return inserted.length > 0;
}

/**
 * After any sign-in (link, password, Google): the account, and on the very first sign-in the site typed at sign-up
 * (kept in the user's sign-up details as first_site). Returns that new site's id, so the caller can open Embed code.
 * Only for a new account: a site deleted later never comes back.
 */
export async function finishSignIn(user: AuthUser): Promise<string | null> {
  const meta = user.user_metadata ?? {};
  const isNew = await ensureAccount({ id: user.id, email: user.email, name: typeof meta.full_name === "string" ? meta.full_name : null });
  if (!isNew) return null;
  const domain = typeof meta.first_site === "string" ? normalizeDomain(meta.first_site) : null;
  if (!domain) return null;
  const siteId = await createSite(user.id, domain);
  if (siteId) revalidateTag(widgetConfigTag(user.id), "max"); // the widget shows there right away
  return siteId;
}
