# Account-block event receiver

The source implementation accepts Auth0's documented [`user.updated` CloudEvent](https://auth0.com/docs/events/user/user.updated) at `POST /api/aircraft-sale/auth/auth0-events`. Auth0's [webhook destination](https://auth0.com/docs/customize/events/create-an-event-stream) performs the notification; no Management API account/token or new cloud service is needed by the receiver. This feature is implemented and tested locally but is not activated in the deployed seller Worker. Owned-tenant availability, actual delivery and monitoring remain acceptance gates.

## Exact configuration proposal

Target: dedicated staging Worker `rwas-seller-staging-20261001`, on the existing exact Pages alias. Require valid existing `AUTH_ISSUER`, `AUTH_CLIENT_ID` and `AUTH_REDIRECT_URI`, then add:

| Setting                | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| `AUTH_EVENT_TENANT`    | Actual owned staging tenant name                                        |
| `AUTH_EVENT_SOURCE`    | Exact `source` URN from the tenant's verified event envelope            |
| `AUTH_EVENT_STREAM_ID` | Exact approved `est_…` stream ID                                        |
| `AUTH_STREAM_SECRET`   | Private bearer proof ≥32 characters, different from `AUTH_EVENT_SECRET` |

Auth0 stream name proposal: `RWAS staging account blocks`. Subscription: **only `user.updated`**. Destination: `https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/auth0-events`. Authentication: Bearer using the same privately configured `AUTH_STREAM_SECRET`. Configure through the owned dashboard after specific approval; do not create an M2M grant from the documentation's optional CLI example. Prefer an isolated staging tenant: this subscription sends that tenant's user-update snapshots, not only updates from one client application. Obtain exact source/stream metadata using the owner's legitimate dashboard/event testing process; do not accept an unknown source by guessing its format.

The source change also needs an authorized code update of the dedicated seller Worker before activation. Pages preview deployment alone does not update this Worker. It does not require a new DO class/migration or public Worker route. Do not route the webhook through the staff Access policy or wildcard preview URLs. No secret or stream has been configured by this change.

## Authentication and effects

The receiver rejects missing configuration (503), wrong proof (403), wrong site/origin (403), unsupported content type (415), mismatched tenant/source/stream/type/schema (400), oversized bodies (413), and reused event identities with changed security facts (409). It uses the existing 64,000-byte JSON limit. Supported content types: `application/json`, `application/cloudevents+json`. The configured stream secret cannot equal the existing generic reset/security-event secret. Bearer proof authenticates the delivery; no payload signature is claimed.

`data.object.blocked === true` maps the exact `user_id` and actual CloudEvent `time` to the existing `account-blocked` operation. This revokes all sessions on the linked RWAS profile, denies email-code fallback, preserves unknown-subject tombstones and fences in-flight/future login. Any `previous_object.user_id` must match the current subject. Other user updates and `blocked:false` do not clear a sticky hold. Only the separately authorized, fresh security-operator preview/apply path can reconcile an unblock, with provider evidence. Reviewer rights do not include this authority.

Minimal receipt fingerprint and revocation are committed together in the existing serialized SQLite store; failed persistence returns 503 without acknowledging delivery. Stable event identity survives restart and rejects security-fact collisions. An already-committed identical duplicate can be acknowledged after the five-minute event window without repeating revocation. New blocks outside that window are rejected (400) and need operator reconciliation; their time is never rewritten. Previously reconciled, out-of-order blocks cannot restore a cleared hold. Receipts are pruned after a day during subsequent accepted block processing. Raw provider profiles/emails/metadata are not retained in these receipts or audit records.

## Reliability acceptance

This is synchronous commit-before-ack processing, without a new external queue. [Auth0's documented retry/recovery behavior](https://auth0.com/docs/customize/events/events-best-practices) is bounded; a 4xx may stop delivery, and failing streams can be disabled. It does not guarantee eventual revocation. Configure monitoring of failed deliveries/stream status using the existing approved owner process, test outage/response loss/restart, and reconcile missed or late blocks through the separate operator workflow. Real provider block/unblock, payload size, source/type metadata and delivery behavior must be verified before production. If Events is unavailable in the owned tenant, record that gate; do not substitute login failures or inferred log messages for authoritative block events.

`tests/aircraft-sale/auth0-events.test.mjs` has seven offline tests: actual workerd SQLite persistence/restart, configuration/proof isolation, linked-session revocation and email-code denial, malformed/cross-stream input, ignored unblocks, atomic failure/duplicate/collision handling, unknown-subject and out-of-order recovery. Tests use disposable state and synthetic identities; they do not establish configured live Auth0 delivery.
