import { mkdirSync, writeFileSync } from "node:fs";
import { test as setup, expect, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localStack } from "./local-stack";
import { NEW_EMAIL, OWNER_EMAIL, resetNewAccount, seed } from "./seed";

/*
 * Signs the test users in WITHOUT the sign-in page, so these tests don't depend on which login options it offers
 * (magic link today; passwords, Google or passkeys later). tests/sign-in.spec.ts tests the page itself.
 * The local stack's admin API makes the user and a one-time sign-in link; the link is verified the same way the
 * dashboard's Supabase client does it, and the resulting session cookies go into the browser. The dashboard's own
 * code has no bypass: it reads an ordinary session. Only the local stack's secret key can do this.
 *   owner@accesspilot.test  the seeded account most tests use
 *   new@accesspilot.test    an account with no sites (Getting started from zero)
 */

/** Signs `email` in, in this browser context. Returns the user's id. */
async function signIn(context: BrowserContext, email: string, baseURL: string): Promise<string> {
  const stack = localStack();
  const admin = createClient(stack.apiUrl, stack.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already been registered|already exists/i.test(created.error.message)) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;

  // Verify it with the same cookie-based client the dashboard uses, and keep the cookies it sets
  const jar: { name: string; value: string; options: { maxAge?: number } }[] = [];
  const supabase = createServerClient(stack.apiUrl, stack.publishableKey, {
    cookies: { getAll: () => [], setAll: (cookies) => void jar.push(...cookies) },
  });
  const verified = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.user) throw verified.error ?? new Error("No user after verifying the link");

  await context.addCookies(
    jar.map(({ name, value, options }) => ({
      name,
      value,
      url: baseURL,
      sameSite: "Lax" as const,
      expires: options.maxAge ? Math.floor(Date.now() / 1000) + options.maxAge : -1,
    }))
  );
  return verified.data.user.id;
}

setup("sign in the test users and seed their accounts", async ({ browser }) => {
  const baseURL = setup.info().project.use.baseURL ?? "http://localhost:3990";
  const owner = await browser.newContext({ baseURL });
  const fresh = await browser.newContext({ baseURL });
  const ownerId = await signIn(owner, OWNER_EMAIL, baseURL);
  const freshId = await signIn(fresh, NEW_EMAIL, baseURL);

  await resetNewAccount(freshId);
  const seeded = await seed(ownerId);

  for (const context of [owner, fresh]) {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible(); // signed in
  }

  mkdirSync("tests/.state", { recursive: true });
  writeFileSync("tests/.state/seeded.json", JSON.stringify(seeded));
  await owner.storageState({ path: "tests/.state/owner.json" });
  await fresh.storageState({ path: "tests/.state/new.json" });
  await owner.close();
  await fresh.close();
});
