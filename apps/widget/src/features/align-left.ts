import type { ToggleImpl } from "./types";

/*
 * Align left (id "align-left"; words in the catalog, @app/widget-config): text blocks line up on one side
 * instead of being centered or justified (WCAG 1.4.8). `start`, so right-to-left pages line up on the right.
 * Text blocks only, never <div>s, so centered buttons and layouts stay where they are.
 */
const BLOCKS = ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "dd", "dt", "td", "th", "figcaption", "caption"];

export const alignLeft: ToggleImpl = {
    inherited: true, // text-align passes down to children (e.g. an ignored <div> inside a list item)
    css: (scope) => `
      ${BLOCKS.map((tag) => `${tag}${scope}`).join(", ")} {
        text-align: start !important;
        text-align-last: auto !important;
      }
    `,
};
