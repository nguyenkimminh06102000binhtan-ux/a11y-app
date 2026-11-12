// The real widget. Mounts an isolated UI once the page has finished loading.
import { mount } from "./mount";

const thisScript = document.currentScript as HTMLScriptElement | null; // only valid right now, not later
const account = thisScript?.dataset.account;

console.log("[a11y-widget] app loaded", { account, host: location.hostname });

/** The widget isn't needed for first paint: wait for the page so we don't compete with it. */
function whenPageLoaded(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

whenPageLoaded().then(() => {
  const root = mount();

  // Placeholder until chunk 3 brings the real UI.
  const box = document.createElement("p");
  box.className = "box";
  box.textContent = "Widget mounted";
  root.appendChild(box);
});
