/*
 * The widget's settings, shared by the dashboard (which stores and serves them) and the widget (which uses them).
 * One schema per shape gives both the TypeScript type and the validation, so all three places check the same rules.
 *
 * Two shapes, on purpose:
 * - SiteSettings: what a site owner chose (stored in widget_settings.settings). Grows with the product.
 * - WidgetConfig: what the widget receives (GET /api/widget/config). Built by toWidgetConfig(), where plan limits
 *   and other server-side rules will live, so the widget only ever gets what it's allowed to use.
 *
 * Adding an option: add a field with a default to SiteSettingsSchema (no migration: it's JSON), map it in
 * toWidgetConfig, and add it to WidgetConfigSchema as a field with a fallback, so old widgets just ignore it.
 * Removing or renaming: bump the version and upgrade old data in readSiteSettings / serve old widgets as before.
 */
import * as v from "valibot";

// ─── Settings a site owner can turn on by default ──────────────────────────────────────────────────────────

/** Keys of the widget's Settings. */
export const DEFAULTABLE = ["highlightLinks", "textSpacing", "focusOutline", "pauseAnimations"] as const;
export type DefaultableSetting = (typeof DEFAULTABLE)[number];

/** Their names in the dashboard: the same words as the widget's panel, so site owners recognize them. */
export const DEFAULTABLE_LABELS: Record<DefaultableSetting, string> = {
    highlightLinks: "Highlight links",
    textSpacing: "Text spacing",
    focusOutline: "Stronger focus outline",
    pauseAnimations: "Pause animations",
};

// ─── Field schemas: strict, with the messages the dashboard shows next to the field ───────────────────────

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The site owner's brand color: any color. The widget stays readable on its own (see onStateColor and stateInk),
 * so owners can use their exact color, light ones included.
 */
export const StateColorSchema = v.pipe(v.string(), v.regex(HEX, "Enter a color like #5b47c8."), v.toLowerCase());

/** Settings on by default: known keys only, each once, in a fixed order. */
export const DefaultSettingsSchema = v.pipe(
    v.array(v.string()),
    v.transform((keys) => DEFAULTABLE.filter((key) => keys.includes(key)))
);

// ─── What the site owner chose (stored) ────────────────────────────────────────────────────────────────────

export const SETTINGS_VERSION = 1;

/**
 * Every field has a default, and a field that doesn't validate falls back to it: reading never fails, and one bad
 * value never loses the others. Writes are checked strictly field by field first (see the field schemas).
 */
export const SiteSettingsSchema = v.object({
    v: v.fallback(v.literal(SETTINGS_VERSION), SETTINGS_VERSION),
    appearance: v.fallback(
        v.object({
            stateColor: v.fallback(v.optional(StateColorSchema), undefined), // missing = our default color
        }),
        {}
    ),
    defaults: v.fallback(DefaultSettingsSchema, []),
});
export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = { v: SETTINGS_VERSION, appearance: {}, defaults: [] };

/** Stored JSON (or nothing) → complete settings. Never throws. Old versions get upgraded here when there are some. */
export function readSiteSettings(input: unknown): SiteSettings {
    const result = v.safeParse(SiteSettingsSchema, input);
    return result.success ? withoutUndefined(result.output) : { ...DEFAULT_SITE_SETTINGS };
}

// ─── What the widget receives (served) ─────────────────────────────────────────────────────────────────────

/** Bump only for breaking changes, and keep serving the old version until old cached widgets are gone. */
export const CONFIG_VERSION = 1;

/** Fields fall back one by one, so a field this widget doesn't know or can't validate never breaks the rest. */
export const WidgetConfigSchema = v.object({
    v: v.literal(CONFIG_VERSION),
    /** false: this page's domain isn't one of the account's sites, so the widget doesn't show. */
    enabled: v.fallback(v.boolean(), true),
    /** The site owner's colors. Missing = our defaults (packages/tokens). */
    theme: v.fallback(v.object({ state: v.fallback(v.optional(StateColorSchema), undefined) }), {}),
    /** Settings on by default for visitors who haven't chosen yet. Only `true` entries. */
    defaults: v.fallback(
        v.pipe(
            v.record(v.string(), v.unknown()),
            v.transform(
                (map) => Object.fromEntries(DEFAULTABLE.filter((key) => map[key] === true).map((key) => [key, true])) as Partial<Record<DefaultableSetting, true>>
            )
        ),
        {}
    ),
});
export type WidgetConfig = v.InferOutput<typeof WidgetConfigSchema>;

/**
 * Used when the config can't be loaded (network error, bad response). Fails open: visitors still get the
 * widget with our defaults, because an accessibility tool that vanishes when our server hiccups hurts the
 * people who rely on it.
 */
export const FALLBACK_CONFIG: WidgetConfig = { v: CONFIG_VERSION, enabled: true, theme: {}, defaults: {} };

/** Untrusted JSON → WidgetConfig. null if it isn't a config of this version at all (then use FALLBACK_CONFIG). */
export function parseConfig(input: unknown): WidgetConfig | null {
    const result = v.safeParse(WidgetConfigSchema, input);
    return result.success ? withoutUndefined(result.output) : null;
}

/** The one place that turns what an owner chose into what their widget gets. */
export function toWidgetConfig(settings: SiteSettings, enabled: boolean): WidgetConfig {
    return {
        v: CONFIG_VERSION,
        enabled,
        theme: settings.appearance.stateColor ? { state: settings.appearance.stateColor } : {},
        defaults: Object.fromEntries(settings.defaults.map((key) => [key, true])),
    };
}

// ─── Color math ────────────────────────────────────────────────────────────────────────────────────────────
/*
 * One brand color, four uses (the widget sets them as --bcn-* variables, see packages/tokens):
 * - the color itself, only as a fill (launcher, check badges): any color is fine there;
 * - onStateColor: black or white, for icons and check marks on that fill;
 * - stateInk: for state text, borders and icons on white: the brand color when it's dark enough, else our ink;
 * - stateTint: the brand color 10% over white, behind tiles that are on (text on it stays our ink).
 * The brand color is never altered: each element uses it exactly, or not at all.
 */

const WHITE = "#ffffff";
const BLACK = "#000000";
/** Our text color (packages/tokens --bcn-text). */
export const INK = "#1c1a33";

/** Black or white, whichever reads on this color. White when it's enough (4.5:1), so dark brands keep white icons. */
export function onStateColor(hex: string): string {
    return contrastRatio(hex, WHITE) >= 4.5 ? WHITE : BLACK; // every color reaches 4.5:1 with one of the two
}

/** Is this color dark enough for state text and borders: 4.5:1 on white and on its own tint? */
export function isReadableStateColor(hex: string): boolean {
    return HEX.test(hex) && contrastRatio(hex, WHITE) >= 4.5 && contrastRatio(hex, stateTint(hex)) >= 4.5;
}

/** The color for state text, borders and icons on white: the brand color itself if readable, otherwise our ink. */
export function stateInk(hex: string): string {
    return isReadableStateColor(hex) ? hex.toLowerCase() : INK;
}


/** The "on" tint: the state color 10% over white, as CSS color-mix(in srgb, state 10%, white) computes it. */
export function stateTint(hex: string): string {
    return "#" + channels(hex).map((c) => Math.round(c * 0.1 + 255 * 0.9).toString(16).padStart(2, "0")).join("");
}

/** WCAG 2 contrast ratio between two #rrggbb colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
    const [r, g, b] = channels(hex).map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channels(hex: string): number[] {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** A field that fell back to `undefined` is dropped, so the JSON we store and serve stays minimal. */
function withoutUndefined<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
