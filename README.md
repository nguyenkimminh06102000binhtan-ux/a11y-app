# a11y-app

Accessibility widget + audit dashboard that pinpoints unfixed issues and shows exactly where to fix them.

## Structure
- `apps/ww` — marketing site (yourapp.com)
- `apps/dashboard` — Next.js customer dashboard (+ /admin); also serves the widget's config (`/api/widget/config`)
- `apps/widget` — accessibility toolbar widget (CDN bundle: `l.js` loader + content-hashed app)
- `apps/worker` — audit runner (Playwright + axe-core, Postgres queue)
- `apps/shopify` — Shopify app + theme extension     _(coming)_
- `packages/db` — Drizzle schema + database client
- `packages/tokens` — shared design tokens (Iris colors) + contrast check
- `packages/widget-config` — the widget ⇄ dashboard contract: settings and config schemas (Valibot), brand color math

## Dev
```bash
pnpm install
pnpm dev
```

| App | Address |
|---|---|
| Dashboard | http://localhost:3001 (pinned, so the widget knows where to ask for its config) |
| Widget test pages | http://localhost:4000 |

### Widget
```bash
pnpm --filter widget dev        # http://localhost:4000 — test pages: /, /hostile.html, /components.html
pnpm --filter widget build      # dist/: l.js + app.<hash>.js; fails if over the size limits
pnpm --filter widget preview    # serves the production build at http://localhost:4001
pnpm --filter widget test       # Playwright + axe against the production build (the config is mocked)
pnpm --filter widget typecheck
```
The test pages use the fake key `acct_test`: the dashboard answers 400 and the widget shows with our defaults.
To try your own settings, copy `index.html` to `apps/widget/public/mine.html` (git-ignored), put your real
`acct_…` key in it, add `localhost` as a site in the dashboard, and open http://localhost:4000/mine.html.

### Dashboard tests
Every page at 320, 768 and 1280px with axe (WCAG 2.2 A/AA), no sideways scrolling, 44px controls, plus the open
states (menu, panels, confirmations, toasts) and key behaviors. They run against a **local Supabase test stack**
(`supabase/config.toml`: database, auth and a test mailbox in Docker, never the real project). The test account is
reseeded each run. There's no login bypass in the dashboard's code:
- `tests/setup.ts` signs the test user in **without the sign-in page**: the local stack's admin API makes a one-time
  sign-in link and the session goes into the browser. So the other tests don't depend on which login options exist.
- `tests/sign-in.spec.ts` tests the sign-in page itself (today: the magic link through the test mailbox and
  `/auth/callback`). When the login options change, change only this file.
```bash
supabase start                                   # once, from the repo root (needs Docker); `supabase stop` after
MIGRATION_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm --filter @app/db db:migrate
pnpm --filter dashboard test                     # builds into .next-test (your .next is untouched), then tests
pnpm --filter dashboard typecheck
```
CI (`.github/workflows/dashboard.yml`) does the same on pull requests and pushes to `main` that touch the dashboard,
`packages/*` it uses or `supabase/`. It only tests; Vercel still deploys.

### Shared packages
```bash
pnpm --filter @app/tokens test           # every color pairing we use still has enough contrast
pnpm --filter @app/widget-config test    # schemas, and readable colors for any brand color
pnpm --filter @app/db db:generate        # after a schema change; then db:migrate
```

## Deploying the widget
The widget is served from **https://cdn.accesspilot.org** (Cloudflare Pages project `accesspilot-widget`).
Deploys are automatic: `.github/workflows/widget.yml` runs on every pull request and push to `main` that
touches the widget, `packages/tokens`, `packages/widget-config` or the lockfile.
- **Pull request:** typecheck, contract and contrast tests, Playwright + axe tests.
- **Push to `main`:** the same tests, then a clean build with
  `WIDGET_API_BASE=https://manage.accesspilot.org` and `wrangler pages deploy`. Failed tests mean no deploy.
- **Redeploy by hand:** GitHub → Actions → Widget → Run workflow.
- **Roll back:** Cloudflare → Workers & Pages → `accesspilot-widget` → Deployments → Rollback on the last good one.
- **Secrets** (GitHub → Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (Account →
  Cloudflare Pages → Edit only) and `CLOUDFLARE_ACCOUNT_ID`.

Caching (from `dist/_headers`, written by the build): `l.js` for 5 minutes, so a release reaches every site
within about 5 minutes; `app.<hash>.js` for a year, since a new build gets a new name. Both send CORS
(needed for the loader's integrity check) and `Cross-Origin-Resource-Policy: cross-origin`.

A local build without `WIDGET_API_BASE` points to `http://localhost:3001` (the build prints which address it uses).

## Widget: notes for site owners

**Install** the same snippet on every site of your account:
```html
<script src="https://cdn.accesspilot.org/l.js" data-account="acct_…" async></script>
```
The widget mounts after the page's `load` event, inside its own shadow root, and stays mounted across
single-page-app navigation. It adds nothing to your HTML except one `<style>` while a setting is on.

**Where it shows:** on the sites you've added in the dashboard (`shop.com` also covers `www.shop.com`), and on
`localhost` for testing. A subdomain such as `blog.shop.com` is a separate site with its own plan: it shows there
only once it's added as a site. On any other domain it stays hidden and logs one console warning.

**Settings per site** (dashboard › your site › Widget › Customize):
- **Brand color:** any color. Icons on it are black or white, whichever reads best; it's used for text and borders
  only where it's dark enough to read, so the widget always stays readable.
- **Position:** bottom right, top right, middle right (or the same on the left), with a distance from the side and
  from the top or bottom (0–200 px), and optionally a different position on phones (up to 640 px wide). The widget
  keeps the button on screen whatever the distances, avoids the notch and home bar, and opens its panel toward the
  middle of the screen. Visitors can move it to the other side from the panel ("Move to the left"); that choice is
  theirs, kept on the site's pages, and wins over the site's left/right. "Reset all" puts it back.
- **On by default:** settings that start on for visitors who haven't changed anything. Visitors can turn them
  off, and their own choices always win.
- Changes reach visitors within about 5 minutes.

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

Settings are saved per site in the visitor's browser (`localStorage`), applied inside open web components and
same-origin iframes too, and survive single-page-app navigation. Turning a setting off restores the page exactly.

## Widget config: how it works
- The widget asks `GET /api/widget/config?account=acct_…&host=<page hostname>` as soon as it loads, and waits at
  most 3 seconds. The answer says whether it may show, the brand color, and the settings on by default.
- **When it shows:** once the page has loaded, so it doesn't slow the page down, but at most 3 seconds after the
  HTML is in: an image or ad that never finishes loading can't keep the widget hidden. The visitor's saved settings
  are applied at once either way; only Text size waits for the full load (it measures the page's final font sizes).
- **Installed?** When the config request comes from a browser on the site itself (its `Origin` is the site's
  domain, www. or not), the dashboard notes the time on the site (`sites.widget_seen_at`, at most once a minute,
  after answering). Sites, the Widget section and Embed code show "Seen 5 minutes ago" / "Not installed yet".
  Nothing about visitors is stored. A script outside a browser could fake the Origin: at worst "seen" looks newer.
- **Fails open:** no answer (server down, blocked request) means the last answer this visitor got, or our defaults.
  An accessibility tool shouldn't vanish because our server had a problem.
- **Caching:** the dashboard caches each answer (cleared at once when a site or its settings change); browsers ask
  again on every page view, CDNs keep it 5 seconds, so a change in the dashboard shows on the next reload within
  seconds. The widget keeps the last answer in `localStorage`, so returning visitors see the right colors immediately.
- **Two shapes** in `packages/widget-config`: `SiteSettings` (what the owner chose, one JSON document per site in
  `widget_settings`) and `WidgetConfig` (what the widget gets). `toWidgetConfig()` is the only place that maps one
  to the other.
- **Adding an option:** add a field with a default to `SiteSettingsSchema` (no migration), map it in
  `toWidgetConfig`, add it to `WidgetConfigSchema` with a fallback (old widgets ignore it), then add it to the form.
  Removing or renaming a field is breaking: bump the version.

## Widget: known limits
- **Closed shadow roots** can't be reached by any setting.
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
- **Iframes**: iframes from another domain (videos, maps, payments) can't be reached by any setting. Same-origin
  iframes get Highlight links, Text spacing, Stronger focus outline and the CSS part of Pause animations,
  but not Text size, the rest of Pause animations, web components or iframes inside them.
  An iframe page that runs the widget itself is left to its own widget.
- **Config**
  - Settings changes reach visitors within about 5 minutes (browser cache).
  - If the config request is blocked (some ad blockers) or our server is down, the widget shows with the visitor's
    last known settings or our defaults, also on a domain that isn't registered.
