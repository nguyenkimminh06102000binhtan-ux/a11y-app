import { onElementsAdded } from "../../core/dom-watcher";
import { isIgnored } from "../../core/ignore";
import { deepQueryAll, onNewShadowRoot } from "../../core/shadow-roots";
import type { MotionPart } from "./part";

/*
 * Pauses YouTube and Vimeo players embedded in iframes, through each player's documented postMessage API.
 * - Vimeo: any embed.
 * - YouTube: only embeds whose URL has enablejsapi=1; others ignore messages (known limit).
 * A player ignores messages until it has loaded, so for 10s after we find it we keep asking it to pause,
 * unless the visitor clicks into it to watch (the page then loses focus to that iframe).
 * Never resumed on stop: we can't know it was playing, and sound must never restart by surprise.
 */
const KEEP_PAUSING_MS = 10_000;

type Player = { origin: string; message: string; foundAt: number; visitorChoseToWatch: boolean };
const players = new Map<HTMLIFrameElement, Player>();
const unsubscribes: Array<() => void> = [];

function describePlayer(iframe: HTMLIFrameElement): Pick<Player, "origin" | "message"> | null {
  let url: URL;
  try {
    url = new URL(iframe.src, location.href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    return { origin: url.origin, message: JSON.stringify({ event: "command", func: "pauseVideo", args: "" }) };
  }
  if (host === "player.vimeo.com") {
    return { origin: url.origin, message: JSON.stringify({ method: "pause" }) };
  }
  return null;
}

function sendPause(iframe: HTMLIFrameElement, player: Player): void {
  // targetOrigin: the message is only delivered if the iframe still shows that player's site
  iframe.contentWindow?.postMessage(player.message, player.origin);
}

function onIframeLoad(e: Event): void {
  const iframe = e.currentTarget as HTMLIFrameElement;
  const player = players.get(iframe);
  if (!player || player.visitorChoseToWatch) return;
  player.foundAt = Date.now(); // a new video loaded: give it the full window again
  sendPause(iframe, player);
}

function track(start: Document | ShadowRoot | Element): void {
  for (const iframe of deepQueryAll<HTMLIFrameElement>("iframe", start)) {
    if (players.has(iframe) || isIgnored(iframe)) continue;
    const described = describePlayer(iframe);
    if (!described) continue;
    const player: Player = { ...described, foundAt: Date.now(), visitorChoseToWatch: false };
    players.set(iframe, player);
    iframe.addEventListener("load", onIframeLoad);
    sendPause(iframe, player);
  }
}

/** The focused element, looking inside open shadow roots (document.activeElement stops at a component's host). */
function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function onPageBlur(): void {
  // Clicking into an iframe moves focus to it: that's the visitor choosing to watch that video.
  setTimeout(() => {
    const active = deepActiveElement();
    const player = active instanceof HTMLIFrameElement ? players.get(active) : undefined;
    if (player) player.visitorChoseToWatch = true;
  });
}

export const embeds: MotionPart = {
  start() {
    track(document);
    window.addEventListener("blur", onPageBlur);
    unsubscribes.push(onElementsAdded((added) => added.forEach(track)), onNewShadowRoot(track));
  },

  recheck() {
    const now = Date.now();
    players.forEach((player, iframe) => {
      if (!iframe.isConnected) {
        iframe.removeEventListener("load", onIframeLoad);
        players.delete(iframe);
      } else if (!player.visitorChoseToWatch && now - player.foundAt < KEEP_PAUSING_MS) {
        sendPause(iframe, player);
      }
    });
  },

  stop() {
    window.removeEventListener("blur", onPageBlur);
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    players.forEach((_, iframe) => iframe.removeEventListener("load", onIframeLoad));
    players.clear();
  },
};
