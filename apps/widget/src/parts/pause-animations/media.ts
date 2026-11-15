import { HOST_TAG } from "../../core/host";
import { isIgnored, type MotionPart, deepQueryAll, onNewShadowRoot, openShadowRootsIn } from "./part";

/*
 * Pauses autoplaying video and audio without taking control away from the visitor:
 * - a play within 1s of a real click or key press ON THE PAGE is allowed, so play buttons keep working;
 * - nothing global is patched and play() is never replaced, so the site's own code keeps working;
 * - on stop, only muted videos resume (decorative backgrounds). Sound never restarts by surprise (WCAG 1.4.2).
 */
const USER_PLAY_WINDOW_MS = 1000;
// A component can be found up to ~1s after it appeared (observer batch, or the once-a-second rescan).
// Media found already playing in it gets a longer window, so a video lightbox opened by a click still plays.
const FOUND_LATE_WINDOW_MS = 2000;

let lastGesture = 0;
const pausedByUs = new Set<HTMLMediaElement>();
const listenedTrees = new Set<Document | ShadowRoot>();
let stopWatching: (() => void) | null = null;

function recordGesture(e: Event): void {
  if (!e.isTrusted) return; // events created by scripts aren't the visitor
  const inWidget = e.composedPath().some((node) => (node as Element).localName === HOST_TAG);
  if (inWidget) return; // ticking our own checkbox mustn't let autoplay through
  lastGesture = Date.now();
}

function visitorInteractedWithin(ms: number): boolean {
  return Date.now() - lastGesture < ms;
}

function pause(el: HTMLMediaElement): void {
  if (isIgnored(el)) return;
  el.pause();
  pausedByUs.add(el);
}

function pausePlayingIn(tree: Document | ShadowRoot): void {
  for (const el of deepQueryAll<HTMLMediaElement>("video, audio", tree)) {
    if (!el.paused && !el.ended) pause(el);
  }
}

function onPlay(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement)) return;
  if (visitorInteractedWithin(USER_PLAY_WINDOW_MS)) return; // the visitor pressed play
  pause(el);
}

function listen(tree: Document | ShadowRoot): void {
  if (listenedTrees.has(tree)) return;
  listenedTrees.add(tree);
  // "play" doesn't bubble and doesn't leave shadow roots: listen in the capture phase on every tree
  tree.addEventListener("play", onPlay, true);
}

function onRootFound(root: ShadowRoot): void {
  listen(root); // from now on, autoplay in it is caught the moment it starts...
  if (!visitorInteractedWithin(FOUND_LATE_WINDOW_MS)) pausePlayingIn(root); // ...and what started before we found it is paused now
}

export const media: MotionPart = {
  start() {
    window.addEventListener("pointerdown", recordGesture, true);
    window.addEventListener("keydown", recordGesture, true);
    listen(document);
    openShadowRootsIn(document).forEach(listen);
    pausePlayingIn(document);
    stopWatching = onNewShadowRoot(onRootFound);
  },

  stop() {
    window.removeEventListener("pointerdown", recordGesture, true);
    window.removeEventListener("keydown", recordGesture, true);
    listenedTrees.forEach((tree) => tree.removeEventListener("play", onPlay, true));
    listenedTrees.clear();
    stopWatching?.();
    stopWatching = null;

    pausedByUs.forEach((el) => {
      if (el.isConnected && el.muted) el.play().catch(() => {}); // play() can be refused; that's fine
    });
    pausedByUs.clear();
  },
};
