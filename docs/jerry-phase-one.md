# Jerry website integration: local phase-one candidate

Status: implemented for local review and synthetic testing. Not deployed or activated. Production Worker configuration, records, identity access, and the running relay have not been changed.

## Approved behavior

- Signed-in, email-verified accounts can save and reopen conversations across devices. The server resolves the current provider session, stable owner, revocation fences, account holds and current role. Browser claims never grant identity or permissions.
- Public website and Aviation Exchange histories occupy separate owner/surface namespaces. Private operational pages are excluded. Page context comes from the published static translation catalog, or from an authorized listing reference, rather than arbitrary browser HTML or URLs.
- Guest messages remain in this tab. Signing in prompts an explicit choice to attach the guest conversation or keep it separate. Import is affirmative, bounded, idempotent and marked as untrusted guest data. The old unbound `jerry-chat-history` key is never automatically imported.
- Saved conversations expire 90 days after their last committed user or assistant message. Reads enforce expiry even when an alarm has not run. Empty conversations expire 90 days after creation. Limits: 50 active/deleting conversations per owner/surface and 250 turns per conversation.
- Deleting conversation content commits a tombstone before cleaning other controlled copies. It removes canonical turns and content from intake replay receipts and matching legacy activity copies. Permanent ID tombstones and content-free troubleshooting references remain. Cleanup retries durably after outages. There are no generated summaries in this version; future summaries must use this same deletion fence.
- Independent drafts, listings, uploads and support/business records remain when a conversation is deleted or expires. A new conversation can resume an existing draft. Permanent account removal schedules cleanup of its associated conversations separately from the existing account/business removal process.
- Guided listing answers use stable operation IDs plus an expected draft fingerprint. The answer and deterministic reply receipt commit in the same seller transaction. Same-ID retry returns the saved result; changed input or a stale draft returns 409. A lost final reply cannot advance the workflow twice. Switching from a manual draft requires resume and preserves its fields.
- Saved-work tools read only the current account’s draft, listings and support status. Administrator tools show moderation/support counts; they do not expose seller tools. Chat cannot publish, approve, delete business records, send email, or access internal operations.
- English, Brazilian Portuguese and Spanish locale context accompanies replies. Deterministic workflow text uses the same stateless website response service when available and validates identifiers/numbers; unavailable or invalid translation retains the original response with an explicit localized notice. Conversation records preserve the text actually delivered.
- Exchange activity entries hold content-free references. Authorized administrator detail requests resolve the canonical Exchange transcript. Deleted or expired conversations return an unavailable notice without falling back to a legacy transcript. Public conversations never enter the Exchange log. A durable metadata outbox retries reference logging without retaining session credentials.

## Architecture and boundaries

`functions/_jerry/gateway.mjs` enforces same-origin custom-header JSON requests, size limits and published page references. The native seller service binding exposes a closed set of website operations. Authentication is checked again after inference and before finalization. The application’s existing authorization and CSRF checks still protect guided draft mutations.

`JerryConversations` stores account content separately from `SellerStore`. All reserve/finalize/delete operations are short transactions. Inference runs outside both object queues. Alarm cleanup invokes the seller queue outside the conversation queue, avoiding a callback cycle. Deletion and expiry generation fences reject late replies, retries, imports and browser transcript ingestion.

The browser partitions active IDs and uncertain operation inputs by owner/surface/conversation. Account transcripts are not cached in browser storage. Sign-out, account/session/page changes, conversation changes, deletion and locale changes invalidate requests; stale replies cannot render, write storage, trigger actions, or alter current loading/error state. Same-browser deletion broadcasts clear other open views. Administrator transcript views clear while inactive, revalidate on return and poll active views every 10 seconds; server reads always enforce deletion immediately. Already delivered information cannot be remotely recalled from a disconnected device.

The old public chat Worker creates random OpenClaw `web-chat-*` sessions. Reusing it would leave transcript copies outside the new deletion domain. The new path therefore requires the separate `workers/jerry-response` service and has **no fallback to OpenClaw or the old public chat endpoint**. The new responder has no tools, business bindings, session filesystem or operational access. It uses a fixed Responses API destination, `store: false`, and no provider conversation/previous-response ID. It never logs request content or raw provider errors. Provider-controlled abuse-monitoring or legally required retention is governed separately by the provider’s policy; `store: false` is not a claim of zero provider retention. API contract reference: [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Local verification

Use `npm run test:jerry`, `npm run test:jerry:browser`, the existing seller/intake/language suites, lint and Pages build. All conversation and provider tests use synthetic accounts/messages and injected responses; no live customer login, model invocation or production mutation is needed. Browser tests use `PLAYWRIGHT_MODULE`, with the workstation’s existing Playwright installation as the fallback.

`wrangler.jerry.local.toml` and the response service’s `wrangler.local.toml` are local fixture candidates only. They are not production deployment manifests. No real key/model configuration is included or obtained by this change.

## Release gate and rollback

Production is off by default: both Pages and the seller service require `JERRY_CONVERSATIONS_ENABLED=true`, and the production manifest has not been changed. A later approved release must review the complete active settings, add the conversation binding/class migration without replacing the existing seller migration, bind the stateless response service, select an approved provider model/credential, verify provider processing for both chat and translation, qualify durable guest abuse/concurrency admission, and qualify the built artifact in isolation before any production activation. No provider credential acquisition, new access, activation or deployment is authorized by the current local implementation approval.

Disabling the Pages feature flag restores the legacy widget path without migrating its unbound history. Cleanup capabilities and the conversation binding must remain available until deletion/expiry outboxes drain; do not remove the new class or deploy an older source that cannot finish those jobs. Rollback does not authorize copying account transcripts into legacy storage or creating replacement listing drafts.

The existing advisory screening policy remains unchanged: verified accounts remain usable while concerns are flagged, and administrators make account/listing approval decisions. This work adds no automatic approval or broader sharing.
