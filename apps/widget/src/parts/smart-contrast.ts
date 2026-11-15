import { blend, contrast, parseColor, passingColor, toHex, type Rgba } from "../core/color-math";
import type { Part, PartContext } from "../core/parts";
import { handOver } from "./handoff";

/*
 * Smart contrast (Contrast › Smart), downloaded when chosen (see core/parts.ts).
 * Text that fails WCAG AA against its real background (4.5:1, or 3:1 for large text: 24px, or 18.66px bold) gets an
 * inline `color … !important` with only its lightness moved, so it keeps its hue. Passing text isn't touched.
 * - The background: walk up (across shadow roots) to the first opaque background color, blending semi-transparent
 *   ones on the way. A background image or gradient on the way means the background can't be known: skipped.
 * - Skipped too: disabled controls (WCAG exempts them), gradient-filled text, hidden elements, opted-out areas.
 * - Each element's original inline color is kept, so stop() restores the page exactly. refresh() (after any
 *   setting change: text size changes what's large, Highlight links changes link colors) restores, then looks again.
 * - Works through the page in slices of ~8ms between frames, so long pages never freeze.
 */

const ID = "contrast"; // data-a11yw-ignore="contrast" opts an area out, as for Dark and Light
const SLICE_MS = 8;
const WHITE: Rgba = [255, 255, 255, 1];
const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link", "svg", "math", "iframe", "img", "video", "canvas"]);
const FORM_TAGS = new Set(["input", "textarea", "select", "button"]);

type Saved = { value: string; priority: string };

let context: PartContext | null = null;
let isIgnored: (el: Element) => boolean = () => false;
const changed = new Map<HTMLElement, Saved>();
const unsubscribes: Array<() => void> = [];
let queue: Element[] = [];
let next = 0; // read position in queue (shift() would be slow on long pages)
let timer: ReturnType<typeof setTimeout> | undefined;
let backgrounds = new Map<Element, Rgba | null>(); // per pass: ancestors are shared by many text elements

function hasOwnText(el: Element): boolean {
    if (FORM_TAGS.has(el.localName)) return true;
    for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
    }
    return false;
}

function parentOf(el: Element): Element | null {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
}

/** The opaque color behind an element's text, or null if it can't be known (an image or gradient on the way). */
function backgroundOf(el: Element): Rgba | null {
    if (backgrounds.has(el)) return backgrounds.get(el)!;
    const style = getComputedStyle(el);
    let result: Rgba | null;
    if (style.backgroundImage !== "none") result = null;
    else {
        const own = parseColor(style.backgroundColor);
        const parent = parentOf(el);
        if (own && own[3] >= 1) result = own;
        else {
            const below = parent ? backgroundOf(parent) : WHITE; // the canvas behind the page is white
            result = below && own && own[3] > 0 ? blend(own, below) : below;
        }
    }
    backgrounds.set(el, result);
    return result;
}

function check(el: Element): void {
    if (!(el instanceof HTMLElement) || changed.has(el) || SKIP_TAGS.has(el.localName) || !hasOwnText(el)) return;
    if (el.matches(":disabled, [aria-disabled='true']") || isIgnored(el) || el.getClientRects().length === 0) return;
    const style = getComputedStyle(el);
    if (style.visibility !== "visible" || style.backgroundClip === "text") return;
    const bg = backgroundOf(el);
    const own = parseColor(style.color);
    const fill = parseColor(style.getPropertyValue("-webkit-text-fill-color"));
    if (!bg || !own || own[3] === 0 || (fill && (fill[3] === 0 || toHex(fill) !== toHex(own)))) return; // gradient or fill-colored text
    const fg = own[3] < 1 ? blend(own, bg) : own;
    const px = parseFloat(style.fontSize);
    const large = px >= 24 || (px >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
    const target = large ? 3 : 4.5;
    if (contrast(fg, bg) >= target) return;
    changed.set(el, { value: el.style.getPropertyValue("color"), priority: el.style.getPropertyPriority("color") });
    el.style.setProperty("color", toHex(passingColor(fg, bg, target + 0.1)), "important"); // a little margin for rounding
}

/** Check queued elements in slices, yielding between them so the page stays responsive. */
function work(): void {
    timer = undefined;
    const end = performance.now() + SLICE_MS;
    while (next < queue.length && performance.now() < end) {
        const el = queue[next++];
        try {
            check(el);
        } catch {
            // One odd element never stops the rest
        }
    }
    if (next < queue.length) timer = setTimeout(work, 0);
    else {
        queue = [];
        next = 0;
        backgrounds = new Map(); // a fresh look next time: pages change
    }
}

function enqueue(elements: Element[]): void {
    queue.push(...elements);
    timer ??= setTimeout(work, 0);
}

function all(start?: Document | ShadowRoot | Element): Element[] {
    return context ? context.deepQueryAll("*", start) : [];
}

function restore(): void {
    clearTimeout(timer);
    timer = undefined;
    queue = [];
    next = 0;
    backgrounds = new Map();
    changed.forEach((saved, el) => {
        if (saved.value) el.style.setProperty("color", saved.value, saved.priority);
        else el.style.removeProperty("color");
    });
    changed.clear();
}

function scan(): void {
    if (document.readyState === "complete") enqueue(all());
    else window.addEventListener("load", scan, { once: true }); // page styles may still be loading
}

const smartContrast: Part = {
    start(ctx) {
        context = ctx;
        isIgnored = ctx.ignoredBy(ID);
        scan();
        unsubscribes.push(
            ctx.onElementsAdded((added) => enqueue(added.flatMap((el) => all(el)))),
            ctx.onNewShadowRoot((root) => enqueue(all(root)))
        );
    },
    stop() {
        window.removeEventListener("load", scan);
        unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
        restore();
        context = null;
    },
    refresh() {
        restore();
        scan();
    },
};

handOver("smart-contrast", smartContrast);
