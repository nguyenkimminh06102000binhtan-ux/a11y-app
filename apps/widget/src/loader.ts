// The tiny script customers embed. Its only job: find out who we are, then load the app.
const LOADED_ATTR = "data-a11yw-account"; // set on <html> once the widget is loading
const BOT_UA = /bot|crawler|spider|slurp|facebookexternalhit|bingpreview/i;

function main() {
  // Must be read synchronously at the top level; it's null inside callbacks.
  const thisScript = document.currentScript as HTMLScriptElement | null;
  if (!thisScript) return;

  const account = thisScript.dataset.account;
  if (!account) {
    console.warn("[a11y-widget] Missing data-account on the embed script.");
    return;
  }

  // Already loaded by another copy of the snippet: don't load twice.
  const root = document.documentElement;
  const loadedFor = root.getAttribute(LOADED_ATTR);
  if (loadedFor !== null) {
    if (loadedFor !== account) {
      console.warn(`[a11y-widget] Two different accounts embedded on this page (${loadedFor}, ${account}). Using ${loadedFor}.`);
    }
    return;
  }

  // Crawlers don't need a toolbar.
  if (BOT_UA.test(navigator.userAgent)) return;

  root.setAttribute(LOADED_ATTR, account);

  const app = document.createElement("script");
  app.src = new URL(__APP_FILE__, thisScript.src).href; // resolve next to l.js, wherever it's hosted
  app.async = true;
  app.dataset.account = account;
  if (__APP_INTEGRITY__) {
    app.integrity = __APP_INTEGRITY__;
    app.crossOrigin = "anonymous"; // browsers only verify integrity on cross-origin scripts fetched with CORS
  }
  document.head.appendChild(app);
}

main();
