# Dedicated seller staging acceptance

The user approved isolated setup, push/deploy and unattended creation/testing of a dedicated noncustomer account. Production and customer records remain outside this staging run. Warranty stays draft-only.

## Configured resources

- Exact seller origin: `https://repair-aircraft-seller-workf.rwas-web.pages.dev`.
- New service-only Worker: `rwas-seller-staging-20261001`, entry `workers/aircraft-sale/entry.mjs`; no public routes, workers.dev or preview URLs.
- SQLite Durable Object: `SELLER_STORE`, class `SellerStore`, first migration `seller-staging-20261001-first`.
- New private R2: `rwas-seller-staging-20261001`; managed public access disabled, no custom domains.
- Pages preview-only `SELLER_API` points to this Worker. New public flags are `SELLER_STAGING_ORIGIN` and `SELLER_MAIL_VIA_PAGES=true`; backend uses `MAIL_VIA_PAGES=true`.
- Existing Pages mail secret/sender are reused at runtime, never copied or exposed. Production configuration and all pre-existing preview variables/bindings were compared before/after and preserved.
- Dedicated Resend inbox exists. Its generated receiving address will be used directly, without production MX/forwarding changes. Receipt of an app-delivered code and creation of the test seller remain pending hosted acceptance.

The backend was deployed as version `e3b414e3-dbb3-4aae-a9c9-2cb93b881224`. The frontend update is awaiting branch publication. Do not interpret that backend deployment as successful signup or provider acceptance.

## Verified locally

The private mail broker stores hashes and delivery tickets; browser HTTP responses never include a code/ticket. Preparation does not activate a code. Provider failure preserves the prior active code; completed/cancelled receipts and durable sequence checks prevent out-of-order overwrite or resurrection. Email-change preparation and acknowledgement require recent authenticated ownership. Storage failure prevents activation, and durable throttling precedes delivery.

Tests cover actual workerd service-binding RPC, SQLite, exact staging routing, public route attacks, failure/retry, expiry, recent ownership, restart, confirmation response loss, storage outage and concurrent delivery. All prior seller/intake and renderer regressions remain required. The full Cloudflare build and lint/type checks pass. An independent reviewer found no blocking broker/routing flaw and independently passed the initial nine mail/routing checks.

## Hosted acceptance pending

Use the exact seller alias, not the hash preview. Verify health, provider delivery, signup, sessions/profile, Jerry draft, listing edits and state transitions, photos/private PDFs/video ranges, unauthorized access, review failure, trash/restore/purge and logout. Only synthetic records in this new store may be changed.

Real email/password, Google and Apple remain unconfigured: no authorized identity-provider admin connection or owned social registration configuration has been supplied. `AUTH_CONNECTIONS={}` fails closed. No staff authentication grants were added; real review approval must stay unavailable until an existing authorized staging staff identity is configured. Source/data migration prerequisites still gate production cutover; no denied legacy Worker source/version read was retried.
