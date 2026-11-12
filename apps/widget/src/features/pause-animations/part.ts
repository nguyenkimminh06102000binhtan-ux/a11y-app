import { ignoredBy } from "../../core/ignore";
import type { Behavior } from "../types";

/** Public id of this setting, used in data-a11yw-ignore="…". Never rename once customers use it. */
export const FEATURE_ID = "pause-animations";

/** Is this element in an area the site owner opted out of Pause animations? */
export const isIgnored = ignoredBy(FEATURE_ID);

/** One kind of motion handled by "Pause animations". recheck() runs about once a second while it's on. */
export type MotionPart = Behavior & { recheck?(): void };
