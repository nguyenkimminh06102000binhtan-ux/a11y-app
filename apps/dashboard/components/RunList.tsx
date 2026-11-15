import Link from "next/link";
import { changesText, runStatus, type RunSummary } from "@/lib/scans";
import { RelativeTime } from "@/components/RelativeTime";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function pagesText(run: RunSummary): string {
  const checked = plural(run.done, "page checked", "pages checked");
  const waiting = run.total - run.done - run.failed;
  return [checked, run.failed > 0 && `${run.failed} failed`, waiting > 0 && `${waiting} to go`].filter(Boolean).join(" · ");
}

/** A dash for "nothing yet", read as words by screen readers */
export function NotYet() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">none yet</span>
    </>
  );
}

/**
 * The run's link: "25 minutes ago", named "See scan from 25 minutes ago (Nov 15, 2026, 9:40 AM UTC)" for screen
 * readers, so it makes sense out of context and points to one scan.
 */
function RunLink({ run, base }: { run: RunSummary; base: string }) {
  return (
    <Link href={`${base}/${run.key}`} className="inline-flex min-h-11 items-center font-bold">
      <span>
        <span className="sr-only">See scan from </span>
        <RelativeTime iso={run.startedAt.toISOString()} exact />
      </span>
    </Link>
  );
}

/** Scan runs: a table from 1024px, one card per run below that (same facts, as labelled lines). */
export function RunList({ runs, base }: { runs: RunSummary[]; base: string }) {
  return (
    <>
      <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
        <table className="w-full text-left">
          <caption className="sr-only">Scans, newest first</caption>
          <thead className="bg-subtle text-small text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-normal">Started</th>
              <th scope="col" className="px-4 py-3 font-normal">Pages</th>
              <th scope="col" className="px-4 py-3 font-normal">Issues found</th>
              <th scope="col" className="px-4 py-3 font-normal">Changes</th>
              <th scope="col" className="px-4 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.key} className="border-t border-line align-middle">
                <th scope="row" className="px-4 py-1 font-bold">
                  <RunLink run={run} base={base} />
                </th>
                <td className="px-4 py-3 text-small">{pagesText(run)}</td>
                <td className="px-4 py-3">{run.done > 0 ? run.issues.toLocaleString("en-US") : <NotYet />}</td>
                <td className="px-4 py-3 text-small">{changesText(run) ?? <NotYet />}</td>
                <td className="px-4 py-3 text-small">{runStatus(run)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 lg:hidden" aria-label="Scans, newest first">
        {runs.map((run) => (
          <li key={run.key} className="rounded-xl border border-line bg-surface p-4">
            <h3 className="m-0 text-base">
              <RunLink run={run} base={base} />
            </h3>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
              <dt className="text-muted">Pages</dt>
              <dd>{pagesText(run)}</dd>
              <dt className="text-muted">Issues found</dt>
              <dd>{run.done > 0 ? run.issues.toLocaleString("en-US") : <NotYet />}</dd>
              <dt className="text-muted">Changes</dt>
              <dd>{changesText(run) ?? <NotYet />}</dd>
              <dt className="text-muted">Status</dt>
              <dd>{runStatus(run)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
