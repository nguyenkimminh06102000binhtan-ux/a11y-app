import type { ToggleImpl } from "./types";

/*
 * Hide images (id "hide-images"; words in the catalog, @app/widget-config). Pictures become a plain striped box of
 * the same size, so nothing on the page moves: their content is pushed out of their box (object-position) and the
 * element's own background shows. Still in the page, so screen readers keep their alt text, and Image descriptions
 * still works on them. Background images are removed (background colors stay). Icon SVGs (no role="img") stay:
 * buttons need them.
 */
const STRIPES = "repeating-linear-gradient(45deg, #e6e6e6 0 8px, #f7f7f7 8px 16px)";

export const hideImages: ToggleImpl = {
    css: (scope) => `
      *${scope} { background-image: none !important; }
      :is(img, video, input[type="image"])${scope} {
        object-position: -99999px 0 !important;
        background-image: ${STRIPES} !important;
      }
      svg[role="img"]${scope} { background-image: ${STRIPES} !important; }
      svg[role="img"] > :not(title, desc)${scope} { opacity: 0 !important; }
    `,
};
