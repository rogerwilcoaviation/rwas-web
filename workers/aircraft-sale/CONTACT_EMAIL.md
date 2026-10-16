# Clerk seller contact-email delivery

The production Pages helper accepts only `POST /api/aircraft-sale/account/email-code`
at `https://www.rogerwilcoaviation.com` with the same exact Origin header. It
requires the existing `SELLER_MAIL_VIA_PAGES=true` selector and uses Pages'
existing `SELLER_MAILER`, or `RESEND_API_KEY` with `CONTACT_FROM_EMAIL`. Production
email-code login remains unavailable. The dedicated staging flow stays separate.

Pages sends an exact bounded context through private service-binding RPC for
both preparation and delivery confirmation. The internal mail route reconstructs
only the canonical authentication request and invokes the existing Clerk/RWAS
pairing, revocation and ten-minute RWAS-session freshness checks. Legacy/Auth0
sessions cannot enter this production Clerk bridge. Proofs are transient; ticket
records retain only the existing hashed code and owner/sequence/expiry data.
Public HTTP cannot call the internal code-returning routes or supply this RPC
context through a custom header.

Successful delivery precedes activation. Failed or interrupted delivery cancels
the pending ticket; there is no automatic resend. Verification changes only the
RWAS contact address and revokes other RWAS sessions. It keeps the seller ID,
listings, media and Clerk sign-in account intact.

## Coupled rollout prerequisite

The production Pages metadata read on 2026-10-12 found its existing mail key-name,
sender-name and seller service binding present, with `SELLER_MAIL_VIA_PAGES`
absent. A rollout must enable that nonsecret selector and deploy the updated
Pages helper together with the compatible seller Worker RPC/DO code. Keep the
Worker's `MAIL_VIA_PAGES=true` and existing Clerk configuration. This change
copies no credentials and requires no Worker mail credential or new provider
permission. No configuration, deployment or genuine email delivery is performed
by this source change or its tests.

Focused offline validation: run `node --test --test-concurrency=1
tests/aircraft-sale/mail.test.mjs
tests/aircraft-sale/production-contact-mail.test.mjs`. The fixtures use the real
Pages handler, service-binding RPC and SQLite Durable Object, with synthetic
signed Clerk identities and an in-memory mailer. They establish local behavior,
not live mail delivery or provider readiness.
