import type { ToggleImpl } from "./types";

/** Stronger focus outline (id "focus-outline"; words in the catalog, @app/widget-config). */
export const focusOutline: ToggleImpl = {
    // Same two-tone ring as the widget's own: a dark ring next to the element, a white one outside it.
    css: (scope) => `
      :focus-visible${scope} {
        outline: 3px solid #1a1a1a !important;
        outline-offset: 0 !important;
        box-shadow: 0 0 0 6px #fff !important;
      }
      @media (forced-colors: active) {
        :focus-visible${scope} {
          outline-color: Highlight !important;
        }
      }
    `,
};
