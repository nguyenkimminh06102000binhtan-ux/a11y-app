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

type CatalogBase = { readonly id: string; readonly section: SectionId; readonly label: string; readonly hint: string };
/** On or off. */
export type ToggleEntry = CatalogBase & { readonly kind: "toggle"; readonly key: string };
/**
 * One of several levels. Level 0 is always the page's own state (off). `ordered`: each level is more of the same
 * (Text size), so a higher level also satisfies a lower one (see PROFILES).
 */
export type LevelEntry = CatalogBase & { readonly kind: "levels"; readonly key: string; readonly levels: readonly CatalogLevel[]; readonly ordered?: true };
/** A button that does something (e.g. opens a dialog). Nothing is saved, so it has no key. */
export type ActionEntry = CatalogBase & { readonly kind: "action" };
export type CatalogEntry = ToggleEntry | LevelEntry | ActionEntry;

export const CATALOG = [
    // Content
    {
        kind: "levels",
        id: "text-size",
        key: "textSize",
        ordered: true,
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
    // Before Line height: level settings' CSS is written in this order, so a chosen Line height wins over Text spacing's 1.5
    {
        kind: "levels",
        id: "text-spacing",
        key: "textSpacing",
        ordered: true,
        section: "content",
        label: "Text spacing",
        hint: "Adds space between lines, letters, words and paragraphs. Wide uses the WCAG values.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Wide", short: "Wide" },
            { label: "Wider", short: "Wider" },
            { label: "Widest", short: "Widest" },
        ],
    },
    {
        kind: "levels",
        id: "line-height",
        key: "lineHeight",
        ordered: true,
        section: "content",
        label: "Line height",
        hint: "Adds space between the lines of text.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Comfortable (1.5)", short: "1.5" },
            { label: "Roomy (1.75)", short: "1.75" },
            { label: "Double (2)", short: "2" },
        ],
    },
    {
        kind: "levels",
        id: "font",
        key: "font",
        section: "content",
        label: "Font",
        hint: "Clear: letters that are hard to mix up. Wide: more room between letters. Simple: school-style letters.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Clear", short: "Clear" },
            { label: "Wide", short: "Wide" },
            { label: "Simple", short: "Simple" },
        ],
    },
    {
        kind: "levels",
        id: "text-align",
        key: "textAlign",
        section: "content",
        label: "Align text",
        hint: "Lines text up on one side instead of centering or stretching it.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Left", short: "Left" },
            { label: "Right", short: "Right" },
        ],
    },
    {
        kind: "toggle",
        id: "image-descriptions",
        key: "imageDescriptions",
        section: "content",
        label: "Image descriptions",
        hint: "Shows an image's description when you point at it or tab to it.",
    },
    // Appearance
    {
        kind: "levels",
        id: "contrast",
        key: "contrast",
        section: "appearance",
        label: "Contrast",
        hint: "Smart: makes hard-to-read text darker or lighter, keeping the site's colors. Dark and Light: plain backgrounds with strong text.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Smart", short: "Smart" },
            { label: "Dark", short: "Dark" },
            { label: "Light", short: "Light" },
        ],
    },
    {
        kind: "levels",
        id: "color",
        key: "color",
        section: "appearance",
        label: "Color",
        hint: "Muted: calmer colors. Vivid: stronger colors. Grayscale: no color.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Muted", short: "Muted" },
            { label: "Vivid", short: "Vivid" },
            { label: "Grayscale", short: "Grayscale" },
        ],
    },
    {
        kind: "toggle",
        id: "hide-images",
        key: "hideImages",
        section: "appearance",
        label: "Hide images",
        hint: "Hides pictures and background images. Screen readers still get their descriptions.",
    },
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
        kind: "levels",
        id: "reading-aid",
        key: "readingAid",
        section: "navigation",
        label: "Reading aid",
        hint: "Guide: a bar under the line you're reading. Mask: dims everything but a few lines. Both follow the pointer or keyboard.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Guide", short: "Guide" },
            { label: "Mask", short: "Mask" },
        ],
    },
    {
        kind: "levels",
        id: "big-cursor",
        key: "bigCursor",
        section: "navigation",
        label: "Big cursor",
        hint: "A bigger arrow and hand, in black or white.",
        levels: [
            { label: "Default", short: "Default" },
            { label: "Black", short: "Black" },
            { label: "White", short: "White" },
        ],
    },
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
    {
        kind: "action",
        id: "page-structure",
        section: "navigation",
        label: "Page structure",
        hint: "Lists the page's headings, landmarks and links, to jump to any of them.",
    },
    // Tools
    {
        kind: "toggle",
        id: "read-aloud",
        key: "readAloud",
        section: "tools",
        label: "Read aloud",
        hint: "Click any text to hear it. A player lets you pause, skip and change speed.",
    },
] as const satisfies readonly CatalogEntry[];

type Entry = (typeof CATALOG)[number];
/** The catalog's settings: everything except actions. */
export type SettingEntry = Exclude<Entry, { kind: "action" }>;
export const SETTINGS = CATALOG.filter((entry): entry is SettingEntry => entry.kind !== "action");
export type FeatureId = Entry["id"];
export type ToggleKey = Extract<Entry, { kind: "toggle" }>["key"];
export type LevelKey = Extract<Entry, { kind: "levels" }>["key"];

/** A visitor's choices: on/off for each toggle, a level number (0 = off) for each level setting. */
export type FeatureSettings = { [K in ToggleKey]: boolean } & { [K in LevelKey]: number };

// ─── Profiles: one-tap groups of the settings above, named by need ───────────────────────────────────────
/*
 * A profile is a shortcut, not a saved setting: it shows as on while all of its settings are in effect (for
 * `ordered` settings, at least its level), and turning it off puts them back (apps/widget/src/settings/profiles.ts).
 * `id` is public (the dashboard will show and hide them): never rename once customers use it.
 */
export type Profile = { readonly id: string; readonly label: string; readonly hint: string; readonly settings: Partial<FeatureSettings> };

export const PROFILES = [
    {
        id: "seizure-safe",
        label: "Seizure safe",
        hint: "No motion, calmer colors.",
        settings: { pauseAnimations: true, color: 1 },
    },
    {
        id: "vision",
        label: "Vision",
        hint: "Bigger, clearer text and cursor.",
        settings: { textSize: 2, font: 1, contrast: 1, bigCursor: 1, focusOutline: true, imageDescriptions: true },
    },
    {
        id: "adhd-friendly",
        label: "ADHD friendly",
        hint: "Fewer distractions.",
        settings: { pauseAnimations: true, readingAid: 2, color: 1 },
    },
    {
        id: "easier-reading",
        label: "Easier reading",
        hint: "Bigger text, a reading guide.",
        settings: { textSize: 1, contrast: 1, readingAid: 1, imageDescriptions: true, pauseAnimations: true },
    },
    {
        id: "dyslexia-friendly",
        label: "Dyslexia friendly",
        hint: "Wide font, more spacing.",
        settings: { font: 2, lineHeight: 1, textSpacing: 1, textAlign: 1 },
    },
    {
        id: "motor-keyboard",
        label: "Motor & keyboard",
        hint: "Clear focus, cursor and links.",
        settings: { focusOutline: true, bigCursor: 1, highlightLinks: true, pauseAnimations: true },
    },
] as const satisfies readonly Profile[];

/** Items grouped by section, in section order, leaving out sections with none (so no empty heading shows). */
export function bySection<T extends { readonly section: SectionId }>(items: readonly T[]): Array<{ section: Section; items: T[] }> {
    return SECTIONS.map((section) => ({ section, items: items.filter((item) => item.section === section.id) })).filter(
        (group) => group.items.length > 0
    );
}

// ─── Settings a site owner can turn on by default ──────────────────────────────────────────────────────────

/**
 * Settings an owner can turn on by default. Part of the stored and served contract: only ever add.
 * Served as `true`; for a level setting that means its first level above Default (Text spacing: Wide, which is what
 * it was when it was an on/off setting).
 */
export const DEFAULTABLE = ["highlightLinks", "textSpacing", "focusOutline", "pauseAnimations"] as const satisfies readonly (ToggleKey | LevelKey)[];
export type DefaultableSetting = (typeof DEFAULTABLE)[number];

/** Their catalog entries, in panel order (by section), for the dashboard. */
export const DEFAULTABLE_ENTRIES = SETTINGS.filter((entry): entry is Extract<SettingEntry, { key: DefaultableSetting }> =>
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

// ─── Links in the panel ────────────────────────────────────────────────────────────────────────────────────

export const MAX_URL = 500;
const BAD_URL = "Enter a full web address, like https://shop.com/accessibility.";

/**
 * The owner's accessibility statement page: a full http(s) address. Anything else (javascript:, data:, relative)
 * is refused on save and dropped when read, so the widget never gets a link that runs code.
 */
export const StatementUrlSchema = v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(MAX_URL, `Use at most ${MAX_URL} characters.`),
    v.check((value) => {
        try {
            const url = new URL(value);
            return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
        } catch {
            return false;
        }
    }, BAD_URL)
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
    /** Links shown in the panel. Missing = none. */
    links: v.fallback(v.object({ statement: v.fallback(v.optional(StatementUrlSchema), undefined) }), {}),
});
export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = { v: SETTINGS_VERSION, appearance: {}, defaults: [], links: {} };

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
    /** The owner's accessibility statement page, linked from the panel. Missing = no link. */
    statementUrl: v.fallback(v.optional(StatementUrlSchema), undefined),
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
        ...(settings.links.statement && { statementUrl: settings.links.statement }),
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
