import type { ToggleImpl } from "./types";

/** Text spacing (id "text-spacing"; words in the catalog, @app/widget-config). */
export const textSpacing: ToggleImpl = {
    inherited: true, // line-height, letter-spacing and word-spacing pass down to children
    css: (scope) => `
      *${scope} {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p${scope} {
        margin-bottom: 2em !important;
      }
    `,
};
