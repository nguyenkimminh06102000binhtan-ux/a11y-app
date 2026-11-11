import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { db, closeDb, sites, scans, issues, eq } from "@app/db";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function fingerprint(ruleId: string, pageUrl: string, selector: string) {
  const path = new URL(pageUrl).pathname; // ignore ?query and #hash
  return createHash("sha256").update(`${ruleId}|${path}|${selector}`).digest("hex").slice(0, 32);
}

async function main() {
  const [siteKey, url] = process.argv.slice(2);
  if (!siteKey || !url) {
    console.error("Usage: pnpm --filter worker scan <siteKey> <url>");
    process.exit(1);
  }

  const [site] = await db.select().from(sites).where(eq(sites.siteKey, siteKey));
  if (!site) throw new Error(`No site with key ${siteKey}`);

  // only scan pages that belong to this site's domain
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host !== site.domain && !host.endsWith(`.${site.domain}`)) {
    throw new Error(`${url} is not on ${site.domain}`);
  }

  const [scan] = await db
    .insert(scans)
    .values({ siteId: site.id, url, status: "running" })
    .returning();

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {}); // busy sites never go idle; that's ok

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    const rows = results.violations.flatMap((v) =>
      v.nodes.map((node) => {
        const selector = node.target.flat().join(" ");
        return {
          scanId: scan.id,
          siteId: site.id,
          fingerprint: fingerprint(v.id, url, selector),
          ruleId: v.id,
          help: v.help,
          impact: v.impact ?? null,
          pageUrl: url,
          selector,
          html: node.html,
          summary: node.failureSummary ?? v.help,
          helpUrl: v.helpUrl,
        };
      })
    );

    await db.transaction(async (tx) => {
      if (rows.length) await tx.insert(issues).values(rows);
      await tx
        .update(scans)
        .set({ status: "done", issueCount: rows.length, finishedAt: new Date() })
        .where(eq(scans.id, scan.id));
    });

    console.log(`✓ ${url}: ${rows.length} issues across ${results.violations.length} rules`);
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id} × ${v.nodes.length}: ${v.help}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(scans)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(scans.id, scan.id));
    console.error(`✗ Scan failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);