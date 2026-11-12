import { onElementsAdded } from "../dom-watcher";
import { isIgnored } from "../ignore";
import { deepQueryAll, onNewShadowRoot } from "../shadow-roots";
import type { MotionPart } from "./part";

/*
 * Animation libraries that run their own JavaScript loop, invisible to CSS and to getAnimations().
 * Each is detected through its public API and only touched if present; no library code is bundled or loaded.
 * - lottie-web (window.lottie / window.bodymovin): registered animations are paused
 * - <lottie-player>, <dotlottie-player>, <dotlottie-wc>: paused; some restart themselves when scrolled
 *   back into view, so the ones we paused are checked again regularly
 * - jQuery: running .animate() calls jump to their end, and new ones finish instantly (jQuery.fx.off)
 */
type LottieAnimation = { isPaused: boolean; pause(): void; play(): void };
type LottieLib = { getRegisteredAnimations?(): LottieAnimation[] };
type PlayerElement = HTMLElement & { pause?(): void; play?(): void; currentState?: string };
type JQueryLike = ((selector: string) => { finish(): unknown }) & { fx?: { off: boolean } };
type PageGlobals = { lottie?: LottieLib; bodymovin?: LottieLib; jQuery?: JQueryLike };

const PLAYER_TAGS = "lottie-player, dotlottie-player, dotlottie-wc";
const pageGlobals = window as unknown as PageGlobals;

const pausedLottie = new Set<LottieAnimation>();
const pausedPlayers = new Set<PlayerElement>();   // we paused these; re-paused if they restart themselves
const resumablePlayers = new Set<PlayerElement>(); // ...and these were known to be playing, so we resume them
let jqueryFxOffBefore: boolean | null = null;
const unsubscribes: Array<() => void> = [];

function pauseLottieWeb(): void {
  const lib = pageGlobals.lottie ?? pageGlobals.bodymovin;
  for (const animation of lib?.getRegisteredAnimations?.() ?? []) {
    if (animation.isPaused) continue;
    animation.pause();
    pausedLottie.add(animation);
  }
}

function pausePlayer(el: PlayerElement): void {
  if (typeof el.pause !== "function" || isIgnored(el)) return;
  if (el.currentState !== undefined && el.currentState !== "playing") return; // reports its state and isn't playing
  if (el.currentState === "playing") resumablePlayers.add(el); // only resume what we know was playing
  el.pause();
  pausedPlayers.add(el);
}

function pauseNewPlayers(start: Document | ShadowRoot | Element): void {
  deepQueryAll<PlayerElement>(PLAYER_TAGS, start).forEach((el) => {
    if (!pausedPlayers.has(el)) pausePlayer(el);
  });
}

function finishJquery(): void {
  const $ = pageGlobals.jQuery;
  if (typeof $ !== "function" || !$.fx || $.fx.off) return;
  jqueryFxOffBefore = $.fx.off;
  $.fx.off = true;          // new .animate() calls jump straight to the end
  $(":animated").finish();  // and the ones running now
}

export const libraries: MotionPart = {
  start() {
    pauseLottieWeb();
    pauseNewPlayers(document);
    finishJquery();
    unsubscribes.push(
      onElementsAdded((added) => added.forEach(pauseNewPlayers)),
      onNewShadowRoot(pauseNewPlayers)
    );
  },

  recheck() {
    pauseLottieWeb(); // animations registered or restarted since the last check
    pausedPlayers.forEach((el) => el.currentState === "playing" && el.pause?.()); // restarted on scroll
    finishJquery();   // jQuery loaded after we started
  },

  stop() {
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    pausedLottie.forEach((animation) => animation.play());
    resumablePlayers.forEach((el) => el.isConnected && el.play?.());
    const $ = pageGlobals.jQuery;
    if ($?.fx && jqueryFxOffBefore !== null) $.fx.off = jqueryFxOffBefore;

    pausedLottie.clear();
    pausedPlayers.clear();
    resumablePlayers.clear();
    jqueryFxOffBefore = null;
  },
};
