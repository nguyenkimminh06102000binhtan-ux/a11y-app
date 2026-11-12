import { onElementsAdded } from "./dom-watcher";
import { deepQueryAll } from "./shadow-roots";

/*
 * Same-origin iframes (CMS previews, rich-text editors, e-learning players…) are separate documents:
 * the page's <style> doesn't reach into them. Each iframe is handed to `callback` when found and
 * every time it loads a new page (which wipes whatever we added to the old one).
 * Iframes from another origin can't be reached by any script: frameDocument() returns null for them.
 */
const WIDGET_MARK = "data-a11yw-account"; // set on <html> by our loader (entries/loader.ts LOADED_ATTR)

const frames = new Set<HTMLIFrameElement>();
let onFrame: ((frame: HTMLIFrameElement) => void) | null = null;

/** Start watching. Call after watchShadowRoots(): that starts the observer on the document. */
export function watchIframes(callback: (frame: HTMLIFrameElement) => void): void {
  if (onFrame) return; // already watching
  onFrame = callback;
  deepQueryAll<HTMLIFrameElement>("iframe").forEach(register);
  onElementsAdded((added) => added.forEach((el) => deepQueryAll<HTMLIFrameElement>("iframe", el).forEach(register)));
}

/** Every iframe found so far. Kept even if removed: one put back reloads, and its load event tells us. */
export function knownIframes(): Iterable<HTMLIFrameElement> {
  return frames;
}

/** The iframe's document, if scripts here may touch it (same origin) and it doesn't run its own copy of the widget. */
export function frameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    const doc = frame.contentDocument; // null for another origin
    if (!doc?.documentElement || doc.documentElement.hasAttribute(WIDGET_MARK)) return null;
    return doc;
  } catch {
    return null;
  }
}

function register(frame: HTMLIFrameElement): void {
  if (frames.has(frame)) return;
  frames.add(frame);
  frame.addEventListener("load", () => onFrame?.(frame)); // each new page loaded in it
  onFrame?.(frame); // the page it has right now
}
