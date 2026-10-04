# Aircraft seller repair — review and rollout gates

## Baseline and scope

Repair branch is isolated from the existing checkout and based on upstream main `8f6316b5ebdac00c9eb91fa3624e5d14230475d6` (2026-09-30). The audited checkout was `2c0a3f7`; seller files were unchanged between those revisions. The separate `rwas-aircraft-sale/index.mjs` is unversioned and is **not assumed to be deployed source**. Existing Cloudflare credentials returned “No access to the specified resource” for Worker version metadata. No access grant was expanded, no cloud resources created, no production migration/deployment performed. Warranty work remains draft-only.

## Delivered implementation

- Versioned seller Worker with normalized SQLite Durable Object rows and atomic transaction commits; serialized requests prevent lost concurrent updates. There is no insecure legacy KV fallback in rollout configuration.
- Cryptographically random, hashed, single-use 15-minute codes; five failed attempts; durable email/IP/global-send limits; provider failures are visible. Separate hashed 24-hour session records; server logout/session revocation; profile maintenance; recent-auth verified email change; gated account deletion.
- Draft → pending review → approved revision/active. Details and media changes invalidate publication; pause/resume cannot bypass review. Sold, archive, trash, restore-to-draft and confirmed permanent deletion have explicit guards. Idempotent create/retry; owned file membership; cleanup errors retain records for retry; all R2 pages purged.
- Private owner-bound intake/drafts and documents. Public photos/video only for active/sold listings. No-store file responses and live public detail routing prevent stale archived/deleted pages. Staff-only media review uses verified reviewer identity. Public data omits owner identifiers and document keys.
- Photos and bounded reorder; PDF records; MP4/WebM video and public byte-range support. Signature/type, size, category and field checks. Authenticated previews/downloads use blob URLs and revoke them.
- Actual Jerry widget uses authenticated deterministic intake on the seller page, with private durable progress, required-field validation and structured draft transfer. Chat never creates/publishes automatically, and makes no promised email/relay notification. The durable pending-review inbox is the review notification contract; no Jerry relay communications are introduced.
- Responsive, keyboard-accessible native dialog, draft-first media workflow, status/actions/errors, account/session controls; staff review queue with revision fencing. General Jerry service chat retains its existing endpoint.

## Explicit acceptance boundaries

Passwordless email login is retained. Passwords/Google/Apple/SSO are **not added**: an approved identity-provider choice and configuration are required before implementing those optional methods. No custom password database or guessed OAuth grants were introduced.

Records remain private to owner and approved staff. Public purchasers request records through contact; this change does not create a buyer-record-sharing authorization feature. File signatures check type; this is not a malware scanner or a complete media decoder. Video limit is 50 MB/file, 40 files/category. No warranty, airworthiness or manufacturer promises generated.

The Durable Object serializes the small shop marketplace and reads records into memory for routing. It is not a high-volume sharded marketplace design. SQLite rows remove the old shared-KV lost-update problem; response schemas/media do not expose other profiles.

## Tests

Run `npm run test:seller`: API, adapters, offline migration, actual local workerd SQLite/R2, advanced Pages routing. Tests use fake mail and reviewer service bindings, reserved `.test` identities, transient tokens and disposable storage. Global outbound fetch in security tests is prohibited or explicitly intercepted.

Run `node tests/aircraft-sale/browser.mjs` with installed Playwright; set `PLAYWRIGHT_MODULE` to its module path when it is not a project dependency. Browser allowlist permits only loopback. The actual seller React component and Jerry widget are tested with real local deterministic intake and memory-only actual Worker. `browser-results.json` contains request method/path/status evidence; `mobile.png` shows the 390px view. Full Next application shell, real email/Access/Cloudflare rollout and real data are not tested by this browser harness.

Build the actual production export first with `node node_modules/next/dist/bin/next build`, then run `npm run test:seller:shell` (same Playwright module override). This serves unmodified `out` HTML, RSC payloads, CSS/fonts/assets and production Next bundles on loopback port 18763. It exercises real home-to-marketplace navigation, dynamic seller hydration, deferred Jerry, staff queue, public card/detail navigation, profile, lifecycle and media on desktop/mobile, plus failed-mail retry, private-record denial, failed inventory/refresh recovery and invalid PDF/retry. API/mail/storage remain disposable; a local fake edge identity cookie enables staff PDF downloads. Exact downloaded PDF bytes are asserted. Cloudflare identity configuration itself is not simulated as proven production acceptance. Dynamic detail forwarding matches the Worker route; the exact advanced Pages wrapper is covered separately in Miniflare routing tests. `full-shell-results.json` and `full-shell-mobile.png` retain evidence. No external browser request is permitted.

Original defect reproductions are retained in the parent task directory, while these regressions assert corrected behavior. Tests include code replay/expiry, owner B attacks, pending→paused bypass attempts, arbitrary media references, duplicate/concurrent create, revision fences, archive/trash restores, cleanup interruption, PDF/video validation, private file access, staff JWT signature/audience/issuer/expiry/allowlist, and dynamic routing. All real customer state and credentials are excluded.

## Verification result and acceptance matrix

Final verification on Node 22.22.0: **42/42 automated checks passed** (26 seller/API/adapters/migration/routing/runtime checks and 16 existing intake checks). The runtime fixture uses actual workerd SQLite Durable Objects and R2, including stored owner-only PDF retrieval. Component browser: **10/10 checkpoints**, 89 loopback requests. Full production Next-shell browser: **16/16 checkpoints**, 143 loopback requests. Both report zero external requests and browser errors; PDF assertions verify bytes, not only filenames. Full `next build` passed (1,916 generated pages), including lint/type checks; standalone repository lint and Worker/test lint passed. Required fonts were fetched read-only. No deployment commands were run.

| Workflow                                  | Audited legacy source                                                           | Repair / local result                                           | Live acceptance                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Email code signup/login/logout            | FAIL: reusable codes, weak randomness, no revocation                            | PASS: single-use, limited, hashed sessions and revocation       | BLOCKED: deployed source/provider staging         |
| Password/Google/Apple login               | NOT IMPLEMENTED                                                                 | NOT IMPLEMENTED: provider decision required                     | BLOCKED: approved provider/configuration          |
| Account/profile/email/session maintenance | NOT IMPLEMENTED                                                                 | PASS: profile, verified email, revocation, guarded deletion     | BLOCKED: staging/provider smoke                   |
| Established-account Jerry intake          | FAIL: email-scoped unauthenticated draft and brittle transfer                   | PASS: owner-bound resumable intake and reviewed draft transfer  | BLOCKED: staging                                  |
| Create/edit/review/pause/sold             | FAIL: authorization and moderation bypass, lost writes                          | PASS: serialized durable storage, idempotency, revision fencing | BLOCKED: source parity/migration                  |
| Archive/trash/restore/permanent delete    | Partial unsafe hard delete                                                      | PASS: guarded transitions and retryable complete cleanup        | BLOCKED: approved real-data lifecycle/migration   |
| Photos/reorder/PDF/video                  | FAIL: reorder route shadowed, cross-owner deletion/public records; video absent | PASS: association checks, private records, typed media/ranges   | BLOCKED: private bucket/old URL retirement        |
| Fresh public inventory/detail             | FAIL: private states/files and cached build details                             | PASS: live public-state filtering and dynamic Pages detail      | BLOCKED: Pages binding/cutover/cache verification |
| Staff listing review                      | FAIL: publication could bypass review                                           | PASS: approved identity and exact-revision queue/media review   | BLOCKED: approved reviewer identity settings      |

Priority for release: (P0) verify deployed source, disable/retire legacy insecure routes and cached record URLs through approved cutover; (P0) configure approved private storage/identity bindings and reconcile migration/backups; (P1) staging provider-backed acceptance and rollback rehearsal; (P2) optional additional login-provider choice. Local corrections do not prove deployed vulnerabilities are closed.

## Independent local review follow-up

A separate reviewer inspected commit `efef771` against the audit, reproduced defects with disposable fixtures, then reviewed the follow-up corrections. Fixed: metadata-first durable file/purge deletion intents with hidden retryable recovery; streaming JSON byte cap/cancellation; failed-provider throttling and prior-code preservation; durable counters before mail delivery; archive/trash reorder guards; clearing optional edit fields; staff private PDF links; seller staging-origin/noindex fences. Focused tests include persistence failure before any R2 deletion, final persistence failure after deletion, restart and retry, paginated purge, unavailable storage producing zero mail, and staging wrong-origin rejection. Browser checks cover actual staff PDF download/approval and clearing the previous description.

The reviewer reports **no remaining blocking code defect identified in the reviewed local paths** and independently passed 21/21 focused API tests. This is scoped local implementation acceptance, not a claim of exhaustive defect absence, deployed vulnerability closure, or release approval. Full Next-shell browser integration is now tested locally; real provider/configuration acceptance remains untested. Password, password recovery and Google/Apple remain unresolved pending the user's preference, and no provider has been provisioned. Publication approval remains pending after automatic approval review rejected the push; no PR exists.

## Full-shell findings corrected

The full production export exposed two stale-inventory paths outside the seller component: homepage aircraft cards/photos were frozen from the legacy API, and the static sitemap fetched legacy aircraft IDs. The homepage now fetches current active/sold listings from the same-origin service, fails closed on unavailable inventory and uses current private-gated media URLs. Dynamic aircraft IDs are excluded from the static sitemap; the marketplace index remains present for discovery. Archive is verified to remove homepage cards and deny old public detail. Page instructions now describe guided authenticated intake and on-page draft uploads, removing the unimplemented upload-email promise.

The earlier staff download checkpoint checked filename only and could pass an error response; both browser harnesses now model a disposable edge identity and require exact PDF bytes. The final passing evidence supersedes that weaker assertion. Browser fixtures remain independent of real accounts, provider grants and production data.

## Rollout sequence — requires explicit owner approval

1. Obtain authorized read-only export/source/version metadata of the deployed sale Worker and confirm account/resource identity; compare against this versioned replacement. Do not deploy over an unverified source.
2. Review mail sender and use of existing Resend secret. Configure `RESEND_API_KEY` and `FROM_EMAIL`, or bind the approved `MAILER`. This artifact does not copy/create secrets or send real messages.
3. Approve staff identity choice: bind existing `ADMIN_AUTH`, or approved Cloudflare Access `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `REVIEWER_EMAILS`. Setting policies, applications, grants or reviewer memberships is separately gated. No legacy admin token/password is imported or automatically trusted.
4. Approve/provision isolated staging `SELLER_STORE` SQLite class, **private** `MEDIA` R2 bucket, and Pages `SELLER_API` service binding. Local-only example is `workers/aircraft-sale/wrangler.local.toml`; there is deliberately no ready-to-run production config.
5. Run the full workflow in approved staging with fake mail first, then a separately approved dedicated mailbox and real provider smoke. Confirm staff media/revision review, public stale-state removal, account change/revocation and failure recovery.
6. Operator-authorized current legacy export → `node scripts/seller-legacy-plan.mjs INPUT.json OUTPUT.json`. This is an **offline plan only**, not an importer. Missing/ambiguous owners or file associations stop planning; sessions/OTPs/admin credentials/unowned drafts are excluded. All legacy aircraft become drafts until reviewed. Approve mapping and transfer implementation against the verified deployed schema, backups and reconciliation counts before any real writes.
7. Approve retirement of old write routes, legacy session invalidation, migration/copy, public old file URL retirement and CDN cache purge. Existing downloaded/cached records cannot be made private merely by changing new code. These are material real-data/security operations, not covered by local repair testing.
8. Review exact Worker/Pages configuration, staged data, rollback plan and artifacts, then explicitly authorize production rollout. Do not merge this PR first: main workflow deploys automatically. The repair branch suppresses automatic PR preview deployment, while retaining validation. Remove that temporary branch fence only after approved preview/cutover arrangements.

No production rollout is ready until those gates are fulfilled. The local repair is reviewable; deployed vulnerability closure cannot be claimed yet.

Design references: [Cloudflare SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) and [Pages routing](https://developers.cloudflare.com/pages/functions/routing/).
