// The real widget. For now it only proves the handoff from the loader works.
export {}; // make this file a module so its top-level names don't clash with browser globals

const thisScript = document.currentScript as HTMLScriptElement | null;
const account = thisScript?.dataset.account;

console.log("[a11y-widget] app loaded", { account, host: location.hostname });
