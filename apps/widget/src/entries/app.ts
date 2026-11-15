// The real widget. Mounts an isolated UI once the page has finished loading.
import { h, render } from "preact";
import { mount } from "../ui/mount";
import { Widget } from "../ui/Widget";
import { DEFAULTS, loadSettings, setOwnerDefaults } from "../settings/settings";
import { adoptInto, applyToFrame, applyToPage, restoreDocumentCss } from "../settings/apply";
import { watchShadowRoots } from "../core/shadow-roots";
import { keepMounted } from "../ui/keep-mounted";
import { textSize } from "../features/text-size";
import { FEATURES } from "../features";
import { warnUnknownIgnoreIds } from "../core/ignore";
import { watchIframes } from "../core/iframes";
import { cachedConfig, fetchConfig } from "../settings/config";
import { applyTheme } from "../ui/theme";
import { applyPosition } from "../ui/position";

const thisScript = document.currentScript as HTMLScriptElement | null; // only valid right now, not later
const account = thisScript?.dataset.account ?? "";

// Ask the dashboard now, so the answer is usually back by the time the page has loaded.
const config = fetchConfig(account);

// Apply the visitor's settings now, not after load, so they don't see the page unadjusted first.
// The owner's defaults come from the last page view's config; a site where the widget isn't allowed gets nothing.
const lastConfig = cachedConfig(account);
if (lastConfig) setOwnerDefaults(lastConfig.defaults);
if (lastConfig?.enabled !== false) applyToPage(loadSettings());
watchShadowRoots(adoptInto); // from now on, every open shadow root on the page gets the shared stylesheet
watchIframes(applyToFrame); // same-origin iframes get the CSS settings too (after watchShadowRoots: it starts the observer)

/** At most this long after the page's HTML is in: one slow image or ad mustn't keep the widget hidden. */
const MAX_LOAD_WAIT_MS = 3000;

/**
 * The widget isn't needed for first paint: wait for the page so we don't compete with it, but not forever.
 * Resolves at the load event, or MAX_LOAD_WAIT_MS after the HTML is parsed, whichever comes first.
 */
function whenPageLoaded(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
    const cap = () => setTimeout(resolve, MAX_LOAD_WAIT_MS);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cap, { once: true });
    else cap();
  });
}

Promise.all([config, whenPageLoaded()]).then(([{ enabled, theme, defaults, position }]) => {
  setOwnerDefaults(defaults);
  if (!enabled) {
    // Not one of the account's sites: no widget, and undo anything applied from an older answer.
    // The visitor's saved choices stay, for when the site is added.
    applyToPage({ ...DEFAULTS }); // every setting off
    console.warn(`[a11y-widget] ${location.hostname} isn't one of this account's sites. Add it in the dashboard to show the widget.`);
    return;
  }
  applyToPage(loadSettings()); // the fresh answer may have changed the owner's defaults

  const container = mount();
  const host = (container.getRootNode() as ShadowRoot).host as HTMLElement;
  applyTheme(host, theme); // before the first render, so the brand color never flashes
  applyPosition(host, position); // likewise, so the button never jumps from the default corner
  render(h(Widget, {}), container);

  // Single-page apps can remove the widget, our <style> or the text-size variable while navigating: put them back.
  keepMounted(host, () => {
    restoreDocumentCss();
    textSize.restore();
  });

  // Help site owners spot typos like data-a11yw-ignore="text-sise"
  warnUnknownIgnoreIds(FEATURES.map((f) => f.id));
});
