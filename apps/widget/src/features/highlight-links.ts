import type { ToggleImpl } from "./types";

/** Highlight links (id "highlight-links"; words in the catalog, @app/widget-config). */
export const highlightLinks: ToggleImpl = {
    inherited: true, // `color` passes down to children (e.g. an ignored <span> inside a link)
    css: (scope) => `
      a[href]${scope} {
        background-color: #ff0 !important;
        color: #000 !important;
        text-decoration: underline !important;
        text-decoration-thickness: 0.15em !important;
        text-underline-offset: 0.15em !important;
      }
    `,
};
