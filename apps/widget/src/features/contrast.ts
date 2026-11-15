import { setLensFilter } from "../core/lens";
import type { LevelCount, LevelImpl } from "./types";

/*
 * Contrast (id "contrast"; words in the catalog, @app/widget-config).
 * - Dark and Light: page CSS. Plain backgrounds and strong text and link colors (all 4.5:1 or more: white on black
 *   21:1, yellow on black 19.6:1, black on white 21:1, #0000ee on white 9.4:1). Images and video keep their colors
 *   (never inverted); background images stay (Hide images removes them). Links use :any-link, which is less specific
 *   than Highlight links' a[href], so Highlight links still wins. Link contents inherit the link's colors.
 *   Buttons and form fields get a thin inner edge in the text color, so they still look like controls.
 * - High: the lens (core/lens.ts) adds contrast to the site's own colors, so it covers the whole screen.
 */
type Scheme = { scheme: "dark" | "light"; bg: string; text: string; link: string; placeholder: string };
const SCHEMES = [
    null, // Default
    { scheme: "dark", bg: "#000", text: "#fff", link: "#ff0", placeholder: "#c8c8c8" },
    { scheme: "light", bg: "#fff", text: "#000", link: "#0000ee", placeholder: "#595959" },
    null, // High: the lens
] as const satisfies ReadonlyArray<Scheme | null>;
SCHEMES satisfies { length: LevelCount<"contrast"> };

const HIGH = 3;

export const contrast: LevelImpl = {
    inherited: true, // color passes down to children (e.g. an ignored area inside a paragraph)
    css: (level, scope) => {
        const s = SCHEMES[level];
        if (!s) return "";
        return `
      :root { color-scheme: ${s.scheme} !important; }
      *${scope} {
        background-color: ${s.bg} !important;
        color: ${s.text} !important;
      }
      :any-link${scope} { color: ${s.link} !important; }
      :any-link *${scope} {
        color: inherit !important;
        background-color: transparent !important;
      }
      :is(input, select, textarea, button, [role="button"])${scope} {
        border-color: currentColor !important;
        box-shadow: inset 0 0 0 1px currentColor !important; /* a visible edge, even without a border, and no size change */
      }
      *${scope}::placeholder { color: ${s.placeholder} !important; opacity: 1 !important; }
    `;
    },
    apply(level) {
        setLensFilter("contrast", level === HIGH ? "contrast(1.5)" : null);
    },
};
