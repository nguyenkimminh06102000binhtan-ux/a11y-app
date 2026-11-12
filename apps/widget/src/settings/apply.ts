import { FEATURES, type ToggleFeature } from "../features";
import type { Settings } from "./settings";
import { rescanShadowRoots } from "../core/shadow-roots";
import { applyBehaviors } from "./behaviors";

const STYLE_ID = "a11yw-page-adjustments";
let currentCss = "";

// One stylesheet object shared by every open shadow root: updating it once updates them all.
// Supported in Chrome 73+, Firefox 101+ and Safari 16.4+. Older browsers still get the main-document <style>.
const shadowSheet = "replaceSync" in CSSStyleSheet.prototype ? new CSSStyleSheet() : null;

/** The CSS for every active setting. Empty when nothing is on. */
export function cssFor(settings: Settings): string {
    return FEATURES.filter((f): f is ToggleFeature => f.kind !== "levels" && settings[f.key] && !!f.css)
        .map((f) => f.css)
        .join("\n");
}

/** Apply the visitor's settings to the page and to every open shadow root on it. */
export function applyToPage(settings: Settings): void {
    const css = cssFor(settings);
    setDocumentCss(css);
    shadowSheet?.replaceSync(css);
    rescanShadowRoots(); // also catches components that appeared without any change an observer could see
    applyBehaviors(settings);
}

/** Give an open shadow root the shared stylesheet. Called once per root by watchShadowRoots. */
export function adoptInto(root: ShadowRoot): void {
    if (!shadowSheet) return;
    // Added after the component's own styles, so with !important our rules win, as they do on the page.
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, shadowSheet];
}

/** One <style> in <head>, present only while at least one setting is on. */
function setDocumentCss(css: string): void {
    currentCss = css;
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

/** Put our <style> back if the page removed it (e.g. a single-page app replacing <head> contents). */
export function restoreDocumentCss(): void {
    if (currentCss && !document.getElementById(STYLE_ID)) setDocumentCss(currentCss);
}

