import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { localStack } from "./local-stack";
import { emailLink, anyEmail } from "./mailbox";

/*
 * Forgot password → the reset email (local test mailbox) → choose a new password → Sites. Uses its own user each
 * run: changing the owner's password would sign out the sessions the other tests use.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const OLD = "the old password here";
const NEW = "a brand new password";

test.use({ storageState: { cookies: [], origins: [] } }); // signed out

async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function expectAccessible(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== "running")
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "scrolls sideways").toBeLessThanOrEqual(0);
}

async function newUser(): Promise<string> {
  const stack = localStack();
  const admin = createClient(stack.apiUrl, stack.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `reset-${Date.now()}-${Math.round(Math.random() * 1e6)}@accesspilot.test`;
  const { error } = await admin.auth.admin.createUser({ email, password: OLD, email_confirm: true });
  if (error) throw error;
  return email;
}

async function signInWith(page: Page, email: string, password: string) {
  await ready(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("forgot password → email → a new password → Sites; the old one stops working, the link works once", async ({ page, request, browser }) => {
  const email = await newUser();

  await ready(page, "/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await page.waitForLoadState("networkidle");
  const since = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByRole("main")).toContainText(`If ${email} has an account, a link to choose a new password`);

  const link = await emailLink(request, email, since);
  await page.goto(link); // → /auth/confirm (type=recovery) → /reset-password, signed in for it
  await expect(page).toHaveURL("/reset-password");
  await expect(page.getByRole("main")).toContainText(`For ${email}.`);
  await page.waitForLoadState("networkidle");
  await expectAccessible(page);

  const field = page.getByLabel("New password", { exact: true });
  await field.fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(/Use at least 10 characters/);
  await expectAccessible(page);

  await field.fill(NEW);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: /^Dismiss/ })).toContainText("Password changed.");
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeFocused();

  const other = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
  await signInWith(other, email, OLD);
  await expect(other.getByRole("main").getByRole("alert")).toContainText("We couldn’t sign you in.");
  await signInWith(other, email, NEW);
  await expect(other).toHaveURL("/");

  await other.context().clearCookies();
  await other.goto(link); // the same link again: used
  await expect(other).toHaveURL(/\/forgot-password\?error=link/);
  await expect(other.getByRole("main").getByRole("alert")).toContainText("That reset link didn’t work.");
});

test("an email without an account gets the same answer, and no email", async ({ page, request }) => {
  const stranger = `nobody-${Date.now()}@accesspilot.test`;
  await ready(page, "/forgot-password");
  const since = Date.now();
  await page.getByLabel("Email").fill(stranger);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`If ${stranger} has an account`);
  expect(await anyEmail(request, stranger, since)).toBe(false);
});

test("an empty email is asked for; /reset-password needs the email's link (sign in first)", async ({ page }) => {
  await ready(page, "/forgot-password");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter your email first.");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login\?next=%2Freset-password/);
});

for (const width of [320, 768, 1280]) {
  test(`Forgot password at ${width}px: accessible, also after sending and with a broken link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "/forgot-password?error=link");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("That reset link didn’t work.");
    await expectAccessible(page);
    await page.getByLabel("Email").fill(`layout-${Date.now()}@accesspilot.test`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expectAccessible(page);
  });
}
