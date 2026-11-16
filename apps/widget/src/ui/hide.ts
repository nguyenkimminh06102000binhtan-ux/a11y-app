/*
 * Visitors can hide the widget's button: for this visit (until the tab closes) or for 30 days. Their settings stay
 * on. Alt+A (Option+A on Mac) brings it back at any time, and clears this.
 * Never throws: storage can be blocked, in which case hiding lasts for this page view only.
 */
const KEY = "a11yw:hidden:v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type HideFor = "visit" | "30-days";

export function isHidden(): boolean {
    try {
        if (sessionStorage.getItem(KEY)) return true;
        const until = Number(localStorage.getItem(KEY));
        if (until > Date.now()) return true;
        if (localStorage.getItem(KEY)) localStorage.removeItem(KEY); // expired (or junk)
    } catch {
        // Storage blocked: not hidden
    }
    return false;
}

export function hide(howLong: HideFor): void {
    try {
        if (howLong === "visit") sessionStorage.setItem(KEY, "1");
        else localStorage.setItem(KEY, String(Date.now() + THIRTY_DAYS_MS));
    } catch {
        // Storage blocked: hidden for this page view only
    }
}

export function unhide(): void {
    try {
        sessionStorage.removeItem(KEY);
        localStorage.removeItem(KEY);
    } catch {
        // Nothing to clear
    }
}
