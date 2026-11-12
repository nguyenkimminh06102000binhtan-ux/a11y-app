import { onElementsAdded, watchTree } from "./dom-watcher";
import { HOST_TAG } from "./mount";

let onRoot: ((root: ShadowRoot) => void) | null = null;
const seen = new WeakSet<ShadowRoot>();

/** Find every open shadow root on the page, now and later, and hand each one to `callback` once. */
export function watchShadowRoots(callback: (root: ShadowRoot) => void): void {
  if (onRoot) return; // already watching
  onRoot = callback;

  watchTree(document);
  onElementsAdded((added) => added.forEach(scan));
  rescanShadowRoots();

  // Components defined after our first scan attach shadow roots without adding any elements,
  // which no observer can see. Look again at these milestones (and on every settings change).
  document.addEventListener("DOMContentLoaded", rescanShadowRoots, { once: true });
  window.addEventListener("load", rescanShadowRoots, { once: true });
}

/** Scan the whole page, including inside every open shadow root. Cheap enough for milestones and settings changes. */
export function rescanShadowRoots(): void {
  if (onRoot) scan(document);
}

function scan(start: Document | ShadowRoot | Element): void {
  if (start.nodeType === Node.ELEMENT_NODE) visit(start as Element);
  start.querySelectorAll("*").forEach(visit);
}

function visit(el: Element): void {
  if (el.localName === HOST_TAG) return; // our own widget: page adjustments must never style it
  const root = el.shadowRoot; // null for closed roots: those can't be reached, by design
  if (!root) return;
  if (!seen.has(root)) {
    seen.add(root);
    watchTree(root);
    onRoot?.(root);
  }
  scan(root); // components nested inside this component, including ones defined since the last scan
}
