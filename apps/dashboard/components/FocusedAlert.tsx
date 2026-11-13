"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * An error message that takes keyboard focus when it appears (e.g. after a form posts back with ?error=), so
 * keyboard and screen reader users land on it instead of at the top of the page.
 */
export function FocusedAlert({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p ref={ref} role="alert" tabIndex={-1}>
      {children}
    </p>
  );
}
