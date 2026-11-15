"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Toasts: short success confirmations ("shop.com was deleted.") for things the page already shows. Errors never
 * go here: they stay next to what they're about.
 * - Announced politely by a live region that's always on the page; focus doesn't move.
 * - 6 seconds each, paused while the pointer or keyboard focus is on them; each has a Dismiss button.
 * - Bottom-right from 640px, full width at the bottom on phones. While any are shown, the page gets room
 *   underneath and the focused element is scrolled clear of them (WCAG 2.4.11 Focus Not Obscured).
 */

type Toast = { id: number; message: string };

const DURATION_MS = 6000;
const MAX_SHOWN = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Show a confirmation. Callable from any client component. */
export function toast(message: string): void {
  toasts = [...toasts, { id: nextId++, message }].slice(-MAX_SHOWN);
  emit();
}

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** The visible one (Next keeps the previous page in the DOM, hidden, after navigating). */
export function visibleElement(selector: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
      typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null
    ) ?? null
  );
}

/** Once, in the app layout. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  const [paused, setPaused] = useState(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null); // where focus was before it entered the toasts

  const updatePaused = () => setPaused(hovered.current || focused.current);

  // Room underneath while toasts show, and the focused element kept clear of them
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || list.length === 0) return;
    const root = document.documentElement;
    const keepFocusClear = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || area.contains(active)) return;
      const a = active.getBoundingClientRect();
      const t = area.getBoundingClientRect();
      const overlaps = a.bottom > t.top && a.top < t.bottom && a.right > t.left && a.left < t.right;
      if (overlaps) active.scrollIntoView({ block: "nearest" });
    };
    const fit = () => {
      const space = `${Math.ceil(window.innerHeight - area.getBoundingClientRect().top) + 8}px`;
      root.style.scrollPaddingBottom = space;
      document.body.style.paddingBottom = space;
      keepFocusClear();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    document.addEventListener("focusin", keepFocusClear);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", keepFocusClear);
      root.style.scrollPaddingBottom = "";
      document.body.style.paddingBottom = "";
    };
  }, [list.length]);

  function dismiss(id: number, button: HTMLButtonElement) {
    // Focus was on this Dismiss button: move it to the next toast, or back to where it came from
    const others = [...(areaRef.current?.querySelectorAll<HTMLButtonElement>("button[data-dismiss]") ?? [])].filter((b) => b !== button);
    remove(id);
    if (others.length > 0) others[others.length - 1].focus();
    else {
      const back = returnTo.current?.isConnected ? returnTo.current : visibleElement("#main h1");
      if (back && !back.matches("a, button, input, select, textarea, [tabindex]")) back.setAttribute("tabindex", "-1");
      back?.focus();
      focused.current = false;
      updatePaused();
    }
  }

  return (
    <>
      {/* What screen readers hear: only the messages (not the Dismiss buttons), each new one announced once */}
      <div role="status" className="sr-only">
        {list.map((t) => (
          <p key={t.id}>{t.message}</p>
        ))}
      </div>

      <div
        ref={areaRef}
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96"
        onMouseEnter={() => ((hovered.current = true), updatePaused())}
        onMouseLeave={() => ((hovered.current = false), updatePaused())}
        onFocus={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            returnTo.current = event.relatedTarget as HTMLElement | null;
          }
          focused.current = true;
          updatePaused();
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          focused.current = false;
          updatePaused();
        }}
      >
        {list.map((t) => (
          <ToastItem key={t.id} toast={t} paused={paused} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}

function ToastItem({
  toast,
  paused,
  onDismiss,
}: {
  toast: Toast;
  paused: boolean;
  onDismiss: (id: number, button: HTMLButtonElement) => void;
}) {
  const remaining = useRef(DURATION_MS);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => remove(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, toast.id]);

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-xl border-[1.5px] border-frame bg-surface py-1 pr-1 pl-4 shadow-lg motion-safe:animate-toast-in">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-state" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 10.5 L8.5 13.5 L14.5 7" />
      </svg>
      <p className="m-0 min-w-0 flex-1 py-2 wrap-anywhere">{toast.message}</p>
      <button
        type="button"
        data-dismiss
        onClick={(event) => onDismiss(toast.id, event.currentTarget)}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent px-3 font-bold text-ink"
      >
        Dismiss<span className="sr-only">: {toast.message}</span>
      </button>
    </div>
  );
}

/**
 * A toast for something that happened before a redirect (?deleted=…): shown once, focus moved to `focus`
 * (the page's heading, since the button that was used is gone), and the `clear` params removed from the
 * address so a reload or Back doesn't show it again.
 */
export function ArrivalToast({ message, focus, clear }: { message: string; focus: string; clear: string[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const target = visibleElement(focus);
    if (target) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus();
    }
    toast(message);
    const url = new URL(window.location.href);
    clear.forEach((name) => url.searchParams.delete(name));
    window.history.replaceState(null, "", url); // Next keeps its router in step with this
  }, [message, focus, clear]);
  return null;
}
