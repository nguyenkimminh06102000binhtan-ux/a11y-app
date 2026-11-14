import axe from "axe-core";

/**
 * Which WCAG success criteria an axe rule checks, from axe-core's own rule metadata (tags like "wcag111" and
 * "wcag2a"), so every issue gets its criteria without storing them, old scans included.
 * The dashboard pins the same axe-core version the worker scans with (apps/dashboard/package.json), so the
 * rule ids always match. Import it from server components only, so axe-core is never sent to browsers.
 */

export type Criterion = { id: string; name: string; level: "A" | "AA" | "AAA" };
export type RuleWcag = { criteria: Criterion[]; version: "2.0" | "2.1" | "2.2" | null };

/**
 * WCAG 2.2 success criteria at levels A and AA (the W3C titles), plus the AAA ones axe's A/AA rules also tag.
 * 4.1.1 is obsolete in 2.2 but axe still tags it.
 */
const NAMES: Record<string, [string, Criterion["level"]]> = {
  "1.1.1": ["Non-text Content", "A"],
  "1.2.1": ["Audio-only and Video-only (Prerecorded)", "A"],
  "1.2.2": ["Captions (Prerecorded)", "A"],
  "1.2.3": ["Audio Description or Media Alternative (Prerecorded)", "A"],
  "1.2.4": ["Captions (Live)", "AA"],
  "1.2.5": ["Audio Description (Prerecorded)", "AA"],
  "1.3.1": ["Info and Relationships", "A"],
  "1.3.2": ["Meaningful Sequence", "A"],
  "1.3.3": ["Sensory Characteristics", "A"],
  "1.3.4": ["Orientation", "AA"],
  "1.3.5": ["Identify Input Purpose", "AA"],
  "1.4.1": ["Use of Color", "A"],
  "1.4.2": ["Audio Control", "A"],
  "1.4.3": ["Contrast (Minimum)", "AA"],
  "1.4.4": ["Resize Text", "AA"],
  "1.4.5": ["Images of Text", "AA"],
  "1.4.10": ["Reflow", "AA"],
  "1.4.11": ["Non-text Contrast", "AA"],
  "1.4.12": ["Text Spacing", "AA"],
  "1.4.13": ["Content on Hover or Focus", "AA"],
  "2.1.1": ["Keyboard", "A"],
  "2.1.2": ["No Keyboard Trap", "A"],
  "2.1.3": ["Keyboard (No Exception)", "AAA"],
  "2.1.4": ["Character Key Shortcuts", "A"],
  "2.2.1": ["Timing Adjustable", "A"],
  "2.2.2": ["Pause, Stop, Hide", "A"],
  "2.3.1": ["Three Flashes or Below Threshold", "A"],
  "2.4.1": ["Bypass Blocks", "A"],
  "2.4.2": ["Page Titled", "A"],
  "2.4.3": ["Focus Order", "A"],
  "2.4.4": ["Link Purpose (In Context)", "A"],
  "2.4.5": ["Multiple Ways", "AA"],
  "2.4.6": ["Headings and Labels", "AA"],
  "2.4.7": ["Focus Visible", "AA"],
  "2.4.11": ["Focus Not Obscured (Minimum)", "AA"],
  "2.5.1": ["Pointer Gestures", "A"],
  "2.5.2": ["Pointer Cancellation", "A"],
  "2.5.3": ["Label in Name", "A"],
  "2.5.4": ["Motion Actuation", "A"],
  "2.5.7": ["Dragging Movements", "AA"],
  "2.5.8": ["Target Size (Minimum)", "AA"],
  "3.1.1": ["Language of Page", "A"],
  "3.1.2": ["Language of Parts", "AA"],
  "3.2.1": ["On Focus", "A"],
  "3.2.2": ["On Input", "A"],
  "3.2.3": ["Consistent Navigation", "AA"],
  "3.2.4": ["Consistent Identification", "AA"],
  "3.2.6": ["Consistent Help", "A"],
  "3.3.1": ["Error Identification", "A"],
  "3.3.2": ["Labels or Instructions", "A"],
  "3.3.3": ["Error Suggestion", "AA"],
  "3.3.4": ["Error Prevention (Legal, Financial, Data)", "AA"],
  "3.3.7": ["Redundant Entry", "A"],
  "3.3.8": ["Accessible Authentication (Minimum)", "AA"],
  "4.1.1": ["Parsing", "A"],
  "4.1.2": ["Name, Role, Value", "A"],
  "4.1.3": ["Status Messages", "AA"],
};

const VERSION_OF: Record<string, RuleWcag["version"]> = {
  wcag2a: "2.0", wcag2aa: "2.0", wcag2aaa: "2.0",
  wcag21a: "2.1", wcag21aa: "2.1", wcag21aaa: "2.1",
  wcag22a: "2.2", wcag22aa: "2.2", wcag22aaa: "2.2",
};

/** "wcag1410" → "1.4.10": principle, guideline, then the rest is the criterion number. */
function criterionId(tag: string): string | null {
  const digits = /^wcag(\d{3,4})$/.exec(tag)?.[1];
  return digits ? `${digits[0]}.${digits[1]}.${digits.slice(2)}` : null;
}

const BY_RULE = new Map<string, RuleWcag>(
  axe.getRules().map((rule) => {
    const ids = rule.tags.map(criterionId).filter((id): id is string => !!id);
    const criteria = ids.map((id): Criterion => {
      const known = NAMES[id];
      return { id, name: known?.[0] ?? "", level: known?.[1] ?? "AAA" };
    });
    const version = rule.tags.map((t) => VERSION_OF[t]).find(Boolean) ?? null;
    return [rule.ruleId, { criteria, version }];
  })
);

/** The WCAG criteria an axe rule checks (none for best-practice rules). */
export function wcagFor(ruleId: string): RuleWcag {
  return BY_RULE.get(ruleId) ?? { criteria: [], version: null };
}

/** "1.4.3 Contrast (Minimum)", or just the number when we don't have its name. */
export function criterionLabel(c: Criterion): string {
  return c.name ? `${c.id} ${c.name}` : c.id;
}

/** Sort criteria by number: 1.4.3 before 1.4.10 before 2.1.1. */
export function compareCriteria(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

/** For checks: criteria axe's rules use that have no name here, so a missing name can be caught. */
export function criteriaWithoutNames(): string[] {
  const missing = new Set<string>();
  for (const { criteria } of BY_RULE.values()) for (const c of criteria) if (!c.name) missing.add(c.id);
  return [...missing];
}
