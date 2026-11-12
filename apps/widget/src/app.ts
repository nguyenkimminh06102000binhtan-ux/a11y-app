// The real widget. Mounts an isolated UI once the page has finished loading.
import { h, render } from "preact";
import { mount } from "./mount";
import { Widget } from "./Widget";
import { loadSettings } from "./settings";
import { adoptInto, applyToPage } from "./page-styles";
import { watchShadowRoots } from "./shadow-roots";


const thisScript = document.currentScript as HTMLScriptElement | null; // only valid right now, not later
const account = thisScript?.dataset.account;

console.log("[a11y-widget] app loaded", { account, host: location.hostname });

// Apply saved settings now, not after load, so the visitor doesn't see the page unadjusted first.
applyToPage(loadSettings());
watchShadowRoots(adoptInto); // from now on, every open shadow root on the page gets the shared stylesheet


/** The widget isn't needed for first paint: wait for the page so we don't compete with it. */
function whenPageLoaded(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

whenPageLoaded().then(() => {
  render(h(Widget, {}), mount());
});
