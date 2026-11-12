import { stateTint, type WidgetConfig } from "@app/widget-config";

/**
 * The site owner's brand color on our widget. Set on the host element, so it overrides the default tokens
 * (`:host` rules) for everything inside, and the page's CSS can't override it.
 * The tint is computed here too, so it matches in browsers without color-mix().
 */
export function applyTheme(host: HTMLElement, theme: WidgetConfig["theme"]): void {
    if (!theme.state) return; // parseConfig only keeps colors with enough contrast
    host.style.setProperty("--bcn-state", theme.state);
    host.style.setProperty("--bcn-state-tint", stateTint(theme.state));
}
