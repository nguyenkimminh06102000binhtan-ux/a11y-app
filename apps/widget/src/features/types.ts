import type { Settings } from "../settings/settings";

type KeysOfType<T> = { [K in keyof Settings]: Settings[K] extends T ? K : never }[keyof Settings];

export type Behavior = { start(): void; stop(): void };

/** On or off: a checkbox. (`kind` can be left out.) */
export type ToggleFeature = {
    kind?: "toggle";
    id: string;          // public, used in data-a11yw-ignore="…": never rename once customers use it
    key: KeysOfType<boolean>;
    label: string;       // the control's accessible name
    hint: string;        // short description, linked with aria-describedby
    css?: (scope: string) => string; // page CSS while on; end every selector with `scope` (skips opted-out areas)
    inherited?: boolean; // its CSS sets inherited properties: also skip elements containing an opted-out area
    behavior?: Behavior; // JavaScript run while the setting is on
};

/** One of several levels: a radio group. Level 0 is always the page's own state. */
export type LevelFeature = {
    kind: "levels";
    id: string;          // public, used in data-a11yw-ignore="…": never rename once customers use it
    key: KeysOfType<number>;
    label: string;
    hint: string;
    levels: Array<{ label: string; scale: number }>;
    apply(scale: number): void;
};

export type Feature = ToggleFeature | LevelFeature;
