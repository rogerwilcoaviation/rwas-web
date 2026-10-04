# Dedicated seller staging acceptance

The user approved isolated setup, push/deploy and unattended creation/testing of a dedicated noncustomer account. Production and customer records remain outside this staging run. Warranty stays draft-only.

## Configured resources

- Exact seller origin: `https://repair-aircraft-seller-workf.rwas-web.pages.dev`.
- New service-only Worker: `rwas-seller-staging-20261001`, entry `workers/aircraft-sale/entry.mjs`; no public routes, workers.dev or preview URLs.
- SQLite Durable Object: `SELLER_STORE`, class `SellerStore`, first migration `seller-staging-20261001-first`.
- New private R2: `rwas-seller-staging-20261001`; managed public access disabled, no custom domains.
- Pages preview-only `SELLER_API` points to this Worker. New public flags are `SELLER_STAGING_ORIGIN` and `SELLER_MAIL_VIA_PAGES=true`; backend uses `MAIL_VIA_PAGES=true`.
- Existing Pages mail secret/sender are reused at runtime, never copied or exposed. Production configuration and all pre-existing preview variables/bindings were compared before/after and preserved.
- Dedicated Resend inbox exists. Its generated receiving address will be used directly, without production MX/forwarding changes. App-delivered mail was received and read automatically, and a dedicated seller was created through the real signup UI. A second email-code login reused the established account; other sessions were revoked.

Current staging backend version: `c24c70c2-3afc-4404-9e1c-b051e3465fca`. Frontend commit `7c8a7115c3129915a194bfb731bfaa432dbd853a` deployed at `https://72bca858.rwas-web.pages.dev` and the exact seller alias. Seller health now returns200; hash preview remains fenced. The follow-up adds the hosted-discovered empty-stream logout fix and this acceptance record. No production merge/deployment occurred.

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
| Logout                                  | Pass after correction: bodyless POST200, signed-out UI, cleared session storage, old token401                                            |

The initial live logout request failed400: forwarding represented a bodyless POST as an empty stream, which the old parser rejected. A regression test reproduced the failure before correction; only logout now permits empty JSON, and malformed nonempty bodies still fail. The staging backend was redeployed and the same logged-in browser retested successfully. One immediate retest during deployment propagation still saw the old400; the later hosted result is the verified correction.

Local final verification: 116/116 seller/intake checks, 39/39 renderer cases, lint and diff checks pass. The preceding complete Cloudflare frontend build passed; CI reruns on the final follow-up. Browser results/screenshots remain local outside Git, with no codes, session tokens or secrets recorded. Tracking/analytics and external chat/commerce requests were blocked during browser acceptance. Valid synthetic photo/video fixtures were generated locally; no customer files or listings were used. Real email-change destination replacement, account deletion, cross-owner authenticated attacks and approved active/pause/sold transitions still need dedicated hosted acceptance; local checks cover them.

Only synthetic staging records were changed. The test account remains available, signed out, with no live listings. No persistent staff or operator grants were added.

Real email/password, Google and Apple remain unconfigured: no authorized identity-provider admin connection or owned social registration configuration has been supplied. `AUTH_CONNECTIONS={}` fails closed. No staff authentication grants were added; real review approval must stay unavailable until an existing authorized staging staff identity is configured. Source/data migration prerequisites still gate production cutover; no denied legacy Worker source/version read was retried.
