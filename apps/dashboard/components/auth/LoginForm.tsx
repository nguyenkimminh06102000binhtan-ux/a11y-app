"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInError, type SignInState } from "@/app/login/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FocusedAlert } from "@/components/FocusedAlert";
import { PasswordField } from "@/components/auth/PasswordField";
import { CheckEmail } from "@/components/auth/CheckEmail";
import { GoogleSoon, OrWithEmail } from "@/components/auth/GoogleSoon";

const IDLE: SignInState = {};

const MESSAGES: Record<SignInError | "link", { title: string; text: string }> = {
  missing: { title: "Enter your email and password.", text: "Or use a sign-in link: it only needs your email." },
  "link-missing": { title: "Enter your email first.", text: "Then choose “Email me a sign-in link”." },
  invalid: {
    title: "We couldn’t sign you in.",
    text: "The email or password doesn’t match an account. Try again, or get a sign-in link by email instead.",
  },
  unconfirmed: { title: "Confirm your email first.", text: "Open the link we sent when you signed up, or get a sign-in link." },
  busy: { title: "Too many tries.", text: "Wait a minute, then try again." },
  unknown: { title: "Something went wrong.", text: "Please try again in a moment." },
  link: { title: "That sign-in link didn’t work.", text: "It may have expired or been used already. Get a new one below." },
};

/**
 * Sign in: Google (soon), then email with a password, or a one-time sign-in link to the same email.
 * One form, one action: the pressed button says which way. A refusal is a message that takes focus (and is
 * announced again on every try); the email stays filled in, the password doesn't.
 */
export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, formAction] = useActionState(signIn, IDLE);
  const [editing, setEditing] = useState(false); // "Use a different email" after a link was sent
  const error = state.error ?? (linkError && !state.at ? "link" : undefined);
  const message = error ? MESSAGES[error] : null;

  if (state.sent && !editing) {
    return (
      <CheckEmail key={state.at} formAction={formAction} hidden={{ email: state.sent, next }} resendIntent="link" onEdit={() => setEditing(true)}>
        If <b className="wrap-anywhere">{state.sent}</b> has an account, a sign-in link is on its way. It works for one hour.
      </CheckEmail>
    );
  }

  return (
    <>
      <GoogleSoon label="Continue with Google" />
      <OrWithEmail />
      <form action={(data) => (setEditing(false), formAction(data))} noValidate className="flex-col items-stretch gap-5">
        <input type="hidden" name="next" value={next} />
        {message && (
          <FocusedAlert key={state.at ?? "link"}>
            <span className="block font-bold">{message.title}</span>
            {message.text}
          </FocusedAlert>
        )}
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
            aria-invalid={(error === "missing" || error === "link-missing") && !state.email ? true : undefined}
            className="max-w-none"
          />
        </div>
        <PasswordField
          key={`password-${state.at ?? 0}`}
          id="password"
          label="Password"
          autoComplete="current-password"
          invalid={error === "invalid" || (error === "missing" && !!state.email)}
        />
        <SubmitButton name="intent" value="password" pendingLabel="Signing in…" className="min-h-[3.25rem] text-[1.0625rem]">
          Sign in
        </SubmitButton>
        <SubmitButton name="intent" value="link" variant="quiet" pendingLabel="Sending…" className="underline underline-offset-[0.2em]">
          Email me a sign-in link instead
        </SubmitButton>
      </form>
    </>
  );
}
