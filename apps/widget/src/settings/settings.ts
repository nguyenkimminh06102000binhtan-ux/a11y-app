// The visitor's choices, saved per site in localStorage on the customer's domain.
import { CATALOG, type DefaultableSetting, type FeatureSettings, type WidgetConfig } from "@app/widget-config";

/** One value per catalog setting: on/off, or a level (0 = the page's own state). */
export type Settings = FeatureSettings;

/** Everything off. */
export const DEFAULTS = Object.fromEntries(CATALOG.map((entry) => [entry.key, entry.kind === "levels" ? 0 : false])) as Settings;

// The settings a site owner can turn on by default must exist here, as on/off settings
DEFAULTS satisfies Record<DefaultableSetting, boolean>;

/**
 * What a visitor starts with: our defaults plus the site owner's "on by default" settings.
 * Visitors who changed anything keep their own choices; Reset all brings back this starting point.
 */
let startingPoint: Settings = { ...DEFAULTS };

export function setOwnerDefaults(defaults: WidgetConfig["defaults"]): void {
    startingPoint = { ...DEFAULTS, ...defaults };
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
            if (typeof saved[key] === typeof DEFAULTS[key]) {
                (settings as Record<string, unknown>)[key] = saved[key];
            }
        }
        // A number isn't enough: it must be one of that setting's levels
        for (const entry of CATALOG) {
            if (entry.kind !== "levels") continue;
            const level = settings[entry.key];
            if (!Number.isInteger(level) || level < 0 || level >= entry.levels.length) settings[entry.key] = 0;
        }
    } catch {
        // Corrupt JSON or blocked storage (e.g. Safari private mode, strict cookie settings): use defaults.
    }
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
