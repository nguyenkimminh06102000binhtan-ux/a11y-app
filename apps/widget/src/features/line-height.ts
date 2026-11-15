import type { LevelCount, LevelImpl } from "./types";

/*
 * Line height (id "line-height"; words in the catalog, @app/widget-config): one unitless multiplier on every
 * element, so each one scales with its own font size. 1.5 is WCAG 1.4.12's minimum. Written after Text spacing's
 * CSS, so a chosen height wins over its 1.5.
 */
const HEIGHTS = [null, 1.5, 1.75, 2] as const; // Default (the page's own), then one per level
HEIGHTS satisfies { length: LevelCount<"line-height"> };

export const lineHeight: LevelImpl = {
    inherited: true, // line-height passes down to children (e.g. an ignored <span> inside a paragraph)
    css: (level, scope) => {
        const height = HEIGHTS[level];
        return height ? `*${scope} { line-height: ${height} !important; }` : "";
    },
};
