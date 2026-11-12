import type { Behavior } from "../features";
import { safely } from "../safely";
import { media } from "./media";

// One part per kind of motion. 4b adds gifs, 4c players, 4d third-party adapters.
const parts: Behavior[] = [media];

/** Everything "Pause animations" does beyond CSS. One failing part never stops the others. */
export const pauseMotion: Behavior = {
  start: () => parts.forEach((part) => safely(() => part.start())),
  stop: () => parts.forEach((part) => safely(() => part.stop())),
};
