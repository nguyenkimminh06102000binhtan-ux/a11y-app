import { DEFAULT_PLACEMENT, type Placement, type WidgetConfig } from "@app/widget-config";

/**
 * Where the button sits (the site owner's choice), set on the host element as attributes and variables;
 * widget.css does the layout: phones (up to 640px wide) use the phone placement, wider screens the desktop one.
 * No timers and no measuring: CSS also keeps the button on screen and opens the panel toward the middle.
 * Variables are set as important, so the page's CSS can't move the widget by accident.
 */
export function applyPosition(host: HTMLElement, position: WidgetConfig["position"]): void {
  const { desktop, phone } = position ?? { desktop: DEFAULT_PLACEMENT, phone: DEFAULT_PLACEMENT };
  set(host, "", desktop);
  set(host, "-phone", phone);
}

function set(host: HTMLElement, suffix: string, { spot, side, edge }: Placement): void {
  const [y, x] = spot.split("-"); // "bottom-right" → bottom, right
  host.setAttribute(`data-x${suffix}`, x);
  host.setAttribute(`data-y${suffix}`, y);
  host.style.setProperty(`--ap-side${suffix}`, `${side}px`, "important");
  host.style.setProperty(`--ap-edge${suffix}`, `${edge}px`, "important");
}
