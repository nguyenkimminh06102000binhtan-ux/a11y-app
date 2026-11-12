import type { Settings } from "./settings";

type BooleanKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export type ToggleFeature = {
  key: BooleanKey;
  label: string; // the control's accessible name
  hint: string;  // short description, linked with aria-describedby
  css: string;   // added to the page while the setting is on
};

/**
 * Every setting the widget offers. The UI, the page styles and (in step 4) per-account
 * config all read this list, so a feature is defined in exactly one place.
 */
export const FEATURES: ToggleFeature[] = [
  {
    key: "highlightLinks",
    label: "Highlight links",
    hint: "Makes every link stand out with a yellow background and underline.",
    css: `
      a[href] {
        background-color: #ff0 !important;
        color: #000 !important;
        text-decoration: underline !important;
        text-decoration-thickness: 0.15em !important;
        text-underline-offset: 0.15em !important;
      }
    `,
  },
    {
    key: "textSpacing",
    label: "Text spacing",
    hint: "Adds space between lines, letters, words and paragraphs.",
    // WCAG 1.4.12 values. `:not(#a11yw-x)` matches every element but adds id-level specificity,
    // so these rules beat page rules like `.article p { line-height: 1.2 !important }`.
    css: `
      *:not(#a11yw-x) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p:not(#a11yw-x) {
        margin-bottom: 2em !important;
      }
    `,
  },
  {
    key: "focusOutline",
    label: "Stronger focus outline",
    hint: "Shows a thick outline around whatever the keyboard is on.",
    // Same two-tone ring as the widget's own: a dark ring next to the element, a white one outside it.
    css: `
      :focus-visible:not(#a11yw-x) {
        outline: 3px solid #1a1a1a !important;
        outline-offset: 0 !important;
        box-shadow: 0 0 0 6px #fff !important;
      }
      @media (forced-colors: active) {
        :focus-visible:not(#a11yw-x) {
          outline-color: Highlight !important;
        }
      }
    `,
  },
];
