"use client";

import { useActionState, useState } from "react";
import { requestReset, type ForgotState } from "@/app/forgot-password/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FocusedAlert } from "@/components/FocusedAlert";
import { CheckEmail } from "@/components/auth/CheckEmail";

const IDLE: ForgotState = {};

/** Forgot password: the email, then "Check your email" (the same answer whether or not it has an account). */
export function ForgotForm({ linkError }: { linkError: boolean }) {
  const [state, formAction] = useActionState(requestReset, IDLE);
  const [editing, setEditing] = useState(false);

  if (state.sent && !editing) {
    return (
      <CheckEmail key={state.at} formAction={formAction} hidden={{ email: state.sent }} resendIntent="reset" onEdit={() => setEditing(true)}>
        If <b className="wrap-anywhere">{state.sent}</b> has an account, a link to choose a new password is on its way. It
        works once, for one hour.
      </CheckEmail>
    );
  }

  const message =
    state.error === "missing"
      ? "Enter your email first."
      : state.error === "busy"
        ? "Too many tries. Wait a minute, then try again."
        : linkError && !state.at
          ? "That reset link didn’t work. It may have expired or been used already. Send a new one below."
          : null;

  return (
    <form action={(data) => (setEditing(false), formAction(data))} noValidate className="flex-col items-stretch gap-5">
      {message && <FocusedAlert key={state.at ?? "link"}>{message}</FocusedAlert>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="m-0">
          Email
        </label>
        <input
          key={`email-${state.at ?? 0}`}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@company.com"
          defaultValue={state.email ?? ""}
          aria-invalid={state.error === "missing" ? true : undefined}
          className="max-w-none"
        />
      </div>
      <SubmitButton pendingLabel="Sending…" className="min-h-[3.25rem] text-[1.0625rem]">
        Send reset link
      </SubmitButton>
    </form>
  );
}
