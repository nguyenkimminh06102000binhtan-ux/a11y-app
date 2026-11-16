import { HOST_TAG } from "../core/host";
import type { Part, PartContext } from "../core/parts";
import { handOver } from "./handoff";
import { browserEngine, type Engine } from "./speech";

/*
 * Read aloud (Tools › Read aloud), downloaded when turned on (see core/parts.ts).
 * - Turning it on shows a player and says nothing. Clicking text (not a link, button or field: those work as usual)
 *   reads from that block on, block by block. Play with nothing playing reads the selected text, else from the
 *   focused element's block, else from the start of the main content.
 * - Sentence by sentence (speech.ts); the block is outlined and, where the browser supports CSS highlights, the
 *   sentence is highlighted.
 * - Never read: form field values (never text), hidden text, the widget, data-a11yw-ignore="read-aloud" areas.
 *   Nothing is announced to screen readers, and it never starts by itself.
 */

const ID = "read-aloud";
const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, td, th, figcaption, caption, pre";
const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable=""], [contenteditable="true"]';
const SKIP = 'script, style, noscript, template, [aria-hidden="true"], [hidden], input, select, textarea';
const HIGHLIGHT = "a11yw-reading";
const SPEEDS: Array<[string, number]> = [["Slow", 0.75], ["Normal", 1], ["Fast", 1.25], ["Faster", 1.5]];
const SPEED_KEY = "a11yw:read-speed:v1";

const PLAYER_CSS = `
.ra {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.375em;
  box-sizing: border-box; width: min(28em, calc(100vw - 16px)); padding: 0.5em;
  color: var(--bcn-text); background: var(--bcn-bg);
  border: 2px solid var(--bcn-frame); border-radius: 1em; box-shadow: 0 0.25em 1.5em rgb(0 0 0 / 0.2);
}
@media (max-width: 640px) { .ra { left: 8px; right: 8px; width: auto; transform: none; bottom: calc(16px + 4em); } }
.ra-btn {
  font: inherit; width: 2.75em; height: 2.75em; display: inline-flex; align-items: center; justify-content: center;
  padding: 0; color: var(--bcn-text); background: var(--bcn-bg); border: 2px solid var(--bcn-frame); border-radius: 50%;
  cursor: var(--a11yw-cursor-hand, pointer);
}
.ra-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ra-btn svg { width: 1.25em; height: 1.25em; fill: currentColor; }
.ra-speed { display: inline-flex; align-items: center; gap: 0.375em; font-weight: 700; }
.ra-speed select { font: inherit; min-height: 2.75em; padding: 0 0.5em; color: var(--bcn-text); background: var(--bcn-bg); border: 2px solid var(--bcn-frame); border-radius: 0.625em; }
.ra-msg { flex: 1 1 100%; margin: 0; text-align: center; font-size: 0.875em; }
`;
const PAGE_CSS = `::highlight(${HIGHLIGHT}) { background-color: #ffd600; color: #1c1a33; }`;

const ICONS = {
    previous: '<path d="M6 5h2v14H6zM9.5 12 19 5v14z"/>',
    play: '<path d="M7 4.5v15L19.5 12z"/>',
    pause: '<path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/>',
    next: '<path d="M16 5h2v14h-2zM14.5 12 5 5v14z"/>',
    stop: '<path d="M6 6h12v12H6z"/>',
};

type Sentence = { text: string; range: Range | null };

let page: PartContext | null = null;
let isIgnored: (el: Element) => boolean = () => false;
let engine: Engine = browserEngine();
let player: HTMLElement | null = null;
let playButton: HTMLButtonElement | null = null;
let style: HTMLStyleElement | null = null;
let pageStyle: HTMLStyleElement | null = null;
let rate = readSpeed();
let blocks: HTMLElement[] = [];
let blockIndex = -1;
let sentences: Sentence[] = [];
let sentenceIndex = 0;
let state: "idle" | "playing" | "paused" = "idle";
let run = 0; // bumped on every start, skip and stop: callbacks from an older run are ignored
let unwatch: (() => void) | null = null;
let outlined: { el: HTMLElement; saved: Array<[string, string, string]> } | null = null;

function readSpeed(): number {
    try {
        const saved = Number(sessionStorage.getItem(SPEED_KEY));
        return SPEEDS.some(([, value]) => value === saved) ? saved : 1;
    } catch {
        return 1;
    }
}

// ─── The page's text ──────────────────────────────────────────────────────────────────────────────────────

function readable(el: Element): boolean {
    return !el.closest(SKIP) && !isIgnored(el) && el.getClientRects().length > 0;
}

/** Blocks with text, in page order, innermost only (a list item holding a paragraph is read as that paragraph). */
function allBlocks(): HTMLElement[] {
    return (page?.deepQueryAll<HTMLElement>(BLOCKS) ?? []).filter((el) => !el.querySelector(BLOCKS) && readable(el) && textNodes(el).length > 0);
}

function textNodes(block: HTMLElement): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        if (text.data.trim() && text.parentElement && readable(text.parentElement)) nodes.push(text);
    }
    return nodes;
}

/** A block's sentences, each with its range in the page (for the highlight). */
function sentencesOf(block: HTMLElement): Sentence[] {
    const nodes = textNodes(block);
    const joined = nodes.map((n) => n.data).join("");
    const found: Sentence[] = [];
    const pattern = /[^.!?。！？]+(?:[.!?。！？]+["'”’)\]]*|$)/g;
    for (let m = pattern.exec(joined); m; m = pattern.exec(joined)) {
        const text = m[0].replace(/\s+/g, " ").trim();
        if (text) found.push({ text, range: rangeFor(nodes, m.index, m.index + m[0].length) });
        if (m[0].length === 0) pattern.lastIndex++;
    }
    return found;
}

function rangeFor(nodes: Text[], start: number, end: number): Range | null {
    const range = document.createRange();
    let offset = 0;
    let started = false;
    for (const node of nodes) {
        const next = offset + node.data.length;
        if (!started && start < next) {
            range.setStart(node, start - offset);
            started = true;
        }
        if (started && end <= next) {
            range.setEnd(node, end - offset);
            return range;
        }
        offset = next;
    }
    return started ? range : null;
}

function langOf(el: Element): string {
    return el.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || navigator.language || "en";
}

// ─── Reading ──────────────────────────────────────────────────────────────────────────────────────────────

function outline(el: HTMLElement | null): void {
    if (outlined) {
        const { el: prev, saved } = outlined;
        saved.forEach(([p, value, priority]) => (value ? prev.style.setProperty(p, value, priority) : prev.style.removeProperty(p)));
        outlined = null;
    }
    if (!el) return;
    const saved = ["outline", "outline-offset"].map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)] as [string, string, string]);
    el.style.setProperty("outline", "3px solid #1c1a33", "important");
    el.style.setProperty("outline-offset", "2px", "important");
    outlined = { el, saved };
}

function highlight(range: Range | null): void {
    const registry = (window.CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightClass = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!registry || !HighlightClass) return; // older browsers: the outline alone
    if (range) registry.set(HIGHLIGHT, new HighlightClass(range));
    else registry.delete(HIGHLIGHT);
}

function setState(next: typeof state): void {
    state = next;
    if (!playButton) return;
    const playing = next === "playing";
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    playButton.innerHTML = svg(playing ? ICONS.pause : ICONS.play);
}

function speakSentence(token: number): void {
    if (token !== run) return;
    const sentence = sentences[sentenceIndex];
    if (!sentence) {
        playBlock(blockIndex + 1);
        return;
    }
    highlight(sentence.range);
    const block = blocks[blockIndex];
    engine.speak(sentence.text, { lang: block ? langOf(block) : langOf(document.documentElement), rate }, () => {
        if (token !== run) return;
        sentenceIndex++;
        speakSentence(token);
    });
}

function playBlock(index: number): void {
    engine.cancel();
    const token = ++run;
    const block = blocks[index];
    if (!block) return finish();
    blockIndex = index;
    sentences = sentencesOf(block);
    sentenceIndex = 0;
    outline(block);
    block.scrollIntoView({ block: "nearest" });
    setState("playing");
    speakSentence(token);
}

/** Read just this text (the visitor's selection): no blocks before or after it. */
function playText(text: string, lang: string): void {
    engine.cancel();
    const token = ++run;
    blocks = [];
    blockIndex = -1;
    outline(null);
    highlight(null);
    sentences = [{ text, range: null }];
    sentenceIndex = 0;
    setState("playing");
    engine.speak(text, { lang, rate }, () => token === run && finish());
}

function startAt(block: HTMLElement): void {
    blocks = allBlocks();
    let index = blocks.indexOf(block);
    if (index < 0) {
        blocks.push(block); // e.g. a block that was just added
        index = blocks.length - 1;
    }
    playBlock(index);
}

function finish(): void {
    run++;
    engine.cancel();
    outline(null);
    highlight(null);
    setState("idle");
}

function play(): void {
    if (state === "playing") {
        engine.pause();
        setState("paused");
        return;
    }
    if (state === "paused") {
        engine.resume();
        setState("playing");
        return;
    }
    const selection = getSelection();
    const selected = selection && !selection.isCollapsed ? selection.toString().replace(/\s+/g, " ").trim() : "";
    if (selected && selection?.anchorNode?.parentElement && readable(selection.anchorNode.parentElement)) {
        return playText(selected, langOf(selection.anchorNode.parentElement));
    }
    const focused = document.activeElement?.closest<HTMLElement>(BLOCKS);
    if (focused && readable(focused)) return startAt(focused);
    blocks = allBlocks();
    const main = document.querySelector("main, [role='main']");
    const first = main ? blocks.findIndex((b) => main.contains(b)) : 0;
    playBlock(Math.max(0, first));
}

function onClick(e: MouseEvent): void {
    const path = e.composedPath().filter((n): n is Element => n instanceof Element);
    if (path.some((el) => el.localName === HOST_TAG || el.matches(INTERACTIVE))) return; // ours, or does something itself
    if (getSelection()?.isCollapsed === false) return; // selecting text by dragging, not a click to read
    const block = path.find((el) => el.matches(BLOCKS));
    if (!block || !(block instanceof HTMLElement)) return;
    const inner = block.querySelector(BLOCKS) ? null : block;
    if (inner && readable(inner)) startAt(inner);
}

// ─── The player ───────────────────────────────────────────────────────────────────────────────────────────

function svg(paths: string): string {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function button(label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ra-btn";
    b.setAttribute("aria-label", label);
    b.innerHTML = svg(icon);
    b.addEventListener("click", onClick);
    return b;
}

function showPlayer(): void {
    const shadow = document.querySelector(HOST_TAG)?.shadowRoot;
    if (!shadow || player?.isConnected) return;
    style = document.createElement("style");
    style.textContent = PLAYER_CSS;
    const bar = document.createElement("div");
    bar.className = "ra";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Read aloud");

    const previous = button("Previous", ICONS.previous, () => blocks.length && playBlock(Math.max(0, blockIndex - 1)));
    playButton = button("Play", ICONS.play, play);
    const next = button("Next", ICONS.next, () => blocks.length && playBlock(blockIndex + 1));
    const stop = button("Stop", ICONS.stop, finish);

    const speed = document.createElement("label");
    speed.className = "ra-speed";
    speed.append("Speed ");
    const select = document.createElement("select");
    for (const [name, value] of SPEEDS) {
        const option = new Option(name, String(value), false, value === rate);
        select.append(option);
    }
    select.addEventListener("change", () => {
        rate = Number(select.value);
        try {
            sessionStorage.setItem(SPEED_KEY, String(rate));
        } catch {
            // Remembered for this page only
        }
        if (state === "playing") {
            const token = ++run; // say the current sentence again at the new speed
            engine.cancel();
            speakSentence(token);
        }
    });
    speed.append(select);

    const message = document.createElement("p");
    message.className = "ra-msg";
    message.textContent = engine.supported ? "Click any text to hear it, or press Play." : "Your browser can't read aloud.";
    if (!engine.supported) [previous, playButton, next, stop, select].forEach((control) => (control.disabled = true));

    bar.append(previous, playButton, next, speed, stop, message);
    shadow.append(style, bar);
    player = bar;
}

const readAloud: Part = {
    start(context) {
        page = context;
        isIgnored = context.ignoredBy(ID);
        engine = browserEngine();
        pageStyle = document.createElement("style");
        pageStyle.textContent = PAGE_CSS;
        (document.head ?? document.documentElement).append(pageStyle);
        showPlayer();
        // Saved as on: this starts before the widget is on the page. Show the player once it's added.
        unwatch = context.onElementsAdded((added) => {
            if (added.some((el) => el.localName === HOST_TAG)) showPlayer();
        });
        document.addEventListener("click", onClick, true);
        addEventListener("pagehide", finish);
    },
    refresh: showPlayer,
    stop() {
        unwatch?.();
        unwatch = null;
        document.removeEventListener("click", onClick, true);
        removeEventListener("pagehide", finish);
        finish();
        player?.remove();
        style?.remove();
        pageStyle?.remove();
        player = style = pageStyle = playButton = null;
        blocks = [];
    },
};

handOver(ID, readAloud);
