import type { ToggleFeature } from "./types";

export const textSpacing: ToggleFeature = {
    id: "text-spacing",
    key: "textSpacing",
    label: "Text spacing",
    hint: "Adds space between lines, letters, words and paragraphs.",
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
