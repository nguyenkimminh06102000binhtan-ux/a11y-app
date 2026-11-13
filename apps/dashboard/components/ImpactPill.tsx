import { Badge } from "@/components/ui/Badge";

/**
 * An issue's impact as a labelled badge. The word is always shown (never color alone); the look only adds
 * emphasis: critical = the shared "on" tint with a state edge and bold, serious = state edge and bold, others = frame.
 */
export function ImpactPill({ impact }: { impact: string | null }) {
  const level = impact ?? "unknown";
  const tone = level === "critical" || level === "serious" ? "strong" : "neutral";
  return (
    <Badge tone={tone} className={`capitalize ${level === "critical" ? "bg-state-tint" : ""}`}>
      {level}
    </Badge>
  );
}
