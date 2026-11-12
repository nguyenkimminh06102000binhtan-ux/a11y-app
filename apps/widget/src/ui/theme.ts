import { onStateColor, stateInk, stateTint, type WidgetConfig } from "@app/widget-config";

/**
 * The site owner's brand color on our widget. Set on the host element, so it overrides the default tokens
 * (`:host` rules) for everything inside, and the page's CSS can't override it.
 * Any color works: the colors that go with it are derived so everything stays readable (see @app/widget-config).
 */
export function applyTheme(host: HTMLElement, theme: WidgetConfig["theme"]): void {
  if (!theme.state) return;
  host.style.setProperty("--bcn-state", theme.state); // fills: launcher, check badges
  host.style.setProperty("--bcn-on-state", onStateColor(theme.state)); // icons and check marks on it
  host.style.setProperty("--bcn-state-ink", stateInk(theme.state)); // state text, borders and icons on white
  host.style.setProperty("--bcn-state-tint", stateTint(theme.state)); // behind tiles that are on (also without color-mix())
}
