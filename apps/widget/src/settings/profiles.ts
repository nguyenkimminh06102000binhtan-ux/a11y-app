import { PROFILES, SETTINGS, type Profile } from "@app/widget-config";
import type { Settings } from "./settings";

/*
 * Profiles (catalog: PROFILES) are shortcuts to settings, not saved state:
 * - On while all of a profile's settings are in effect: the same value, or for `ordered` settings (Text size,
 *   Text spacing, Line height) at least its level, so raising text above a profile's size keeps it on.
 * - Turning one on sets its values, never lowering an ordered setting. For other settings the newest profile wins
 *   (e.g. Font: Dyslexia friendly's Wide after Vision's Clear; Vision then shows as off).
 * - Turning one off puts each of its settings back to what a profile that's still on needs, or else to the
 *   visitor's starting point (our defaults plus the site owner's "on by default" settings). A profile whose
 *   settings are all part of the one turned off (Seizure safe inside ADHD friendly) only looked on because of it,
 *   so it goes off too.
 */

type Key = keyof Settings;
type Value = boolean | number;

const ORDERED = new Set<string>(SETTINGS.filter((e) => e.kind === "levels" && "ordered" in e && e.ordered).map((e) => e.key));

function entries(profile: Profile): Array<[Key, Value]> {
    return Object.entries(profile.settings) as Array<[Key, Value]>;
}

function meets(key: Key, current: Value, wanted: Value): boolean {
    return ORDERED.has(key) ? (current as number) >= (wanted as number) : current === wanted;
}

export function isOn(profile: Profile, settings: Settings): boolean {
    return entries(profile).every(([key, value]) => meets(key, settings[key], value));
}

export function turnOn(profile: Profile, settings: Settings): Settings {
    const next = { ...settings } as Record<Key, Value>;
    for (const [key, value] of entries(profile)) {
        next[key] = ORDERED.has(key) ? Math.max(settings[key] as number, value as number) : value;
    }
    return next as Settings;
}

export function turnOff(profile: Profile, settings: Settings, start: Settings): Settings {
    const covered = (other: Profile) => entries(other).every(([key]) => key in profile.settings); // all its settings are this one's too
    const stillOn = PROFILES.filter((other) => other !== profile && isOn(other, settings) && !covered(other));
    const next = { ...settings } as Record<Key, Value>;
    for (const [key] of entries(profile)) {
        const needed = stillOn.flatMap((other) => (key in other.settings ? [(other.settings as Record<Key, Value>)[key]] : []));
        if (needed.length === 0) next[key] = start[key];
        else next[key] = ORDERED.has(key) ? Math.max(...(needed as number[])) : needed[0]; // profiles still on agree on unordered ones
    }
    return next as Settings;
}

/** What a profile turned on, for screen readers: "Text size 150%, Font Clear, Big cursor Black, Image descriptions". */
export function describe(profile: Profile): string {
    return entries(profile)
        .map(([key, value]) => {
            const entry = SETTINGS.find((e) => e.key === key)!;
            return entry.kind === "levels" ? `${entry.label} ${entry.levels[value as number].short}` : entry.label;
        })
        .join(", ");
}
