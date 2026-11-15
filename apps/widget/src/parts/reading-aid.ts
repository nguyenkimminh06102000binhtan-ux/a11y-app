import { HOST_TAG } from "../core/host";
import type { Part } from "../core/parts";
import { handOver } from "./handoff";

/*
 * Reading aid (Navigation › Reading aid), downloaded when chosen (see core/parts.ts).
 * - Guide: a bar across the screen just below the line being read.
 * - Mask: dims the screen above and below a window a few lines tall.
 * Both start in the middle of the screen, so choosing one shows it at once (also to keyboard users), then follow
 * the mouse or pen (once per frame), keyboard focus (to the focused element) and the last tap (not while
 * scrolling, which would fight the finger). Clicks, scrolling and selection go through (pointer-events:
 * none); hidden from screen readers. Drawn in the widget's shadow root, before the panel, so the panel stays above
 * the mask and undimmed.
 */

const GUIDE_BELOW_PX = 14; // the ruler sits in the gap under the pointer's line, not across the next one
const WINDOW_PX = 96; // the mask's clear window: about four lines of body text

const CSS = `
.a11yw-aid { position: fixed; inset: 0; pointer-events: none; }
.a11yw-aid[hidden], .a11yw-aid [hidden] { display: none; }
.a11yw-guide {
  position: absolute; left: 0; right: 0; height: 6px; box-sizing: border-box;
  background: #ffd600; border-block: 1px solid #1c1a33;
}
.a11yw-shade { position: absolute; left: 0; right: 0; background: rgb(0 0 0 / 0.6); }
.a11yw-shade-top { top: 0; }
.a11yw-shade-bottom { bottom: 0; }
@media (forced-colors: active) { .a11yw-guide { border-color: CanvasText; } }
`;

type Mode = "guide" | "mask";
let mode: Mode = "guide";
let y: number | null = null;
let frame = 0;
let style: HTMLStyleElement | null = null;
let aid: HTMLElement | null = null;
let guide: HTMLElement | null = null;
let top: HTMLElement | null = null;
let bottom: HTMLElement | null = null;

/** Our layer in the widget's shadow root, before the panel. Null until the widget is on the page. */
function ensure(): HTMLElement | null {
    const shadow = document.querySelector(HOST_TAG)?.shadowRoot;
    if (!shadow) return null;
    if (!aid || aid.getRootNode() !== shadow) {
        style = document.createElement("style");
        style.textContent = CSS;
        aid = document.createElement("div");
        aid.className = "a11yw-aid";
        aid.setAttribute("aria-hidden", "true");
        guide = document.createElement("div");
        guide.className = "a11yw-guide";
        top = document.createElement("div");
        top.className = "a11yw-shade a11yw-shade-top";
        bottom = document.createElement("div");
        bottom.className = "a11yw-shade a11yw-shade-bottom";
        aid.append(guide, top, bottom);
        shadow.prepend(style, aid);
    }
    return aid;
}

function render(): void {
    frame = 0;
    const layer = ensure();
    if (!layer || !guide || !top || !bottom) return;
    layer.hidden = y === null;
    if (y === null) return;
    guide.hidden = mode !== "guide";
    top.hidden = bottom.hidden = mode !== "mask";
    guide.style.top = `${Math.round(y + GUIDE_BELOW_PX)}px`;
    top.style.height = `${Math.max(0, Math.round(y - WINDOW_PX / 2))}px`;
    bottom.style.height = `${Math.max(0, Math.round(innerHeight - y - WINDOW_PX / 2))}px`;
}

function moveTo(next: number): void {
    y = next;
    frame ||= requestAnimationFrame(render);
}

function onPointer(e: PointerEvent): void {
    if (e.type === "pointermove" && e.pointerType === "touch") return; // a finger moving is scrolling
    moveTo(e.clientY);
}

function onFocus(e: FocusEvent): void {
    const path = e.composedPath();
    if (path.some((node) => node instanceof Element && node.localName === HOST_TAG)) return; // the panel
    const target = path[0];
    if (!(target instanceof Element)) return;
    const rect = target.getBoundingClientRect();
    if (rect.height > 0) moveTo(rect.top + rect.height / 2);
}

const LISTENERS: Array<[string, EventListener]> = [
    ["pointermove", onPointer as EventListener],
    ["pointerdown", onPointer as EventListener],
    ["focusin", onFocus as EventListener],
];

function setMode(option?: string): void {
    mode = option === "mask" ? "mask" : "guide";
    if (y !== null) moveTo(y);
}

const readingAid: Part = {
    start(_context, option) {
        setMode(option);
        moveTo(innerHeight / 2);
        LISTENERS.forEach(([type, fn]) => document.addEventListener(type, fn, { capture: true, passive: true }));
        addEventListener("resize", render);
    },
    update: setMode,
    stop() {
        LISTENERS.forEach(([type, fn]) => document.removeEventListener(type, fn, { capture: true }));
        removeEventListener("resize", render);
        cancelAnimationFrame(frame);
        frame = 0;
        y = null;
        aid?.remove();
        style?.remove();
        aid = style = guide = top = bottom = null;
    },
};

handOver("reading-aid", readingAid);
