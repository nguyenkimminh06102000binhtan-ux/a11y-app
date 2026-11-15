import { setLensFilter } from "../core/lens";
import type { LevelCount, LevelImpl } from "./types";

/*
 * Color (id "color"; words in the catalog, @app/widget-config): Muted, Vivid or Grayscale, through the lens
 * (core/lens.ts), so the page's layout doesn't change and the widget keeps its colors. Covers the whole screen,
 * embedded videos and maps included; data-a11yw-ignore can't exclude an area from it.
 */
const FILTERS = [null, "saturate(0.5)", "saturate(2)", "grayscale(1)"] as const;
FILTERS satisfies { length: LevelCount<"color"> };

export const color: LevelImpl = {
    apply(level) {
        setLensFilter("color", FILTERS[level] ?? null);
    },
};
