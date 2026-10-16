# Existing seller account linking: local candidate

This candidate links a verified Clerk subject to an existing RWAS seller only
after an explicit request proves both credentials. It does not activate Clerk,
alter production records, migrate accounts automatically, or select an owner by
matching email.

## Implemented boundary

The existing RWAS credential must either be an independent email-code session
less than ten minutes old, or the restricted owner proof issued by the dedicated
[Auth0 owner reauthentication flow](CLERK-AUTH0-OWNER-REAUTH.md). It must remain
live through finish.
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

For the dedicated Auth0 owner proof, both link requests additionally require
`X-RWAS-Owner-CSRF` from owner authentication. That proof is scoped to the exact
Clerk subject, session and password generation that initiated reauthentication.

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

## Existing Auth0 owners and the remaining ownership boundary

Clerk mode continues to disable `/send-code`, `/check-code` and the ordinary
provider `/auth/start` and `/auth/finish` routes. The email-code path therefore
requires an already fresh pre-cutover session. Established Auth0 password owners
with an exact persisted subject-to-profile mapping in the current seller store
can instead use the purpose-limited owner reauthentication flow. It never mints
general Auth0 seller access or creates an owner profile in Clerk mode.

The historical `method: "identity"` session has only an RWAS user ID and local
creation/expiry times. It does not retain the exact provider identity or an
independently revalidatable provider session. The general `user()` method checks
live provider proof only for `method: "clerk-production"`. Treating an otherwise
valid historical bearer as fresh provider-owner proof would therefore weaken
authentication, so this linking route rejects it.

A separate migration protocol must first establish the exact persisted legacy
identity-to-seller relationship when no current-store mapping exists. The new
Auth0 path refuses unknown subjects even when their verified email matches a
seller. The original separate legacy backend's ownership/schema is not proven
by this source, and no account or listing import is included. Such unmapped
accounts require separately verified ownership evidence; matching email or a
browser-supplied owner ID cannot supply it.

## Synthetic verification

The dedicated `tests/aircraft-sale/clerk-existing-account.test.mjs` exercises the
actual Worker routes with ephemeral signing keys, synthetic seller state and an
intercepted provider. It covers explicit linking and preservation, wrong/stale
owner credentials, origin/browser/CSRF proof, nonce replay and protocol mixing,
provider identity/session/password changes, identity collisions, held accounts,
revocation fences and provider failures. Root owns executing and recording these
checks; this document makes no provider-backed acceptance claim.
