import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const toggle = (page: Page) => page.getByRole("button", { name: "Accessibility" });
const panel = (page: Page) => page.getByRole("region", { name: "Accessibility settings" });
const closeButton = (page: Page) => page.getByRole("button", { name: "Close", exact: true });

/** axe scan of the widget only. The hostile page's own problems are deliberate and not ours. */
async function widgetViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include("a11yw-root").withTags(WCAG).analyze();
  // Readable failure output: "rule-id: selector, selector"
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const path of ["/", "/hostile.html", "/components.html"]) {
  test.describe(`widget on ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await expect(toggle(page)).toBeVisible(); // mounts after the page's load event
    });

    test("loads the hashed app with an integrity check", async ({ page }) => {
      await expect(page.locator("head script[integrity][crossorigin='anonymous']")).toHaveCount(1);
    });

    test("has no WCAG violations, closed and open", async ({ page }) => {
      expect(await widgetViolations(page)).toEqual([]);
      await toggle(page).click();
      await expect(panel(page)).toBeVisible();
      expect(await widgetViolations(page)).toEqual([]);
    });

    test("page styles don't leak in", async ({ page }) => {
      const style = await toggle(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { font: s.fontFamily, color: s.color, direction: s.direction, letterSpacing: s.letterSpacing };
      });
      expect(style.font).not.toContain("Comic Sans");
      expect(style.color).toBe("rgb(255, 255, 255)");
      expect(style.direction).toBe("ltr");
      expect(style.letterSpacing).toBe("normal");

      const lang = await toggle(page).evaluate((el) => el.closest("[lang]")?.getAttribute("lang"));
      expect(lang).toBe("en");
    });

    test("stays in the bottom-right corner, on top, while scrolling", async ({ page }) => {
      for (const scrollY of [0, 2000]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        const box = await toggle(page).boundingBox();
        const viewport = page.viewportSize()!;
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeGreaterThan(viewport.width - 40);
        expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);

        // Nothing on the page covers it (e.g. the hostile page's cookie banner)
        const topTag = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.tagName,
          [box!.x + box!.width / 2, box!.y + box!.height / 2]
        );
        expect(topTag).toBe("A11YW-ROOT");
      }
    });

    test("keyboard: Enter opens, Escape closes and returns focus, page never sees Escape", async ({ page }) => {
      const pageEscapes: string[] = [];
      page.on("console", (msg) => {
        if (msg.text() === "PAGE saw Escape") pageEscapes.push(msg.text());
      });

      await toggle(page).focus();
      await page.keyboard.press("Enter");
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      await expect(panel(page)).toBeVisible();
      await expect(toggle(page)).toBeFocused(); // disclosure: focus doesn't jump into the panel

      await page.keyboard.press("Tab");
      await expect(closeButton(page)).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(panel(page)).toBeHidden();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(toggle(page)).toBeFocused();

      if (path === "/hostile.html") {
        // Positive control: an Escape pressed on the page itself IS seen, so the listener works...
        await page.locator("h1").click();
        await page.keyboard.press("Escape");
        await expect.poll(() => pageEscapes.length).toBe(1); // ...and the widget's Escape earlier was not.
      }
    });

    test("Close button closes and returns focus", async ({ page }) => {
      await toggle(page).click();
      await closeButton(page).click();
      await expect(panel(page)).toBeHidden();
      await expect(toggle(page)).toBeFocused();
    });

    test("panel stays open while the visitor uses the page", async ({ page }) => {
      await toggle(page).click();
      await page.locator("h1").click();
      await expect(panel(page)).toBeVisible();
    });

    test("focus ring is visible, also in forced-colors mode", async ({ page }) => {
      for (const forcedColors of ["none", "active"] as const) {
        await page.emulateMedia({ forcedColors });
        await toggle(page).focus();
        const ring = await toggle(page).evaluate((el) => {
          const s = getComputedStyle(el);
          return { focusVisible: el.matches(":focus-visible"), style: s.outlineStyle, width: s.outlineWidth };
        });
        expect(ring).toEqual({ focusVisible: true, style: "solid", width: "3px" });
      }
    });

    test("buttons are at least 44px tall at default text size", async ({ page }) => {
      await toggle(page).click();
      for (const button of [toggle(page), closeButton(page)]) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44); // WCAG 2.5.8 minimum is 24; 44 is our own standard
      }
    });
        test("Highlight links: applies to the page, survives reload, resets", async ({ page }) => {
      const linkBackground = () =>
        page.locator("a[href]").first().evaluate((el) => getComputedStyle(el).backgroundColor);
      const before = await linkBackground();

      await toggle(page).click();
      await page.getByRole("checkbox", { name: "Highlight links" }).check();
      expect(await linkBackground()).toBe("rgb(255, 255, 0)"); // wins against the hostile page's !important too

      // Remembered, and applied before the panel is ever opened
      await page.reload();
      await expect(toggle(page)).toBeVisible();
      expect(await linkBackground()).toBe("rgb(255, 255, 0)");

      await toggle(page).click();
      await expect(page.getByRole("checkbox", { name: "Highlight links" })).toBeChecked();
      await page.getByRole("button", { name: "Reset all" }).click();
      expect(await linkBackground()).toBe(before);
      expect(await page.evaluate(() => localStorage.getItem("a11yw:settings:v1"))).toBeNull();
      await expect(page.locator("#a11yw-page-adjustments")).toHaveCount(0); // nothing left behind
    });

    test("survives junk in saved settings", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => localStorage.setItem("a11yw:settings:v1", "{not json"));

      await page.reload();
      await expect(toggle(page)).toBeVisible();
      expect(errors).toEqual([]);
    });
    test.describe("web components (/components.html)", () => {
  const YELLOW = "rgb(255, 255, 0)";
  const background = (page: Page, name: string) =>
    page.getByRole("link", { name, exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);

  async function turnOnHighlightLinks(page: Page) {
    await toggle(page).click();
    await page.getByRole("checkbox", { name: "Highlight links" }).check();
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/components.html");
    await expect(toggle(page)).toBeVisible();
  });

  test("Highlight links reaches open shadow roots, nested ones and slotted links", async ({ page }) => {
    await turnOnHighlightLinks(page);
    for (const name of ["Light DOM link", "Open shadow link", "Nested shadow link", "Slotted link"]) {
      await expect.poll(() => background(page, name), { message: name }).toBe(YELLOW);
    }
  });

  test("components added later are adjusted too", async ({ page }) => {
    await turnOnHighlightLinks(page);
    await page.getByRole("button", { name: "Add cards" }).click();
    for (const name of ["Late card link", "Late nested card link"]) {
      await expect.poll(() => background(page, name), { message: name }).toBe(YELLOW); // waits for the observer's batch
    }
  });

  test("a component defined late is adjusted on the next settings change", async ({ page }) => {
    await page.getByRole("button", { name: "Define late component" }).click();
    await turnOnHighlightLinks(page); // the settings change rescans the page
    await expect.poll(() => background(page, "Late-defined link")).toBe(YELLOW);
  });

  test("closed shadow roots are left alone, without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.reload();
    await expect(toggle(page)).toBeVisible();

    await turnOnHighlightLinks(page);
    await expect.poll(() => background(page, "Open shadow link")).toBe(YELLOW); // proves the setting is on
    const closed = await page.evaluate(() => {
      const root = (window as unknown as { closedRoot: ShadowRoot }).closedRoot;
      return getComputedStyle(root.querySelector("a")!).backgroundColor;
    });
    expect(closed).not.toBe(YELLOW); // known limit: closed roots can't be reached by any outside script
    expect(errors).toEqual([]);
  });
});
  });
}
