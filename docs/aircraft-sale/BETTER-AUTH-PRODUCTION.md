# Seller authentication in production

The seller application uses Better Auth on the existing Cloudflare seller Worker,
with identity data in D1. Seller profiles/listings remain in `SELLER_STORE` and
media remains in `MEDIA`. Clerk code is retained for historical regression
coverage; production Clerk and acceptance modes are disabled.

`workers/aircraft-sale/wrangler.production.toml` is the portable production
configuration. It enables public Better Auth and public listings, preserves the
existing bindings, disables automatic invocation URL logs, and keeps encrypted
secrets in Cloudflare. Never put credential values in this repository. Use
ordinary supported Cloudflare deployment tooling, preserving other current
settings and checking for newer deployments before publishing.

Password signup, email verification/recovery, Google sign-in, authenticator MFA,
session revocation and account management are implemented. Apple is intentionally
disabled by the owner's instruction. Google uses only `openid email profile`;
its callback is
`https://www.rogerwilcoaviation.com/api/aircraft-sale/identity/callback/google`.

Identity administration requires the explicitly configured immutable user ID,
verified email and a current MFA-verified session. Matching the administrator
email alone grants no identity privilege. Cloudflare Staff access for listing
moderation and business-account maintenance is separate. Do not replace either
check with email equivalence or a database role edit.

Existing Auth0 sellers can connect through the account panel using both a recent
old-owner sign-in and a recent verified Better Auth identity. Same-email accounts
are never automatically merged. Successful linking keeps the business profile
and retires its old login access. A legacy-profile conflict is not permission to
delete or adopt that profile. Preserve the Auth0 configuration while transitions
remain supported.

Jerry-assisted listing uses the mounted seller request facade. Better Auth
requests need the current opaque seller session, CSRF header and same-origin
cookie. The widget binds asynchronous work to the identity/session snapshot;
general chat sends no seller credentials. Avoid adding a Bearer-only shortcut.

Local verification includes `npm run test:seller` and the browser contracts in
`.github/workflows/deploy.yml`. Those browser tests accept `PLAYWRIGHT_MODULE`;
CI installs its pinned browser runtime before invoking them. Hosted acceptance
also needs real email delivery, private human password/MFA entry and actual
provider checks; fixture passes do not replace those observations.

After real Better Auth accounts exist, retain a Better Auth-compatible Worker,
D1 and frontend during recovery. A pre-Better-Auth rollback would remove session
checks or strand new users. Prefer a compatible maintenance configuration or a
forward fix. Do not replay expired QA cleanup, delete real identities, revoke
shared deployment credentials or reset test histories as part of rollback.
