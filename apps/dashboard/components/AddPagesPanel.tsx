"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPages, type AddPagesState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

const IDLE: AddPagesState = { status: "idle" };

/**
 * "Add pages" opens a panel to paste page addresses. After adding, a summary says what was added and what was
 * skipped (and why); it takes focus, so keyboard and screen reader users hear it.
 */
export function AddPagesPanel({ siteId, domain }: { siteId: string; domain: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addPages, IDLE);
  const openerRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Each result is a new message (`at`): move focus to it
  useEffect(() => {
    if (state.at) summaryRef.current?.focus();
  }, [state.at]);

  function close() {
    setOpen(false);
    openerRef.current?.focus(); // back to where the panel was opened from
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button ref={openerRef} variant={open ? "secondary" : "primary"} aria-expanded={open} aria-controls="add-pages-panel" onClick={() => (open ? close() : setOpen(true))}>
          Add pages
        </Button>
      </div>

      {open && (
        <div id="add-pages-panel" className="rounded-xl border border-line p-4 sm:p-5">
          <form action={formAction} className="flex-col items-stretch gap-3">
            <input type="hidden" name="siteId" value={siteId} />
            <label htmlFor="page-urls">Page addresses</label>
            <textarea
              id="page-urls"
              name="urls"
              rows={6}
              required
              autoFocus
              aria-describedby="page-urls-hint"
              placeholder={`https://${domain}/products/coffee\nhttps://${domain}/cart`}
              className="w-full rounded-[0.625rem] border-[1.5px] border-frame bg-surface p-3 font-mono text-small"
            />
            <p id="page-urls-hint" className="text-small text-muted">
              One per line. Only pages on {domain}, with or without www. Subdomains such as blog.{domain} are separate
              sites with their own plan. Adding pages is free; your plan limits how many different pages you scan each month.
            </p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Adding…">Add to the list</SubmitButton>
              <Button variant="quiet" onClick={close}>
                Close
              </Button>
            </div>
          </form>

          {state.status !== "idle" && (
            <div
              key={state.at}
              ref={summaryRef}
              tabIndex={-1}
              role={state.status === "error" ? "alert" : "status"}
              className={state.status === "done" ? "mt-4 rounded-xl border border-line bg-subtle px-4 py-3" : "mt-4"}
            >
              <Summary state={state} domain={domain} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ state, domain }: { state: AddPagesState; domain: string }) {
  if (state.error === "empty") return <p>Enter at least one page address.</p>;
  if (state.error === "too-many") return <p>Paste up to 500 addresses at a time.</p>;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const skipped: { text: string; items?: string[] }[] = [];
  if (state.duplicates) skipped.push({ text: `${plural(state.duplicates, "was", "were")} already on the list` });
  if (state.subdomain?.length)
    skipped.push({ text: `${plural(state.subdomain.length, "is on a subdomain", "are on subdomains")}: add each subdomain as its own site`, items: state.subdomain });
  if (state.otherDomain?.length) skipped.push({ text: `${plural(state.otherDomain.length, "isn't", "aren't")} on ${domain}`, items: state.otherDomain });
  if (state.invalid?.length) skipped.push({ text: `${plural(state.invalid.length, "isn't a web address", "aren't web addresses")}`, items: state.invalid });

  return (
    <>
      <p className="font-bold">{state.added ? `Added ${plural(state.added, "page", "pages")}.` : "No new pages added."}</p>
      {skipped.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {skipped.map((s) => (
            <li key={s.text} className="wrap-anywhere">
              Skipped: {s.text}
              {s.items && <span className="text-muted"> ({s.items.slice(0, 5).join(", ")}{s.items.length > 5 ? ", …" : ""})</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
