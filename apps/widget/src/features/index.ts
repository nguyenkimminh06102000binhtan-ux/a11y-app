import { CATALOG } from "@app/widget-config";
import { bigCursor } from "./big-cursor";
import { color } from "./color";
import { contrast } from "./contrast";
import { font } from "./font";
import { hideImages } from "./hide-images";
import { imageDescriptions } from "./image-descriptions";
import { lineHeight } from "./line-height";
import { focusOutline } from "./focus-outline";
import { highlightLinks } from "./highlight-links";
import { pageStructure } from "./page-structure";
import { pauseAnimations } from "./pause-animations";
import { readAloud } from "./read-aloud";
import { readingAid } from "./reading-aid";
import { textSizeFeature } from "./text-size";
import { textAlign } from "./text-align";
import { textSpacing } from "./text-spacing";
import type { Feature, Implementations, SettingFeature } from "./types";

export type { ActionFeature, Behavior, Feature, LevelFeature, SettingFeature, ToggleFeature } from "./types";

/** What each catalog entry does. A missing or extra entry, or one of the wrong kind, is a type error. */
const IMPLEMENTATIONS: Implementations = {
    "text-size": textSizeFeature,
    "line-height": lineHeight,
    font,
    "text-spacing": textSpacing,
    "text-align": textAlign,
    "image-descriptions": imageDescriptions,
    contrast,
    color,
    "hide-images": hideImages,
    "pause-animations": pauseAnimations,
    "reading-aid": readingAid,
    "big-cursor": bigCursor,
    "highlight-links": highlightLinks,
    "focus-outline": focusOutline,
    "page-structure": pageStructure,
    "read-aloud": readAloud,
};

/**
 * Every setting the widget offers, in panel order: the catalog (@app/widget-config, shared with the dashboard)
 * joined with what each one does. The UI, the page styles and the saved settings all read this list.
 */
export const FEATURES: Feature[] = CATALOG.map((entry) => ({ ...entry, ...IMPLEMENTATIONS[entry.id] }) as Feature);

/** The saved settings among them (not the actions). */
export const SETTING_FEATURES = FEATURES.filter((f): f is SettingFeature => f.kind !== "action");
