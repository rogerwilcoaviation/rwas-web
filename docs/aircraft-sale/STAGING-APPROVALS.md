# Narrow staging setup approval packet

These are reviewable proposed changes, not grants already applied. John has already received the Auth0 owner signup handoff. After the owned dashboard is ready, verify actual identifiers privately before applying these items. Cloudflare hosting, working email-code login and warranty draft-only behavior remain in place.

## 1. Seller identity connection

**Target:** RWAS-owned Auth0 staging tenant/application `RWAS Seller Staging`, and dedicated Cloudflare Worker `rwas-seller-staging-20261001` in account `08c51088fd98ea9214af8a0ae226663c`.

**Access/effect:** enable hosted email/password signup, verified email and recovery plus Google and Apple for this staging SPA. Request only identity/verified-email claims (`openid profile email`), without Management API scopes, a machine administrative principal, new cloud permissions or a purchase. Existing RWAS accounts require explicit linking to preserve ownership safely. Google/Apple need actual owned registrations and provider acceptance.

**Exact site:** `https://repair-aircraft-seller-workf.rwas-web.pages.dev`. Callback and logout: that origin + `/aircraft-for-sale`; web/CORS origin: that exact origin, no wildcards. Configure only this Worker's `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_REDIRECT_URI` and `AUTH_CONNECTIONS`, using actual verified tenant/client/connection identifiers. The PKCE SPA needs no browser client secret. See [COMPLETION-SETUP.md](COMPLETION-SETUP.md) for dashboard settings.

## 2. Reset/block notifications and staging backend code

**Target:** that same dedicated Worker and the owned staging tenant only. Update the Worker to the reviewed source on this draft branch; preserve its existing service-only binding, SQLite namespace and private R2 bucket. This is a backend code deployment, separate from the automatic Pages frontend preview. No new resources, migration, public Worker route or production binding change is proposed.

**Access/effect:** install the candidate Post Change Password Action; enable one webhook stream named `RWAS staging account blocks`, subscribed only to `user.updated`. Reset/block events revoke every RWAS session on a linked profile; blocks also prevent email-code fallback. Provider unblock never clears a security hold automatically. The stream transmits tenant-wide user-update snapshots, so use a dedicated staging tenant and approve that scope; the receiver stores only minimal security facts/receipts, not raw snapshots.

**Exact destinations:**

- Reset Action: `https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/events`.
- Block stream: `https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/auth0-events`.

Use separate private proofs `AUTH_EVENT_SECRET` and `AUTH_STREAM_SECRET` (each at least 32 characters) in the matching Worker/provider secret stores. Also configure verified `AUTH_EVENT_TENANT`, `AUTH_EVENT_SOURCE` and `AUTH_EVENT_STREAM_ID`; the Action uses `RWAS_AUTH0_TENANT` and `RWAS_SECURITY_EVENT_URL`. Do not put values in Git/chat/logs. No M2M token/grant is needed by the receiver. Actual owned-dashboard delivery, failed-event monitoring and late-event reconciliation must pass before release. Details: [AUTH0-BLOCK-EVENTS.md](AUTH0-BLOCK-EVENTS.md).

## 3. Staff reviewer

**Target:** exact staging alias only: `/seller-review` and descendants, plus `/api/aircraft-sale/admin` and descendants, under one verified Cloudflare Access audience.

**Access/effect:** allow only **`admin@rwas.team`**, with a one-hour session through the owned team's approved identity provider. The reviewer can inspect all staging listings/private media and approve or reject an exact pending revision. This grants no security-operator recovery, permanent deletion or production access. An unattended machine reviewer would require a separately named principal and trusted adapter/grant; none is proposed or created here.

Configure only this Worker's `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `REVIEWER_EMAILS=admin@rwas.team` after verifying the application's actual audience/team domain. First verify that the owned Access account supports this exact Pages alias/path application. The built-in Pages Access switch initially protects all project previews; it does not match this proposal. If exact scope is unavailable, return the concrete alternative for review. Leave seller auth, security-event destinations, intake and production outside this staff policy. See the [path-scoping evidence](COMPLETION-SETUP.md#proposed-staff-review-access).

## Current access and data gates

The existing Cloudflare management request returned error 10000. A safe local inspection found an environment API token present; Wrangler prioritizes it over stored OAuth credentials. Stored OAuth expiry therefore does not establish the cause of this failed request. No token values were exposed, credentials created, auth mode changed, principal switched or denied source read retried. The owner must verify/restore the existing authorized connection before any management write; no expanded grant is requested.

Legacy inventory remains unverified. Use the existing authorized owner inventory/export process, then [offline preflight](INVENTORY-PREFLIGHT.md). Complete verified empty profiles, all listing states, saved drafts and object inventory permit a clean-cutover proposal. Any retained data requires preservation, real-format decoder/import work and validated bytes/ownership. The offline report does not authorize a migration. Do not reroute the denied legacy source/version read.

Production merge/deployment, security recovery grants and permanent real-data deletion remain separate decisions. These proposals do not assert that tenant ownership, Google/Apple consent, reviewer MFA or real provider acceptance has occurred.
