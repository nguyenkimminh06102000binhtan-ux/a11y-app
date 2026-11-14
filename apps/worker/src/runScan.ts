import { createHash } from "node:crypto";
import type { Browser } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { db, scans, sites, issues, eq } from "@app/db";

type Scan = typeof scans.$inferSelect;
type Site = typeof sites.$inferSelect;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function fingerprint(ruleId: string, pageUrl: string, selector: string) {
  const path = new URL(pageUrl).pathname;
  return createHash("sha256").update(`${ruleId}|${path}|${selector}`).digest("hex").slice(0, 32);
}

export async function runScan(browser: Browser, scan: Scan, site: Site): Promise<number> {
  // Defense in depth (the dashboard checks this too): only the site's own domain, with or without www.
  // A subdomain is a separate site with its own plan, so it's never scanned as part of this one.
  const host = new URL(scan.url).hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (host !== site.domain) {
    throw new Error(`${scan.url} is not on ${site.domain}`);
  }

  const context = await browser.newContext(); // fresh cookies/storage for every scan
  try {
    const page = await context.newPage();
    await page.goto(scan.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    const rows = results.violations.flatMap((v) =>
      v.nodes.map((node) => {
        const selector = node.target.flat().join(" ");
        return {
          scanId: scan.id,
          siteId: site.id,
          fingerprint: fingerprint(v.id, scan.url, selector),
          ruleId: v.id,
          help: v.help,
          impact: v.impact ?? null,
          pageUrl: scan.url,
          selector,
          html: node.html,
          summary: node.failureSummary ?? v.help,
          helpUrl: v.helpUrl,
        };
      })
    );

    await db.transaction(async (tx) => {
const CHUNK = 1000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx.insert(issues).values(rows.slice(i, i + CHUNK));
      }
      await tx
        .update(scans)
        .set({ status: "done", issueCount: rows.length, finishedAt: new Date() })
        .where(eq(scans.id, scan.id));
    });

    return rows.length;
  } finally {
    await context.close();
  }
}