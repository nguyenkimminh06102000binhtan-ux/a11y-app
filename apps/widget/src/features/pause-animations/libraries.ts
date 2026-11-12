import { onElementsAdded } from "../../core/dom-watcher";
import { deepQueryAll, onNewShadowRoot } from "../../core/shadow-roots";
import { isIgnored, type MotionPart } from "./part";

/*
 * Animation libraries that run their own JavaScript loop, invisible to CSS and to getAnimations().
 * Each is detected through its public API and only touched if present; no library code is bundled or loaded.
 * - lottie-web (window.lottie / window.bodymovin): registered animations are paused
 * - <lottie-player>, <dotlottie-player>, <dotlottie-wc>: paused; some restart themselves when scrolled
 *   back into view, so the ones we paused are checked again regularly
 * - jQuery: running .animate() calls jump to their end, and new ones finish instantly (jQuery.fx.off)
 * - GSAP (window.gsap) and anime.js v3 (window.anime): endless animations pause, others jump to their end
 */
type LottieAnimation = { isPaused: boolean; pause(): void; play(): void };
type LottieLib = { getRegisteredAnimations?(): LottieAnimation[] };
type PlayerElement = HTMLElement & { pause?(): void; play?(): void; currentState?: string };
type JQueryLike = ((selector: string) => { finish(): unknown }) & { fx?: { off: boolean } };
type GsapAnimation = {
  isActive(): boolean;
  repeat(): number; // -1 = endless
  pause(): unknown;
  resume(): unknown;
  totalProgress(value: number): unknown;
};
type Gsap = { globalTimeline?: { getChildren(nested: boolean, tweens: boolean, timelines: boolean): GsapAnimation[] } };
type AnimeInstance = { paused: boolean; loop: boolean | number; duration: number; pause(): void; play(): void; seek(time: number): void };
type Anime = { running?: AnimeInstance[] };
type PageGlobals = { lottie?: LottieLib; bodymovin?: LottieLib; jQuery?: JQueryLike; gsap?: Gsap; anime?: Anime };


const PLAYER_TAGS = "lottie-player, dotlottie-player, dotlottie-wc";
const pageGlobals = window as unknown as PageGlobals;

const pausedLottie = new Set<LottieAnimation>();
const pausedPlayers = new Set<PlayerElement>();   // we paused these; re-paused if they restart themselves
const resumablePlayers = new Set<PlayerElement>(); // ...and these were known to be playing, so we resume them
let jqueryFxOffBefore: boolean | null = null;
const pausedGsap = new Set<GsapAnimation>();
const pausedAnime = new Set<AnimeInstance>();
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

/** GSAP: endless animations pause; ones with an end jump to it (like our CSS rule, so fade-ins stay visible). */
function settleGsap(): void {
  for (const animation of pageGlobals.gsap?.globalTimeline?.getChildren(false, true, true) ?? []) {
    if (!animation.isActive()) continue; // not started yet, or paused (by the site or by us)
    if (animation.repeat() === -1) {
      animation.pause();
      pausedGsap.add(animation);
    } else {
      animation.totalProgress(1);
    }
  }
}

/** anime.js v3 (window.anime): endless instances pause; others stop at their end state. */
function settleAnime(): void {
  for (const instance of [...(pageGlobals.anime?.running ?? [])]) { // a copy: pausing removes it from `running`
    if (instance.paused) continue;
    if (instance.loop === true) {
      instance.pause();
      pausedAnime.add(instance);
    } else {
      instance.seek(instance.duration);
      instance.pause();
    }
  }
}

export const libraries: MotionPart = {
  start() {
    pauseLottieWeb();
    pauseNewPlayers(document);
    finishJquery();
    settleGsap();
    settleAnime();
    unsubscribes.push(
      onElementsAdded((added) => added.forEach(pauseNewPlayers)),
      onNewShadowRoot(pauseNewPlayers)
    );
  },

  recheck() {
    pauseLottieWeb(); // animations registered or restarted since the last check
    pausedPlayers.forEach((el) => el.currentState === "playing" && el.pause?.()); // restarted on scroll
    finishJquery();   // jQuery loaded after we started
    settleGsap();
    settleAnime();
  },

  stop() {
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    pausedLottie.forEach((animation) => animation.play());
    resumablePlayers.forEach((el) => el.isConnected && el.play?.());
    pausedGsap.forEach((animation) => animation.resume());
    pausedAnime.forEach((instance) => instance.play());
    const $ = pageGlobals.jQuery;
    if ($?.fx && jqueryFxOffBefore !== null) $.fx.off = jqueryFxOffBefore;

    pausedLottie.clear();
    pausedPlayers.clear();
    resumablePlayers.clear();
    pausedGsap.clear();
    pausedAnime.clear();
    jqueryFxOffBefore = null;
  },
};
