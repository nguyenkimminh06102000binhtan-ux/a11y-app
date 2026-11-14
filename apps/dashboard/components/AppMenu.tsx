"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type Props = { brand: ReactNode; children: ReactNode };

/**
 * The app menu's container. From 768px it's always shown (the sidebar). On phones it's behind a "Menu" button:
 * a disclosure (not a modal), so nothing traps focus. Esc closes it and returns focus to the button, and it
 * closes by itself after you go to another page.
 * Reads the URL, so render it inside <Suspense> with <AppMenuView open={false}> as the fallback.
 */
export function AppMenu({ brand, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  // Went to another page: close (adjusted while rendering, not in an effect)
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }
  return (
    <AppMenuView brand={brand} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)}>
      {children}
    </AppMenuView>
  );
}

export function AppMenuView({
  brand,
  open,
  onToggle,
  onClose,
  children,
}: Props & { open: boolean; onToggle?: () => void; onClose?: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {brand}
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls="app-menu"
          onClick={onToggle}
          className="inline-flex items-center gap-2 border-frame bg-surface md:hidden"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
            {open ? <path d="M4 4l8 8M12 4l-8 8" /> : <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />}
          </svg>
          Menu
        </button>
      </div>
      <div
        id="app-menu"
        className={`${open ? "flex" : "hidden"} flex-1 flex-col gap-6 md:flex`}
        onKeyDown={(event) => {
          // Esc on a phone: close and go back to the button (the Combobox handles its own Esc first)
          if (event.key === "Escape" && open && !event.defaultPrevented) {
            onClose?.();
            buttonRef.current?.focus();
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
