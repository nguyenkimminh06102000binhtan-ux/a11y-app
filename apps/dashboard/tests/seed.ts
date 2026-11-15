import { randomUUID } from "node:crypto";
import { localStack } from "./local-stack";

/*
 * The test account's data, recreated on every run (dates relative to now, so "2 hours ago" reads right):
 *   shop.example     scanned twice: issues, new/fixed, a failed page, a removable page, a formula-looking HTML
 *   busy.example     a scan running now (progress card)
 *   delete-me.example  for the delete test
 *   a very long domain, and site-01 … site-27 (never scanned): wrapping, empty states, pagination
 * Widget seen: shop.example 5 minutes ago (working), site-01 ten days ago (stale), the rest never.
 * A second account, new@accesspilot.test, is emptied: Getting started from zero.
 */

export type Seeded = {
  accountId: string;
  shop: string;
  busy: string;
  deleteMe: string;
  longSite: string;
  latestRun: string; // shop.example's latest scan run (batch id)
  widgetKey: string; // the account's public embed key
  site01: string; // widget seen 10 days ago
  site02: string; // never seen (the "seen" rules test marks it)
  site03: string; // never seen (the Embed code wait test)
};

export const OWNER_EMAIL = "owner@accesspilot.test";
export const NEW_EMAIL = "new@accesspilot.test";
export const LONG_DOMAIN = "a-really-long-subdomain-name.some-very-long-domain-name-example.co.uk";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

type IssueSeed = { fp: string; rule: string; impact: string; selector: string; html: string; help: string; summary: string };

const ISSUES: Record<string, IssueSeed> = {
  alt: { fp: "f-alt", rule: "image-alt", impact: "critical", selector: "img.hero", html: '<img class="hero" src="/hero.jpg">', help: "Images must have alternative text", summary: "Fix any of the following:\n  Element does not have an alt attribute" },
  contrast: { fp: "f-contrast", rule: "color-contrast", impact: "serious", selector: "p.muted", html: '<p class="muted">Free shipping</p>', help: "Elements must meet minimum color contrast ratio thresholds", summary: "Fix any of the following:\n  Element has insufficient color contrast of 2.9 (foreground color: #999999, background color: #ffffff)" },
  link: { fp: "f-link", rule: "link-name", impact: "serious", selector: "a.icon", html: '<a class="icon" href="/cart"></a>', help: "Links must have discernible text", summary: "Fix all of the following:\n  Element is in tab order and does not have accessible text" },
  label: { fp: "f-label", rule: "label", impact: "critical", selector: "input#qty", html: '<input id="qty" type="number">', help: "Form elements must have labels", summary: "Fix any of the following:\n  Form element does not have an implicit (wrapped) <label>" },
  region: { fp: "f-region", rule: "region", impact: "moderate", selector: "div.promo", html: '<div class="promo">Sale</div>', help: "All page content should be contained by landmarks", summary: "Fix any of the following:\n  Some page content is not contained by landmarks" },
  formula: { fp: "f-button", rule: "button-name", impact: "critical", selector: "-2+3", html: '=HYPERLINK("http://evil.example","click")\n<button class="x, y"></button>', help: "Buttons must have discernible text", summary: "Fix any of the following:\n  Element does not have inner text that is visible to screen readers" },
};

/** `userId`: the test user's id in the local auth service (its account row uses the same id, like /auth/callback) */
export async function seed(userId: string): Promise<Seeded> {
  process.env.DATABASE_URL = localStack().dbUrl; // before @app/db connects
  const { db, accounts, sites, pages, scans, issues, widgetSettings, eq, closeDb } = await import("@app/db");

  await db.insert(accounts).values({ id: userId, email: OWNER_EMAIL }).onConflictDoNothing();
  const [account] = await db.select({ id: accounts.id, widgetKey: accounts.widgetKey }).from(accounts).where(eq(accounts.id, userId));
  await db.delete(sites).where(eq(sites.accountId, account.id)); // cascades to pages, scans, issues, settings

  const site = async (domain: string) =>
    (await db.insert(sites).values({ accountId: account.id, domain }).returning({ id: sites.id }))[0].id;
  const shop = await site("shop.example");
  const busy = await site("busy.example");
  const deleteMe = await site("delete-me.example");
  const longSite = await site(LONG_DOMAIN);
  const numbered: string[] = [];
  for (let i = 1; i <= 27; i++) numbered.push(await site(`site-${String(i).padStart(2, "0")}.example`));
  await db.update(sites).set({ widgetSeenAt: ago(5) }).where(eq(sites.id, shop));
  await db.update(sites).set({ widgetSeenAt: ago(10 * 24 * 60) }).where(eq(sites.id, numbered[0]));

  const url = (path: string) => `https://shop.example${path}`;
  await db.insert(pages).values(["/", "/cart", "/about", "/contact"].map((p) => ({ siteId: shop, url: url(p) })));
  await db.insert(pages).values({ siteId: busy, url: "https://busy.example/" });
  await db.insert(widgetSettings).values({ siteId: shop, settings: { v: 1, appearance: { stateColor: "#0b6e4f" }, defaults: [] } });

  const scan = async (s: { site?: string; path: string; batch: string; status: "done" | "failed" | "running" | "queued"; at: Date; found?: IssueSeed[]; error?: string }) => {
    const siteId = s.site ?? shop;
    const pageUrl = s.site === busy ? "https://busy.example/" : url(s.path);
    const [row] = await db
      .insert(scans)
      .values({
        siteId,
        url: pageUrl,
        status: s.status,
        batchId: s.batch,
        issueCount: s.found?.length ?? 0,
        error: s.error ?? null,
        createdAt: s.at,
        startedAt: s.status === "queued" ? null : s.at,
        finishedAt: s.status === "done" || s.status === "failed" ? new Date(s.at.getTime() + 40_000) : null,
      })
      .returning({ id: scans.id });
    if (s.found?.length) {
      await db.insert(issues).values(
        s.found.map((i) => ({
          scanId: row.id, siteId, pageUrl, fingerprint: i.fp, ruleId: i.rule, impact: i.impact, selector: i.selector,
          html: i.html, help: i.help, summary: i.summary, helpUrl: null,
        }))
      );
    }
  };

  // Two days ago: the first scan of / and /cart
  const first = randomUUID();
  await scan({ path: "/", batch: first, status: "done", at: ago(2 * 24 * 60), found: [ISSUES.alt, ISSUES.contrast] });
  await scan({ path: "/cart", batch: first, status: "done", at: ago(2 * 24 * 60), found: [ISSUES.label] });
  // Two hours ago: / changed (alt fixed, link + formula new), /cart failed, /about scanned for the first time
  const latestRun = randomUUID();
  await scan({ path: "/", batch: latestRun, status: "done", at: ago(120), found: [ISSUES.contrast, ISSUES.link, ISSUES.formula] });
  await scan({ path: "/cart", batch: latestRun, status: "failed", at: ago(120), error: "page.goto: Timeout 30000ms exceeded." });
  await scan({ path: "/about", batch: latestRun, status: "done", at: ago(120), found: [ISSUES.region] });
  // busy.example: being scanned right now
  await scan({ site: busy, path: "/", batch: randomUUID(), status: "running", at: ago(1) });

  await closeDb();
  return {
    accountId: account.id, shop, busy, deleteMe, longSite, latestRun, widgetKey: account.widgetKey,
    site01: numbered[0], site02: numbered[1], site03: numbered[2],
  };
}

/** The second account: exists, with no sites (Getting started from zero). Call before seed(), which closes the connection. */
export async function resetNewAccount(userId: string): Promise<void> {
  process.env.DATABASE_URL = localStack().dbUrl;
  const { db, accounts, sites, eq } = await import("@app/db");
  await db.insert(accounts).values({ id: userId, email: NEW_EMAIL }).onConflictDoNothing();
  await db.delete(sites).where(eq(sites.accountId, userId));
}
