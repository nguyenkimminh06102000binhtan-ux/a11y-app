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

// ─── Feature catalog: every setting the widget offers, in one place ────────────────────────────────────────
/*
 * The words and structure of each setting: which section it's in, its name and hint, and its levels. The widget's
 * panel and the dashboard both read this list, so they always use the same words; what each setting does to the
 * page lives in apps/widget/src/features (one implementation per entry, checked by the widget's types).
 *
 * Adding a setting: add an entry here (in the order it should appear in its section), then its implementation.
 * `id` is public (data-a11yw-ignore="…") and `key` is stored in visitors' browsers: never rename either once
 * customers use them.
 */

/** The panel's sections, in order. A section shows only once it has settings. */
export const SECTIONS = [
    { id: "profiles", label: "Profiles" },
    { id: "content", label: "Content" },
    { id: "appearance", label: "Appearance" },
    { id: "navigation", label: "Navigation" },
    { id: "tools", label: "Tools" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
export type Section = (typeof SECTIONS)[number];

/** One level of a level setting. `label` is its full name (what assistive tech reads); `short` is what's shown. */
export type CatalogLevel = { readonly label: string; readonly short: string };

type CatalogBase = { readonly id: string; readonly key: string; readonly section: SectionId; readonly label: string; readonly hint: string };
/** On or off. */
export type ToggleEntry = CatalogBase & { readonly kind: "toggle" };
/** One of several levels. Level 0 is always the page's own state (off). */
export type LevelEntry = CatalogBase & { readonly kind: "levels"; readonly levels: readonly CatalogLevel[] };
export type CatalogEntry = ToggleEntry | LevelEntry;

export const CATALOG = [
    // Content
    {
        kind: "levels",
        id: "text-size",
        key: "textSize",
        section: "content",
        label: "Text size",
        hint: "Makes the page's text bigger without zooming the whole page.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Large (125%)", short: "125%" },
            { label: "Larger (150%)", short: "150%" },
            { label: "Largest (200%)", short: "200%" },
        ],
    },
    {
        kind: "toggle",
        id: "text-spacing",
        key: "textSpacing",
        section: "content",
        label: "Text spacing",
        hint: "Adds space between lines, letters, words and paragraphs.",
    },
    // Appearance
    {
        kind: "toggle",
        id: "pause-animations",
        key: "pauseAnimations",
        section: "appearance",
        label: "Pause animations",
        hint: "Stops moving effects, GIFs, carousels, and autoplaying video and sound. You can still press play.",
    },
    // Navigation
    {
        kind: "toggle",
        id: "highlight-links",
        key: "highlightLinks",
        section: "navigation",
        label: "Highlight links",
        hint: "Makes every link stand out with a yellow background and underline.",
    },
    {
        kind: "toggle",
        id: "focus-outline",
        key: "focusOutline",
        section: "navigation",
        label: "Stronger focus outline",
        hint: "Shows a thick outline around whatever the keyboard is on.",
    },
] as const satisfies readonly CatalogEntry[];

type Entry = (typeof CATALOG)[number];
export type FeatureId = Entry["id"];
export type ToggleKey = Extract<Entry, { kind: "toggle" }>["key"];
export type LevelKey = Extract<Entry, { kind: "levels" }>["key"];

/** A visitor's choices: on/off for each toggle, a level number (0 = off) for each level setting. */
export type FeatureSettings = { [K in ToggleKey]: boolean } & { [K in LevelKey]: number };

/** Items grouped by section, in section order, leaving out sections with none (so no empty heading shows). */
export function bySection<T extends { readonly section: SectionId }>(items: readonly T[]): Array<{ section: Section; items: T[] }> {
    return SECTIONS.map((section) => ({ section, items: items.filter((item) => item.section === section.id) })).filter(
        (group) => group.items.length > 0
    );
}

// ─── Settings a site owner can turn on by default ──────────────────────────────────────────────────────────

/** On/off settings an owner can turn on by default. Part of the stored and served contract: only ever add. */
export const DEFAULTABLE = ["highlightLinks", "textSpacing", "focusOutline", "pauseAnimations"] as const satisfies readonly ToggleKey[];
export type DefaultableSetting = (typeof DEFAULTABLE)[number];

/** Their catalog entries, in panel order (by section), for the dashboard. */
export const DEFAULTABLE_ENTRIES = CATALOG.filter((entry): entry is Extract<Entry, { key: DefaultableSetting }> =>
    (DEFAULTABLE as readonly string[]).includes(entry.key)
);

/** Their names in the dashboard: the same words as the widget's panel, so site owners recognize them. */
export const DEFAULTABLE_LABELS = Object.fromEntries(DEFAULTABLE_ENTRIES.map((entry) => [entry.key, entry.label])) as Record<
    DefaultableSetting,
    string
>;

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

// ─── Where the widget button sits ──────────────────────────────────────────────────────────────────────────

/** The six spots for the button. Named, not numbered, so every place that reads them says what it means. */
export const SPOTS = ["bottom-right", "bottom-left", "top-right", "top-left", "middle-right", "middle-left"] as const;
export type Spot = (typeof SPOTS)[number];

/** Their names in the dashboard. */
export const SPOT_LABELS: Record<Spot, string> = {
    "top-left": "Top left",
    "top-right": "Top right",
    "middle-left": "Middle left",
    "middle-right": "Middle right",
    "bottom-left": "Bottom left",
    "bottom-right": "Bottom right",
};

export const MAX_OFFSET = 200;

/**
 * One placement. Both distances are measured inward from the screen's edges the spot touches, so there is no
 * direction to get wrong: `side` from the left or right edge, `edge` from the top or bottom (unused for middle
 * spots, which are centered vertically). The widget also keeps the button on screen whatever the numbers.
 */
export type Placement = { spot: Spot; side: number; edge: number };

/** Where the button is when the owner hasn't chosen: bottom right, 16px in (as before positions existed). */
export const DEFAULT_PLACEMENT: Placement = { spot: "bottom-right", side: 16, edge: 16 };

/** Strict, for the dashboard form. */
export const SpotSchema = v.picklist(SPOTS, "Choose where the button goes.");
const OUT_OF_RANGE = `Enter a number from 0 to ${MAX_OFFSET}.`;
export const OffsetSchema = v.pipe(
    v.number(OUT_OF_RANGE),
    v.finite(OUT_OF_RANGE),
    v.integer("Use whole pixels, like 16."),
    v.minValue(0, OUT_OF_RANGE),
    v.maxValue(MAX_OFFSET, OUT_OF_RANGE)
);

/** Lenient, for reading: a bad field falls back to its default alone. */
const PlacementSchema = v.object({
    spot: v.fallback(SpotSchema, DEFAULT_PLACEMENT.spot),
    side: v.fallback(OffsetSchema, DEFAULT_PLACEMENT.side),
    edge: v.fallback(OffsetSchema, DEFAULT_PLACEMENT.edge),
});

export function isMiddle(spot: Spot): boolean {
    return spot.startsWith("middle-");
}

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
            // missing = DEFAULT_PLACEMENT everywhere; phone missing = same as desktop
            position: v.fallback(
                v.optional(v.object({ desktop: PlacementSchema, phone: v.fallback(v.optional(PlacementSchema), undefined) })),
                undefined
            ),
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
    /** Where the button sits, from 641px wide (desktop) and up to 640px (phone). Missing = DEFAULT_PLACEMENT for both. */
    position: v.fallback(v.optional(v.object({ desktop: PlacementSchema, phone: PlacementSchema })), undefined),
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
        ...(settings.appearance.position && {
            position: { desktop: settings.appearance.position.desktop, phone: settings.appearance.position.phone ?? settings.appearance.position.desktop },
        }),
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
