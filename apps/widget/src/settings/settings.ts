// The visitor's choices, saved per site in localStorage on the customer's domain.
import { SETTINGS, type FeatureSettings, type WidgetConfig } from "@app/widget-config";

/** One value per catalog setting: on/off, or a level (0 = the page's own state). */
export type Settings = FeatureSettings;

/** Everything off. */
export const DEFAULTS = Object.fromEntries(SETTINGS.map((entry) => [entry.key, entry.kind === "levels" ? 0 : false])) as Settings;

/** The value "on" means for a setting: true, or a level setting's first level above Default. */
function onValue(key: keyof Settings): boolean | number {
    return typeof DEFAULTS[key] === "number" ? 1 : true;
}

/**
 * What a visitor starts with: our defaults plus the site owner's "on by default" settings (true, or a level).
 * Visitors who changed anything keep their own choices; Reset all brings back this starting point.
 * Settings the owner hides stay off, whatever was saved: visitors couldn't turn them off. (Saved choices are kept,
 * so they come back if the owner shows the setting again.)
 */
let startingPoint: Settings = { ...DEFAULTS };
let hiddenKeys = new Set<string>();

export function setOwnerChoices(defaults: WidgetConfig["defaults"], hidden: WidgetConfig["hidden"]): void {
    hiddenKeys = new Set(SETTINGS.filter((entry) => hidden.features.includes(entry.id)).map((entry) => entry.key));
    startingPoint = { ...DEFAULTS };
    for (const [key, value] of Object.entries(defaults) as Array<[keyof Settings, true | number]>) {
        if (!hiddenKeys.has(key)) (startingPoint as Record<string, unknown>)[key] = value === true ? onValue(key) : value;
    }
}

export function startingSettings(): Settings {
    return { ...startingPoint };
}


const KEY = "a11yw:settings:v1"; // bump the version if the shape changes incompatibly

/** Read saved settings. Never throws: storage can be blocked, full, or written to by the page's own scripts. */
export function loadSettings(): Settings {
    const settings = startingSettings();
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return settings;
        const saved = JSON.parse(raw) as Record<string, unknown>;
        // Keep only known keys whose type matches the default; ignore anything else.
        for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
            let value = saved[key];
            // A setting that was on/off and now has levels (Text spacing): on = its first level
            if (typeof value === "boolean" && typeof DEFAULTS[key] === "number") value = value ? onValue(key) : 0;
            if (typeof value === typeof DEFAULTS[key]) {
                (settings as Record<string, unknown>)[key] = value;
            }
        }
        // A number isn't enough: it must be one of that setting's levels
        for (const entry of SETTINGS) {
            if (entry.kind !== "levels") continue;
            const level = settings[entry.key];
            if (!Number.isInteger(level) || level < 0 || level >= entry.levels.length) settings[entry.key] = 0;
        }
    } catch {
        // Corrupt JSON or blocked storage (e.g. Safari private mode, strict cookie settings): use defaults.
    }
    hiddenKeys.forEach((key) => ((settings as Record<string, unknown>)[key] = DEFAULTS[key as keyof Settings]));
    return settings;
}

export function saveSettings(settings: Settings): void {
    try {
        const isDefault = (Object.keys(DEFAULTS) as (keyof Settings)[]).every((k) => settings[k] === startingPoint[k]);
        // Same as the starting point: leave no trace, and keep following the site owner's defaults if they change.
        // Anything else is saved whole, so turning off a setting the owner turns on by default sticks.

        if (isDefault) localStorage.removeItem(KEY); // leave no trace when nothing is changed
        else localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // Storage unavailable: the setting still works for this page view.
    }
}
