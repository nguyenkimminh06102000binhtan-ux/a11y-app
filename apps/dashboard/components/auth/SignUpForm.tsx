"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signUp, type SignUpField, type SignUpState } from "@/app/signup/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FocusedAlert } from "@/components/FocusedAlert";
import { PasswordField } from "@/components/auth/PasswordField";
import { CheckEmail } from "@/components/auth/CheckEmail";
import { FieldError } from "@/components/auth/FieldError";
import { GoogleButton, OrWithEmail } from "@/components/auth/GoogleButton";
import { MIN_PASSWORD } from "@/lib/password";

const IDLE: SignUpState = {};
const ORDER: SignUpField[] = ["name", "email", "site", "password", "terms"]; // page order: focus the first wrong one

/**
 * Sign up: Google (soon), then name, work email, website (optional: it becomes the first site), password and the
 * terms. Errors appear under their fields and focus moves to the first one; what was typed stays (not the password).
 * Afterwards "Check your email": the account is made when the confirmation link is opened.
 */
export function SignUpForm({ google }: { google: boolean }) {
  const [state, formAction] = useActionState(signUp, IDLE);
  const [editing, setEditing] = useState(false);
  const errors = state.errors ?? {};
  const values = state.values ?? { name: "", email: "", site: "" };

  useEffect(() => {
    const first = ORDER.find((f) => state.errors?.[f]);
    if (first) document.getElementById(first)?.focus(); // each field's id is its name
  }, [state]);

  if (state.sent && !editing) {
    return (
      <CheckEmail
        key={state.at}
        formAction={formAction}
        hidden={{ email: state.sent }}
        resendIntent="resend"
        onEdit={() => setEditing(true)}
        notice={state.error === "busy" && <FocusedAlert>Too many tries. Wait a minute, then send it again.</FocusedAlert>}
      >
        To finish, open the link we sent to <b className="wrap-anywhere">{state.sent}</b>. It works for one hour. Already
        signed up with this email? <Link href="/login">Sign in</Link> instead.
      </CheckEmail>
    );
  }

  const field = (name: SignUpField) => ({ "aria-invalid": errors[name] ? true : undefined });
  const describe = (name: SignUpField, hint?: boolean) =>
    [errors[name] && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <GoogleButton label="Sign up with Google" enabled={google} />
      <OrWithEmail />
      <form action={(data) => (setEditing(false), formAction(data))} noValidate className="flex-col items-stretch gap-[1.125rem]">
        {(state.error === "busy" || state.error === "unknown") && (
          <FocusedAlert key={state.at}>
            {state.error === "busy" ? "Too many tries. Wait a minute, then try again." : "Something went wrong. Please try again in a moment."}
          </FocusedAlert>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="m-0">Your name</label>
          <input key={`name-${state.at ?? 0}`} id="name" name="name" type="text" autoComplete="name" defaultValue={values.name} aria-describedby={describe("name")} className="max-w-none" {...field("name")} />
          {errors.name && <FieldError id="name-error">{errors.name}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="m-0">Work email</label>
          <input key={`email-${state.at ?? 0}`} id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@company.com" defaultValue={values.email} aria-describedby={describe("email")} className="max-w-none" {...field("email")} />
          {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="site" className="m-0">
            Your website <span className="font-normal text-muted">(optional)</span>
          </label>
          <input key={`site-${state.at ?? 0}`} id="site" name="site" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="shop.com" defaultValue={values.site} aria-describedby={describe("site", true)} className="max-w-none" {...field("site")} />
          {errors.site && <FieldError id="site-error">{errors.site}</FieldError>}
          <p id="site-hint" className="m-0 text-small text-muted">We&apos;ll add it as your first site. You can add more later.</p>
        </div>

        <PasswordField
          key={`password-${state.at ?? 0}`}
          id="password"
          label="Password"
          autoComplete="new-password"
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters. A few words together work well.`}
        />

        <div className="flex flex-col gap-1.5">
          <label className="m-0 flex min-h-11 cursor-pointer items-start gap-3 font-normal leading-snug">
            <input id="terms" type="checkbox" name="terms" aria-describedby={describe("terms")} className="mt-0.5 size-[1.375rem] shrink-0" {...field("terms")} />
            <span>
              I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and the{" "}
              <Link href="/privacy" target="_blank">Privacy Policy</Link>
              <span className="sr-only"> (open in a new tab)</span>
            </span>
          </label>
          {errors.terms && <FieldError id="terms-error">{errors.terms}</FieldError>}
        </div>

        <SubmitButton pendingLabel="Creating your account…" className="min-h-[3.25rem] text-[1.0625rem]">
          Create account
        </SubmitButton>
      </form>
    </>
  );
}
