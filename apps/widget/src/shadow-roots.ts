import { onElementsAdded, watchTree } from "./dom-watcher";
import { HOST_TAG } from "./mount";

type Tree = Document | ShadowRoot | Element;

let onRoot: ((root: ShadowRoot) => void) | null = null;
const seen = new WeakSet<ShadowRoot>();

/** Find every open shadow root on the page, now and later, and hand each one to `callback` once. */
export function watchShadowRoots(callback: (root: ShadowRoot) => void): void {
  if (onRoot) return; // already watching
  onRoot = callback;

  watchTree(document);
  onElementsAdded((added) => added.forEach((el) => openShadowRootsIn(el).forEach(register)));
  rescanShadowRoots();

  // Components defined after our first scan attach shadow roots without adding any elements,
  // which no observer can see. Look again at these milestones (and on every settings change).
  document.addEventListener("DOMContentLoaded", rescanShadowRoots, { once: true });
  window.addEventListener("load", rescanShadowRoots, { once: true });
}

/** Scan the whole page, including inside every open shadow root. Cheap enough for milestones and settings changes. */
export function rescanShadowRoots(): void {
  if (onRoot) openShadowRootsIn(document).forEach(register);
}

function register(root: ShadowRoot): void {
  if (seen.has(root)) return;
  seen.add(root);
  watchTree(root);
  onRoot?.(root);
}

/** Every open shadow root inside `start`, including nested ones. Never our widget's; closed roots can't be reached. */
export function openShadowRootsIn(start: Tree): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  const check = (el: Element) => {
    if (el.localName === HOST_TAG || !el.shadowRoot) return;
    found.push(el.shadowRoot);
    walk(el.shadowRoot);
  };
  const walk = (node: Tree) => {
    if (node.nodeType === Node.ELEMENT_NODE) check(node as Element);
    node.querySelectorAll("*").forEach(check);
  };
  walk(start);
  return found;
}

/** querySelectorAll that also searches inside every open shadow root (never our widget's). */
export function deepQueryAll<T extends Element = Element>(selector: string, start: Tree = document): T[] {
  const results: T[] = [];
  for (const tree of [start, ...openShadowRootsIn(start)]) {
    if (tree.nodeType === Node.ELEMENT_NODE && (tree as Element).matches(selector)) results.push(tree as T);
    tree.querySelectorAll<T>(selector).forEach((el) => results.push(el));
  }
  return results;
}
