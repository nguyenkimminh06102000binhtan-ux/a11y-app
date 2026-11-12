import { SCOPE } from "./scope";
import type { ToggleFeature } from "./types";

export const focusOutline: ToggleFeature = {
    key: "focusOutline",
    label: "Stronger focus outline",
    hint: "Shows a thick outline around whatever the keyboard is on.",
    // Same two-tone ring as the widget's own: a dark ring next to the element, a white one outside it.
    css: `
      :focus-visible${SCOPE} {
        outline: 3px solid #1a1a1a !important;
        outline-offset: 0 !important;
        box-shadow: 0 0 0 6px #fff !important;
      }
      @media (forced-colors: active) {
        :focus-visible${SCOPE} {
          outline-color: Highlight !important;
        }
      }
    `,
};
