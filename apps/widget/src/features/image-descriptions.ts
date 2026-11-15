import { partBehavior } from "../core/parts";
import type { ToggleImpl } from "./types";

/** Image descriptions (id "image-descriptions"; words in the catalog). The work is in parts/image-descriptions.ts, downloaded when turned on. */
export const imageDescriptions: ToggleImpl = {
    behavior: partBehavior("image-descriptions"),
};
