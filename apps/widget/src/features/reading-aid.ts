import { partBehavior } from "../core/parts";
import type { LevelCount, LevelImpl } from "./types";

/** Reading aid (id "reading-aid"; words in the catalog): Guide or Mask, drawn by parts/reading-aid.ts, downloaded when chosen. */
const MODES = [null, "guide", "mask"] as const;
MODES satisfies { length: LevelCount<"reading-aid"> };

const part = partBehavior("reading-aid");

export const readingAid: LevelImpl = {
    apply(level) {
        const mode = MODES[level];
        if (mode) part.start(mode);
        else part.stop();
    },
};
