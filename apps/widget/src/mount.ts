import css from "./widget.css";

export const HOST_TAG = "a11yw-root"; // custom tag: no class or id for page CSS like [class*="widget"] to match

/** Create the widget's isolated container and return the element to render into. */
export function mount(): HTMLElement {
    const existing = document.querySelector(HOST_TAG)?.shadowRoot?.querySelector<HTMLElement>(".app");
    if (existing) return existing; // the app ran twice: reuse the same container

    const host = document.createElement(HOST_TAG);
    // "open" so axe-core, Playwright and our own scanner can look inside. "closed" adds no real security.
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);

    // Preact gets its own container: rendering straight into the shadow root could remove our <style>.
    const app = document.createElement("div");
    app.className = "app";
    app.lang = "en";
    app.dir = "ltr";
    shadow.appendChild(app);

    pickParent().appendChild(host);
    return app;
}


/**
 * <body> by default: React 19 hydration tolerates extra elements there.
 * Fall back to <html> when <body> would trap position: fixed (transform, filter, etc.),
 * otherwise the widget would be pinned to the bottom of the page instead of the screen.
 */
export function pickParent(): HTMLElement {
    const body = document.body;
    const s = getComputedStyle(body);
    const trapsFixed =
        s.transform !== "none" ||
        s.filter !== "none" ||
        s.perspective !== "none" ||
        /paint|layout|strict|content/.test(s.contain) ||
        /transform|filter|perspective/.test(s.willChange);
    return trapsFixed ? document.documentElement : body;
}
