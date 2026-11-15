import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { emailLink, anyEmail } from "./mailbox";
import { OWNER_EMAIL } from "./seed";

/*
 * Sign up: the form's checks, then the whole way through: confirmation email (local test mailbox) → /auth/confirm
 * → the account and the first site from "Your website" → Embed code waiting for the widget.
 * Each run signs up a new, unique email.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PASSWORD = "ten or more characters";

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

async function fill(page: Page, fields: { name?: string; email?: string; site?: string; password?: string; terms?: boolean }) {
  if (fields.name !== undefined) await page.getByLabel("Your name").fill(fields.name);
  if (fields.email !== undefined) await page.getByLabel("Work email").fill(fields.email);
  if (fields.site !== undefined) await page.getByLabel(/Your website/).fill(fields.site);
  if (fields.password !== undefined) await page.getByLabel("Password", { exact: true }).fill(fields.password);
  if (fields.terms) await page.getByRole("checkbox", { name: /I agree/ }).check();
}

const create = (page: Page) => page.getByRole("button", { name: "Create account" }).click();

test("each field says what's wrong, focus goes to the first, and what was typed stays", async ({ page }) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "/signup");
    await create(page);
    await expect(page.getByLabel("Your name")).toBeFocused();
    for (const [label, message] of [
      ["Your name", "Enter your name."],
      ["Work email", "Enter an email address like you@company.com."],
      ["Password", "Use at least 10 characters."],
    ] as const) {
      const input = page.getByLabel(label, { exact: true });
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAccessibleDescription(new RegExp(message.replace(".", "\\.")));
    }
    await expect(page.getByRole("checkbox", { name: /I agree/ })).toHaveAccessibleDescription(/agree to the Terms of Service/);
    await expectAccessible(page);
  }

  await fill(page, { name: "Maria", email: "maria@example.com", site: "not a domain", password: "short", terms: true });
  await create(page);
  await expect(page.getByLabel(/Your website/)).toBeFocused();
  await expect(page.getByLabel(/Your website/)).toHaveAccessibleDescription(/Enter a domain like shop\.com/);
  await expect(page.getByLabel("Your name")).toHaveValue("Maria");
  await expect(page.getByLabel("Work email")).toHaveValue("maria@example.com");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(""); // never typed back
});

test("sign up → confirm by email → the first site, on Embed code", async ({ page, request }) => {
  const stamp = Date.now();
  const email = `signup-${stamp}@accesspilot.test`;
  const domain = `first-${stamp}.example`;

  await ready(page, "/signup");
  const since = Date.now();
  await fill(page, { name: "Maria Lopez", email, site: `https://www.${domain}/`, password: PASSWORD, terms: true });
  await create(page);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.locator("main")).toContainText(`open the link we sent to ${email}`);
  await expectAccessible(page);

  // Not before confirming
  await ready(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Confirm your email first.");

  await page.goto(await emailLink(request, email, since)); // → /auth/confirm → the account and its first site
  await expect(page).toHaveURL(/\/embed-code\?added=/);
  await expect(page.locator("main p[role=status]").filter({ hasText: "Waiting for the widget" })).toContainText(domain);

  await ready(page, "/");
  await expect(page.getByRole("link", { name: domain, exact: true }).first()).toBeAttached();
  await expect(page.getByRole("region", { name: "Getting started" })).toContainText("1 of 4 done");
  await expect(page.getByText(`Signed in as ${email}`)).toBeAttached();

  await page.goto("/signup"); // signed in: on to Sites
  await expect(page).toHaveURL("/");
});

test("an email that already has an account gets the same answer", async ({ page, request }) => {
  await ready(page, "/signup");
  const since = Date.now();
  await fill(page, { name: "Someone", email: OWNER_EMAIL, password: PASSWORD, terms: true });
  await create(page);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.locator("main")).toContainText(`open the link we sent to ${OWNER_EMAIL}`);
  expect(await anyEmail(request, OWNER_EMAIL, since)).toBe(false); // and nothing new for the account's owner
});

test("Use a different email goes back to the form", async ({ page }) => {
  await ready(page, "/signup");
  await fill(page, { name: "Sam", email: `back-${Date.now()}@accesspilot.test`, password: PASSWORD, terms: true });
  await create(page);
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
