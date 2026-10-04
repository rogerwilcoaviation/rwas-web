# Selected seller login methods and operator handoff

The user selected email/password, Google and Apple and approved release work. The reference adapter targets [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login) with [Authorization Code + PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce). Existing managed identity service/tenant details have not been supplied. If RWAS already uses another service, adapt and verify that provider before provisioning a duplicate. No subscription or developer membership purchase is made by this change.

## Exact Worker configuration

| Setting             | Required value                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ISSUER`       | HTTPS Auth0 issuer root with trailing slash, e.g. `https://TENANT.auth0.com/`; exact token issuer                                                             |
| `AUTH_CLIENT_ID`    | Public SPA application client ID; Authorization Code grant, PKCE, RS256; no client secret in browser                                                          |
| `AUTH_REDIRECT_URI` | Exact origin + `/aircraft-for-sale`; separate staging/production settings, HTTPS outside local tests                                                          |
| `AUTH_CONNECTIONS`  | JSON connection-name map, e.g. `{"password":"Username-Password-Authentication","google":"google-oauth2","apple":"apple"}`; verify actual enabled tenant names |
| `AUTH_EVENT_SECRET` | Owner-configured secret at least 32 characters, shared only with security-event sender; absent secret disables the password button                            |

Register exact callback and allowed logout URLs in the SPA app; do not allow arbitrary preview domains or wildcards. Enable database signup, email verification and hosted password recovery. Only verified email claims are accepted. Configure [Google](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google) with RWAS-owned OAuth credentials and [Apple](https://marketplace.auth0.com/integrations/apple-social-connection) with the owned Team/Service IDs and signing key. Provider secrets belong in the provider dashboard. Apple private relay delivery/domain configuration must be verified by the operator.

Existing email-code accounts keep their RWAS profile/listing ownership. A matching provider email cannot silently claim that account: sign in using the existing method, open Account, and explicitly Connect the new method with a recent session. Subject identity remains authoritative on later logins even after an email change. Account deletion removes RWAS profile/links after listing guards; it does not delete Google, Apple or the managed provider account. Provider logout revokes RWAS first; logging out of Google/Apple everywhere is not promised.

## Security event delivery contract

The [Auth0 Post Change Password trigger](https://auth0.com/docs/customize/actions/explore-triggers/post-change-password) can notify an external app to revoke its independent sessions. Configure and test an Action/owned delivery service that POSTs the following to the same environment's `/api/aircraft-sale/auth/events` with `Authorization: Bearer <AUTH_EVENT_SECRET>` over HTTPS:

```json
{
  "id": "unique-stable-event-id",
  "kind": "password-reset",
  "subject": "exact-provider-subject",
  "issuedAt": 1790856000000
}
```

`issuedAt` is the actual event time in Unix milliseconds (the number above is illustrative, not a runnable event). `id` is 1–128 alphanumeric/underscore/hyphen characters and must remain unchanged for retries. `subject` is the exact ID-token `sub` / Auth0 `event.user.user_id`. `account-blocked` uses the same contract through an owner-operated block integration. Events outside five minutes are rejected, so monitor and retry promptly; older failures require an operator reconciliation path before release. Password reset events revoke every RWAS session on the profile, including sessions linked to social providers; in-flight transactions started before the event cannot restore them. Unknown subjects retain reset/block tombstones. Blocks are sticky and currently require a separately reviewed operator unblock mechanism.

This endpoint uses a shared bearer secret and replay/time checks; it does not verify a payload signature. Merely setting the secret does not prove event delivery. Hook reliability, outage handling, administrative password changes, account blocking and notification failure must be tested in staging. A lost hook leaves existing app sessions until expiry, so monitored delivery/reconciliation is a release requirement. No provider administrative scope or Management API token is requested by the code.

## Synthetic evidence and staging acceptance

`npm run test:seller` includes 8 identity tests with ephemeral RSA keys, synthetic `.test` identities and intercepted provider HTTP. `node tests/aircraft-sale/identity-browser.mjs` runs actual built Next pages with synthetic hosted pages; every provider page is fulfilled locally, no real password is entered, and no external browser traffic is allowed. Its six checkpoints cover all methods, callback cleanup, account linking with preserved listing ownership, logout, hosted-help cancellation, event-driven revocation and lost-proof/replay failure. This verifies RWAS integration, not actual provider enrollment or recovery.

Before release the owner must operate the real provider screens with a dedicated noncustomer account in isolated staging. Test signup + verified email, correct/incorrect password, reset + old-password rejection, Google/Apple consent/cancel/relay, missing proof, explicit account linking, blocked account/email-code fallback, profile change, all-session revocation, listing lifecycle and private PDF/video review. Use a staff test identity with only staging review access. Never use customer accounts/listings or production records for destructive acceptance. Source parity, storage, backend binding and migration prerequisites remain in [REVIEW.md](REVIEW.md).
