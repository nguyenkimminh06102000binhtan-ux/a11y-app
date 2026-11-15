import { SETTING_FEATURES } from "../features";
import { safely } from "../core/safely";
import type { Settings } from "./settings";

const running = new Set<string>();
const appliedLevel = new Map<string, number>();

/** Bring each setting's JavaScript in line with the settings. Only acts on changes. */
export function applyBehaviors(settings: Settings): void {
  for (const feature of SETTING_FEATURES) {
    if (feature.kind === "levels") {
      const level = settings[feature.key];
      if (appliedLevel.get(feature.key) === level) continue;
      appliedLevel.set(feature.key, level);
      const apply = feature.apply;
      if (apply) safely(() => apply(level));
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

  // Settings that depend on the page's current look (e.g. Smart contrast) look again after any change
  for (const feature of SETTING_FEATURES) {
    const refresh = feature.refresh;
    if (refresh && (feature.kind === "levels" ? settings[feature.key] > 0 : settings[feature.key])) safely(() => refresh());
  }
}
