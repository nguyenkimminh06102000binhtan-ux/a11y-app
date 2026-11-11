# a11y-app

Accessibility widget + audit dashboard that pinpoints unfixed issues and shows exactly where to fix them.

## Structure
- `apps/dashboard` — Next.js customer dashboard (+ /admin)
- `apps/widget` — overlay widget (CDN bundle)        _(coming)_
- `apps/worker` — audit runner (Playwright + axe-core) _(coming)_
- `apps/shopify` — Shopify app + theme extension     _(coming)_
- `packages/*` — shared engine, types, db            _(coming)_

## Dev
pnpm install
pnpm dev