import { DEFAULT_PLACEMENT, type Placement, type WidgetConfig } from "@app/widget-config";

/**
 * Where the button sits, set on the host element as attributes and variables; widget.css does the layout:
 * phones (PHONE) use the phone placement, wider screens the desktop one. No timers and no measuring: CSS also keeps
 * the button on screen and opens the panel toward the middle. Variables are set as important, so the page's CSS
 * can't move the widget by accident.
 *
 * Two inputs: the site owner's placements (from the config), and the visitor's own side, if they moved the button
 * ("Move to the left" in the panel). The visitor's side wins over the owner's left/right, on desktop and phones;
 * the owner's top/middle/bottom and distances still apply.
 */
export const PHONE = "(max-width: 640px)"; // keep in step with the @media rule in widget.css

export type Side = "left" | "right";
type Position = NonNullable<WidgetConfig["position"]>;

const SIDE_KEY = "a11yw:side:v1";

let host: HTMLElement | null = null;
let memory: Side | null = null; // the visitor's side when localStorage isn't available
let owner: Position = { desktop: DEFAULT_PLACEMENT, phone: DEFAULT_PLACEMENT };

/** Once, before the first render: the owner's placements, with the visitor's side if they chose one. */
export function applyPosition(element: HTMLElement, position: WidgetConfig["position"]): void {
  host = element;
  owner = position ?? owner;
  render();
}

/** The side the button is on right now (the placement in use at this screen width). */
export function visibleSide(): Side {
  const phone = typeof matchMedia === "function" && matchMedia(PHONE).matches;
  return host?.getAttribute(phone ? "data-x-phone" : "data-x") === "left" ? "left" : "right";
}

/** The visitor moved the button: remembered on this site, on every page. */
export function moveTo(side: Side): void {
  saveSide(side);
  render();
}

/** Back to the owner's side (Reset all). */
export function resetSide(): void {
  saveSide(null);
  render();
}

function render(): void {
  if (!host) return;
  const side = savedSide();
  set(host, "", owner.desktop, side);
  set(host, "-phone", owner.phone, side);
}

function set(element: HTMLElement, suffix: string, { spot, side, edge }: Placement, visitorSide: Side | null): void {
  const [y, x] = spot.split("-"); // "bottom-right" → bottom, right
  element.setAttribute(`data-x${suffix}`, visitorSide ?? x);
  element.setAttribute(`data-y${suffix}`, y);
  element.style.setProperty(`--ap-side${suffix}`, `${side}px`, "important");
  element.style.setProperty(`--ap-edge${suffix}`, `${edge}px`, "important");
}

/** Checked when read: the page's own scripts can write to localStorage. */
function savedSide(): Side | null {
  try {
    const value = localStorage.getItem(SIDE_KEY);
    return value === "left" || value === "right" ? value : null;
  } catch {
    return memory;
  }
}

function saveSide(side: Side | null): void {
  memory = side;
  try {
    if (side) localStorage.setItem(SIDE_KEY, side);
    else localStorage.removeItem(SIDE_KEY);
  } catch {
    // Storage unavailable: the move still applies until the visitor leaves this page.
  }
}
