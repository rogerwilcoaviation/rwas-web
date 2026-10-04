# Staging seller account administration

Originally implemented in isolated branch `feature/staging-seller-account-admin` (`f4ec40f` on `e9d2dfb`), then applied cleanly as `64329a1` in `staging/seller-account-admin-integration-20261004` on verified rebased PR36 head `620e2ec`. The original commit remains preserved. This is a local staging deliverable. It has not been deployed, merged into PR36, or used to grant access. Existing checkouts and draft-only warranty restrictions remain intact.

## What is implemented

`/seller-accounts` is a noindex administrator dashboard. It provides bounded account search by name, email or ID; status filters and pagination; contact details; linked method names; session metadata; listing references and media counts; and the last 20 administrator operations. It supports preview/confirm of name, phone and location edits, suspension/reinstatement of seller sign-in, and revocation of all seller sessions.

Every API request under `/api/aircraft-sale/admin/accounts` requires independently verified account-administrator authority. Listing-reviewer, security-operator and seller sessions do not confer this role. Reads and writes require the configured exact site origin. Writes additionally require a matching Origin header and authentication within ten minutes. Missing configuration fails closed; missing or invalid verified login metadata permits authenticated reads only.

Writes bind the administrator, target, fixed reason code, canonical changes and current account state to a preview digest. Stale confirmation returns 409. Operation receipts persist atomically with the change and audit record in SQLite. Repeating the same confirmed operation returns its prior receipt rather than revoking sessions created afterward. Persistence failure rolls back the entire account operation.

Suspension, reinstatement and revocation invalidate sessions, pending linked identity transactions, verification codes, and pending email-delivery tickets, and fence older identity logins. A separate provider/legacy security hold survives reinstatement. Listings, listing states, media, saved drafts and ownership remain intact; suspension does not withdraw a published aircraft.

No administrator password, email-address override, role assignment, account deletion, provider security-hold override or listing approval control is exposed. Profile email changes retain the existing seller verification workflow. Passwords remain managed by the identity provider.

Audit evidence contains actor, target ID, operation ID, action, fixed reason code, changed field names, revocation counts and timestamps. It excludes contact before/after values, credentials, codes, session tokens and provider subjects. The API returns allowlisted account/session/audit projections with `Cache-Control: no-store`. The dashboard clears private state after access expiry or an authorization/service error and ignores responses that arrive after expiry.

## Exact proposed access scope — not applied

Proposed identity: **`admin@rwas.team`**, using an existing organization identity with MFA. Do not create a password, new identity, service token or permanent administrator credential as part of this proposal.

Proposed destination: **`https://repair-aircraft-seller-workf.rwas-web.pages.dev` only**, after coordinated PR36 integration and staging deployment. Use the isolated `rwas-seller-staging-20261001` Worker/SQLite/R2 bindings. No production host, legacy seller service, QMX, Sites host, or other Pages preview is included.

Protect both the dashboard route `/seller-accounts` (including its trailing-slash variant) and API prefix `/api/aircraft-sale/admin/accounts*` with a dedicated Cloudflare Access application/audience. Its audience must differ from the listing-reviewer and security-operator applications. The allowlist is exactly `admin@rwas.team`; deny other identities, bypass rules and service-token access. The proposed initial pilot is time-limited to one hour, with an Access session of at most one hour; writes still require verified authentication within ten minutes. Staging account visibility covers all sellers stored in the staging backend.

Required public Worker settings, to be filled from the actual authorized Access application:

| Setting                            | Required value                                            |
| ---------------------------------- | --------------------------------------------------------- |
| `ACCOUNT_ADMIN_SITE_ORIGIN`        | `https://repair-aircraft-seller-workf.rwas-web.pages.dev` |
| `ACCOUNT_ADMIN_ACCESS_TEAM_DOMAIN` | Actual owned `<team>.cloudflareaccess.com` domain         |
| `ACCOUNT_ADMIN_ACCESS_AUD`         | Actual distinct account-administration audience           |
| `ACCOUNT_ADMIN_EMAILS`             | `admin@rwas.team`                                         |

No guessed tenant/audience values or new secrets are provided. The Pages same-origin `SELLER_API` service binding remains isolated from production.

The native adapter verifies the signed Access application token and retrieves the authenticated identity from the same approved team's `/cdn-cgi/access/get-identity` endpoint, using the request token privately as its authorization cookie. It accepts the endpoint's documented user-login timestamp only when the returned email and user UUID match the signed claims and service-token authentication is explicitly false. The JWT's own `iat` (token issuance) and the server's current time never establish freshness. Missing/malformed metadata, identity mismatch, service tokens, future timestamps, or lookup failure leave management disabled. Before activation, verify the actual account identity response and that MFA and fresh reauthentication are enforced; explicit token expiry still bounds all access. See [Cloudflare application-token and identity documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/). A private `ACCOUNT_ADMIN_AUTH` service binding remains an alternative only after review of its real authentication/freshness/expiry verification. Synthetic bindings in tests are not deployment configuration.

Approval needed for activation is specifically: integrate/deploy this deliverable to the named staging destination and grant the above time-limited account-administration role to the named existing identity. This proposal does not authorize live account operations, production rollout, additional reviewer/operator privileges, or credentials.

## Separate hosted acceptance proposal — not performed

After staging activation, proposed mutation target is only the existing dedicated account **`7c2ccf8a@uazileihel.resend.app`** (previously verified as an empty synthetic account). Reverify its account ID and zero-listing baseline before any action. Stop if it contains real data or maps to another profile.

Proposed exact data/actions:

1. Seller sign-in using that account's existing approved method; no new identity, password entry or reset.
2. Create one draft with make `Synthetic`, model `Staging Acceptance — NOT FOR SALE`, year `2000`, asking price `1`, description `Synthetic acceptance fixture. Do not publish. No real aircraft or records.` No fabricated FAA tail number.
3. Upload only the committed fixtures as `RWAS-SYNTHETIC-TEST.png`, `RWAS-SYNTHETIC-TEST.mp4`, and `RWAS-SYNTHETIC-TEST.pdf` (airframe category). Verify authenticated previews/download and denial to anonymous/unrelated identities. Inspect only these objects.
4. Preview/confirm a temporary contact name change to `Synthetic Staging Acceptance`; restore the previous name. Revoke the test account's sessions, perform a fresh approved login, suspend sign-in, verify denial, then reinstate and verify a fresh approved login. Restore original contact values and active sign-in status, retaining privacy-safe receipts.
5. Edit only the synthetic draft; archive and restore it; move it to reversible trash for cleanup. Leave the account signed out. Preserve all previously existing records and media.

This requires separate approval for the exact hosted test data and account operations above. The account administrator has no publisher role. Submitting for review, publishing, permanent listing/media purge, deleting the test account, sending new unrelated email, or acting on any other seller is excluded. A provider block/reset/unblock acceptance test remains separate from an administrator sign-in suspension test.

## Local acceptance and remaining limits

| Check                                                                     | Local result                                        | Hosted result                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Directory/detail/contact editing                                          | PASS backend and real built dashboard               | Not deployed                                                          |
| Role/origin/freshness/expiry enforcement                                  | PASS signed JWT, service-boundary and browser tests | Access configuration unverified/ungranted                             |
| Suspend/reinstate/revoke + independent hold                               | PASS synthetic tests                                | No hosted account mutation performed                                  |
| Atomic persistence and receipt replay after restart                       | PASS real workerd SQLite                            | Not deployed                                                          |
| Seller listing lifecycle and private media                                | PASS actual built interface and disposable storage  | Dedicated hosted test account has no populated-listing acceptance yet |
| PNG decode, H.264 metadata/playback/seek/range, PDF download/parse/render | PASS real fixtures                                  | Hosted object acceptance not performed                                |
| Native email/password                                                     | Previously passed dedicated staging acceptance      | Google and Apple provider setup remains unverified/unavailable        |
| Provider reset hook transport receipt                                     | Behavioral revocation previously passed             | Direct Action/receiver receipt remains unverified                     |

Run `npm run test:seller`, `npm run test:intake`, `npm run build`, `npm run lint`, `npm run test:seller:accounts-browser`, and `npm run test:seller:media-browser`. Browser tests require the local Playwright module (or `PLAYWRIGHT_MODULE`) and block external traffic. Media acceptance additionally needs Python with locally installed PyMuPDF; select it with `PDF_VERIFY_PYTHON`. `TEST_ARTIFACT_DIR` controls additional screenshots/evidence.

The backend still validates upload type by byte signature and extension, rather than full server-side decoding or malware inspection. Browser tests now establish that the committed valid fixtures decode; they do not prove arbitrary uploads are safe or renderable. Account search currently scans the staging state in memory; an indexed directory is a scaling follow-up if the seller population grows.

Read-only probe on October 4, 2026 at approximately 2:50 p.m. New York time: the existing staging browser returned health 200 and unauthenticated account-admin request 401 from the older deployed backend. It did not return account data. This is not activation proof for the new feature. Raw Python HTTP probes were rejected by Cloudflare with 403/1010 and are not evidence of an application failure.
