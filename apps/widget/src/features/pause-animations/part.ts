import type { Behavior } from "../types";

/** One kind of motion handled by "Pause animations". recheck() runs about once a second while it's on. */
export type MotionPart = Behavior & { recheck?(): void };
