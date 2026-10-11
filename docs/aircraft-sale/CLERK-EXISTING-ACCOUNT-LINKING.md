# Existing seller account linking: local candidate

This candidate links a verified Clerk subject to an existing RWAS seller only
after an explicit request proves both credentials. It does not activate Clerk,
alter production records, migrate accounts automatically, or select an owner by
matching email.

## Implemented boundary

The existing RWAS session must have been issued by the independent email-code
login, must be less than ten minutes old, and must remain live through finish.
Both profile holds and security/revocation fences for every identity already
attached to that seller remain authoritative. The verified Clerk identity must
remain unchanged across the transaction and must not already belong to any RWAS
account. An account that already has a Clerk identity cannot attach a second
Clerk subject through this route.

`POST /api/aircraft-sale/auth/clerk-production/link/start` accepts
`{ "proof": "<fresh random browser proof>", "confirm": true }`, with the existing
RWAS `Authorization: Bearer ...`, `X-Clerk-Session-Token`, and
`X-RWAS-Link-Proof` containing the same browser proof. The canonical production
Origin is required. Start returns a nonce and a separate server-issued CSRF
proof. The transaction expires after five minutes.

`POST /api/aircraft-sale/auth/clerk-production/link/finish` adds that nonce to the
same body and adds `X-RWAS-CSRF` containing the start response's CSRF proof. The
transaction binds the existing owner session, browser proof, CSRF proof, origin,
Clerk issuer and subject, provider session and creation generation, and password
generation. A recognized link nonce is durably consumed before proof/provider
validation; failed requests cannot replay it. Login nonces cannot substitute for
link nonces.

Success preserves the existing profile, draft, listing ownership and other
identity mappings. It records `identity-link`, retires the seller's old local
bearer sessions and pending link transactions, and returns a normal verified
Clerk RWAS session and its CSRF proof. The browser must replace its owner envelope
only after explicit finish succeeds. A Clerk session listener must not initiate
linking automatically.

## Remaining established-account migration blocker

Clerk mode continues to disable `/send-code`, `/check-code` and the old provider
`/auth/start` and `/auth/finish` routes. Consequently, this flow can use only an
already fresh email-code owner session from before cutover. A signed-out seller,
an expired owner session, or an old provider session requires staff review.

The historical `method: "identity"` session has only an RWAS user ID and local
creation/expiry times. It does not retain the exact provider identity or an
independently revalidatable provider session. The general `user()` method checks
live provider proof only for `method: "clerk-production"`. Treating an otherwise
valid historical bearer as fresh provider-owner proof would therefore weaken
authentication, so this linking route rejects it.

A separate migration protocol must first establish the exact persisted legacy
identity-to-seller relationship and independently prove fresh authentication of
that legacy subject, with current provider block/reset/revocation checks. It must
then bind that owner proof to the verified Clerk subject using an origin-bound,
one-use transaction and repeat held-account/collision checks at durable commit.
The browser must never supply a trusted owner ID, and staff must never authorize
the association solely from matching email. A reviewed preview/apply receipt
would make any proposed staff-assisted mapping concrete and auditable before
activation. That protocol is not included in this candidate.

## Synthetic verification

The dedicated `tests/aircraft-sale/clerk-existing-account.test.mjs` exercises the
actual Worker routes with ephemeral signing keys, synthetic seller state and an
intercepted provider. It covers explicit linking and preservation, wrong/stale
owner credentials, origin/browser/CSRF proof, nonce replay and protocol mixing,
provider identity/session/password changes, identity collisions, held accounts,
revocation fences and provider failures. Root owns executing and recording these
checks; this document makes no provider-backed acceptance claim.
