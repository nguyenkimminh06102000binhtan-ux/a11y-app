import { onElementsAdded } from "../dom-watcher";
import { isIgnored } from "../ignore";
import { HOST_TAG } from "../mount";
import { deepQueryAll, onNewShadowRoot, openShadowRootsIn } from "../shadow-roots";
import type { MotionPart } from "./part";

/*
 * Animation engines built into the browser that CSS can't reach:
 * - SVG SMIL (<animate>, <animateTransform>…): paused per <svg>;
 * - <marquee>: stopped;
 * - animations started from JavaScript with element.animate(): ones with an end jump to it
 *   (like our CSS rule, so fade-ins never stay invisible); endless ones are paused.
 * stop() resumes only what we paused.
 */
const pausedSvgs = new Set<SVGSVGElement>();
const stoppedMarquees = new Set<HTMLMarqueeElement>();
const pausedAnimations = new Set<Animation>();
const unsubscribes: Array<() => void> = [];

function pauseSvgsAndMarquees(start: Document | ShadowRoot | Element): void {
  for (const svg of deepQueryAll<SVGSVGElement>("svg", start)) {
    if (isIgnored(svg) || svg.animationsPaused()) continue; // nested <svg> share their outer svg's clock
    svg.pauseAnimations();
    pausedSvgs.add(svg);
  }
  for (const marquee of deepQueryAll<HTMLMarqueeElement>("marquee", start)) {
    if (isIgnored(marquee) || stoppedMarquees.has(marquee)) continue;
    marquee.stop();
    stoppedMarquees.add(marquee);
  }
}

/** CSS animations and transitions also show up in getAnimations(); our CSS rule already handles those. */
function startedByScript(a: Animation): boolean {
  if (typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation) return false;
  if (typeof CSSTransition !== "undefined" && a instanceof CSSTransition) return false;
  return true;
}

function skipTarget(a: Animation): boolean {
  const target = a.effect instanceof KeyframeEffect ? a.effect.target : null;
  if (!target) return false;
  const root = target.getRootNode();
  const inWidget = root instanceof ShadowRoot && root.host.localName === HOST_TAG;
  return inWidget || isIgnored(target);
}

function settleScriptAnimations(): void {
  const all = new Set<Animation>();
  [document, ...openShadowRootsIn(document)].forEach((tree) => tree.getAnimations().forEach((a) => all.add(a)));

  all.forEach((a) => {
    if (a.playState !== "running" || !startedByScript(a) || skipTarget(a)) return;
    try {
      const end = Number(a.effect?.getComputedTiming().endTime);
      if (Number.isFinite(end)) {
        a.finish(); // jump to the end state; the page sees a normal "finish"
      } else {
        a.pause(); // endless: finish() would throw
        pausedAnimations.add(a);
      }
    } catch {
      // e.g. playbackRate 0: leave it alone
    }
  });
}

export const engines: MotionPart = {
  start() {
    pauseSvgsAndMarquees(document);
    settleScriptAnimations();
    unsubscribes.push(
      onElementsAdded((added) => added.forEach((el) => pauseSvgsAndMarquees(el))),
      onNewShadowRoot(pauseSvgsAndMarquees)
    );
  },

  recheck: settleScriptAnimations, // element.animate() fires no event we can listen for

  stop() {
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    pausedSvgs.forEach((svg) => svg.isConnected && svg.unpauseAnimations());
    stoppedMarquees.forEach((marquee) => marquee.isConnected && marquee.start());
    pausedAnimations.forEach((a) => a.playState === "paused" && a.play());
    pausedSvgs.clear();
    stoppedMarquees.clear();
    pausedAnimations.clear();
  },
};
