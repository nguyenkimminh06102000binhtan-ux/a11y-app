import { FEATURES, type ToggleFeature } from "../features";
import type { Settings } from "./settings";
import { rescanShadowRoots } from "../core/shadow-roots";
import { scopeFor } from "../features/scope";
import { applyBehaviors } from "./behaviors";

const STYLE_ID = "a11yw-page-adjustments";
let currentCss = "";

// One stylesheet object shared by every open shadow root: updating it once updates them all.
// Supported in Chrome 73+, Firefox 101+ and Safari 16.4+. Older browsers get a <style> in each root instead.
const shadowSheet = "replaceSync" in CSSStyleSheet.prototype ? new CSSStyleSheet() : null;

// Without a shared stylesheet: every open shadow root we've seen, to update its <style> on each change.
// Kept even if its component is removed: it may be put back, and we're never told about a root twice.
const fallbackRoots = new Set<ShadowRoot>();

/** The CSS for every active setting. Empty when nothing is on. */
export function cssFor(settings: Settings): string {
    return FEATURES.filter((f): f is ToggleFeature => f.kind !== "levels" && settings[f.key] && !!f.css)
        .map((f) => f.css!(scopeFor(f.id, f.inherited)))
        .join("\n");
}

/** Apply the visitor's settings to the page and to every open shadow root on it. */
export function applyToPage(settings: Settings): void {
    const css = cssFor(settings);
    setDocumentCss(css);
    if (shadowSheet) shadowSheet.replaceSync(css);
    else fallbackRoots.forEach((root) => setStyle(root, css));
    rescanShadowRoots(); // also catches components that appeared without any change an observer could see
    applyBehaviors(settings);
}

/** Give an open shadow root our settings. Called once per root by watchShadowRoots. */
export function adoptInto(root: ShadowRoot): void {
    if (shadowSheet) {
        // Added after the component's own styles, so with !important our rules win, as they do on the page.
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, shadowSheet];
        return;
    }
    fallbackRoots.add(root);
    setStyle(root, currentCss);
}

/** One <style> in <head>, present only while at least one setting is on. */
function setDocumentCss(css: string): void {
    currentCss = css;
    setStyle(document, css);
}

/**
 * Our <style> in the document's <head> or at the end of a shadow root: there only while at least one
 * setting is on, so turning everything off leaves the page exactly as it was.
 */
function setStyle(tree: Document | ShadowRoot, css: string): void {
    let style = tree.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!css) {
        style?.remove();
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        const parent = tree instanceof Document ? (tree.head ?? tree.documentElement) : tree;
        parent.appendChild(style); // last, so it comes after the component's own <style>s
    }
    if (style.textContent !== css) style.textContent = css;
}

/** Put our <style> back if the page removed it (e.g. a single-page app replacing <head> contents). */
export function restoreDocumentCss(): void {
    if (currentCss && !document.getElementById(STYLE_ID)) setDocumentCss(currentCss);
}
