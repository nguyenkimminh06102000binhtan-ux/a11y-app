"use client";

import { useActionState, useEffect } from "react";
import { savePassword, type ResetState } from "@/app/reset-password/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { MIN_PASSWORD } from "@/lib/password";

const IDLE: ResetState = {};

/** Choose a new password: one field with Show (no "type it twice"), its rule as a hint, a refusal under it. */
export function ResetForm() {
  const [state, formAction] = useActionState(savePassword, IDLE);
  useEffect(() => {
    if (state.at) document.getElementById("new-password")?.focus(); // back to the field that explains it
  }, [state.at]);
  return (
    <form action={formAction} noValidate className="flex-col items-stretch gap-5">
      <PasswordField
        key={`password-${state.at ?? 0}`}
        id="new-password"
        label="New password"
        autoComplete="new-password"
        error={state.error}
        hint={`At least ${MIN_PASSWORD} characters. A few words together work well.`}
      />
      <SubmitButton pendingLabel="Saving…" className="min-h-[3.25rem] text-[1.0625rem]">
        Save new password
      </SubmitButton>
    </form>
  );
}
