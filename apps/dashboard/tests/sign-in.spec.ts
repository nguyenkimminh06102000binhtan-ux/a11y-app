import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { emailLink, anyEmail } from "./mailbox";
import { OWNER_EMAIL, OWNER_PASSWORD as PASSWORD, type Seeded } from "./seed";

/*
 * The sign-in page and the public legal pages. If the sign-in options change, change this file; the other tests
 * sign in without the page (tests/setup.ts) and don't change.
 *   - email + password (setup gives the owner a password)
 *   - a one-time sign-in link by email, end to end through the local test mailbox and /auth/callback
 *   - where you land afterwards: ?next= when it's one of our pages, Sites otherwise
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const seeded = () => JSON.parse(readFileSync("tests/.state/seeded.json", "utf8")) as Seeded;

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
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, input:not([type=checkbox]):not([type=radio]):not([type=hidden])")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && r.height < 43.5;
      })
      .map((el) => el.outerHTML.slice(0, 100))
  );
  expect(small, "controls under 44px tall").toEqual([]);
}

async function fillAndSignIn(page: Page, password: string) {
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("email + password signs you in and opens Sites", async ({ page }) => {
  await ready(page, "/login");
  await fillAndSignIn(page, PASSWORD);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();

  await page.goto("/login"); // signed in: straight on to Sites
  await expect(page).toHaveURL("/");
});

test("a wrong password: one message that takes focus, the email kept, the password cleared", async ({ page }) => {
  await ready(page, "/login");
  await fillAndSignIn(page, "not the password");
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("We couldn’t sign you in.");
  await expect(alert).toBeFocused();
  await expect(alert).not.toContainText(/no account|not found|wrong password/i); // never says which part was wrong
  await expect(page.getByLabel("Email")).toHaveValue(OWNER_EMAIL);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expectAccessible(page);

  await page.getByRole("button", { name: "Sign in", exact: true }).click(); // empty password: asked for it
  await expect(page.locator("main").getByRole("alert")).toContainText("Enter your email and password.");
});

test("Show password reveals it and says what it will do next", async ({ page }) => {
  await ready(page, "/login");
  const field = page.getByLabel("Password", { exact: true });
  await field.fill("abc");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toBeFocused();
});

test("after signing in you're back where you were going, and only on our own pages", async ({ page }) => {
  const target = `/sites/${seeded().shop}/audit`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.waitForLoadState("networkidle");
  await fillAndSignIn(page, PASSWORD);
  await expect(page).toHaveURL(target);

  await page.context().clearCookies();
  await ready(page, "/login?next=https://evil.example/steal");
  await fillAndSignIn(page, PASSWORD);
  await expect(page).toHaveURL("/");
});

test.describe("sign-in link", () => {
  test("the email's link signs you in and opens Sites", async ({ page, request }) => {
    await ready(page, "/login");
    const since = Date.now();
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
    await expect(page.getByRole("button", { name: /Send again in 0:\d\d/ })).toHaveAttribute("aria-disabled", "true");
    await expectAccessible(page);

    await page.goto(await emailLink(request, OWNER_EMAIL, since)); // → /auth/confirm → Sites
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
  });

  test("an email without an account gets the same answer, and no email or account", async ({ page, request }) => {
    const stranger = `nobody-${Date.now()}@accesspilot.test`;
    await ready(page, "/login");
    const since = Date.now();
    await page.getByLabel("Email").fill(stranger);
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.locator("main")).toContainText(`If ${stranger} has an account`);
    expect(await anyEmail(request, stranger, since)).toBe(false); // sign-in links don't make accounts: Sign up does
  });

  test("a sign-in link without an email asks for one; a broken link says so", async ({ page }) => {
    await ready(page, "/login");
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Enter your email first.");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

    for (const broken of ["/auth/callback?code=not-a-real-code", "/auth/confirm?token_hash=nope&type=email"]) {
      await ready(page, broken);
      await expect(page).toHaveURL(/\/login\?error=link/);
      await expect(page.locator("main").getByRole("alert")).toContainText("That sign-in link didn’t work.");
    }
  });
});

for (const width of [320, 768, 1280]) {
  test(`sign-in and legal pages at ${width}px: accessible, no sideways scroll, 44px controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/login", "/signup", "/terms", "/privacy", "/accessibility"]) {
      await ready(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page);
    }
  });
}
