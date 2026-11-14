"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { addSite, type AddSiteState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PageHeader } from "@/components/ui/PageHeader";

const IDLE: AddSiteState = {};

const ERRORS: Record<NonNullable<AddSiteState["error"]>, string> = {
  invalid: "That doesn't look like a domain. Enter it like shop.com, without https://.",
  duplicate: "You've already added that site.",
};

/**
 * The Sites header with its Add site button, and the panel it opens just below: one click away however long the
 * list is. Errors show under the field and focus moves back to it; a new site opens its Widget › Install tab.
 */
export function SitesHeader({ description }: { description: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addSite, IDLE);
  const openerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Each refusal is new (`at`): back to the field, which now names the problem
  useEffect(() => {
    if (state.at) inputRef.current?.focus();
  }, [state.at]);

  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  const error = state.error ? ERRORS[state.error] : null;

  return (
    <>
      <PageHeader
        title="Sites"
        description={description}
        actions={
          <Button
            ref={openerRef}
            variant={open ? "secondary" : "primary"}
            aria-expanded={open}
            aria-controls="add-site-panel"
            onClick={() => (open ? close() : setOpen(true))}
          >
            Add site
          </Button>
        }
      />

      {open && (
        <div id="add-site-panel" className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mt-0 mb-3 text-lg">Add a site</h2>
          <form action={formAction} className="flex-col items-stretch gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="domain" className="font-bold">
                Domain
              </label>
              <p id="domain-hint" className="m-0 text-small text-muted">
                Like shop.com, without https://. A subdomain such as blog.shop.com is a separate site with its own plan.
              </p>
              <input
                ref={inputRef}
                id="domain"
                name="domain"
                required
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="shop.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "domain-error domain-hint" : "domain-hint"}
                className="max-w-md"
              />
              {error && (
                <p key={state.at} id="domain-error" role="alert" className="m-0 font-bold">
                  <span aria-hidden="true">⚠ </span>
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Adding…">Add this site</SubmitButton>
              <Button variant="quiet" onClick={close}>
                Close
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
