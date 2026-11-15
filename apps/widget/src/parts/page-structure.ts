import { HOST_TAG } from "../core/host";
import type { Part, PartContext } from "../core/parts";
import { handOver } from "./handoff";

/*
 * Page structure (Navigation › Page structure), downloaded the first time it's opened (see core/parts.ts).
 * A modal <dialog> in the widget's shadow root listing the page's headings, landmarks and links (web components
 * included; hidden ones, our widget and data-a11yw-ignore="page-structure" areas left out). Choosing one closes the
 * dialog, scrolls to it, moves focus to it (a temporary tabindex="-1" if it can't take focus) and outlines it
 * briefly. Esc or Close returns focus to the Page structure button. The panel's own styles (widget.css) apply in
 * here too: title, close button, segmented choice, focus ring.
 * Plain DOM, not Preact: the part would otherwise carry a second copy of Preact.
 */

const ID = "page-structure";
const MAX_LINKS = 500;
const OUTLINE_MS = 2000;

type Kind = "headings" | "landmarks" | "links";
type Item = { el: HTMLElement; text: string; level?: number };

const KINDS: Array<{ kind: Kind; label: string; empty: string }> = [
    { kind: "headings", label: "Headings", empty: "This page has no headings." },
    { kind: "landmarks", label: "Landmarks", empty: "This page has no landmarks." },
    { kind: "links", label: "Links", empty: "This page has no links." },
];

const LANDMARK_NAMES: Record<string, string> = {
    main: "Main",
    navigation: "Navigation",
    complementary: "Aside",
    banner: "Header",
    contentinfo: "Footer",
    search: "Search",
    form: "Form",
    region: "Region",
};

const CSS = `
.ps {
  box-sizing: border-box;
  width: min(32em, calc(100vw - 16px));
  max-height: calc(100vh - 32px);
  padding: 0;
  font: inherit;
  color: var(--bcn-text);
  background: var(--bcn-bg);
  border: 2px solid var(--bcn-frame);
  border-radius: 1em;
}
.ps[open] { display: flex; flex-direction: column; }
.ps::backdrop { background: rgb(0 0 0 / 0.45); }
.ps-head { display: flex; align-items: center; gap: 0.625em; padding: 0.75em 0.75em 0.75em 1em; border-bottom: 1px solid var(--bcn-frame); }
.ps-show { min-width: 0; margin: 0; padding: 0.75em 1em; border: 0; border-bottom: 1px solid var(--bcn-frame); }
.ps-legend { float: left; width: 100%; padding: 0; margin: 0 0 0.375em; font-weight: 700; } /* float: sits inside the padding, not on the edge */
.ps-show .level-options { clear: both; }
@media (max-width: 440px) { /* narrow screens: the three choices stacked, so their words don't wrap */
  .ps-show .level-options { grid-template-columns: 1fr; }
  .ps-show .level + .level .level-face { border-left: 0; border-top: 1px solid var(--bcn-frame); }
}
.ps-body { flex: 1; min-height: 0; overflow: auto; padding: 0.5em 1em 1em; }
.ps-list { list-style: none; margin: 0; padding: 0; }
.ps-item {
  font: inherit; color: inherit; width: 100%; min-height: 2.75em;
  display: flex; align-items: center; gap: 0.5em; padding: 0.375em 0.5em;
  text-align: start; background: none; border: 0; border-radius: 0.5em;
  cursor: var(--a11yw-cursor-hand, pointer);
}
.ps-item:hover { background: var(--bcn-state-tint); }
.ps-level { flex: none; font-size: 0.8125em; font-weight: 700; padding: 0.125em 0.375em; border: 1px solid var(--bcn-frame); border-radius: 0.375em; }
.ps-text { min-width: 0; overflow-wrap: anywhere; }
.ps-note { margin: 0.5em 0 0; }
`;

let page: PartContext | null = null;
let dialog: HTMLDialogElement | null = null;
let opener: HTMLElement | null = null;
let returnFocus = true; // false when closing to go to an item: the close event comes later, so it's read there

// ─── Reading the page ─────────────────────────────────────────────────────────────────────────────────────

function clean(text: string | null | undefined): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

/** aria-label, then aria-labelledby: the name a landmark or link was given. */
function givenName(el: Element): string {
    const label = clean(el.getAttribute("aria-label"));
    if (label) return label;
    const ids = el.getAttribute("aria-labelledby");
    if (!ids) return "";
    const root = el.getRootNode() as Document | ShadowRoot;
    return clean(ids.split(/\s+/).map((id) => root.getElementById?.(id)?.textContent ?? "").join(" "));
}

function shown(el: HTMLElement, ignored: (el: Element) => boolean): boolean {
    return el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"], [inert]') && !ignored(el);
}

function headings(ignored: (el: Element) => boolean): Item[] {
    return page!
        .deepQueryAll<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]')
        .filter((el) => shown(el, ignored))
        .map((el) => {
            const aria = parseInt(el.getAttribute("aria-level") ?? "", 10);
            const level = aria > 0 ? aria : /^h[1-6]$/.test(el.localName) ? Number(el.localName[1]) : 2;
            return { el, level, text: givenName(el) || clean(el.textContent) };
        })
        .filter((item) => item.text);
}

/** A landmark's role, from its role attribute or its element. Null if it isn't one. */
function landmarkRole(el: HTMLElement): string | null {
    const explicit = el.getAttribute("role")?.trim().split(/\s+/)[0];
    if (explicit) return explicit in LANDMARK_NAMES ? explicit : null;
    const scoped = !!el.parentElement?.closest("article, aside, main, nav, section"); // header/footer inside these aren't landmarks
    switch (el.localName) {
        case "main": return "main";
        case "nav": return "navigation";
        case "aside": return "complementary";
        case "search": return "search";
        case "header": return scoped ? null : "banner";
        case "footer": return scoped ? null : "contentinfo";
        case "form": return givenName(el) ? "form" : null; // only named ones
        case "section": return givenName(el) ? "region" : null;
        default: return null;
    }
}

function landmarks(ignored: (el: Element) => boolean): Item[] {
    const selector = 'main, nav, aside, header, footer, form, section, search, [role="main"], [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="search"], [role="form"], [role="region"]';
    return page!
        .deepQueryAll<HTMLElement>(selector)
        .filter((el) => shown(el, ignored))
        .flatMap((el) => {
            const role = landmarkRole(el);
            if (!role) return [];
            const name = givenName(el);
            return [{ el, text: name ? `${LANDMARK_NAMES[role]}: ${name}` : LANDMARK_NAMES[role] }];
        });
}

function links(ignored: (el: Element) => boolean): Item[] {
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const el of page!.deepQueryAll<HTMLAnchorElement>("a[href]")) {
        if (!shown(el, ignored)) continue;
        const images = Array.from(el.querySelectorAll("img[alt]"), (img) => img.getAttribute("alt")).join(" ");
        const text = givenName(el) || clean(el.textContent) || clean(images) || el.href;
        const key = `${text}\n${el.href}`;
        if (seen.has(key)) continue; // same words, same place: listed once
        seen.add(key);
        items.push({ el, text });
        if (items.length >= MAX_LINKS) break;
    }
    return items;
}

// ─── Going to an item ─────────────────────────────────────────────────────────────────────────────────────

const FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]";

function jump(el: HTMLElement): void {
    returnFocus = false;
    dialog?.close();
    el.scrollIntoView({ block: "center" });
    if (!el.matches(FOCUSABLE)) {
        el.setAttribute("tabindex", "-1"); // so focus can land here; removed when it leaves
        el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
    }
    el.focus({ preventScroll: true });
    // Show where they landed, then put the element's own outline back
    const saved = ["outline", "outline-offset"].map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)] as const);
    el.style.setProperty("outline", "3px solid #1c1a33", "important");
    el.style.setProperty("outline-offset", "2px", "important");
    setTimeout(() => saved.forEach(([p, value, priority]) => (value ? el.style.setProperty(p, value, priority) : el.style.removeProperty(p))), OUTLINE_MS);
}

// ─── The dialog ───────────────────────────────────────────────────────────────────────────────────────────

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

function renderList(list: HTMLUListElement, note: HTMLParagraphElement, kind: Kind, items: Item[]): void {
    list.replaceChildren(
        ...items.map((item) => {
            const li = make("li");
            const button = make("button", "ps-item");
            button.type = "button";
            if (item.level) {
                button.style.paddingInlineStart = `${0.5 + (Math.min(item.level, 6) - 1) * 1}em`; // indented by level
                button.append(make("span", "ps-level", `H${item.level}`), " "); // a real space: "H2 Deals", not "H2Deals"
            }
            button.append(make("span", "ps-text", item.text));
            button.addEventListener("click", () => jump(item.el));
            li.append(button);
            return li;
        })
    );
    const k = KINDS.find((x) => x.kind === kind)!;
    note.textContent = items.length === 0 ? k.empty : kind === "links" && items.length >= MAX_LINKS ? `Showing the first ${MAX_LINKS} links.` : "";
    note.hidden = !note.textContent;
}

function open(): void {
    const shadow = document.querySelector(HOST_TAG)?.shadowRoot;
    if (!shadow || !page) return;
    opener = (shadow.activeElement as HTMLElement | null) ?? null;
    dialog?.remove();

    if (!shadow.querySelector("style[data-ps]")) {
        const style = make("style");
        style.dataset.ps = "";
        style.textContent = CSS;
        shadow.append(style);
    }

    const ignored = page.ignoredBy(ID);
    const found: Record<Kind, Item[]> = { headings: headings(ignored), landmarks: landmarks(ignored), links: links(ignored) };

    const d = make("dialog", "ps");
    d.setAttribute("aria-labelledby", "ps-title");
    const head = make("div", "ps-head");
    const title = make("h2", "title", "Page structure");
    title.id = "ps-title";
    const close = make("button", "close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => d.close());
    head.append(title, close);

    const show = make("fieldset", "ps-show");
    show.append(make("legend", "ps-legend", "Show"));
    const options = make("div", "level-options");
    options.style.setProperty("--levels", String(KINDS.length));
    const list = make("ul", "ps-list");
    const note = make("p", "ps-note");
    KINDS.forEach(({ kind, label }, i) => {
        const option = make("label", "level");
        const radio = make("input", "level-input");
        radio.type = "radio";
        radio.name = "ps-show";
        radio.checked = i === 0;
        if (i === 0) radio.autofocus = true; // focus starts on the choice
        radio.addEventListener("change", () => renderList(list, note, kind, found[kind]));
        option.append(radio, make("span", "level-face", `${label} (${found[kind].length})`));
        options.append(option);
    });
    show.append(options);

    const body = make("div", "ps-body");
    body.append(list, note);
    d.append(head, show, body);
    d.addEventListener("close", () => {
        if (returnFocus) opener?.focus(); // Esc or Close: back to the Page structure button
        returnFocus = true;
        d.remove();
        if (dialog === d) dialog = null;
    });
    renderList(list, note, "headings", found.headings);
    shadow.append(d);
    dialog = d;
    d.showModal();
}

const pageStructure: Part = {
    start(context) {
        page = context;
        open();
    },
    stop() {
        dialog?.close();
    },
};

handOver(ID, pageStructure);
