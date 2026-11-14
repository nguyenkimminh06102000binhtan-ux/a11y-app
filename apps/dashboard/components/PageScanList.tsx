"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { scanPages, type ScanPagesState } from "@/app/actions";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RemovePageButton } from "@/components/RemovePageButton";
import { scanRefusal } from "@/components/scanRefusal";

export type PageRow = {
  id: string;
  label: string;
  open: number;
  critical: number;
  lastChecked: string | null;
  usedThisMonth: boolean; // rescans free; can't be removed until the quota resets
};

type Props = {
  siteId: string;
  domain: string;
  rows: PageRow[];
  left: number; // pages left this month
  resetsOn: string; // "Dec 1"
  running: boolean; // a scan run is in progress: one at a time
};

/**
 * The Pages list with a checkbox per page, "Select all", and a Scan button that says what the selection costs:
 * "Scan 3 pages" / "Uses 2 of your 13 pages left this month (1 is a free rescan)".
 * One selection drives both layouts (table on wide screens, cards on phones); hidden inputs carry it to the server,
 * so the hidden layout's checkboxes are never sent. Remove has its own forms, beside this one (never nested).
 * The button stays focusable when it can't scan (aria-disabled), so its reason can be read.
 */
export function PageScanList({ siteId, domain, rows, left, resetsOn, running }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState(scanPages, {} as ScanPagesState);
  const allRef = useRef<HTMLInputElement>(null);
  const costId = useId();

  // A run started: start the next selection from scratch (adjusted while rendering, not in an effect)
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (running) setSelected(new Set());
  }

  const chosen = rows.filter((r) => selected.has(r.id));
  const free = chosen.filter((r) => r.usedThisMonth).length;
  const needed = chosen.length - free;
  const over = needed > left;
  const allOn = rows.length > 0 && chosen.length === rows.length;

  // Select all shows "some" (the native mixed state) when part of the list is ticked
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = chosen.length > 0 && !allOn;
  }, [chosen.length, allOn]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  const blocked = running || chosen.length === 0 || over;
  const buttonLabel = running ? "Scan running" : chosen.length === 0 ? "Select pages to scan" : `Scan ${pages(chosen.length)}`;
  const cost = running
    ? "You can start another scan when this one finishes."
    : chosen.length === 0
      ? `Tick the pages to check. ${left} new ${left === 1 ? "page" : "pages"} left this month; pages you scanned this month rescan free.`
      : over
        ? `These need ${pages(needed)} you haven't scanned this month, but ${left ? `only ${left}` : "none"} ${left === 1 ? "is" : "are"} left until ${resetsOn}. Untick some, or pick pages marked "Scanned this month": they rescan free.`
        : needed === 0
          ? `All free rescans: pages you already scanned this month.`
          : `Uses ${pages(needed)} of the ${left} left this month${free ? ` (${free} ${free === 1 ? "is a free rescan" : "are free rescans"})` : ""}.`;

  const checkbox = (row: PageRow) => (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={selected.has(row.id)}
        onChange={() => toggle(row.id)}
        aria-label={`Select ${row.label}`}
        className="size-5 accent-state"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The scan form: the selection travels as hidden inputs */}
      <form
        action={formAction}
        className="items-center justify-between gap-x-4 gap-y-3 rounded-xl bg-subtle px-2 py-2 sm:px-3"
        onSubmit={(event) => {
          if (blocked) event.preventDefault(); // aria-disabled: focusable, but it doesn't send
        }}
      >
        <input type="hidden" name="siteId" value={siteId} />
        {chosen.map((r) => (
          <input key={r.id} type="hidden" name="pageId" value={r.id} />
        ))}

        <div className="flex flex-wrap items-center gap-x-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 font-bold">
            <input
              ref={allRef}
              type="checkbox"
              checked={allOn}
              onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
              className="size-5 accent-state"
            />
            Select all {pages(rows.length)}
          </label>
          <span role="status" className="text-small text-muted">
            {chosen.length} of {rows.length} selected
          </span>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <SubmitButton
            variant={blocked ? "secondary" : "primary"}
            pendingLabel="Starting…"
            aria-disabled={blocked || undefined}
            aria-describedby={costId}
            className={blocked ? "border-dashed" : ""}
          >
            {buttonLabel}
          </SubmitButton>
          <p id={costId} className="max-w-md text-caption text-muted sm:text-right">
            {cost}
          </p>
        </div>

        {state.error && (
          <p key={state.at} role="alert" className="basis-full">
            {scanRefusal(state, resetsOn)}
          </p>
        )}
      </form>

      {/* Wide screens: a table. "relative" keeps the visually hidden caption and header text inside its scroll box. */}
      <div className="relative hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Pages on {domain}</caption>
          <thead className="bg-subtle text-small text-muted">
            <tr>
              <th scope="col" className="w-14 px-2 py-3 font-normal">
                <span className="sr-only">Selected</span>
              </th>
              <th scope="col" className="px-3 py-3 font-normal">Page</th>
              <th scope="col" className="px-3 py-3 font-normal">Open issues</th>
              <th scope="col" className="px-3 py-3 font-normal">Critical</th>
              <th scope="col" className="px-3 py-3 font-normal">Last checked</th>
              <th scope="col" className="px-3 py-3 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-t border-line align-middle ${selected.has(row.id) ? "bg-subtle" : ""}`}>
                <td className="px-2 py-1">{checkbox(row)}</td>
                <th scope="row" className="px-3 py-3 font-bold">
                  <span className="wrap-anywhere">{row.label}</span>
                  {row.usedThisMonth && (
                    <span className="mt-1 block">
                      <Badge>Scanned this month · free rescan</Badge>
                    </span>
                  )}
                </th>
                <td className="px-3 py-3">{row.lastChecked ? row.open : <NotYet />}</td>
                <td className="px-3 py-3">{row.lastChecked ? row.critical : <NotYet />}</td>
                <td className="px-3 py-3 text-small text-muted">{row.lastChecked ?? "Not checked yet"}</td>
                <td className="px-3 py-2 text-right">
                  <RowAction row={row} resetsOn={resetsOn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per page, the checkbox first */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={`Pages on ${domain}`}>
        {rows.map((row) => (
          <li key={row.id} className={`flex gap-1 rounded-xl border p-2 ${selected.has(row.id) ? "border-state bg-subtle" : "border-line"}`}>
            <div className="shrink-0">{checkbox(row)}</div>
            <div className="min-w-0 flex-1 py-2 pr-2">
              <p className="font-bold wrap-anywhere">{row.label}</p>
              {row.usedThisMonth && (
                <p className="mt-1">
                  <Badge>Scanned this month · free rescan</Badge>
                </p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-small">
                <dt className="text-muted">Open issues</dt>
                <dd>{row.lastChecked ? row.open : "–"}</dd>
                <dt className="text-muted">Critical</dt>
                <dd>{row.lastChecked ? row.critical : "–"}</dd>
                <dt className="text-muted">Last checked</dt>
                <dd>{row.lastChecked ?? "Not checked yet"}</dd>
              </dl>
              <div className="mt-2">
                <RowAction row={row} resetsOn={resetsOn} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotYet() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">not checked yet</span>
    </>
  );
}

/** Remove, or why it can't be removed yet (pages scanned this month stay until the quota resets). */
function RowAction({ row, resetsOn }: { row: PageRow; resetsOn: string }) {
  if (row.usedThisMonth) return <span className="text-caption text-muted">Removable from {resetsOn}</span>;
  return <RemovePageButton pageId={row.id} label={row.label} />;
}
