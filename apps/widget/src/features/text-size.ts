import { onElementsAdded } from "../core/dom-watcher";
import { ignoreSelectors, ignoredBy } from "../core/ignore";
import { deepQueryAll, onNewShadowRoot } from "../core/shadow-roots";
import type { CATALOG } from "@app/widget-config";
import type { LevelImpl } from "./types";

/*
 * Text size: enlarges the font size of every element with its own text, without zooming the layout
 * (images, spacing and widths stay the same, so pages reflow instead of scrolling sideways).
 * - Each element gets an inline `font-size: calc(<original px> * var(--a11yw-text-scale)) !important`:
 *   works on px-based sites, beats page CSS, and parent and child each scale exactly once.
 * - Changing level only changes the variable on <html>; it also inherits into open shadow roots.
 * - New content is measured with the variable at 1 for a moment, so text inside already enlarged
 *   elements isn't enlarged twice.
 * - Turning it off restores each element's own inline font-size and removes the variable: no trace.
 */
/** Public id of this setting, used in data-a11yw-ignore="…". Never rename once customers use it. */
const ID = "text-size";
const isIgnored = ignoredBy(ID);
// An element containing an opted-out area isn't enlarged either: the area would inherit the bigger size.
const IGNORED_INSIDE = ignoreSelectors(ID).join(", ");

const VAR = "--a11yw-text-scale";
const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link"]);
const FORM_TAGS = new Set(["input", "textarea", "select", "button"]); // their text isn't a text node

type StyleRecord = { value: string; priority: string };
const enlarged = new Map<HTMLElement, StyleRecord>();
const unsubscribes: Array<() => void> = [];
let scale = 1;
let waitingForLoad = false;

function hasOwnText(el: Element): boolean {
    if (FORM_TAGS.has(el.localName)) return true;
    for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
    }
    return false;
}

function textElementsIn(start: Document | ShadowRoot | Element): HTMLElement[] {
    return deepQueryAll("*", start).filter(
        (el): el is HTMLElement =>
            el instanceof HTMLElement && !enlarged.has(el) && !SKIP_TAGS.has(el.localName) && hasOwnText(el) && !isIgnored(el) && !el.querySelector(IGNORED_INSIDE)
    );
}

function enlarge(elements: HTMLElement[]): void {
    if (!elements.length || scale === 1) return;
    const rootStyle = document.documentElement.style;

    rootStyle.setProperty(VAR, "1"); // everything we enlarged is back to its original size for a moment...
    const originals = elements.map((el) => parseFloat(getComputedStyle(el).fontSize)); // ...so we read true sizes (one layout pass)
    rootStyle.setProperty(VAR, String(scale));

    elements.forEach((el, i) => {
        const px = originals[i];
        if (!px) return; // 0 or unreadable (e.g. icon-font tricks): leave alone
        enlarged.set(el, { value: el.style.getPropertyValue("font-size"), priority: el.style.getPropertyPriority("font-size") });
        el.style.setProperty("font-size", `calc(${px}px * var(${VAR}, 1))`, "important");
    });
}

function start(): void {
    if (document.readyState !== "complete") {
        // The page's stylesheets may still be loading: sizes read now could be wrong for good. Start at load.
        if (!waitingForLoad) {
            waitingForLoad = true;
            window.addEventListener("load", onLoad, { once: true });
        }
        return;
    }
    enlarge(textElementsIn(document));
    unsubscribes.push(
        onElementsAdded((added) => enlarge([...new Set(added.flatMap(textElementsIn))])),
        onNewShadowRoot((root) => enlarge(textElementsIn(root)))
    );
}

function onLoad(): void {
    waitingForLoad = false;
    if (scale !== 1) start();
}

function stop(): void {
    window.removeEventListener("load", onLoad);
    waitingForLoad = false;
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    enlarged.forEach((prev, el) => {
        if (prev.value) el.style.setProperty("font-size", prev.value, prev.priority);
        else el.style.removeProperty("font-size");
    });
    enlarged.clear();
    document.documentElement.style.removeProperty(VAR);
}

export const textSize = {
    /** scale 1 = the page's own size (off). Moving between levels only changes one CSS variable. */
    apply(next: number): void {
        const wasOn = scale !== 1;
        scale = next;
        if (scale === 1) {
            if (wasOn) stop();
            return;
        }
        document.documentElement.style.setProperty(VAR, String(scale));
        if (!wasOn) start();
    },
    /** Put the variable back if the page rewrote <html>'s style attribute (enlarged text would shrink silently). */
    restore(): void {
        if (scale !== 1 && document.documentElement.style.getPropertyValue(VAR) !== String(scale)) {
            document.documentElement.style.setProperty(VAR, String(scale));
        }
    },
};

/** The scale of each level in the catalog (Default, 125%, 150%, 200%): one per level, checked by the type below. */
const SCALES = [1, 1.25, 1.5, 2] as const;
type TextSizeLevels = Extract<(typeof CATALOG)[number], { id: typeof ID }>["levels"];
SCALES satisfies { length: TextSizeLevels["length"] };

export const textSizeFeature: LevelImpl = {
    apply: (level) => textSize.apply(SCALES[level] ?? 1),
};
