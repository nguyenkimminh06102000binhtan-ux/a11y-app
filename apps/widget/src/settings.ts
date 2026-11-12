// The visitor's choices, saved per site in localStorage on the customer's domain.
export type Settings = {
  highlightLinks: boolean;
  textSpacing: boolean;
  focusOutline: boolean;
};

export const DEFAULTS: Settings = {
  highlightLinks: false,
  textSpacing: false,
  focusOutline: false,
};

const KEY = "a11yw:settings:v1"; // bump the version if the shape changes incompatibly

/** Read saved settings. Never throws: storage can be blocked, full, or written to by the page's own scripts. */
export function loadSettings(): Settings {
  const settings = { ...DEFAULTS };
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
  } catch {
    // Corrupt JSON or blocked storage (e.g. Safari private mode, strict cookie settings): use defaults.
  }
  return settings;
}

export function saveSettings(settings: Settings): void {
  try {
    const isDefault = (Object.keys(DEFAULTS) as (keyof Settings)[]).every((k) => settings[k] === DEFAULTS[k]);
    if (isDefault) localStorage.removeItem(KEY); // leave no trace when nothing is changed
    else localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the setting still works for this page view.
  }
}
