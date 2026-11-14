import { chromium } from "playwright";
import { db, closeDb, scans, sites, eq, sql } from "@app/db";
import { runScan } from "./runScan";

const POLL_MS = 3_000;
const STUCK_MINUTES = 10;
const MAX_BACKOFF_MS = 60_000;

// Ends a wait early, so Ctrl+C doesn't sit out a long retry delay
let wakeUp: (() => void) | null = null;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wakeUp = () => {
      clearTimeout(timer);
      resolve();
    };
  });

let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("Stopping after the current scan…");
    running = false;
    wakeUp?.();
  });
}

/** The useful part of a database error: drizzle wraps the driver's error (e.g. CONNECTION_CLOSED) in `cause`. */
function describe(err: unknown): string {
  const cause = err instanceof Error ? (err.cause as { code?: string; message?: string } | undefined) : undefined;
  return cause?.code ?? cause?.message ?? (err instanceof Error ? err.message : String(err));
}

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
  // One browser, reused across scans. Signals are ours: by default Playwright kills the browser and ends the
  // process on Ctrl+C, which would cut off a running scan and skip the clean stop below.
  const browser = await chromium.launch({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false });
  console.log("Worker started. Waiting for scans…");

  let backoff = POLL_MS;
  try {
    while (running) {
      // A dropped database connection (laptop sleep, network change, the pooler closing it) must not stop the
      // worker: log it, wait a little longer each time, and carry on. The next query opens a fresh connection.
      // A scan claimed just before the drop stays "running" and failStuckScans() marks it failed after STUCK_MINUTES.
      try {
        await failStuckScans();
        const scanId = await claimNext();
        if (backoff !== POLL_MS) console.log("Database reachable again.");
        backoff = POLL_MS; // the database answered: healthy again
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
      } catch (err) {
        console.error(`Database unavailable (${describe(err)}). Retrying in ${backoff / 1000}s…`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
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