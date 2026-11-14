"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A heading that takes focus when it appears, if asked (e.g. the issue you just picked). Re-key it to focus again.
 * Focus also scrolls it into view: on phones the detail sits below the list.
 */
export function FocusHeading({ id, focus, className, children }: { id: string; focus: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    // No focus ring: it's a landing point for screen readers and the keyboard, not a control
    <h3 ref={ref} id={id} tabIndex={-1} className={`focus:outline-none ${className ?? ""}`}>
      {children}
    </h3>
  );
}
