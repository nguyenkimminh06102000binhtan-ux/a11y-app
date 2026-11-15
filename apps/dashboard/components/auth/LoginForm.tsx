"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  signIn,
  type SignInError,
  type SignInState,
} from "@/app/login/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { FocusedAlert } from "@/components/FocusedAlert";
import { PasswordField } from "@/components/auth/PasswordField";

const IDLE: SignInState = {};
const RESEND_AFTER_S = 60;

const MESSAGES: Record<SignInError | "link", { title: string; text: string }> =
  {
    missing: {
      title: "Enter your email and password.",
      text: "Or use a sign-in link: it only needs your email.",
    },
    "link-missing": {
      title: "Enter your email first.",
      text: "Then choose “Email me a sign-in link”.",
    },
    invalid: {
      title: "We couldn’t sign you in.",
      text: "The email or password doesn’t match an account. Try again, or get a sign-in link by email instead.",
    },
    unconfirmed: {
      title: "Confirm your email first.",
      text: "Open the link we sent when you signed up, or get a new sign-in link.",
    },
    busy: { title: "Too many tries.", text: "Wait a minute, then try again." },
    unknown: {
      title: "Something went wrong.",
      text: "Please try again in a moment.",
    },
    link: {
      title: "That sign-in link didn’t work.",
      text: "It may have expired or been used already. Get a new one below.",
    },
  };

/**
 * Sign in: Google (soon), then email with a password, or a one-time sign-in link to the same email.
 * One form, one action: the pressed button says which way. A refusal is a message that takes focus (and is
 * announced again on every try); the email stays filled in, the password doesn't.
 */
export function LoginForm({
  next,
  linkError,
}: {
  next: string;
  linkError: boolean;
}) {
  const [state, formAction] = useActionState(signIn, IDLE);
  const [editing, setEditing] = useState(false); // "Use a different email" after a link was sent
  const sentTo = state.sent && !editing ? state.sent : null;
  const error = state.error ?? (linkError && !state.at ? "link" : undefined);
  const message = error ? MESSAGES[error] : null;

  if (sentTo)
    return (
      <CheckEmail
        key={state.at}
        email={sentTo}
        next={next}
        formAction={formAction}
        onEdit={() => setEditing(true)}
      />
    );

  return (
    <>
      <GoogleSoon />
      <div
        aria-hidden="true"
        className="flex items-center gap-4 text-small text-muted"
      >
        <span className="h-px flex-1 bg-line" />
        or with your email
        <span className="h-px flex-1 bg-line" />
      </div>
      <form
        action={(data) => (setEditing(false), formAction(data))}
        noValidate
        className="flex-col items-stretch gap-5"
      >
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
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            defaultValue={state.email ?? ""}
            key={`email-${state.at ?? 0}`}
            aria-invalid={
              (error === "missing" || error === "link-missing") && !state.email
                ? true
                : undefined
            }
            className="max-w-none"
          />
        </div>
        <PasswordField
          key={`password-${state.at ?? 0}`}
          id="password"
          label="Password"
          autoComplete="current-password"
          invalid={
            error === "invalid" || (error === "missing" && !!state.email)
          }
        />
        <SubmitButton
          name="intent"
          value="password"
          pendingLabel="Signing in…"
          className="min-h-[3.25rem] text-[1.0625rem]"
        >
          Sign in
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="link"
          variant="quiet"
          pendingLabel="Sending…"
          className="underline underline-offset-[0.2em]"
        >
          Email me a sign-in link instead
        </SubmitButton>
      </form>
    </>
  );
}

/** After a sign-in link was sent: where it went, a resend after a minute, and a way back to change the email. */
function CheckEmail({
  email,
  next,
  formAction,
  onEdit,
}: {
  email: string;
  next: string;
  formAction: (data: FormData) => void;
  onEdit: () => void;
}) {
  const [left, setLeft] = useState(RESEND_AFTER_S);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const wait = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <section aria-labelledby="check-heading" className="flex flex-col gap-4">
      <span
        aria-hidden="true"
        className="inline-flex size-16 items-center justify-center rounded-full bg-state-tint"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-8 stroke-state"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 6 L12 13 L20.5 6" />
        </svg>
      </span>
      <h2
        id="check-heading"
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-2xl focus:outline-none"
      >
        Check your email
      </h2>
      <p className="m-0 text-lg">
        If <b className="wrap-anywhere">{email}</b> has an account, a sign-in
        link is on its way. Open it on this device. It works for one hour.
      </p>
      <p className="m-0 text-muted">
        Not there after a minute? Check spam or promotions.
      </p>
      <form action={formAction} className="flex-wrap items-center gap-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        {left > 0 ? (
          <Button
            aria-disabled="true"
            className="cursor-not-allowed border-dashed"
          >
            Send again in {wait}
          </Button>
        ) : (
          <SubmitButton name="intent" value="link" pendingLabel="Sending…">
            Send it again
          </SubmitButton>
        )}
        <Button
          variant="quiet"
          onClick={onEdit}
          className="underline underline-offset-[0.2em]"
        >
          Use a different email
        </Button>
      </form>
    </section>
  );
}

/** In place for chunk 4; until then it says so instead of doing nothing. */
function GoogleSoon() {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby="google-soon"
        className="inline-flex min-h-[3.25rem] cursor-not-allowed items-center justify-center gap-3 rounded-xl border-[1.5px] border-dashed border-frame bg-surface px-4 font-bold text-ink"
      >
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          focusable="false"
          className="size-5"
        >
          <path
            fill="#4285F4"
            d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z"
          />
          <path
            fill="#FBBC05"
            d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.9l7.3-5.7z"
          />
          <path
            fill="#EA4335"
            d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"
          />
        </svg>
        Continue with Google
      </button>
      <p id="google-soon" className="m-0 text-small text-muted">
        Google sign-in is coming soon.
      </p>
    </div>
  );
}
