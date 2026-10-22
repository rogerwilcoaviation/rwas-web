# Existing Auth0 owner proof for Clerk linking

This local candidate adds a purpose-limited reauthentication path for an
established Auth0 password identity that is already mapped to a seller profile
in the same RWAS Durable Object. It does not change the original completion
checkout, production configuration, customer records, provider setup or listing
ownership. Ordinary Auth0 login and email-code routes remain disabled in Clerk
mode. No account or inventory migration is performed.

## Why the mapping can be used

The current and rollback Worker `/auth/finish` paths verify the provider's signed
issuer and subject, resolve `identities[SHA256(issuer + '|' + subject)].userId`,
and issue an RWAS bearer for that exact profile. Identity rows retain the issuer,
subject, method and owner ID. Historical `method: "identity"` session rows retain
only a user ID and local timestamps; they do not retain signed authentication
time or identify the authenticating subject. The new path therefore proves that
subject again and never upgrades a historical bearer from its age alone.

The existing OAuth adapter sends `prompt=login` and validates token issue time.
That is insufficient to prove a fresh authentication. The owner-only request
adds `max_age=0`, and the backend requires a signed integer `auth_time` at or after
the owner transaction's creation second, no later than the current second, and
less than ten minutes old. Missing/stale/future authentication time fails closed.
Normal provider login behavior outside this owner purpose is unchanged. See
[Auth0's reauthentication documentation](https://auth0.com/docs/authenticate/login/max-age-reauthentication).

## Protocol

The browser first signs in with Clerk and explicitly chooses to connect an
existing seller account. It sends
`POST /api/aircraft-sale/auth/clerk-production/owner/start` with
`{ "proof": "<fresh random browser proof>", "confirm": true }`, the same proof
in `X-RWAS-Link-Proof`, and its current `X-Clerk-Session-Token`. The exact canonical
Origin is required. Start verifies Clerk, records its issuer/subject/session,
creation and password generation, and creates a five-minute PKCE/nonce
transaction. It returns `{ state, csrf, authorizationUrl }` using only the
configured password connection and canonical callback.

After Auth0 returns ordinary `state` and `code` query parameters to
`/aircraft-for-sale`, the browser sends them to the dedicated
`POST /api/aircraft-sale/auth/clerk-production/owner/finish` with the persisted
browser proof, `confirm:true`, `X-RWAS-Link-Proof`, `X-RWAS-CSRF` from start, and a
fresh current Clerk token. Recognized owner transactions are durably consumed
before validating credentials or proof. They cannot substitute for ordinary
login or link transactions. Clerk identity changes, cancellation, CSRF/origin
failure and provider errors leave ownership unchanged.

Ordinary `/auth/finish` also consumes and rejects a purpose-tagged transaction
before contacting Auth0, including after Clerk mode is turned off. Removing or
changing the configured owner provider between start and finish consumes the
recognized owner transaction and cannot silently select another issuer or
client.

The backend validates the Auth0 authorization-code exchange, signature, nonce,
audience, issuer and signed authentication time. It then accepts only an exact
existing password-identity row and active profile, checks all linked security
and revocation fences, and rejects missing or mismatched mappings. The verified
provider email is never used to select or create a profile.

Finish returns `{ ok:true, ownerProof, ownerCsrf, expiresAt, email, name }`.
The bearer is stored as `method: "clerk-owner-proof"`, `scope: "clerk-link-only"`,
with its verified source identity, authentication time and initiating Clerk
binding. Its expiry is the earliest of five minutes after issuance, ten minutes
after Auth0 authentication, and the initiating Clerk session's expiry.
The browser stores it only in its dedicated connection flow; it never installs
it as the active seller session or shared seller envelope.

The seller confirms the existing account and completes the established
[explicit link protocol](CLERK-EXISTING-ACCOUNT-LINKING.md), including
`X-RWAS-Owner-CSRF` on link start and finish. Both calls repeat source mapping,
held-account, revocation, identity-collision and Clerk-binding checks. Success
preserves the profile, listing ownership and existing source identity, retires
old bearer sessions and returns the normal Clerk seller envelope.

## Security callbacks and limits

Clerk mode admits only the existing authenticated `/auth/events` and
`/auth/auth0-events` POST security receivers from its alternate-login guard.
Their secret/source, event-time, replay and receipt checks remain in place.
They can revoke owner proofs and fence pending links after Auth0 password reset
or block. This source change does not prove that live event delivery is installed
or reliable; that remains provider-backed acceptance work. No Management API
credential is required or read by this implementation.

An owner proof is rejected by generic `user()` authorization before seller,
profile, mail or listing routes run. Reauthenticating an unknown Auth0 subject
does not authorize mapping creation, even with a matching verified email. The
original separate legacy backend, missing current-store mappings, disabled
owners and unresolved holds remain outside this path. Their independent
ownership evidence cannot be inferred from public inventory or credentials.

## Disposable verification

`tests/aircraft-sale/clerk-owner-reauth.test.mjs` uses ephemeral RSA signatures,
synthetic `.test` identities and intercepted Clerk/Auth0 HTTP. It exercises exact
mapping preservation, signed authentication freshness, purpose isolation,
Origin/CSRF/replay/provider binding, authenticated reset/block delivery and
revocation during a pending link. Additional endpoint cases cover mode and
configuration availability, explicit start consent, expiry/cancellation,
callback purpose mixing after a mode change, and collisions before proof
issuance. Root records guarded test execution and
review separately. No live identity, provider read, production data or deployment
is part of these fixtures.
