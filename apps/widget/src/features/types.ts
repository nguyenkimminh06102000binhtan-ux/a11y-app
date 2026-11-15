import type { CATALOG } from "@app/widget-config";

type Entry = (typeof CATALOG)[number];

export type Behavior = { start(): void; stop(): void };

/*
 * A setting = its catalog entry (@app/widget-config: section, words, levels) + what it does to the page (here).
 * The feature files only export the second part; features/index.ts joins the two.
 */

/** What an on/off setting does while it's on. */
export type ToggleImpl = {
    css?: (scope: string) => string; // page CSS while on; end every selector with `scope` (skips opted-out areas)
    inherited?: boolean; // its CSS sets inherited properties: also skip elements containing an opted-out area
    behavior?: Behavior; // JavaScript run while the setting is on
};

/** What a level setting does: called with the chosen level's index (0 = the page's own state). */
export type LevelImpl = {
    apply(level: number): void;
};

/** On or off: a checkbox tile. */
export type ToggleFeature = Extract<Entry, { kind: "toggle" }> & ToggleImpl;

/** One of several levels: a radio group. */
export type LevelFeature = Extract<Entry, { kind: "levels" }> & LevelImpl;

export type Feature = ToggleFeature | LevelFeature;

/** Exactly one implementation per catalog entry, of the matching kind. */
export type Implementations = { [E in Entry as E["id"]]: E extends { kind: "levels" } ? LevelImpl : ToggleImpl };
