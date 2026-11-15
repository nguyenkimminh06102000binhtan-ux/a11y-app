/**
 * Our mark: a light sending out a beam (same drawing as the widget's). Decorative: the text next to it names it.
 * tone="light" for dark backgrounds (the sign-in panel).
 */
export function Mark({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="12" className={light ? "stroke-night-muted" : "stroke-frame"} />
      <path d="M16 16 L28 10.5 M16 16 L28 21.5" className={light ? "stroke-night-accent" : "stroke-state"} />
      <circle cx="16" cy="16" r="3.5" className={light ? "fill-surface" : "fill-ink"} />
    </svg>
  );
}
