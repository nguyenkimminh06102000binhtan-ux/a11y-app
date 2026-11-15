import { mkdirSync, writeFileSync } from "node:fs";
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localStack } from "./local-stack";
import { OWNER_EMAIL, seed } from "./seed";

/*
 * Signs the test user in WITHOUT the sign-in page, so these tests don't depend on which login options it offers
 * (magic link today; passwords, Google or passkeys later). tests/sign-in.spec.ts tests the page itself.
 * The local stack's admin API makes the user and a one-time sign-in link; the link is verified the same way the
 * dashboard's Supabase client does it, and the resulting session cookies go into the browser. The dashboard's own
 * code has no bypass: it reads an ordinary session. Only the local stack's secret key can do this.
 */
setup("sign in the test user and seed the test account", async ({ page }) => {
  const stack = localStack();
  const admin = createClient(stack.apiUrl, stack.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // The user (once), then a one-time sign-in link for it
  const created = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
  if (created.error && !/already been registered|already exists/i.test(created.error.message)) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER_EMAIL });
  if (link.error) throw link.error;

  // Verify it with the same cookie-based client the dashboard uses, and keep the cookies it sets
  const jar: { name: string; value: string; options: { path?: string; maxAge?: number; sameSite?: string | boolean } }[] = [];
  const supabase = createServerClient(stack.apiUrl, stack.publishableKey, {
    cookies: { getAll: () => [], setAll: (cookies) => void jar.push(...cookies) },
  });
  const verified = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.user) throw verified.error ?? new Error("No user after verifying the link");

  const baseURL = setup.info().project.use.baseURL ?? "http://localhost:3990";
  await page.context().addCookies(
    jar.map(({ name, value, options }) => ({
      name,
      value,
      url: baseURL,
      sameSite: "Lax" as const,
      expires: options.maxAge ? Math.floor(Date.now() / 1000) + options.maxAge : -1,
    }))
  );

  const seeded = await seed(verified.data.user.id);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible(); // signed in

  mkdirSync("tests/.state", { recursive: true });
  writeFileSync("tests/.state/seeded.json", JSON.stringify(seeded));
  await page.context().storageState({ path: "tests/.state/owner.json" });
});
