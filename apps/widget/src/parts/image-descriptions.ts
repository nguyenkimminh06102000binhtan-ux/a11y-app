import { ignoredBy } from "../core/ignore";
import { HOST_TAG } from "../core/host";
import type { Part } from "../core/parts";
import { handOver } from "./handoff";

/*
 * Image descriptions, downloaded when the setting is turned on (see core/parts.ts).
 * Pointing at an image, or tabbing to something containing one, shows its description: alt text, aria-label,
 * or an SVG's <title>. Decorative (alt="") and undescribed images show nothing: flagging those is the audit's job,
 * not the visitor's.
 * WCAG 1.4.13: the label can be pointed at without vanishing, stays until the pointer or focus leaves, and Esc
 * closes it. It's hidden from screen readers (aria-hidden), which already read the description.
 * Drawn in the widget's shadow root, so page CSS can't touch it. Touch does nothing: taps keep doing what the page intends.
 */

const ID = "image-descriptions";
const isIgnored = ignoredBy(ID);
const IMAGES = 'img, input[type="image"], [role="img"], svg';
const SHOW_AFTER_MS = 150; // pointer only: no flicker while the pointer crosses the page
const HIDE_AFTER_MS = 300; // time to move the pointer from the image onto the label

const CSS = `
.a11yw-tip {
  position: fixed;
  z-index: 1;
  box-sizing: border-box;
  max-width: min(40ch, calc(100vw - 16px));
  padding: 0.375em 0.625em;
  border: 1px solid transparent; /* shows in forced-colors mode */
  border-radius: 0.5em;
  background: var(--bcn-text);
  color: var(--bcn-bg);
  font-size: 0.9375em;
  line-height: 1.4;
  overflow-wrap: anywhere;
  box-shadow: 0 0.25em 1em rgb(0 0 0 / 0.25);
}
.a11yw-tip[hidden] { display: none; }
`;

let tip: HTMLElement | null = null;
let style: HTMLStyleElement | null = null;
let current: Element | null = null;
let shownBy: "pointer" | "focus" | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** The description of an image-like element, or "" for decorative and undescribed ones. */
function describe(el: Element): string {
    if (el.closest('[aria-hidden="true"]')) return "";
    const label = el.getAttribute("aria-label")?.trim();
    if (label) return label;
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
        const root = el.getRootNode() as Document | ShadowRoot;
        const text = labelledBy
            .split(/\s+/)
            .map((id) => root.getElementById?.(id)?.textContent?.trim() ?? "")
            .join(" ")
            .trim();
        if (text) return text;
    }
    if (el.localName === "img" || el.localName === "input") return el.getAttribute("alt")?.trim() ?? "";
    if (el.localName === "svg") {
        const title = Array.from(el.children).find((child) => child.localName === "title");
        return title?.textContent?.trim() ?? "";
    }
    return "";
}

function isOurs(path: EventTarget[]): boolean {
    return path.some((node) => node instanceof Element && node.localName === HOST_TAG);
}

/** The image the pointer is on, from the event's path (it reaches into open shadow roots). */
function imageInPath(path: EventTarget[]): Element | null {
    for (const node of path) {
        if (node instanceof Element && node.matches(IMAGES)) return node;
    }
    return null;
}

/** For focus: the element itself if it's an image, else the first described image inside it. */
function imageIn(el: Element): Element | null {
    if (el.matches(IMAGES)) return el;
    return Array.from(el.querySelectorAll(IMAGES)).find((img) => describe(img) && !isIgnored(img)) ?? null;
}

function ensureTip(): HTMLElement | null {
    const shadow = document.querySelector(HOST_TAG)?.shadowRoot;
    if (!shadow) return null; // the widget isn't on the page yet
    if (!tip || tip.getRootNode() !== shadow) {
        style = document.createElement("style");
        style.textContent = CSS;
        tip = document.createElement("div");
        tip.className = "a11yw-tip";
        tip.setAttribute("aria-hidden", "true");
        tip.hidden = true;
        shadow.append(style, tip);
    }
    return tip;
}

function show(el: Element, by: "pointer" | "focus"): void {
    clearTimeout(hideTimer);
    const text = describe(el);
    const t = text && !isIgnored(el) ? ensureTip() : null;
    if (!t) return hide();
    current = el;
    shownBy = by;
    t.textContent = text;
    t.hidden = false;
    // Below the image, or above it if there's no room; always inside the screen
    const img = el.getBoundingClientRect();
    const box = t.getBoundingClientRect();
    const gap = 8;
    const below = img.bottom + gap;
    const top = below + box.height <= innerHeight - gap ? below : Math.max(gap, img.top - gap - box.height);
    const left = Math.min(Math.max(gap, img.left), innerWidth - gap - box.width);
    t.style.top = `${Math.round(top)}px`;
    t.style.left = `${Math.round(Math.max(gap, left))}px`;
}

function hide(): void {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    current = null;
    shownBy = null;
    if (tip) tip.hidden = true;
}

function onPointerOver(e: PointerEvent): void {
    if (e.pointerType === "touch") return;
    const path = e.composedPath();
    if (tip && path.includes(tip)) {
        clearTimeout(hideTimer); // on the label itself: keep it
        return;
    }
    if (isOurs(path)) return;
    const img = imageInPath(path);
    clearTimeout(showTimer);
    if (img && img === current) {
        clearTimeout(hideTimer);
        return;
    }
    if (img && describe(img)) {
        showTimer = setTimeout(() => show(img, "pointer"), SHOW_AFTER_MS);
    } else if (shownBy === "pointer") {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, HIDE_AFTER_MS);
    }
}

function onFocusIn(e: FocusEvent): void {
    const target = e.composedPath()[0];
    if (!(target instanceof Element) || isOurs(e.composedPath())) return;
    const img = imageIn(target);
    if (img && describe(img)) show(img, "focus");
    else if (shownBy === "focus") hide();
}

function onFocusOut(): void {
    if (shownBy === "focus") hide();
}

function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && current) hide(); // not stopped: the page's own Esc handling still runs
}

const LISTENERS: Array<[string, EventListener]> = [
    ["pointerover", onPointerOver as EventListener],
    ["focusin", onFocusIn as EventListener],
    ["focusout", onFocusOut],
    ["keydown", onKeyDown as EventListener],
    ["scroll", hide], // the image moved: the visitor can point at it again
];

const imageDescriptions: Part = {
    start() {
        LISTENERS.forEach(([type, fn]) => document.addEventListener(type, fn, { capture: true, passive: true }));
        addEventListener("resize", hide);
    },
    stop() {
        LISTENERS.forEach(([type, fn]) => document.removeEventListener(type, fn, { capture: true }));
        removeEventListener("resize", hide);
        hide();
        tip?.remove();
        style?.remove();
        tip = style = null;
    },
};

handOver(ID, imageDescriptions);
