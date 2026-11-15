"use client";

import { useSyncExternalStore } from "react";
import { exactTime, relativeTime } from "@/lib/relative-time";

/* One timer for every <RelativeTime> on the page: they all move on together, once a minute. */
const listeners = new Set<() => void>();
let minute = Math.floor(Date.now() / 60000);
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      minute = Math.floor(Date.now() / 60000);
      listeners.forEach((l) => l());
    }, 60000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * "2 hours ago", in a <time> that carries the exact moment (datetime, and a hover tooltip). With `exact`, screen
 * readers also hear the exact time after it ("2 hours ago (Nov 15, 2026, 9:40 AM UTC)"), for links that must
 * point to one specific moment.
 */
export function RelativeTime({ iso, exact = false }: { iso: string; exact?: boolean }) {
  useSyncExternalStore(subscribe, () => minute, () => minute);
  const date = new Date(iso);
  const full = exactTime(date);
  return (
    // The server's clock and the browser's can be a minute apart: the browser's text wins without a warning
    <time dateTime={iso} title={full} suppressHydrationWarning>
      {relativeTime(date, new Date())}
      {exact && <span className="sr-only"> ({full})</span>}
    </time>
  );
}
