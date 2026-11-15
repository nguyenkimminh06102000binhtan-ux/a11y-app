"use client";

import Link from "next/link";
import { continueWithGoogle } from "@/app/auth/google/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
    </svg>
  );
}

/**
 * "Continue with Google" (sign in) / "Sign up with Google". Its own small form (never inside the email form).
 * New people get an account by continuing, so the note under it says that means agreeing to the terms.
 * Until Google is set up (`enabled` false) it says "coming soon" instead (aria-disabled, so it stays focusable
 * and its note is read with it).
 */
export function GoogleButton({ label, enabled, next = "/" }: { label: string; enabled: boolean; next?: string }) {
  const look =
    "min-h-[3.25rem] w-full gap-3 rounded-xl border-[1.5px] border-frame bg-surface px-4 font-bold text-ink";
  if (!enabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" aria-disabled="true" aria-describedby="google-note" className={`inline-flex cursor-not-allowed items-center justify-center border-dashed ${look}`}>
          <GoogleLogo />
          {label}
        </button>
        <p id="google-note" className="m-0 text-small text-muted">
          Google sign-in is coming soon.
        </p>
      </div>
    );
  }
  return (
    <form action={continueWithGoogle} className="flex-col items-stretch gap-1.5">
      <input type="hidden" name="next" value={next} />
      <SubmitButton variant="secondary" pendingLabel="Opening Google…" aria-describedby="google-note" className={`${look} hover:bg-subtle`}>
        <GoogleLogo />
        {label}
      </SubmitButton>
      <p id="google-note" className="m-0 text-small text-muted">
        New here? Continuing creates your account, and means you agree to the{" "}
        <Link href="/terms" target="_blank">Terms of Service</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>
        <span className="sr-only"> (open in a new tab)</span>.
      </p>
    </form>
  );
}

/** "or with your email", between Google and the form (decoration: the form's labels say it all) */
export function OrWithEmail() {
  return (
    <div aria-hidden="true" className="flex items-center gap-4 text-small text-muted">
      <span className="h-px flex-1 bg-line" />
      or with your email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
