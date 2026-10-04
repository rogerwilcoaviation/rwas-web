# Dedicated seller staging acceptance

The user approved isolated setup, push/deploy and unattended creation/testing of a dedicated noncustomer account. Production and customer records remain outside this staging run. Warranty stays draft-only.

## Configured resources

- Exact seller origin: `https://repair-aircraft-seller-workf.rwas-web.pages.dev`.
- New service-only Worker: `rwas-seller-staging-20261001`, entry `workers/aircraft-sale/entry.mjs`; no public routes, workers.dev or preview URLs.
- SQLite Durable Object: `SELLER_STORE`, class `SellerStore`, first migration `seller-staging-20261001-first`.
- New private R2: `rwas-seller-staging-20261001`; managed public access disabled, no custom domains.
- Pages preview-only `SELLER_API` points to this Worker. New public flags are `SELLER_STAGING_ORIGIN` and `SELLER_MAIL_VIA_PAGES=true`; backend uses `MAIL_VIA_PAGES=true`.
- Existing Pages mail secret/sender are reused at runtime, never copied or exposed. Production configuration and all pre-existing preview variables/bindings were compared before/after and preserved.
- Two dedicated Resend inboxes receive directly at their generated addresses, without production MX/forwarding changes. App-delivered mail was read automatically, and dedicated sellers were created through the real hosted authentication flow. The temporary secondary profile was deleted after ownership tests. The retained primary profile now uses the second inbox after a verified email change; it is signed out with no listings or saved draft.

Current staging backend version: `c24c70c2-3afc-4404-9e1c-b051e3465fca`. The first nine checkpoints used frontend `7c8a7115c3129915a194bfb731bfaa432dbd853a`; corrected logout was retested on this backend. Published application head `75a560496cd52b1152a946902527da6b5b5d2333` deployed at `https://5daa6be2.rwas-web.pages.dev` and the exact seller alias, passed read-only smoke and the additional account/security acceptance below. Seller health returns200; hash preview remains fenced. This documentation follow-up changes no application code or backend version. No production merge/deployment occurred.

## Verified locally

The private mail broker stores hashes and delivery tickets; browser HTTP responses never include a code/ticket. Preparation does not activate a code. Provider failure preserves the prior active code; completed/cancelled receipts and durable sequence checks prevent out-of-order overwrite or resurrection. Email-change preparation and acknowledgement require recent authenticated ownership. Storage failure prevents activation, and durable throttling precedes delivery.

Tests cover actual workerd service-binding RPC, SQLite, exact staging routing, public route attacks, failure/retry, expiry, recent ownership, restart, confirmation response loss, storage outage and concurrent delivery. All prior seller/intake and renderer regressions remain required. The full Cloudflare build and lint/type checks pass. An independent reviewer found no blocking broker/routing flaw and independently passed the initial nine mail/routing checks.

## Hosted acceptance results

Nine checkpoints passed on the exact seller alias, with real Cloudflare SQLite/R2 and real app mail delivery:

| Check                                   | Hosted result                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Seller health and noindex               | Pass: health200, schema2                                                                                                                 |
| Next home navigation and signup request | Pass: actual hydrated UI, accepted mail request200                                                                                       |
| Signup and repeated email-code login    | Pass: real inbox receipt, incorrect-code feedback, one-use code, established account reused                                              |
| Jerry intake and clean chat markup      | Pass: eight hosted intake requests transfer a private draft without creating/publishing a listing                                        |
| Photo/video/private PDF storage         | Pass: real photo rendering and video metadata/playback readiness, reorder, exact PDF bytes and video byte range; anonymous access denied |
| Submit/review/publication guard         | Pass: pending state, no public inventory entry, seller publication attempt409, missing staff configuration503                            |
| Edit/archive/trash/restore/purge        | Pass: synthetic listing only; trashed files hidden, restored files readable, purged record/video URLs404                                 |
| Account profile maintenance             | Pass: actual UI persists the synthetic profile                                                                                           |
| Logout                                  | Pass after correction: bodyless POST200, signed-out UI, cleared session storage, old token 401                                            |

The initial live logout request failed400: forwarding represented a bodyless POST as an empty stream, which the old parser rejected. A regression test reproduced the failure before correction; only logout now permits empty JSON, and malformed nonempty bodies still fail. The staging backend was redeployed and the same logged-in browser retested successfully. One immediate retest during deployment propagation still saw the old400; the later hosted result is the verified correction.

Local final verification: 116/116 seller/intake checks, 39/39 renderer cases, lint and diff checks pass. All seller, intake, build/retail and native Cloudflare checks passed on application head `75a5604`; GitHub deployment steps were skipped. Browser results/screenshots remain local outside Git, with no codes, session tokens or secrets recorded. Tracking/analytics and external chat/commerce requests were blocked during browser acceptance. Valid synthetic photo/video fixtures were generated locally; no customer files or listings were used. Approved active/pause/sold transitions remain blocked hosted by missing staff configuration; local checks cover them.

### Additional hosted account/security acceptance, 2026-10-02

Seven supplemental checkpoints passed on application head `75a5604` and backend `c24c70c2`. The three real-mail authentication checkpoints establish the two distinct profiles and an additional primary session needed for these new tests; they are setup, not a repetition of the earlier media/lifecycle suite.

| Check                                                                     | Hosted result                                                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary and distinct secondary authentication; additional primary session | Pass: real app-delivered mail, distinct profile IDs, repeated primary login retains profile ID                                                                                           |
| Authenticated cross-owner access                                          | Pass: secondary own-list empty and saved draft null; private listing/file reads, edit, trash, purge, reorder, upload and file deletion all 404; owner data and exact file bytes preserved |
| Account deletion                                                          | Pass: wrong email confirmation 400; retained listing 409; temporary secondary profile deleted 200 and subsequent account/list access 401                                                     |
| Verified email replacement                                                | Pass: actual account UI and real destination mail; invalid/reused codes 400; profile/listing/file ownership preserved; another previously valid primary session 401                        |
| Cleanup and logout                                                        | Pass: synthetic listing permanently purged, file 404, no listings or saved draft, signed-out UI and revoked current token 401; zero browser exceptions                                     |

The retained test profile was changed only between dedicated noncustomer receiving addresses. No password/provider credential was created. A nonsecret machine-readable summary is [hosted-account-security.json](hosted-account-security.json); the isolated executable harness and detailed request evidence remain in the local `seller-live-stage` directory. Account deletion removes the RWAS profile/session/link data after owned listings are purged; it does not delete an external identity-provider account. Private R2 cleanup is verified through denied file URLs, not an independent bucket object census.

### Production distinction

Read-only production checks at 2026-10-02T08:17Z returned marketplace 200, same-origin seller health 404 and authentication methods 404. At 08:18Z the production widget returned 200 but its SHA256 differed from the reviewed staging widget. The screenshot markup correction and new seller service are verified in staging; production delivery and vulnerability closure remain unproven until cutover. These checks did not call the denied legacy Worker source/version endpoint.

Only synthetic staging records were changed. The retained test account remains available, signed out, with no listings or saved draft. No persistent staff or operator grants were added.

Real email/password, Google and Apple remain unconfigured: no authorized identity-provider admin connection or owned social registration configuration has been supplied. `AUTH_CONNECTIONS={}` fails closed. No staff authentication grants were added; real review approval must stay unavailable until an existing authorized staging staff identity is configured. Source/data migration prerequisites still gate production cutover; no denied legacy Worker source/version read was retried.
