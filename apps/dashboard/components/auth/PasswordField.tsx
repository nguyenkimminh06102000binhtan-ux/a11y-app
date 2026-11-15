"use client";

import { useState } from "react";
import { FieldError } from "@/components/auth/FieldError";

type Props = {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  hint?: string; // under the field, read with it ("At least 10 characters…")
  error?: string; // under the field, read with it, with the field marked invalid
  inputRef?: React.Ref<HTMLInputElement>;
  labelAside?: React.ReactNode; // beside the label, e.g. "Forgot password?"
};

/**
 * A password field with a Show / Hide button inside its edge. The button says what it will do ("Show password"),
 * so its name changes with the state; focus stays on it. Pasting and password managers work as usual.
 */
export function PasswordField({ id, label, autoComplete, invalid, hint, error, inputRef, labelAside }: Props) {
  const [visible, setVisible] = useState(false);
  const bad = invalid || !!error;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor={id} className="m-0">
          {label}
        </label>
        {labelAside}
      </div>
      <div
        className="flex items-center rounded-[0.625rem] border-[1.5px] border-frame bg-surface pr-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink data-invalid:border-[2.5px] data-invalid:border-ink"
        data-invalid={bad || undefined}
      >
        <input
          ref={inputRef}
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="none"
          className="min-w-0 flex-1 border-0! outline-none!"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="inline-flex min-h-11 min-w-16 cursor-pointer items-center justify-center rounded-lg border-0 bg-subtle px-3 text-small font-bold text-ink hover:underline"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-small text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
