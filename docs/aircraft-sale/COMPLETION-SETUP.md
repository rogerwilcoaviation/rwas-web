# Exact remaining seller setup

John has confirmed there is no Auth0 account. `admin@rwas.team` is the selected staff reviewer. These are proposed settings; no identity credentials, reviewer grants or production changes below have been applied. The exact target/access/effect approval packet is [STAGING-APPROVALS.md](STAGING-APPROVALS.md). Keep Cloudflare hosting and the existing mail service. Warranty remains draft-only.

## Owner's first action

Open the official [Auth0 signup](https://auth0.com/signup) and establish an RWAS-owned account/tenant. This administration account manages customer authentication; it is different from a seller account. Complete ownership/verification in the provider's UI. Do not send passwords, keys, tokens or verification codes in chat.

Create an application named `RWAS Seller Staging`, type **Single Page Application**, using Universal Login, Authorization Code + PKCE and RS256. An example tenant domain is `YOUR-TENANT.us.auth0.com`; this is not an existing RWAS tenant. Record the actual **Domain**, **Client ID**, tenant name and enabled connection names. These identifiers are public and can be shared; a client secret is not needed by this browser flow. [Official application settings](https://auth0.com/docs/get-started/applications/application-settings).

| Staging application setting     | Exact value                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| Allowed Callback URLs           | `https://repair-aircraft-seller-workf.rwas-web.pages.dev/aircraft-for-sale` |
| Allowed Logout URLs             | `https://repair-aircraft-seller-workf.rwas-web.pages.dev/aircraft-for-sale` |
| Allowed Web Origins             | `https://repair-aircraft-seller-workf.rwas-web.pages.dev`                   |
| Allowed Origins (CORS), if used | `https://repair-aircraft-seller-workf.rwas-web.pages.dev`                   |

Use exact URLs without wildcards or hash-preview URLs. Production needs separately reviewed application/environment settings with the production origin. Keep the working staging email-code login available.

## Proposed identity settings requiring specific setup authorization

For dedicated Worker `rwas-seller-staging-20261001`, change **only**:

- `AUTH_ISSUER`: exact HTTPS tenant issuer root with trailing slash.
- `AUTH_CLIENT_ID`: public staging SPA Client ID.
- `AUTH_REDIRECT_URI`: exact staging callback above, already configured.
- `AUTH_CONNECTIONS`: actual enabled database/Google/Apple connection names mapped to `password`, `google`, `apple`.
- `AUTH_EVENT_SECRET`: at least 32 characters, entered privately in this Worker's secret store and the matching Auth0 sender. Use an owner-controlled secret manager/dashboard; never Git, chat, browser code or shell arguments/logs.

No new provider administrative token or expanded Cloudflare grant is requested. Setup needs the tenant and specific authorization for these precise changes. Preserve existing Pages intake, sender and secret bindings.

Enable the database connection for this app with signup, email verification and hosted password recovery. Configure RWAS-owned [Google OAuth credentials](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google) and [Apple registration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/) and signing key in their dashboards. Google/Apple use the Auth0 tenant's `/login/callback`, rather than the RWAS callback above. Verify Apple private relay delivery. Missing membership/registration cannot be replaced by simulated consent or an unapproved purchase.

### Prepared password-reset Action

Candidate: [post-change-password.cjs](../../workers/aircraft-sale/auth0/post-change-password.cjs). Create under **Actions > Library**, trigger **Post Change Password**, using a supported Node 22 runtime (confirm availability in the owned tenant). Add settings through the Action's secret UI:

| Action setting            | Staging value                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `RWAS_AUTH0_TENANT`       | Actual tenant name matching `event.tenant.id`                                           |
| `RWAS_SECURITY_EVENT_URL` | `https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/events` |
| `AUTH_EVENT_SECRET`       | Same private value as the dedicated Worker                                              |

Save/test in the provider editor, then install/bind to **Post Change Password** only after setup authorization. [Official Action lifecycle](https://auth0.com/docs/customize/actions/write-your-first-action).

The sender uses documented `user_id`/`last_password_reset`, derives a stable retry ID from tenant/subject/actual event time, allows only the exact staging/production security endpoints, forbids redirect following, and makes at most three requests with three-second timeouts. It preserves reset time; missing/stale timestamps require reconciliation. [Auth0's trigger is asynchronous/nonblocking](https://auth0.com/docs/customize/actions/explore-triggers/post-change-password): failure does **not** undo the password change. This Action is not a durable queue and does not deliver account-block events. The separate [native block-event receiver](AUTH0-BLOCK-EVENTS.md) is implemented and tested locally; its dedicated Worker code update, stream setup and actual delivery remain gated. Verify monitoring and missed/late-event reconciliation before release. See [MANAGED-LOGIN.md](MANAGED-LOGIN.md) and [ROLLOUT.md](ROLLOUT.md).

## Proposed staff review access

Existing staff UI: `https://repair-aircraft-seller-workf.rwas-web.pages.dev/seller-review`. Scope: inspect listings/private media and approve/reject an exact pending revision. Proposed allowlisted identity: **only `admin@rwas.team`**, one-hour session through an approved Access identity provider. This is a grant proposal, not evidence that access exists. No security-recovery/operator or permanent-delete permission is included.

Target only the exact staging alias and these paths under one verified review audience:

| Target                                     | Purpose                                   |
| ------------------------------------------ | ----------------------------------------- |
| `/seller-review` and descendants           | Staff page                                |
| `/api/aircraft-sale/admin` and descendants | Review queue, decisions and private media |

Set Worker `ACCESS_TEAM_DOMAIN` to the approved team's `TEAM.cloudflareaccess.com`, `ACCESS_AUD` to the application's actual audience, and `REVIEWER_EMAILS=admin@rwas.team`. Verify signed issuer/audience/expiry/email through the existing adapter. A Wrangler deployment credential is not reviewer authentication.

[Pages' Access switch](https://developers.cloudflare.com/pages/configuration/preview-deployments/#customize-preview-deployments-access) initially protects **all project previews**. Do not enable it as implicit approval of this narrower proposal. Cloudflare documents [editing the managed hostname](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) and [path scoping](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/). Confirm the owned account supports this exact alias/path application before applying; otherwise return the specific alternative for review. Leave seller login, `/auth/events`, intake and production outside this staff policy.

Acceptance needs an actual authorized `admin@rwas.team` browser session. Unattended machine review is a separate principal/grant with a trusted `ADMIN_AUTH` adapter; the email allowlist is not a machine-token adapter. No machine principal/grant has been created. Consent/MFA/ownership cannot be inferred from deployment access.

## Smallest legitimate legacy-data action

Using the existing authorized owner process, verify counts of legacy seller profiles, all listing states (including private drafts/trash), and every storage object, with resource/version identity and snapshot boundary. Do **not** retry or reroute the denied source/version read.

- Verified complete empty inventory: record it and use a clean cutover; no data export/import needed.
- Any real records/objects: provide a consistent private export, independent ownership mapping and complete file manifest/bytes/checksums through the approved workspace. Then implement real decoder/import adapters; current migration adapters are synthetic only.

Empty public browse does not prove private drafts, owners or files are absent. The [offline inventory preflight](INVENTORY-PREFLIGHT.md) checks owner-supplied normalized evidence, including all four namespaces, pagination, hashes and ownership; it cannot establish actual source completeness or perform an import. Evidence requirements: [OWNER-HANDOFF.md](OWNER-HANDOFF.md).

## Completion sequence and present evidence

Independent source work: bounded Action sender plus seven tests; native block receiver plus seven tests; offline inventory preflight plus five tests; per-listing/per-revision notes; staff login/outage errors; expired-access clearing; stale-review refresh; review-page noindex metadata. `npm run test:seller` includes 119 tests. `npm run test:seller:review-browser` uses the actual export and disposable backend, blocks external traffic and verifies the review changes. Fixtures do not establish real provider/reviewer acceptance; the current validated commit/check results are in the draft PR.

Next: specifically authorized identity/reviewer setup → actual dedicated provider/review/media tests → verified empty inventory or real migration → separately authorized production backend/binding/frontend cutover → production smoke and agreed dedicated acceptance. The draft PR remains unmerged until release prerequisites pass.
