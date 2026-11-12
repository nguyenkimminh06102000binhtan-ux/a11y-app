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
];
