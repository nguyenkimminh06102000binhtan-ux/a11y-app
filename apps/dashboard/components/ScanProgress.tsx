"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/SubmitButton";

type Status = "queued" | "running" | "done" | "failed";
type Scan = { id: string; status: Status; url: string; issueCount: number; error: string | null };

const POLL_MS = 3000;

/**
 * The latest scan's progress on Audit › Overview: Queued → Checking the page → Done.
 * Updates in place by asking /api/sites/:id/scan-status every 3s (no page reload). When the scan ends it refreshes
 * the server parts of the page once, so the counts and lists below show the new results.
 * Always rendered, with the live region always the same element (screen readers often miss a region that appears
 * with its text already in it), so they hear each step and the result; the "finished" message survives the refresh.
 */
export function ScanProgress({ siteId, initial }: { siteId: string; initial: Scan }) {
  const router = useRouter();
  const [scan, setScan] = useState(initial);
  const [sawItRun, setSawItRun] = useState(isActive(initial.status));
  // A new scan was started (the server sends a different one): follow that one instead
  if (initial.id !== scan.id) {
    setScan(initial);
    setSawItRun(isActive(initial.status));
  }
  const active = isActive(scan.status);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}/scan-status`, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as Scan;
        if (!stopped && next.id === initial.id) setScan(next);
      } catch {
        // offline or signed out: try again next time
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, siteId, initial.id]);

  // Finished while this page was open: load the results once
  useEffect(() => {
    if (!active && sawItRun) router.refresh();
  }, [active, sawItRun, router]);

  const announcement = active
    ? scan.status === "queued"
      ? `Scan queued for ${scan.url}.`
      : `Checking ${scan.url}…`
    : sawItRun
      ? scan.status === "done"
        ? `Scan finished: ${scan.issueCount} ${scan.issueCount === 1 ? "issue" : "issues"} found.`
        : "Scan failed. The reason is below."
      : "";

  const idle = !active && !sawItRun; // nothing running, nothing just finished: only the (empty) live region

  const steps: { label: string; state: "done" | "current" | "waiting" }[] = [
    { label: "Queued", state: scan.status === "queued" ? "current" : "done" },
    { label: "Checking the page", state: scan.status === "queued" ? "waiting" : scan.status === "running" ? "current" : "done" },
    { label: "Done", state: active ? "waiting" : "done" },
  ];

  return (
    <div className={idle ? "" : `rounded-xl border-[1.5px] p-4 sm:p-5 ${active ? "border-state" : "border-line"}`}>
      <p role="status" className={idle ? "sr-only" : "font-bold wrap-anywhere"}>
        {announcement}
      </p>
      {active && (
        <>
          <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
            {steps.map((step) => (
              <li key={step.label} className={`flex items-center gap-2 ${step.state === "current" ? "font-bold" : ""}`}>
                {step.state === "done" && <CheckIcon />}
                {step.state === "current" && <Spinner />}
                {step.state === "waiting" && <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-dashed border-frame" />}
                {step.label}
                <span className="text-caption font-normal text-muted">
                  {step.state === "done" ? "done" : step.state === "current" ? "in progress" : "waiting"}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-small text-muted">You can leave this page: the results appear here when it&apos;s done.</p>
        </>
      )}
    </div>
  );
}

function isActive(status: Status) {
  return status === "queued" || status === "running";
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-state" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
