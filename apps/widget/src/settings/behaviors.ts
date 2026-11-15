import { FEATURES } from "../features";
import { safely } from "../core/safely";
import type { Settings } from "./settings";

const running = new Set<string>();
const appliedLevel = new Map<string, number>();

/** Bring each setting's JavaScript in line with the settings. Only acts on changes. */
export function applyBehaviors(settings: Settings): void {
  for (const feature of FEATURES) {
    if (feature.kind === "levels") {
      const level = settings[feature.key];
      if (appliedLevel.get(feature.key) === level) continue;
      appliedLevel.set(feature.key, level);
      safely(() => feature.apply(level));
      continue;
    }

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
