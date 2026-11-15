import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { Seeded } from "./seed";

/*
 * Every dashboard page at phone, tablet and desktop widths: no axe violations (WCAG 2.2 A/AA), no sideways
 * scrolling, and buttons and fields at least 44px tall (our own rule). Then the open states (menu, panels,
 * confirmations, toasts) and the behaviors that are easy to break (focus after Delete/Remove, the CSV, paging).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDTHS = [320, 768, 1280];
/** The seeded ids, written by setup.ts (read when a test runs: this file is loaded before setup has run) */
let seededCache: Seeded | undefined;
const seeded = () => (seededCache ??= JSON.parse(readFileSync("tests/.state/seeded.json", "utf8")) as Seeded);

/** Loaded and interactive: no skeleton left, and the scripts are in (a click before that would do nothing) */
async function settled(page: Page) {
  await expect(page.locator(".animate-skeleton-in")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function expectAccessible(page: Page) {
  // Let entrance animations (a toast fading in) finish: colors measured halfway through aren't the real ones
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== "running")
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sideways, "the page scrolls sideways").toBeLessThanOrEqual(0);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden])")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden" && r.height < 43.5;
      })
      .map((el) => el.outerHTML.slice(0, 100))
  );
  expect(small, "controls under 44px tall").toEqual([]);
}

const site = (id: string) => `/sites/${id}`;

const PAGES: [string, (s: Seeded) => string][] = [
  ["Sites", () => "/"],
  ["Sites, no match", () => "/?q=nothing-matches-this"],
  ["Sites, page 2", () => "/?page=2"],
  ["Embed code", () => "/embed-code"],
  ["Overview", (s) => `${site(s.shop)}/audit`],
  ["Overview, never scanned", (s) => `${site(s.longSite)}/audit`],
  ["Overview, scan running", (s) => `${site(s.busy)}/audit`],
  ["Issues", (s) => `${site(s.shop)}/audit/issues`],
  ["Issue detail", (s) => `${site(s.shop)}/audit/issues?rule=color-contrast`],
  ["Pages", (s) => `${site(s.shop)}/audit/pages`],
  ["Scans", (s) => `${site(s.shop)}/audit/scans`],
  ["One scan", (s) => `${site(s.shop)}/audit/scans/${s.latestRun}`],
  ["Reports", (s) => `${site(s.shop)}/audit/reports`],
  ["Printable report", (s) => `/reports/${s.shop}`],
  ["Customize", (s) => `${site(s.shop)}/widget`],
  ["Settings", (s) => `${site(s.shop)}/widget/settings`],
  ["Not found", () => `${site("00000000-0000-4000-8000-00000000dead")}/audit`],
];

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const [name, path] of PAGES) {
      test(`${name}: accessible, no sideways scroll, 44px controls`, async ({ page }) => {
        await page.goto(path(seeded()));
        await settled(page);
        await expectAccessible(page);
      });
    }
  });
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the sign-in page is accessible, and site pages send you there", async ({ page }) => {
    const s = seeded();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
    }
    await page.goto(`${site(s.shop)}/audit`);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("open states", () => {
  test("phone menu open", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await settled(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Embed code" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Add site with a mistake: the error is next to the field", async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await settled(page);
      await page.getByRole("button", { name: "Add site" }).click();
      await page.getByLabel("Domain").fill("not a domain");
      await page.getByRole("button", { name: "Add this site" }).click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await expect(page.getByLabel("Domain")).toBeFocused();
      await expectAccessible(page);
    }
  });

  test("Save widget settings: a toast, focus stays on Save", async ({ page }) => {
    const s = seeded();
    await page.goto(`${site(s.shop)}/widget`);
    await settled(page);
    const save = page.getByRole("button", { name: "Save widget settings" });
    await save.click();
    await expect(page.getByRole("button", { name: /^Dismiss/ })).toBeVisible();
    await expect(save).toBeFocused();
    await expectAccessible(page);
  });
});

test.describe("behaviors", () => {
  test("Delete a site: refused on a typo, then a toast and focus on Sites", async ({ page }) => {
    const s = seeded();
    await page.goto(`${site(s.deleteMe)}/widget/settings`);
    await settled(page);
    await page.getByRole("button", { name: "Delete site…" }).click();
    const field = page.getByLabel("Type delete-me.example to confirm");
    await field.fill("delete-me.exampel");
    await field.press("Enter"); // the button is aria-disabled until it matches: Enter (or a click) says why
    await expect(page.locator("main").getByRole("alert")).toContainText("doesn't match");
    await expectAccessible(page);

    await field.fill("delete-me.example");
    await page.getByRole("button", { name: "Delete delete-me.example permanently" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /^Dismiss/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("button", { name: /^Dismiss/ })).toHaveCount(0); // not shown again
  });

  test("Remove a page: a toast and focus on the Pages heading", async ({ page }) => {
    const s = seeded();
    await page.goto(`${site(s.shop)}/audit/pages`);
    await settled(page);
    await page.getByRole("button", { name: "Remove /contact" }).click();
    await page.getByRole("button", { name: "Yes, remove /contact" }).click();
    await expect(page.getByRole("button", { name: /^Dismiss/ })).toContainText("Removed /contact from the list.");
    await expect(page.getByRole("heading", { level: 2, name: "Pages" })).toBeFocused();
  });

  test("Scans: new and fixed per scan, and the scan's own page", async ({ page }) => {
    const s = seeded();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${site(s.shop)}/audit/scans`);
    await settled(page);
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("2 new · 1 fixed"); // /: alt fixed; link and button new
    await expect(rows.nth(1)).toContainText("First scan");
    await rows.nth(0).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 2 })).toContainText("Scan from");
    await expect(page.getByRole("cell", { name: "Failed: The page took too long to load." })).toBeVisible();
  });

  test("CSV: open issues, with formula-looking text made safe", async ({ page }) => {
    const s = seeded();
    await page.goto("/");
    await settled(page);
    const response = await page.request.get(`/api/sites/${s.shop}/issues-csv`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="shop\.example-accessibility-issues-\d{4}-\d{2}-\d{2}\.csv"/);
    const csv = await response.text();
    expect(csv.startsWith("﻿Page,Impact,Issue,WCAG criteria")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")`);
    expect(csv).toContain("'-2+3");
    expect(csv).not.toMatch(/axe|deque/i);
    expect((await page.request.get(`/api/sites/00000000-0000-4000-8000-00000000dead/issues-csv`)).status()).toBe(404);
  });

  test("Sites: Next and Previous pages, by keyboard", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    await pagination.getByRole("link", { name: "Next" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(pagination.getByText(/Page 2 of 2/)).toBeVisible();
    await expect(pagination.getByRole("link", { name: "Previous" })).toBeVisible();
  });

  test("Relative dates keep the exact time", async ({ page }) => {
    const s = seeded();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${site(s.shop)}/audit/scans`);
    await settled(page);
    const latest = page.locator("table tbody tr").first().locator("time");
    await expect(latest).toHaveText(/^2 hours ago/); // then the exact time, for screen readers only
    await expect(latest).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await expect(page.locator("table tbody tr").first().getByRole("link")).toHaveAccessibleName(/^See scan from 2 hours ago \(.+ UTC\)$/);
  });
});
