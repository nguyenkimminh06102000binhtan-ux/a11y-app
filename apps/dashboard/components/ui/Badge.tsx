import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "strong" | "live" | "pending" | "soon";

/*
 * A short label: an impact, a widget status, "Soon". The word is always shown, and every tone differs by more
 * than color (bold, a dashed edge, a check mark), so nothing relies on color alone.
 *   neutral: frame edge                      strong: state edge, bold
 *   live:    the shared "on" look (tint, state edge, bold) and a check mark
 *   pending: dashed frame edge (not there yet, e.g. "Not detected")
 *   soon:    dashed frame edge, reads "Soon" unless you pass other text
 * Only "live" has a background; the others are see-through (they pass on white and on --color-subtle), so a
 * caller can add one with className, e.g. bg-state-tint for a critical impact.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "border-frame text-ink",
  strong: "border-state text-ink font-bold",
  live: "border-state bg-state-tint text-state font-bold",
  pending: "border-dashed border-frame text-ink",
  soon: "border-dashed border-frame text-muted",
};

type Props = { tone?: BadgeTone; className?: string; children?: ReactNode };

export function Badge({ tone = "neutral", className = "", children }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-0.5 text-caption ${TONES[tone]} ${className}`}
    >
      {tone === "live" && <CheckIcon />}
      {children ?? (tone === "soon" ? "Soon" : null)}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
