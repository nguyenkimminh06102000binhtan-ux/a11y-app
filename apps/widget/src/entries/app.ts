// The real widget. Mounts an isolated UI once the page has finished loading.
import { h, render } from "preact";
import { mount } from "../ui/mount";
import { Widget } from "../ui/Widget";
import { loadSettings } from "../settings/settings";
import { adoptInto, applyToPage } from "../settings/apply";
import { watchShadowRoots } from "../core/shadow-roots";
import { keepMounted } from "../ui/keep-mounted";
import { restoreDocumentCss } from "../settings/apply";
import { textSize } from "../features/text-size";



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
  const container = mount();
  render(h(Widget, {}), container);

  // Single-page apps can remove the widget, our <style> or the text-size variable while navigating: put them back.
  const host = (container.getRootNode() as ShadowRoot).host as HTMLElement;
  keepMounted(host, () => {
    restoreDocumentCss();
    textSize.restore();
  });
});

