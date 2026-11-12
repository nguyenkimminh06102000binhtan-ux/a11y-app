/*
 * The contract between the dashboard's GET /api/widget/config and the widget.
 * Both import this file, so they can't drift apart.
 *
 * Rules for changing it:
 * - Adding an optional field is safe: old widgets ignore it.
 * - Removing or renaming a field, or changing its meaning, is breaking: bump CONFIG_VERSION, and serve the old
 *   version too until old cached widgets are gone.
 * - The widget never trusts the response: parseConfig() drops anything invalid and keeps the rest.
 */

export const CONFIG_VERSION = 1;

/** Settings a site owner can turn on for visitors who haven't chosen yet. Keys of the widget's Settings. */
export const DEFAULTABLE = ["highlightLinks", "textSpacing", "focusOutline", "pauseAnimations"] as const;
export type DefaultableSetting = (typeof DEFAULTABLE)[number];

export type WidgetConfig = {
  v: typeof CONFIG_VERSION;
  /** false: this page's domain isn't one of the account's sites, so the widget doesn't show. */
  enabled: boolean;
  /** The site owner's colors. Missing = our defaults (packages/tokens). */
  theme: { state?: string };
  /** Settings on by default for visitors who haven't chosen yet. Only `true` entries. */
  defaults: Partial<Record<DefaultableSetting, true>>;
};

/**
 * Used when the config can't be loaded (network error, bad response). Fails open: visitors still get the
 * widget with our defaults, because an accessibility tool that vanishes when our server hiccups hurts the
 * people who rely on it.
 */
export const FALLBACK_CONFIG: WidgetConfig = { v: CONFIG_VERSION, enabled: true, theme: {}, defaults: {} };

const HEX = /^#[0-9a-f]{6}$/i;

/** Read untrusted JSON into a WidgetConfig. Returns null if it isn't one at all (then use FALLBACK_CONFIG). */
export function parseConfig(input: unknown): WidgetConfig | null {
  if (!isObject(input) || input.v !== CONFIG_VERSION) return null;

  const theme: WidgetConfig["theme"] = {};
  if (isObject(input.theme) && typeof input.theme.state === "string" && isUsableStateColor(input.theme.state)) {
    theme.state = input.theme.state.toLowerCase();
  }

  const defaults: WidgetConfig["defaults"] = {};
  if (isObject(input.defaults)) {
    for (const key of DEFAULTABLE) {
      if (input.defaults[key] === true) defaults[key] = true;
    }
  }

  return { v: CONFIG_VERSION, enabled: input.enabled !== false, theme, defaults };
}

/**
 * Can this color be the widget's state color? It's used for state-colored text and borders on white and,
 * mixed 10% into white, as the "on" tint; and white check marks sit on it. All need 4.5:1.
 * The dashboard uses this to refuse a color; the widget uses it to ignore one that slipped through.
 */
export function isUsableStateColor(hex: string): boolean {
  if (!HEX.test(hex)) return false;
  return contrastRatio(hex, "#ffffff") >= 4.5 && contrastRatio(hex, stateTint(hex)) >= 4.5;
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
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
