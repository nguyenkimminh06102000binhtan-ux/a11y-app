import { pickParent } from "./mount";

/*
 * Single-page apps often replace <body> or its children while navigating, which removes the widget
 * (and sometimes our <style> or the text-size variable on <html>). Put them back.
 * - Watches only direct children of <html>, <head> and <body>, plus <html>'s style attribute:
 *   no subtree, so it costs nothing while the page is busy.
 * - Re-attaches the SAME host element: the panel, its state and the visitor's settings survive.
 * - Never fights the page in a loop: after 10 restores in a minute, it stops and logs one warning.
 */
const MAX_RESTORES = 10;
const WINDOW_MS = 60_000;

export function keepMounted(host: HTMLElement, restorePage: () => void): void {
  let restores: number[] = [];

  const observer = new MutationObserver(() => {
    restorePage(); // our <style> and the text-size variable, if they were removed

    if (!host.isConnected) {
      const now = Date.now();
      restores = restores.filter((t) => now - t < WINDOW_MS);
      if (restores.length >= MAX_RESTORES) {
        observer.disconnect();
        console.warn("[a11y-widget] The page keeps removing the widget; leaving it removed.");
        return;
      }
      restores.push(now);
      pickParent().appendChild(host);
    }

    watchParents(); // <body> may have been replaced: watch the new one
  });

  function watchParents(): void {
    observer.disconnect();
    observer.observe(document.documentElement, { childList: true, attributes: true, attributeFilter: ["style"] });
    if (document.head) observer.observe(document.head, { childList: true });
    if (document.body) observer.observe(document.body, { childList: true });
  }

  watchParents();
}
