"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Run } from "@/lib/runs";
import { pageLabel } from "@/lib/page-label";

const POLL_MS = 3000;

/**
 * The latest scan run's progress, on Audit › Overview and Pages: "Checking page 2 of 5: /cart".
 * Updates in place by asking /api/sites/:id/scan-status every 3s (no page reload); when the run ends it refreshes
 * the server parts of the page once, so the counts and lists show the new results.
 * The live region is always the same element (screen readers often miss a region that appears with its text
 * already in it), so they hear each page and the result. A run just started from a button (?started=<its key>)
 * takes focus, so keyboard and screen reader users follow it.
 */
export function ScanProgress({ siteId, domain, initial, started }: { siteId: string; domain: string; initial: Run; started?: string }) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [sawItRun, setSawItRun] = useState(initial.active);
  const cardRef = useRef<HTMLDivElement>(null);

  // A new run was started (the server sends a different one): follow that one instead
  if (initial.key !== run.key) {
    setRun(initial);
    setSawItRun(initial.active);
  }

  // Just started with "Scan 3 pages" or "Try again": move focus here
  useEffect(() => {
    if (started && started === run.key) cardRef.current?.focus();
  }, [started, run.key]);

  useEffect(() => {
    if (!run.active) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}/scan-status`, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as Run;
        if (!stopped && next.key === run.key) setRun(next);
      } catch {
        // offline or signed out: try again next time
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run.active, run.key, siteId]);

  // Finished while this page was open: load the results once
  useEffect(() => {
    if (!run.active && sawItRun) router.refresh();
  }, [run.active, sawItRun, router]);

  const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  const label = (url: string) => pageLabel(url, domain);
  const finished = run.done + run.failed;

  const announcement = run.active
    ? run.current
      ? `Checking page ${Math.min(finished + 1, run.total)} of ${run.total}: ${label(run.current)}`
      : finished === 0
        ? `Scan queued: ${pages(run.total)}.`
        : `Checked ${finished} of ${run.total} pages…`
    : sawItRun
      ? `Scan finished: ${pages(run.done)} checked, ${run.issueCount} ${run.issueCount === 1 ? "issue" : "issues"} found.` +
        (run.failed ? ` ${pages(run.failed)} couldn't be checked.` : "")
      : "";

  const idle = !run.active && !sawItRun; // nothing running, nothing just finished: only the (empty) live region

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className={idle ? "" : `rounded-xl border-[1.5px] p-4 sm:p-5 ${run.active ? "border-state" : "border-line"}`}
    >
      <p role="status" className={idle ? "sr-only" : "font-bold wrap-anywhere"}>
        {announcement}
      </p>
      {run.active && (
        <>
          {/* The text above says the same, so the bar is decoration */}
          <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-state-tint">
            <div className="h-full bg-state" style={{ width: `${Math.round((finished / Math.max(run.total, 1)) * 100)}%` }} />
          </div>
          <p className="mt-3 text-small text-muted">
            {finished} of {run.total} done. You can leave this page: the results appear when it&apos;s finished.
          </p>
        </>
      )}
    </div>
  );
}
