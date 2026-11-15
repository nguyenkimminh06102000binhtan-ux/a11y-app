import { partBehavior } from "../core/parts";
import type { ToggleImpl } from "./types";

/*
 * Pause animations (id "pause-animations"; words in the catalog, @app/widget-config).
 * Its CSS is here, in the main script, so CSS animations and transitions stop the moment it's on. Everything else
 * (video and audio, GIFs, SVG and script animations, animation libraries, carousels, video embeds) is in
 * parts/pause-animations/, downloaded when it's turned on.
 */
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
    behavior: partBehavior("pause-animations"),
};
