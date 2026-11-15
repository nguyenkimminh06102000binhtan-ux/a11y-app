import { HOST_TAG } from "../core/host";
import type { LevelCount, LevelImpl } from "./types";

/*
 * Big cursor (id "big-cursor"; words in the catalog, @app/widget-config): a 48px arrow, and a hand over links and
 * buttons, in black (white outline) or white (black outline), so it shows on any background. Text fields keep the
 * text cursor, to place it between letters. Generated from SVG templates, not stored as images.
 * The widget gets it too: page CSS can't reach into its shadow root, but custom properties set on its host pass
 * through, and widget.css uses --a11yw-cursor and --a11yw-cursor-hand.
 * Other sites' iframes keep the normal cursor: a page can't change the cursor inside another site.
 */
const ARROW = (fill: string, line: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path d="M8 4 L8 40 L17 31 L23 45 L29 42 L23 29 L36 29 Z" fill="${fill}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/></svg>`;
const HAND = (fill: string, line: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path d="M19 7 a3 3 0 0 1 6 0 V22 a3 3 0 0 1 6 0 V24 a3 3 0 0 1 6 0 V26 a3 3 0 0 1 6 0 V35 c0 6 -5 11 -11 11 h-6 c-4 0 -7 -2 -9 -6 L10 31 a3 3 0 0 1 5 -4 L19 31 Z" fill="${fill}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/></svg>`;

const COLORS = [null, ["#000", "#fff"], ["#fff", "#000"]] as const; // Default, Black, White: [fill, outline]
COLORS satisfies { length: LevelCount<"big-cursor"> };

const url = (svg: string, x: number, y: number, fallback: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;

const CLICKABLE = 'a[href], button, [role="button"], [role="link"], label, select, summary, input:is([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"], [type="image"], [type="file"], [type="range"], [type="color"])';
const TYPING = 'textarea, [contenteditable=""], [contenteditable="true"], input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"], [type="image"], [type="file"], [type="range"], [type="color"], [type="hidden"])';

export const bigCursor: LevelImpl = {
    inherited: true, // cursor passes down to children (e.g. an opted-out area inside a paragraph)
    css: (level, scope) => {
        const colors = COLORS[level];
        if (!colors) return "";
        const [fill, line] = colors;
        const arrow = url(ARROW(fill, line), 8, 4, "auto");
        const hand = url(HAND(fill, line), 22, 5, "pointer");
        return `
      *${scope} { cursor: ${arrow} !important; }
      :is(${CLICKABLE})${scope}, :is(a[href], button, [role="button"], [role="link"]) *${scope} { cursor: ${hand} !important; }
      :is(${TYPING})${scope} { cursor: text !important; }
      ${HOST_TAG} { --a11yw-cursor: ${arrow}; --a11yw-cursor-hand: ${hand}; }
    `;
    },
};
