import { FEATURES } from "./features";
import type { Settings } from "./settings";

const STYLE_ID = "a11yw-page-adjustments";

/** The CSS for every active setting. Empty when nothing is on. */
export function cssFor(settings: Settings): string {
  return FEATURES.filter((f) => settings[f.key]).map((f) => f.css).join("\n");
}

/** Apply the visitor's settings to the page. */
export function applyToPage(settings: Settings): void {
  const css = cssFor(settings);
  setDocumentCss(css);
  // Chunk 2: the same CSS also goes into every open shadow root on the page.
}

/** One <style> in <head>, present only while at least one setting is on. */
function setDocumentCss(css: string): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove(); // nothing on: leave the page exactly as it was
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head ?? document.documentElement).appendChild(style);
  }
  style.textContent = css;
}
