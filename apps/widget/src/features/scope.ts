import { ignoreSelectors } from "../core/ignore";

// Browsers without :has() (Firefox < 121, Safari < 15.4) drop a whole rule whose selector uses it.
// Browsers too old to answer this question get `false`: the safe answer.
const HAS_SUPPORTED = typeof CSS !== "undefined" && !!CSS.supports?.("selector(:has(a))");

/**
 * The selector suffix every page rule of setting `id` ends with. It matches every element except:
 * - our own placeholder id `#a11yw-x` (no element has it). This adds id-level specificity, so our
 *   rules beat page rules like `.article p { line-height: 1.2 !important }`; a :not() list counts
 *   as its most specific item, so the id-level strength stays;
 * - areas the site owner opted out of this setting with data-a11yw-ignore, and everything inside them;
 * - with `inherited` (settings whose CSS sets inherited properties: line-height, color…): also elements
 *   that CONTAIN such an area. Otherwise the area would inherit our values from its ancestors.
 *   Those ancestors keep the page's own values, so the area inherits exactly what the page set.
 *   Trade-off: text directly inside such an ancestor isn't adjusted either.
 *   Needs :has(). Without it this part is left out, so the setting still works, but an opted-out
 *   area inherits the setting from the element around it.
 */
export function scopeFor(id: string, inherited = false): string {
  const ignored = ignoreSelectors(id);
  const inside = ignored.flatMap((s) => [s, `${s} *`]);
  const scope = `:not(#a11yw-x, ${inside.join(", ")})`;
  return inherited && HAS_SUPPORTED ? `${scope}:not(:has(${ignored.join(", ")}))` : scope;
}
