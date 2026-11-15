import type { ReactNode } from "react";

/*
 * Loading placeholders in the shape of what's coming, so the page doesn't jump when it arrives.
 * - Screen readers hear only the label ("Loading issues…"); the grey shapes are hidden from them.
 * - They fade in after 300 ms (a fast load never flashes grey) and pulse only without "Reduce motion".
 * - In Windows High Contrast the shapes get an outline, so they don't vanish.
 */

/** The wrapper every skeleton uses: the spoken label, then the shapes. */
export function Skeleton({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" className={`animate-skeleton-in ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

/** One grey shape. Size it with classes (h-4 w-40…). */
export function Bone({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-md bg-line motion-safe:animate-pulse forced-colors:border forced-colors:border-[CanvasText] ${className}`} />
  );
}

/** A few lines of text; the last one shorter, like a paragraph. */
export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full max-w-2xl"}`} />
      ))}
    </div>
  );
}

/** A list like Sites or Scans: a table from 1024px, cards below (same breakpoint as the real lists). */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const items = Array.from({ length: rows }, (_, i) => i);
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
        <div className="flex gap-8 bg-subtle px-4 py-3">
          {["w-24", "w-20", "w-16", "w-20"].map((w, i) => (
            <Bone key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {items.map((i) => (
          <div key={i} className="flex min-h-14 items-center gap-8 border-t border-line px-4">
            <Bone className="h-4 w-48" />
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-24" />
            <Bone className="h-4 w-36" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        {items.map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <Bone className="h-5 w-1/2" />
            <Bone className="h-4 w-3/4" />
            <Bone className="h-4 w-2/3" />
            <Bone className="h-5 w-40" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Cards side by side on wide screens, stacked on phones (Overview, Reports). */
export function SkeletonCards({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:p-5">
          <Bone className="h-5 w-48" />
          <SkeletonText lines={2} />
          <Bone className="h-11 w-44 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Label-and-field pairs, then the button (Customize, Settings). */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-full max-w-xl" />
          <Bone className="h-11 w-full max-w-sm rounded-lg" />
        </div>
      ))}
      <Bone className="h-11 w-52 rounded-lg" />
    </div>
  );
}

/** A search or filter row above a list. */
export function SkeletonSearch() {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-24" />
        <Bone className="h-11 w-64 max-w-full rounded-lg" />
      </div>
      <Bone className="h-11 w-24 rounded-lg" />
    </div>
  );
}
