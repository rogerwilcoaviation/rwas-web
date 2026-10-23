# Papa-Alpha language options — 2026-10-23

## Scope

Optional, user-selected Portuguese (Brazil) and neutral international Spanish pilot pages for Papa-Alpha. English remains the default. There are no geolocation or browser-language redirects.

Translated pilot routes:

- `/pt-br/`, `/pt-br/papa-alpha`, `/pt-br/contato`
- `/es/`, `/es/papa-alpha`, `/es/contacto`

This does **not** translate the full catalog or checkout. Product, SKU, applicability, availability, and exact USD price remain sourced from the live English catalog. Both translated contact pages hand off to the existing secure inquiry form; no new submission backend was created.

## English impact

English body content, catalog, cart, checkout, products, prices, blog, and homepage modules are unchanged. The intentional English changes are limited to:

1. the visible EN / PT-BR / ES control;
2. optional, dismissible browser-language suggestions that never auto-redirect;
3. reciprocal canonical/hreflang metadata on the English home, Papa-Alpha, and contact pages;
4. sitemap entries for the six translated pilot URLs.

An explicit selector choice is saved in local storage for future suggestions. Direct translated URLs remain visitable without first using the selector.

## Changed source

- `app/es/layout.tsx`
- `app/es/page.tsx`
- `app/es/papa-alpha/page.tsx`
- `app/es/contacto/page.tsx`
- `app/pt-br/pt-br.css`
- `app/pt-br/{page,papa-alpha/page,contato/page}.tsx`
- `app/{page,contact/page,services/papa-alpha-tools/page,sitemap}.tsx`
- `components/shared/LanguageExperience.tsx`
- `components/shared/PortugueseDocumentLanguage.tsx`

The pre-existing PT-BR pilot implementation and SEO metadata helper are included in the branch history.

## Verification

Passed locally on the rebased branch:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (1,920 static pages; all EN/PT-BR/ES pilot routes emitted)
- `npm run test:intake` (16/16)
- `node scripts/seo-technical-test.mjs` (37 checks)
- `node scripts/cart-private-runtime-test.mjs` (16 scenarios)
- `node scripts/cart-native-refresh-test.mjs`
- `node scripts/papa-alpha-variant-selection-test.mjs` (14/14 URL cases)
- Local HTTP checks: home, contact, cart-adjacent English routes, all six translated routes returned 200
- Hydrated DOM checks: correct `html lang`, canonical, reciprocal EN/PT-BR/ES/x-default alternates, selector links, and no meta refresh on all route families
- Contact handoff check: Spanish contact points to `/contact?reason=papa-alpha&source=es-contact` and the existing service email
- Desktop (1440 px) and mobile-responsive (500 px) screenshots inspected; selectors remain visible and localized pages do not clip or overlap

The first standalone TypeScript run exposed stale shared dependencies after upstream advanced. The worktree dependency symlink was replaced by an isolated clean `npm ci`; TypeScript and the production build then passed.

## Screenshots

Fourteen reviewed PNGs are under `screenshots/`: desktop and mobile captures for English, Portuguese, and Spanish home/Papa-Alpha pages, plus Spanish contact.

## Deployment

Deployed to production from commit `8bca0fc1e54569f553c00f2d796aaea9937c6832` by GitHub Actions run [698](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/39988550509). The deploy job, Cloudflare Pages production publish, and read-only production smoke all completed successfully. Live verification returned HTTP 200 for English home/Papa-Alpha/contact/cart and all six translated routes; Spanish and Portuguese Papa-Alpha content was present. No DNS, Cloudflare project configuration, scheduler, price, product, checkout, or discount setting was changed.
