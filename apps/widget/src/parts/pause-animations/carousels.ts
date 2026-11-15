import { isIgnored, type MotionPart, deepQueryAll } from "./part";

/*
 * Stops carousels that advance on their own, through each library's public API (only if it's on the page):
 * - Swiper (el.swiper, also <swiper-container>): autoplay.stop() / start()
 * - Bootstrap 5 (window.bootstrap.Carousel): pause() / cycle(). Bootstrap restarts a carousel when the
 *   mouse leaves it, so recheck() pauses ours again.
 * - Slick (jQuery plugin): slickPause / slickPlay, only when its autoplay option is on
 * Carousels usually start up on elements already on the page (no new element appears), so they're found
 * at start and on every recheck rather than through the observer. Only auto-advancing ones are resumed.
 */
type SwiperAutoplay = { running: boolean; stop(): void; start(): void };
type BootstrapCarousel = { pause(): void; cycle(): void };
type SlickApi = { slick?(method: string, ...args: unknown[]): unknown };
type PageGlobals = {
  bootstrap?: { Carousel?: { getInstance(el: Element): BootstrapCarousel | null } };
  jQuery?: (el: Element) => SlickApi;
};

const SELECTOR = ".swiper, .swiper-container, swiper-container, .carousel, .slick-initialized";
const pageGlobals = window as unknown as PageGlobals;

const stoppedSwipers = new Set<SwiperAutoplay>();
const pausedBootstrap = new Map<Element, BootstrapCarousel>();
const pausedSlick = new Set<Element>();

function stopCarousels(): void {
  for (const el of deepQueryAll(SELECTOR)) {
    if (isIgnored(el)) continue;

    const autoplay = (el as Element & { swiper?: { autoplay?: SwiperAutoplay } }).swiper?.autoplay;
    if (autoplay?.running) {
      autoplay.stop();
      stoppedSwipers.add(autoplay);
    }

    const bootstrap = pageGlobals.bootstrap?.Carousel?.getInstance(el);
    if (bootstrap) {
      bootstrap.pause(); // also re-pauses ones Bootstrap restarted on mouse leave
      pausedBootstrap.set(el, bootstrap);
    }

    if (!pausedSlick.has(el) && el.classList.contains("slick-initialized")) {
      const slick = typeof pageGlobals.jQuery === "function" ? pageGlobals.jQuery(el) : null;
      if (typeof slick?.slick === "function" && slick.slick("slickGetOption", "autoplay")) {
        slick.slick("slickPause");
        pausedSlick.add(el);
      }
    }
  }
}

export const carousels: MotionPart = {
  start: stopCarousels,
  recheck: stopCarousels,

  stop() {
    stoppedSwipers.forEach((autoplay) => autoplay.start());
    pausedBootstrap.forEach((carousel, el) => {
      if (el.isConnected && el.getAttribute("data-bs-ride") === "carousel") carousel.cycle(); // only auto-advancing ones
    });
    pausedSlick.forEach((el) => el.isConnected && pageGlobals.jQuery?.(el).slick?.("slickPlay"));
    stoppedSwipers.clear();
    pausedBootstrap.clear();
    pausedSlick.clear();
  },
};
