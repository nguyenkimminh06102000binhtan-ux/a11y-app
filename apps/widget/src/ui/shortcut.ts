/*
 * Alt+A (Option+A on Mac) opens and closes the panel from anywhere on the page.
 * - The physical A key (event.code), so it works where Option+A types "å", and on any keyboard layout.
 * - Never while typing in a text field: it would steal a letter.
 * - Never with Ctrl or ⌘ (the browser's), and it isn't a single-character shortcut (WCAG 2.1.4).
 */
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** As shown to visitors. */
export const SHORTCUT_LABEL = isMac ? "Option+A" : "Alt+A";
/** For aria-keyshortcuts (ARIA names the Option key Alt). */
export const SHORTCUT_ARIA = "Alt+A";

const TYPING = 'textarea, input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="range"], [type="color"], [type="file"], [type="image"])';

export function isShortcut(e: KeyboardEvent): boolean {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== "KeyA") return false;
    const target = e.composedPath()[0];
    return !(target instanceof HTMLElement && (target.isContentEditable || target.matches(TYPING)));
}
