/**
 * Where this script was loaded from, ending in "/" (e.g. https://cdn.accesspilot.org/), for files served next to
 * it, like fonts. Read once, while the script first runs: document.currentScript is only set then.
 * Empty if it can't be known; files are then asked for relative to the page, and simply fail to load.
 */
export const CDN_BASE: string = (() => {
    const script = document.currentScript;
    try {
        return script instanceof HTMLScriptElement && script.src ? new URL(".", script.src).href : "";
    } catch {
        return "";
    }
})();
