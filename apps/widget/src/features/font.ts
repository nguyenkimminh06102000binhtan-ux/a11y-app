import { CDN_BASE } from "../core/cdn-base";
import type { LevelCount, LevelImpl } from "./types";

/*
 * Font (id "font"; words in the catalog, @app/widget-config): Clear (Atkinson Hyperlegible Next), Wide (Lexend),
 * Simple (Andika). All SIL Open Font License, served unchanged from our CDN, never from Google (no visitor IPs
 * sent to a third party).
 * - Nothing is downloaded until a visitor picks one, and then only that font: a <link> to its stylesheet
 *   (fonts/<name>.<hash>.css, built by scripts/fonts.mjs) goes in <head>. Its @font-face rules each cover a unicode
 *   range, so a page only fetches the parts its text uses. Fonts declared in the document also reach open shadow
 *   roots. Same-origin iframes get the font-family rule but not the font: they show the system font.
 * - Our own family names, so a page that already uses one of these fonts isn't affected.
 * - Characters a font doesn't have (e.g. Vietnamese in Clear) use the system font, as does a page whose
 *   Content-Security-Policy blocks our stylesheet or fonts.
 * - Kept as they are: code (monospace) and icon fonts, which would otherwise turn into letters. Icons drawn with
 *   ::before set their own font-family, so they keep it anyway.
 */

const FONTS = [null, ["clear", "AccessPilot Clear"], ["wide", "AccessPilot Wide"], ["simple", "AccessPilot Simple"]] as const;
FONTS satisfies { length: LevelCount<"font"> };

const KEEP = [
    // Code keeps its monospace font, including syntax-highlighting spans inside it
    "code", "kbd", "samp", "pre", "code *", "kbd *", "samp *", "pre *",
    // Icon fonts (Font Awesome, Material Icons/Symbols, Glyphicons, Bootstrap Icons, Dashicons, icomoon…)
    '[class*="icon"]', ".fa", ".fas", ".far", ".fab", ".fal", ".fad", ".fa-solid", ".fa-regular", ".fa-brands",
    '[class^="fa-"]', '[class*=" fa-"]', ".material-icons", '[class^="material-symbols"]', '[class*=" material-symbols"]',
    ".glyphicon", ".dashicons", ".bi", '[class^="bi-"]', '[class*=" bi-"]',
    "math", "math *",
].join(", ");

const LINK_ID = "a11yw-font";
let chosen: (typeof FONTS)[number] = null;

/** The chosen font's stylesheet in <head>, there only while a font is chosen. */
function setLink(): void {
    const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!chosen) {
        existing?.remove();
        return;
    }
    const href = CDN_BASE + __FONT_CSS__[chosen[0]];
    if (existing?.getAttribute("href") === href) return;
    const link = existing ?? document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    link.href = href;
    if (!existing) (document.head ?? document.documentElement).appendChild(link);
}

export const font: LevelImpl & { restore(): void } = {
    inherited: true, // font-family passes down to children (e.g. an ignored area inside a paragraph)
    css: (level, scope) => {
        const choice = FONTS[level];
        return choice ? `*${scope}:not(${KEEP}) { font-family: "${choice[1]}", system-ui, sans-serif !important; }` : "";
    },
    apply(level) {
        chosen = FONTS[level] ?? null;
        setLink();
    },
    /** Put the stylesheet back if the page removed it (e.g. a single-page app replacing <head>). */
    restore: setLink,
};
