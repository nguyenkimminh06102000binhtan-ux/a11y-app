import type { LevelCount, LevelImpl } from "./types";

/*
 * Align text (id "text-align"; words in the catalog, @app/widget-config): text blocks line up on the left or the
 * right edge instead of being centered or justified (WCAG 1.4.8). Physical sides, so "Left" means left on every
 * page, right-to-left ones included.
 * Text blocks only, never <div>s, so centered buttons and layouts stay where they are.
 */
const ALIGN = [null, "left", "right"] as const; // Default (the page's own), Left, Right
ALIGN satisfies { length: LevelCount<"text-align"> };

const BLOCKS = ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "dd", "dt", "td", "th", "figcaption", "caption"];

export const textAlign: LevelImpl = {
    inherited: true, // text-align passes down to children (e.g. an ignored <div> inside a list item)
    css: (level, scope) => {
        const align = ALIGN[level];
        if (!align) return "";
        return `
      ${BLOCKS.map((tag) => `${tag}${scope}`).join(", ")} {
        text-align: ${align} !important;
        text-align-last: auto !important;
      }
    `;
    },
};
