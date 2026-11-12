import type { Settings } from "./settings";
import { pauseMotion } from "./motion";
import { textSize } from "./text-size";

/**
 * Appended to every page rule. Matches every element except our own placeholder id, so it adds
 * id-level specificity (beats page rules like `.article p { line-height: 1.2 !important }`), and it
 * skips areas the site owner opted out with data-a11yw-ignore. A :not() list counts as its most
 * specific item, so the id-level strength stays.
 */
const SCOPE = ":not(#a11yw-x, [data-a11yw-ignore], [data-a11yw-ignore] *)";


type KeysOfType<T> = { [K in keyof Settings]: Settings[K] extends T ? K : never }[keyof Settings];

export type Behavior = { start(): void; stop(): void };

/** On or off: a checkbox. (`kind` can be left out.) */
export type ToggleFeature = {
    kind?: "toggle";
    key: KeysOfType<boolean>;
    label: string;       // the control's accessible name
    hint: string;        // short description, linked with aria-describedby
    css?: string;        // added to the page (and open shadow roots) while the setting is on
    behavior?: Behavior; // JavaScript run while the setting is on
};

/** One of several levels: a radio group. Level 0 is always the page's own state. */
export type LevelFeature = {
    kind: "levels";
    key: KeysOfType<number>;
    label: string;
    hint: string;
    levels: Array<{ label: string; scale: number }>;
    apply(scale: number): void;
};

export type Feature = ToggleFeature | LevelFeature;

/**
 * Every setting the widget offers. The UI, the page styles and (in step 4) per-account
 * config all read this list, so a feature is defined in exactly one place.
 */
export const FEATURES: Feature[] = [
    {
        kind: "levels",
        key: "textSize",
        label: "Text size",
        hint: "Makes the page's text bigger without zooming the whole page.",
        levels: [
            { label: "Default", scale: 1 },
            { label: "Large (125%)", scale: 1.25 },
            { label: "Larger (150%)", scale: 1.5 },
            { label: "Largest (200%)", scale: 2 },
        ],
        apply: textSize.apply,
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
        key: "pauseAnimations",
        label: "Pause animations",
        hint: "Stops moving effects, GIFs, carousels, and autoplaying video and sound. You can still press play.",
        // Not `animation: none` or `paused`: both can leave fade-in content invisible.
        // A tiny duration (not 0s) jumps to the end state and still fires animationend/transitionend,
        // which some sites wait for (e.g. to finish closing a modal).
        css: `
      *${SCOPE},
      *${SCOPE}::before,
      *${SCOPE}::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
        behavior: pauseMotion,
    },
];
