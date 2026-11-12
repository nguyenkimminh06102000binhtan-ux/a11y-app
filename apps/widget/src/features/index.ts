import { focusOutline } from "./focus-outline";
import { highlightLinks } from "./highlight-links";
import { pauseAnimations } from "./pause-animations";
import { textSizeFeature } from "./text-size";
import { textSpacing } from "./text-spacing";
import type { Feature } from "./types";

export type { Behavior, Feature, LevelFeature, ToggleFeature } from "./types";

/**
 * Every setting the widget offers. The UI, the page styles and (in step 4) per-account
 * config all read this list, so a feature is defined in exactly one place.
 */
export const FEATURES: Feature[] = [
    textSizeFeature,
    highlightLinks,
    textSpacing,
    focusOutline,
    pauseAnimations,
];
