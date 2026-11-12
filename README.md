# a11y-app

Accessibility widget + audit dashboard that pinpoints unfixed issues and shows exactly where to fix them.

## Structure
- `apps/ww` — marketing site (yourapp.com)
- `apps/dashboard` — Next.js customer dashboard (+ /admin)
- `apps/widget` — accessibility toolbar widget (CDN bundle: `l.js` loader + content-hashed app)
- `apps/worker` — audit runner (Playwright + axe-core, Postgres queue)
- `apps/shopify` — Shopify app + theme extension     _(coming)_
- `packages/db` — Drizzle schema + database client
- `packages/*` — shared engine, types                _(coming)_
- `packages/tokens` — shared design tokens (Iris colors) + contrast check

## Dev
```bash
pnpm install
pnpm dev
```

### Widget
```bash
pnpm --filter widget dev        # http://localhost:4000 — test pages: /, /hostile.html, /components.html
pnpm --filter widget build      # dist/: l.js + app.<hash>.js; fails if over the size limits
pnpm --filter widget preview    # serves the production build at http://localhost:4001
pnpm --filter widget test       # Playwright + axe against the production build
pnpm --filter widget typecheck
```

## Widget: notes for site owners

**Install**
```html
<script src="https://cdn.example.com/l.js" data-account="acct_…" async></script>
```
The widget mounts after the page's `load` event, inside its own shadow root, and stays mounted across
single-page-app navigation. It adds nothing to your HTML except one `<style>` while a setting is on.


**Exclude part of a page** from every setting, or only from some:
```html
<div data-a11yw-ignore>…</div>                                <!-- every setting -->
<div data-a11yw-ignore="text-size text-spacing">…</div>       <!-- only these -->
```
Setting names: `text-size`, `highlight-links`, `text-spacing`, `focus-outline`, `pause-animations`
(`all` also means every setting). The element and everything inside it are left alone, including
values they would otherwise inherit: for Text size, Text spacing and Highlight links, the elements
*containing* the area keep the page's own values too, so text directly inside them isn't adjusted.
An unknown name (e.g. a typo) logs one console warning.
Limit: inside a web component's shadow root within that area, the CSS-based settings still apply.

These names are a public contract: never rename one once customers use it.

**YouTube embeds:** add `enablejsapi=1` to the embed URL so *Pause animations* can pause them.

## Widget: settings
| Setting | What it does |
|---|---|
| Text size | Default, 125%, 150%, 200%. Enlarges text only (no page zoom), so pages reflow instead of scrolling sideways. |
| Highlight links | Yellow background and underline on every link. |
| Text spacing | WCAG 1.4.12 values: line height 1.5, letters 0.12em, words 0.16em, paragraphs 2em. |
| Stronger focus outline | Thick two-tone outline on whatever has keyboard focus. |
| Pause animations | CSS animations/transitions, autoplay video/audio, GIFs, SVG/marquee, script animations, Lottie, jQuery, GSAP, anime.js, YouTube/Vimeo embeds, Swiper/Bootstrap/Slick carousels. The visitor can still press play. |

Settings are saved per site in the visitor's browser (`localStorage`), applied inside open web components and same-origin iframes too
and survive single-page-app navigation. Turning a setting off restores the page exactly.

## Widget: known limits
- **Closed shadow roots** can't be reached by any setting.
- **Browsers without constructable stylesheets** (Safari < 16.4) get settings on the main page only, not inside web components.
- **Inline `style="… !important"`** on a page element beats the settings.
- **Pause animations**
  - GIFs are detected by URL (`.gif`); animated WebP/APNG aren't detected.
  - Cross-origin CSS background GIFs, backgrounds on `::before`/`::after`, and background GIFs added later by changing `class`/`style` aren't frozen.
  - Canvas/WebGL animation loops aren't paused.
  - YouTube embeds without `enablejsapi=1`; Bootstrap loaded as an ES module; Splide, Glide, Flickity, Owl Carousel; anime.js v4 (no global); `<dotlottie-wc>` unless it exposes `pause()`.
- **Text size** starts once the page has fully loaded (text is normal size until then, so sizes are measured
  correctly); if the page later changes an element's size itself, the size we measured wins; fixed-height boxes
  may overflow (they'd fail WCAG 1.4.4 anyway).
- **Web components defined late** (no DOM change) get settings at the next settings change, page change or load.
- **If the page removes the widget more than 10 times a minute**, it stays removed (one console warning).
- **Browsers without `:has()`** (Firefox < 121, Safari < 15.4): an opted-out area inside adjusted text inherits Text spacing and Highlight links from the element around it.
- **Browsers without constructable stylesheets** (Safari < 16.4) get settings on the main page only, not inside web components.
- **Iframes**: iframes from another domain (videos, maps, payments) can't be reached by any setting. Same-origin
  iframes get Highlight links, Text spacing, Stronger focus outline and the CSS part of Pause animations,
  but not Text size, the rest of Pause animations, web components or iframes inside them.
  An iframe page that runs the widget itself is left to its own widget.




