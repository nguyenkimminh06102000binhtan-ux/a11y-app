"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./Button";

type Props = Omit<ComponentProps<"button">, "type"> & {
  variant?: ButtonVariant;
  /** Shown the moment the form is sent, e.g. "Starting…", until the server answers */
  pendingLabel: string;
};

/**
 * A form's submit button that reacts at once: a spinner and the pending label while the form is being sent.
 * While pending it's aria-disabled, not disabled: a disabled button drops keyboard focus to the top of the page.
 * Extra clicks (and Enter in a field) are ignored, so nothing is sent twice.
 * Must be inside the <form> it submits.
 */
export function SubmitButton({ variant = "primary", pendingLabel, className, onClick, children, ...props }: Props) {
  const { pending } = useFormStatus();
  const { "aria-disabled": ariaDisabled, ...rest } = props; // the caller's own "can't do it now", kept while pending too
  return (
    <button
      type="submit"
      aria-disabled={pending || ariaDisabled || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
        else onClick?.(event);
      }}
      className={buttonClass(variant, `${pending ? "cursor-progress" : ariaDisabled ? "cursor-not-allowed" : ""} ${className ?? ""}`)}
      {...rest}
    >
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Only spins when the visitor hasn't asked for reduced motion; otherwise it's a still ring. */
export function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 motion-safe:animate-spin" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
