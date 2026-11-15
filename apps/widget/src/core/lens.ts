import { HOST_TAG } from "./host";
import { pickParent } from "../ui/mount";

/*
 * The lens: one transparent full-screen layer whose backdrop-filter recolors everything behind it (Color).
 * Unlike a `filter` on the page, it changes no layout: an element with a filter becomes the containing block of
 * the fixed elements inside it, so fixed headers and modals would start scrolling with the page. And unlike a filter on <html>, it doesn't touch the widget, which sits above it.
 * - Clicks, taps and scrolling go through it (pointer-events: none); hidden from assistive tech.
 * - Always placed just before the widget's host, so the widget (same z-index, later in the page) stays on top.
 * - Covers the whole screen: data-a11yw-ignore can't exclude an area from it.
 * - Its own inline !important styles beat any page rule, ours included (e.g. Contrast's backgrounds).
 */
const TAG = "a11yw-lens";
const ORDER = ["color"] as const; // the order the filters are applied in, when more settings use the lens
type LensPart = (typeof ORDER)[number];

const filters = new Map<LensPart, string>();
let lens: HTMLElement | null = null;

/** Set (or with null, remove) one setting's filter. The lens exists only while at least one is set. */
export function setLensFilter(part: LensPart, filter: string | null): void {
    if (filter) filters.set(part, filter);
    else filters.delete(part);
    update();
}

function update(): void {
    const value = ORDER.map((part) => filters.get(part))
        .filter(Boolean)
        .join(" ");
    if (!value) {
        lens?.remove();
        lens = null;
        return;
    }
    if (!lens) {
        lens = document.createElement(TAG);
        lens.setAttribute("aria-hidden", "true");
    }
    lens.style.cssText = [
        "display: block",
        "position: fixed",
        "inset: 0",
        "z-index: 2147483647",
        "pointer-events: none",
        "margin: 0",
        "padding: 0",
        "border: 0",
        "background: transparent",
        "opacity: 1",
        "visibility: visible",
        "transform: none",
        "filter: none",
        `backdrop-filter: ${value}`,
        `-webkit-backdrop-filter: ${value}`, // Safari before 18
    ]
        .map((rule) => `${rule} !important`)
        .join("; ");
    place();
}

/** In the page, just before the widget's host (or where the widget goes, if it isn't mounted yet). */
function place(): void {
    if (!lens) return;
    const host = document.querySelector(HOST_TAG);
    const parent = host?.parentElement ?? pickParent();
    if (host && host.parentElement === parent) {
        if (lens.nextElementSibling !== host) parent.insertBefore(lens, host);
    } else if (lens.parentElement !== parent) {
        parent.appendChild(lens);
    }
}

/** Put the lens back if the page removed it (e.g. a single-page app replacing <body>'s children). */
export function restoreLens(): void {
    if (lens && !lens.isConnected) place();
}
