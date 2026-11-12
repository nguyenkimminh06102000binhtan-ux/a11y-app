import { FEATURES } from "./features";
import { safely } from "./safely";
import type { Settings } from "./settings";

const running = new Set<string>();

/** Start or stop each setting's JavaScript behavior to match the settings. Only acts on changes. */
export function applyBehaviors(settings: Settings): void {
  for (const feature of FEATURES) {
    const behavior = feature.behavior;
    if (!behavior) continue;
    const on = settings[feature.key];
    if (on && !running.has(feature.key)) {
      running.add(feature.key);
      safely(() => behavior.start());
    } else if (!on && running.has(feature.key)) {
      running.delete(feature.key);
      safely(() => behavior.stop());
    }
  }
}