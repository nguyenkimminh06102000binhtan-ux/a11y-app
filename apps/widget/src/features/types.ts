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
    refresh?(): void; // called after any setting changes, while this one is on
};

/**
 * What a level setting does, given the chosen level's index (0 = the page's own state): page CSS for levels above
 * 0 (written after the on/off settings' CSS, so a chosen level wins over them), and/or JavaScript on every change.
 */
export type LevelImpl = {
    css?: (level: number, scope: string) => string;
    inherited?: boolean;
    apply?(level: number): void;
    refresh?(): void; // called after any setting changes, while a level above 0 is chosen
};

/** On or off: a checkbox tile. */
export type ToggleFeature = Extract<Entry, { kind: "toggle" }> & ToggleImpl;

/** One of several levels: a radio group. */
export type LevelFeature = Extract<Entry, { kind: "levels" }> & LevelImpl;

export type Feature = ToggleFeature | LevelFeature;

/** Exactly one implementation per catalog entry, of the matching kind. */
export type Implementations = { [E in Entry as E["id"]]: E extends { kind: "levels" } ? LevelImpl : ToggleImpl };

/** The level count of a catalog setting, to check a per-level table against: `TABLE satisfies { length: LevelCount<"id"> }`. */
export type LevelCount<Id extends Entry["id"]> = Extract<Entry, { id: Id; kind: "levels" }>["levels"]["length"];
