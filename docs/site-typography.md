# Website typography

All RWAS website text uses `Arial, sans-serif`. The shared policy lives in
`public/site-typography.css`. The Next root layout imports this file, and each
standalone HTML page links to the same public asset, including the work-order
interface, printable brochure, and legacy previews. Broadsheet tokens and
Tailwind font aliases also resolve to Arial. Retired Google font imports and
preloads have been removed.

The font-family declaration is important so legacy inline styles and embedded
components follow the site policy. It changes only the family, preserving
existing sizes, weights, italics, spacing, and layout rules.

The Pages wrapper embeds the same stylesheet into seller-generated HTML. It
uses an inline style to respect the listing renderer's existing inline-only
style CSP. JSON responses, authorization, publication decisions, HTTP statuses,
and HEAD behavior retain their existing handling. The seller Worker does not
need a separate deployment for this presentation change.

Run `node tests/site-typography-browser.mjs` after a build. It checks stylesheet
coverage across exported HTML documents, visible text and controls on desktop
and mobile, standalone pages, and print views. Next's empty error bootstraps and provider diagnostic pages are reported
separately; the actual 404 interface is checked in the browser.
Use `TEST_EXPORT_DIR=.vercel/output/static` to check the production artifact.
The deployment workflow runs this check before publishing.
