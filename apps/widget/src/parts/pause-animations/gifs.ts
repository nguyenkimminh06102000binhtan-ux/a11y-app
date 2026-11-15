import { isIgnored, type MotionPart, deepQueryAll, onElementsAdded, onNewShadowRoot, openShadowRootsIn } from "./part";

/*
 * Freezes animated GIFs on the frame showing now, without losing anything:
 * - same-origin / data: <img>: the same element shows a still PNG, so alt, classes, layout and the
 *   site's references to the element keep working;
 * - cross-origin <img> (the browser lets us draw it but not read it back): a still <canvas> is shown
 *   after the hidden image, carrying its alt text, so screen readers lose nothing;
 * - CSS background GIFs (same-origin or CORS-enabled): the element's background shows a still frame.
 * stop() restores everything exactly.
 */

type Tree = Document | ShadowRoot;
type StyleRecord = { value: string; priority: string };
type ImgRecord = {
  still: string;
  src: string | null;
  srcset: string | null;
  sources: Array<[HTMLSourceElement, string | null]>;
};

const frozenImgs = new Map<HTMLImageElement, ImgRecord>();
const coveredImgs = new Map<HTMLImageElement, { canvas: HTMLCanvasElement; display: StyleRecord }>();
const frozenBackgrounds = new Map<HTMLElement, StyleRecord>();
const stillCache = new Map<string, Promise<string | null>>();
const listenedTrees = new Set<Tree>();
let active = false;
const unsubscribes: Array<() => void> = [];

const URL_IN_CSS = /url\(\s*(['"]?)(.*?)\1\s*\)/g;

function isGifUrl(url: string): boolean {
  if (url.startsWith("data:image/gif")) return true;
  try {
    const u = new URL(url, location.href);
    // ".gif" at the end of the path, or in the query (image CDNs: ?url=…/cat.gif)
    return /\.gif$/i.test(u.pathname) || /\.gif(?:[&#]|$)/i.test(u.search);
  } catch {
    return false;
  }
}

function drawStill(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** PNG of the canvas, or null when the browser forbids reading it (cross-origin pixels). */
function readPixels(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function setOrRemove(el: Element, attr: string, value: string | null): void {
  if (value === null) el.removeAttribute(attr);
  else el.setAttribute(attr, value);
}

function saveStyle(el: HTMLElement, prop: string): StyleRecord {
  return { value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) };
}

function restoreStyle(el: HTMLElement, prop: string, prev: StyleRecord): void {
  if (prev.value) el.style.setProperty(prop, prev.value, prev.priority);
  else el.style.removeProperty(prop);
}

// ---- <img> GIFs ----

function freezeImg(img: HTMLImageElement): void {
  if (!active || coveredImgs.has(img) || isIgnored(img)) return;

  const record = frozenImgs.get(img);
  if (record) {
    if (img.getAttribute("src") === record.still) return; // still showing our frozen frame
    frozenImgs.delete(img); // the page swapped the image itself (e.g. a slideshow): freeze the new one
  }

  if (!isGifUrl(img.currentSrc || img.src)) return;
  if (!img.complete || !img.naturalWidth) return; // not loaded yet: the "load" listener calls us again

  const canvas = drawStill(img, img.naturalWidth, img.naturalHeight);
  const still = readPixels(canvas);
  if (still) showStillInPlace(img, still);
  else coverWithCanvas(img, canvas);
}

function showStillInPlace(img: HTMLImageElement, still: string): void {
  const picture = img.parentElement instanceof HTMLPictureElement ? img.parentElement : null;
  const sources = picture ? Array.from(picture.querySelectorAll<HTMLSourceElement>(":scope > source")) : [];

  frozenImgs.set(img, {
    still,
    src: img.getAttribute("src"),
    srcset: img.getAttribute("srcset"),
    sources: sources.map((s) => [s, s.getAttribute("srcset")]),
  });
  sources.forEach((s) => s.removeAttribute("srcset")); // a matching <source> would win over img.src
  img.removeAttribute("srcset");
  img.src = still;
}

function coverWithCanvas(img: HTMLImageElement, canvas: HTMLCanvasElement): void {
  const box = img.getBoundingClientRect();
  canvas.className = img.className; // class-based layout keeps working
  canvas.style.width = `${box.width}px`;
  canvas.style.height = `${box.height}px`;
  canvas.style.verticalAlign = getComputedStyle(img).verticalAlign;

  // Screen readers get exactly what the image gave them
  if (img.alt) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", img.alt);
  } else {
    canvas.setAttribute("aria-hidden", "true"); // decorative stays decorative
  }

  coveredImgs.set(img, { canvas, display: saveStyle(img, "display") });
  img.after(canvas);
  img.style.setProperty("display", "none", "important"); // page CSS can't bring it back while covered
}

// ---- CSS background GIFs ----

function stillOfUrl(url: string): Promise<string | null> {
  let still = stillCache.get(url);
  if (!still) {
    still = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous"; // CORS-enabled CDNs become readable; same-origin is unaffected
      image.onload = () => resolve(readPixels(drawStill(image, image.naturalWidth, image.naturalHeight)));
      image.onerror = () => resolve(null);
      image.src = url;
    });
    stillCache.set(url, still);
  }
  return still;
}

function freezeBackground(el: Element): void {
  if (!(el instanceof HTMLElement) || frozenBackgrounds.has(el) || isIgnored(el)) return;
  const value = getComputedStyle(el).backgroundImage;
  if (!value.includes("url(")) return;
  const urls = [...value.matchAll(URL_IN_CSS)].map((m) => m[2]).filter(isGifUrl);
  if (!urls.length) return;

  Promise.all(urls.map(stillOfUrl)).then((stills) => {
    if (!active || frozenBackgrounds.has(el)) return;
    let frozen = value;
    urls.forEach((url, i) => {
      const still = stills[i];
      if (still) frozen = frozen.split(url).join(still);
    });
    if (frozen === value) return; // nothing could be frozen (cross-origin without CORS)
    frozenBackgrounds.set(el, saveStyle(el, "background-image"));
    el.style.setProperty("background-image", frozen, "important");
  });
}

// ---- wiring ----

function scan(start: Tree | Element): void {
  deepQueryAll<HTMLImageElement>("img", start).forEach(freezeImg);
  deepQueryAll("*", start).forEach(freezeBackground);
}

function onLoad(e: Event): void {
  if (e.target instanceof HTMLImageElement) freezeImg(e.target);
}

function listen(tree: Tree): void {
  if (listenedTrees.has(tree)) return;
  listenedTrees.add(tree);
  // Image "load" doesn't bubble and doesn't leave shadow roots: capture on every tree.
  // Catches lazy-loaded GIFs and slideshows that change src.
  tree.addEventListener("load", onLoad, true);
}

export const gifs: MotionPart = {
  start() {
    active = true;
    listen(document);
    openShadowRootsIn(document).forEach(listen);
    scan(document);
    unsubscribes.push(
      onElementsAdded((added) => added.forEach(scan)),
      onNewShadowRoot((root) => {
        listen(root); // lazy-loaded GIFs in it are caught from now on...
        scan(root);   // ...and the ones already loaded are frozen now
      })
    );
  },

  stop() {
    active = false;
    listenedTrees.forEach((tree) => tree.removeEventListener("load", onLoad, true));
    listenedTrees.clear();
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());


    frozenImgs.forEach((r, img) => {
      r.sources.forEach(([source, srcset]) => setOrRemove(source, "srcset", srcset));
      setOrRemove(img, "srcset", r.srcset);
      setOrRemove(img, "src", r.src);
    });
    coveredImgs.forEach((r, img) => {
      r.canvas.remove();
      restoreStyle(img, "display", r.display);
    });
    frozenBackgrounds.forEach((prev, el) => restoreStyle(el, "background-image", prev));
    frozenImgs.clear();
    coveredImgs.clear();
    frozenBackgrounds.clear();
  },
};
