import { db, accounts } from "@app/db";

/**
 * The dashboard account for a signed-in user (same id as the auth user), made on their first sign-in whichever way
 * they signed in: magic link, password or Google.
 */
export async function ensureAccount(user: { id: string; email?: string | null; name?: string | null }): Promise<void> {
  if (!user.email) return;
  await db
    .insert(accounts)
    .values({ id: user.id, email: user.email, name: user.name ?? null })
    .onConflictDoNothing(); // only inserts the first time
}
