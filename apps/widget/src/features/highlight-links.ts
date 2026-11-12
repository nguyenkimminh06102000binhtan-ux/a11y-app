import type { ToggleFeature } from "./types";

export const highlightLinks: ToggleFeature = {
    id: "highlight-links",
    key: "highlightLinks",
    label: "Highlight links",
    hint: "Makes every link stand out with a yellow background and underline.",
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
