import { deepQueryAll } from "./shadow-roots";

/**
 * Site owners can exclude parts of their page from the widget's settings:
 *   <div data-a11yw-ignore>…</div>                           every setting
 *   <div data-a11yw-ignore="text-size text-spacing">…</div>  only the settings named (ids: features/*.ts)
 * Applies to the element and everything inside it, including inside web components within it.
 * The ids are a public contract: once customers use them, never rename them.
 */
export const IGNORE_ATTR = "data-a11yw-ignore";
const ALL = "all";

/** Selectors for an element whose ignore attribute covers setting `id`: no value, "all", or a list naming it. */
export function ignoreSelectors(id: string): string[] {
  return [`[${IGNORE_ATTR}=""]`, `[${IGNORE_ATTR}~="${ALL}"]`, `[${IGNORE_ATTR}~="${id}"]`];
}

/** A check for one setting: is this element inside an area the site owner opted out of that setting? */
export function ignoredBy(id: string): (el: Element) => boolean {
  const selector = ignoreSelectors(id).join(", ");
  return (el) => {
    let node: Element | null = el;
    while (node) {
      if (node.closest(selector)) return true;
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null; // closest() stops at a shadow root: continue from its host
    }
    return false;
  };
}

/** Warn once about ignore values that name no setting (most likely a typo, e.g. "text-sise"). */
export function warnUnknownIgnoreIds(knownIds: string[]): void {
  const known = new Set([ALL, ...knownIds]);
  const unknown = new Set<string>();
  for (const el of deepQueryAll(`[${IGNORE_ATTR}]`)) {
    for (const token of (el.getAttribute(IGNORE_ATTR) ?? "").split(/\s+/)) {
      if (token && !known.has(token)) unknown.add(token);
    }
  }
  if (unknown.size) {
    console.warn(`[a11y-widget] Unknown ${IGNORE_ATTR} value: ${[...unknown].join(", ")}. Known: ${[...known].join(", ")}.`);
  }
}
