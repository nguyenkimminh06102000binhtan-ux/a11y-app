/** Is the widget working on a site, from when it was last seen (lib/widget-seen.ts). No database: client-safe. */

/** A site not seen for this long gets "is the code still there?" */
export const STALE_AFTER_DAYS = 7;

export type WidgetHealth = "working" | "stale" | "never";

export function widgetHealth(seenAt: Date | null, now = new Date()): WidgetHealth {
  if (!seenAt) return "never";
  return now.getTime() - seenAt.getTime() > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000 ? "stale" : "working";
}
