import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requestScan } from "@/app/actions";

export const metadata: Metadata = { title: "Overview · Audit" };

const ERRORS: Record<string, string> = {
  url: "Enter a full page address starting with https://",
  domain: "That page isn't on this site's domain.",
  busy: "A scan is already queued or running for this site.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Audit › Overview: run a scan, follow its progress, and the latest result counts. Issues: ./issues */
export default function OverviewPage({ params, searchParams }: PageProps) {
  return (
    <>
      <h2 className="mt-0">Overview</h2>
      <Suspense fallback={<p>Loading scans…</p>}>
        <Overview params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Overview({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const { latest, lastFinished, rows, inProgress } = await getLatestAudit(site.id);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.impact ?? "unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <section aria-labelledby="run-heading">
        <h3 id="run-heading" className="mb-2">Run a scan</h3>
        {error && ERRORS[error] && <p role="alert">{ERRORS[error]}</p>}
        <form action={requestScan}>
          <input type="hidden" name="siteId" value={site.id} />
          <label htmlFor="url">Page to scan</label>
          <input id="url" name="url" type="url" defaultValue={`https://${site.domain}/`} required />
          <button type="submit" disabled={inProgress}>Scan now</button>
        </form>
        {inProgress && latest && (
          <>
            <p role="status" className="mt-3">
              Scan {latest.status} for {latest.url}. This page updates automatically.
            </p>
            <AutoRefresh />
          </>
        )}
      </section>

      <section aria-labelledby="scan-heading" className="mt-8">
        <h3 id="scan-heading" className="mb-2">Latest results</h3>
        {!lastFinished ? (
          <p>No finished scans yet.</p>
        ) : (
          <>
            <p>
              {lastFinished.url} · {lastFinished.status}
              {lastFinished.finishedAt &&
                ` · ${lastFinished.finishedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`}
            </p>
            {lastFinished.status === "failed" && <p role="alert">Scan failed: {lastFinished.error}</p>}
            {lastFinished.status === "done" && (
              <>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["critical", "serious", "moderate", "minor"].map((level) => (
                    <li
                      key={level}
                      className={`rounded-xl border-2 p-4 ${level === "critical" && counts[level] ? "border-state" : "border-frame"}`}
                    >
                      <span className="block text-sm capitalize">{level}</span>
                      <span className="block text-3xl font-bold">{counts[level] ?? 0}</span>
                    </li>
                  ))}
                </ul>
                {rows.length > 0 && (
                  <p className="mt-4">
                    <Link href={`/sites/${site.id}/audit/issues`}>See all {rows.length} issues</Link>
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
