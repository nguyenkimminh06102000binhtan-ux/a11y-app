"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

const RESEND_AFTER_S = 60;

/**
 * "Check your email", after a sign-in link or a sign-up: where it went (the `children` sentence), a resend after a
 * minute (posts `hidden` + intent=`resendIntent` to `formAction`), and a way back to change the email.
 * Its heading takes focus, so screen reader and keyboard users land on it.
 */
export function CheckEmail({
  formAction,
  hidden,
  resendIntent,
  onEdit,
  notice,
  children,
}: {
  formAction: (data: FormData) => void;
  hidden: Record<string, string>;
  resendIntent: string;
  onEdit: () => void;
  notice?: ReactNode; // e.g. "Too many tries" after a resend
  children: ReactNode;
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
      <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-full bg-state-tint">
        <svg viewBox="0 0 24 24" fill="none" className="size-8 stroke-state" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 6 L12 13 L20.5 6" />
        </svg>
      </span>
      <h2 id="check-heading" ref={headingRef} tabIndex={-1} className="m-0 text-2xl focus:outline-none">
        Check your email
      </h2>
      {notice}
      <p className="m-0 text-lg">{children}</p>
      <p className="m-0 text-muted">Not there after a minute? Check spam or promotions.</p>
      <form action={formAction} className="flex-wrap items-center gap-3">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {left > 0 ? (
          <Button aria-disabled="true" className="cursor-not-allowed border-dashed">
            Send again in {wait}
          </Button>
        ) : (
          <SubmitButton name="intent" value={resendIntent} pendingLabel="Sending…">
            Send it again
          </SubmitButton>
        )}
        <Button variant="quiet" onClick={onEdit} className="underline underline-offset-[0.2em]">
          Use a different email
        </Button>
      </form>
    </section>
  );
}
