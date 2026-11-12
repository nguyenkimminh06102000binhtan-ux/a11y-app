import { SCOPE } from "./scope";
import type { ToggleFeature } from "./types";

export const highlightLinks: ToggleFeature = {
    key: "highlightLinks",
    label: "Highlight links",
    hint: "Makes every link stand out with a yellow background and underline.",
    css: `
      a[href]${SCOPE} {
        background-color: #ff0 !important;
        color: #000 !important;
        text-decoration: underline !important;
        text-decoration-thickness: 0.15em !important;
        text-underline-offset: 0.15em !important;
      }
    `,
};
