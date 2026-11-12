/**
 * Site owners can exclude any part of their page from the widget's adjustments:
 *   <div data-a11yw-ignore>…</div>
 * Applies to everything inside, including inside web components within it.
 */
export const IGNORE_ATTR = "data-a11yw-ignore";

export function isIgnored(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.closest(`[${IGNORE_ATTR}]`)) return true;
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : null; // closest() stops at a shadow root: continue from its host
  }
  return false;
}
