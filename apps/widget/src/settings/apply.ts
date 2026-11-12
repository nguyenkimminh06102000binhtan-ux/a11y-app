import { FEATURES, type ToggleFeature } from "../features";
import type { Settings } from "./settings";
import { rescanShadowRoots } from "../core/shadow-roots";
import { scopeFor } from "../features/scope";
import { applyBehaviors } from "./behaviors";
import { frameDocument, knownIframes } from "../core/iframes";
import { ignoredBy } from "../core/ignore";


const STYLE_ID = "a11yw-page-adjustments";
let currentCss = "";
let currentSettings: Settings | null = null;


// One stylesheet object shared by every open shadow root: updating it once updates them all.
// Supported in Chrome 73+, Firefox 101+ and Safari 16.4+. Older browsers get a <style> in each root instead.
const shadowSheet = "replaceSync" in CSSStyleSheet.prototype ? new CSSStyleSheet() : null;

// Without a shared stylesheet: every open shadow root we've seen, to update its <style> on each change.
// Kept even if its component is removed: it may be put back, and we're never told about a root twice.
const fallbackRoots = new Set<ShadowRoot>();

/** The CSS for every active setting. Empty when nothing is on. */
/** The CSS for every active setting, minus any `skip` names. Empty when nothing is on. */
export function cssFor(settings: Settings, skip: (id: string) => boolean = () => false): string {
    return FEATURES.filter((f): f is ToggleFeature => f.kind !== "levels" && settings[f.key] && !!f.css && !skip(f.id))
        .map((f) => f.css!(scopeFor(f.id, f.inherited)))
        .join("\n");
}

/** Apply the visitor's settings to the page, every open shadow root and every same-origin iframe on it. */
export function applyToPage(settings: Settings): void {
    currentSettings = settings;
    const css = cssFor(settings);
    setDocumentCss(css);
    if (shadowSheet) shadowSheet.replaceSync(css);
    else fallbackRoots.forEach((root) => setStyle(root, css));
    rescanShadowRoots(); // also catches components that appeared without any change an observer could see
    for (const frame of knownIframes()) applyToFrame(frame);
    applyBehaviors(settings);
}

/** Give a same-origin iframe the CSS settings, minus any the <iframe> element is opted out of. Called by watchIframes. */
export function applyToFrame(frame: HTMLIFrameElement): void {
    const doc = frameDocument(frame);
    if (!doc || !currentSettings) return;
    setStyle(doc, cssFor(currentSettings, (id) => ignoredBy(id)(frame)));
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
        // nodeType, not instanceof: an iframe's document isn't an instance of this page's Document class
        const isDocument = tree.nodeType === Node.DOCUMENT_NODE;
        const doc = isDocument ? (tree as Document) : (tree as ShadowRoot).host.ownerDocument;
        style = doc.createElement("style");
        style.id = STYLE_ID;
        const parent = isDocument ? (doc.head ?? doc.documentElement) : tree;
        parent.appendChild(style); // last, so it comes after the component's own <style>s
    }

    if (style.textContent !== css) style.textContent = css;
}

/** Put our <style> back if the page removed it (e.g. a single-page app replacing <head> contents). */
export function restoreDocumentCss(): void {
    if (currentCss && !document.getElementById(STYLE_ID)) setDocumentCss(currentCss);
}
