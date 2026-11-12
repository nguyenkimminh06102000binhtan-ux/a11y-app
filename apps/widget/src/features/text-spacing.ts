import { SCOPE } from "./scope";
import type { ToggleFeature } from "./types";

export const textSpacing: ToggleFeature = {
    key: "textSpacing",
    label: "Text spacing",
    hint: "Adds space between lines, letters, words and paragraphs.",
    css: `
      *${SCOPE} {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p${SCOPE} {
        margin-bottom: 2em !important;
      }
    `,
};
