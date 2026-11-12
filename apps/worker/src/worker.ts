import { chromium } from "playwright";
import { db, closeDb, scans, sites, eq, sql } from "@app/db";
import { runScan } from "./runScan";

const POLL_MS = 3_000;
const STUCK_MINUTES = 10;

let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("Stopping after the current scan…");
    running = false;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Atomically claim the oldest queued scan. SKIP LOCKED means two workers
// can never grab the same scan, so you can safely run more workers later.
async function claimNext(): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE scans
    SET status = 'running', started_at = now()
    WHERE id = (
      SELECT id FROM scans
      WHERE status = 'queued'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}

// If a worker crashed mid-scan, its scan would stay "running" forever.
async function failStuckScans() {
  await db.execute(sql`
    UPDATE scans
    SET status = 'failed', error = 'Timed out', finished_at = now()
    WHERE status = 'running'
      AND started_at < now() - make_interval(mins => ${STUCK_MINUTES})
  `);
}

async function main() {
  const browser = await chromium.launch(); // one browser, reused across scans
  console.log("Worker started. Waiting for scans…");

  try {
    while (running) {
      await failStuckScans();
      const scanId = await claimNext();
      if (!scanId) {
        await sleep(POLL_MS);
        continue;
      }

      const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
      const [site] = await db.select().from(sites).where(eq(sites.id, scan.siteId));

      try {
        const count = await runScan(browser, scan, site);
        console.log(`✓ ${scan.url}: ${count} issues`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(scans)
          .set({ status: "failed", error: message, finishedAt: new Date() })
          .where(eq(scans.id, scan.id));
        console.error(`✗ ${scan.url}: ${message}`);
      }
    }
  } finally {
    await browser.close();
    await closeDb();
    console.log("Worker stopped cleanly.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});