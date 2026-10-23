# Website typography

RWAS uses Source Serif 4 for editorial headings and section titles, and Arial
for body text, navigation, buttons, forms, and account and staff interfaces.
The shared policy lives in `public/site-typography.css`. The Next root layout
imports it, and standalone HTML pages link to the same public asset. Broadsheet
tokens and Tailwind display/serif aliases use Source Serif 4; body and UI aliases
use Arial. Existing sizes, weights, italics, and spacing are preserved.

The variable Roman and Italic WOFF2 files are self-hosted under
`public/fonts/source-serif-4`. That directory records the pinned upstream source
and SIL Open Font License. `font-display: swap` keeps text visible while the
font loads, and optical sizing adapts headings to their displayed sizes. No
external font-provider request or Google font preload is required.

Legacy inline families inherit the heading or interface family. Seller dialogs,
administration, review, account workspaces, and authentication forms retain Arial
throughout, including their headings. The legacy newspaper page no longer forces
all heading descendants back to Arial.

The Pages wrapper embeds the same stylesheet into seller-generated HTML. It
uses an inline style to respect the listing renderer's existing inline-only
style CSP. JSON responses, authorization, publication decisions, HTTP statuses,
and HEAD behavior retain their existing handling. The seller Worker does not
need a separate deployment for this presentation change.

Run `node tests/site-typography-browser.mjs` after a build. It checks stylesheet
coverage across exported HTML documents, visible heading and interface families, actual font loading, desktop and mobile
layouts, standalone pages, and print views. Next's empty error bootstraps and provider diagnostic pages are reported
separately; the actual 404 interface is checked in the browser.
Use `TEST_EXPORT_DIR=.vercel/output/static` to check the production artifact.
The deployment workflow runs this check before publishing.
