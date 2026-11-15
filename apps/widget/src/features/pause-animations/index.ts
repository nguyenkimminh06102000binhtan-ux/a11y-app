import type { Behavior, ToggleImpl } from "../types";
import { safely } from "../../core/safely";
import { rescanShadowRoots } from "../../core/shadow-roots";
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

/** Pause animations (id "pause-animations", FEATURE_ID in part.ts; words in the catalog, @app/widget-config). */
export const pauseAnimations: ToggleImpl = {
    // Not `animation: none` or `paused`: both can leave fade-in content invisible.
    // A tiny duration (not 0s) jumps to the end state and still fires animationend/transitionend,
    // which some sites wait for (e.g. to finish closing a modal).
    css: (scope) => `
      *${scope},
      *${scope}::before,
      *${scope}::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
    behavior: pauseMotion,
};
