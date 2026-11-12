/**
 * An issue's impact as a labelled pill. The word is always shown (never color alone); the look only adds
 * emphasis: critical = the shared "on" look (tint + state border, bold), serious = state border, others = frame.
 */
const STYLES: Record<string, string> = {
  critical: "bg-state-tint border-state font-bold",
  serious: "border-state font-bold",
};

export function ImpactPill({ impact }: { impact: string | null }) {
  const level = impact ?? "unknown";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-sm capitalize ${STYLES[level] ?? "border-frame"}`}>
      {level}
    </span>
  );
}
