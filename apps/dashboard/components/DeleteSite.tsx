"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteSite, type DeleteSiteState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

const IDLE: DeleteSiteState = {};

/**
 * "Delete site…" opens the confirmation in place (no pop-up, nothing traps focus): type the domain, then
 * "Delete shop.com permanently". The button stays aria-disabled until the domain matches; the server checks again.
 * Cancel goes back to the opening button. After deleting, Sites says so.
 */
export function DeleteSite({
  siteId,
  domain,
}: {
  siteId: string;
  domain: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(0); // tries before the domain matched (a click, or Enter in the field)
  const [state, formAction] = useActionState(deleteSite, IDLE);
  const openerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = typed.trim().toLowerCase() === domain;

  // A refusal from the server is new each time (`at`): back to the field that explains it
  useEffect(() => {
    if (state.at) inputRef.current?.focus();
  }, [state.at]);

  function cancel() {
    setOpen(false);
    setTyped("");
    setTried(0);
    openerRef.current?.focus();
  }

  const error =
    state.error === "paid"
      ? "This site is on a paid plan. Cancel its subscription in Billing first."
      : (state.error === "mismatch" || tried > 0) && !matches
        ? `That doesn't match. Type ${domain} exactly.`
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          ref={openerRef}
          aria-expanded={open}
          aria-controls="delete-site-confirm"
          onClick={() => (open ? cancel() : setOpen(true))}
        >
          Delete site…
        </Button>
      </div>
      {open && (
        <div
          id="delete-site-confirm"
          className="rounded-xl border border-frame p-4"
        >
          <form action={formAction} className="flex-col items-stretch gap-3">
            <input type="hidden" name="id" value={siteId} />
            <div className="flex flex-col gap-1">
              <label htmlFor="delete-confirm" className="font-bold">
                Type <span className="wrap-anywhere">{domain}</span> to confirm
              </label>
              <input
                ref={inputRef}
                id="delete-confirm"
                name="confirm"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "delete-confirm-error" : undefined}
                className="max-w-md"
              />
              {error && (
                <p
                  key={`${state.at}-${tried}`} // announced again on each try
                  id="delete-confirm-error"
                  role="alert"
                  className="m-0 font-bold"
                >
                  <span aria-hidden="true">⚠ </span>
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                pendingLabel="Deleting…"
                aria-disabled={!matches || undefined}
                onClick={(event) => {
                  if (!matches) {
                    event.preventDefault(); // nothing to send yet: say why, back at the field
                    setTried((n) => n + 1);
                    inputRef.current?.focus();
                  }
                }}
                className="wrap-break-word text-left aria-disabled:border-dashed aria-disabled:border-frame aria-disabled:bg-surface aria-disabled:text-ink"
              >
                Delete {domain} permanently
              </SubmitButton>
              <Button variant="quiet" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
