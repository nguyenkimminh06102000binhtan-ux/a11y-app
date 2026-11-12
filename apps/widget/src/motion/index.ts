import type { Behavior } from "../features";
import { safely } from "../safely";
import { rescanShadowRoots } from "../shadow-roots";
import { engines } from "./engines";
import { gifs } from "./gifs";
import { libraries } from "./libraries";
import { media } from "./media";
import type { MotionPart } from "./part";
import { carousels } from "./carousels";
import { embeds } from "./embeds";


// One part per kind of motion. 4d adds third-party adapters (carousels, video iframes, GSAP).
const parts: MotionPart[] = [media, gifs, engines, libraries, carousels, embeds];

// Some things give no signal we can listen for: element.animate(), lottie-web's list, players restarting
// themselves, and components defined late (the browser upgrades them with no DOM change). Check once a second.
const RECHECK_MS = 1000;
let timer: ReturnType<typeof setInterval> | undefined;

function recheck(): void {
  rescanShadowRoots(); // newly found roots reach every part through onNewShadowRoot
  parts.forEach((part) => part.recheck && safely(() => part.recheck!()));
}

/** Everything "Pause animations" does beyond CSS. One failing part never stops the others. */
export const pauseMotion: Behavior = {
  start() {
    parts.forEach((part) => safely(() => part.start()));
    timer = setInterval(recheck, RECHECK_MS);
  },
  stop() {
    clearInterval(timer);
    timer = undefined;
    parts.forEach((part) => safely(() => part.stop()));
  },
};
