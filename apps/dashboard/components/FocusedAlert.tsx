"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A message that takes keyboard focus when it appears (e.g. after a form posts back with ?error=), so keyboard and
 * screen reader users land on it instead of at the top of the page.
 *   error   (default): role="alert", the shared attention look from globals.css
 *   success:           role="status", a quiet box ("Removed /cart from the list.")
 * Give it a new `key` to show (and focus) the same text again.
 */
export function FocusedAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p
      ref={ref}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
      className={tone === "success" ? "rounded-xl border border-line bg-subtle px-4 py-3" : undefined}
    >
      {children}
    </p>
  );
}
