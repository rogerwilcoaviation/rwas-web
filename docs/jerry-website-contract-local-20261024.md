# Jerry website integration: local contract and qualification

Status: local implementation and synthetic qualification only. No push, deployment, production record mutation, live inference, credential access or relay configuration change. The selected candidate has no direct API path, OAuth proxy, provider fallback or automatic RWAS fallback to the old shared-bearer relay. The separate Shopify widget remains outside this candidate.

John approved the first-phase product decisions and local source/tests. His later subscription-only direction supersedes direct-API delivery. Token usage is not a release criterion here. The [earlier read-only transport assessment](jerry-oauth-assessment-20261024.md) records the existing relay gaps; those observations were not refreshed by this local change.

## What is implemented

- The server derives account owner, current session, expiry, role, surface and permitted listing reference. Browser identity/role claims cannot grant access. Public website and Aviation Exchange histories remain separate; internal operational pages are excluded.
- `JERRY_WEBSITE_TRANSPORT` exposes only response, translation, content-free status and bound cleanup through a native service binding. Public HTTP returns 404. Strict input/output shapes reject tools, operational actions, rich action blocks and extra fields. No cookie, bearer token, email, profile or private operational context crosses this binding. A user's own freely typed text can, of course, contain information they supply.
- This implementation accepts only an explicitly synthetic capability descriptor. The default mode is disabled, with no provider/model/credential settings. Fixed in-process fixture replies prove routing; they do not establish real answer quality or translation quality. A real transport cannot be enabled by merely supplying a token.
- Replies, replay receipts and per-operation cleanup bind to owner, surface, session, conversation, deletion generation, operation and expiry. Session/account/role changes are checked again before and after canonical finalization. The browser independently invalidates stale work. Uncertain execution does not silently rerun inference.
- Native SQLite copy storage records prompt/history/reference, reply and translation replay state. Content and its retention alarm commit in one transaction. Alarm-registration failures before or after acknowledgement roll back the write. Lost final delivery can recover an exact completed reply without running the response again.
- A content-free cleanup obligation commits in the seller store before content crosses the binding. Abandoned operations become cleanup-eligible after 90 seconds; failed or mismatched cleanup acknowledgements retry after 60 seconds through the seller alarm. Cancellation before reservation writes a fence, so a late reservation cannot recreate content. Whole-conversation deletion tombstones the copy namespace and blocks delayed completion.
- RWAS feature-off, missing-service and network-failure states show unavailable chat with manual listing access. They neither display/read the old unbound transcript nor call the old `/api/chat` endpoint. Existing stored legacy data is preserved without importing it.
- Existing deterministic listing intake/status/resume behavior, draft fingerprints, revision checks and upload authority remain. Deleting a conversation preserves independent drafts, listings and uploads. Account/listing screening remains advisory and administrator decisions remain explicit.

## Owner management and public chat

John's owner-directed maintenance through his local signed-in assistant remains separate from visitors' requests. The website exposes existing role-authorized saved-work and moderation/support status, with deterministic listing assistance. It does not give a public model administrator powers, email capabilities, internal context or customer-account mutation tools. No new autonomous approval, publishing or destructive action was introduced.

## Copy inventory and deletion boundary

| Copy                                                                               | Retention and cleanup                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical account conversation, title, turns and import markers                    | 90 days after the latest committed message, enforced on reads; alarm-driven cleanup and permanent conversation tombstones.                                                              |
| Native transport prompt/history/reference, reply, translation and completed replay | Each operation expires no later than its original message timestamp plus 90 days. Bound operation cancellation removes its content; whole-conversation cleanup removes all such copies. |
| Seller intake replay receipts and matching old activity-content copies             | Existing canonical cleanup redacts controlled conversation text. Independent business records remain under their existing policy.                                                       |
| Exchange activity references                                                       | Content-free troubleshooting metadata; authorized admin detail resolves canonical Exchange history. Public-site conversations are not added to this log.                                |
| Browser account UI                                                                 | No account transcript cache; transient rendered/in-flight data clears on invalidation. Already delivered data on disconnected devices cannot be remotely recalled.                      |
| Guest chat                                                                         | Remains in the tab; the transport creates no durable guest content copy. Import into an account requires explicit consent and remains bounded/idempotent.                               |
| Admission ledger                                                                   | Content-free pseudonyms, fingerprints and execution/rate metadata, with existing 24-hour expiry. No credential or raw address is stored there.                                          |
| Deletion/cancellation/outbox metadata                                              | Content-free fences and pending-cleanup references remain as needed for idempotence and troubleshooting; a successful acknowledgement must match the exact requested scope.             |
| Old relay/OpenClaw/provider histories, external telemetry or user-made copies      | Outside the new controlled copy domain. They were neither read nor deleted, and no erasure claim is made for them. The selected candidate never sends content to them.                  |

No generated summaries or provider-side conversations are created. A future adapter must inventory and erase any additional copy, including summaries, trajectories, retained jobs, translations and telemetry, before it can join this deletion domain. Native handler tests do not establish hosted alarm delivery; that remains a separate qualification.

## Local evidence

Commands and final results are recorded in `artifacts/jerry-neutral-contract-20261024/validation.json` and adjacent logs. `build-receipt.json` captures backend source hashes, the exact bundled dependency inventory, production manifest hash and byte-for-byte preservation of the four paused direct-API files. `pages-readback.json` captures the built wrapper/widget/controller checks and hashes.

| Check                                                | Result                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| Jerry backend suites                                 | 65 passed                                   |
| Browser behavior and page-error checks               | 11 passed                                   |
| Latest native transport suite                        | 8 passed                                    |
| Existing seller regression                           | 404 passed, 1 live Clerk JWKS check skipped |
| Service intake / site language                       | 16 / 10 passed                              |
| Native journey against generated Pages artifact      | 1 passed                                    |
| Application lint / changed-module lint / Pages build | Passed                                      |
| Paused four-file baseline / production manifest      | Unchanged                                   |

Two initial failures were corrected before qualification: a stale release-plan expectation, and seven seller test-bundle failures caused by a transitive `node:net` dependency. Moving the cleanup capability out of the response sender removed that dependency from existing seller bundles. Initial failure logs are preserved separately from final passing logs.

Exact local hashes:

- Synthetic transport bundle (36,142 bytes): `8fc2d4d772ea773f2198a2bc918ad72f39232251748423e6c50d947aeb0f51a9`.
- Rebuilt alarm fixture: `ac836c525beed56198b1d9e2122fddc60395ea6e830e516599044848d45bc5b8`.
- Built/source-equal widget: `41cfea467605ba449e6c8da9fd5b01d918424d783d86644d354217ab7921335b`.
- Built Pages wrapper: `8037f8c0cbc406a4292dc517e387ab5bca580879b34fb2666fc5731960240029`.

The selected `test:jerry` and `test:jerry:candidate` commands now exercise the neutral contract. The paused direct-response unit/candidate files remain intact and are explicitly excluded from these commands; their historical results do not qualify this candidate. The existing alarm fixture was rebuilt because the native conversation transaction source changed. Its prior bundle receipt is historical; the new receipt still reports hosted delivery as unqualified.

Native tests cover restart/replay, wrong owner/surface/session/generation responses and acknowledgements, delayed completion, logout/account/role/expiry changes, erase-before-reserve, uncertain final storage, abandoned-operation cleanup, alarm failures and expiry without further traffic. The full candidate test uses the actual built Pages wrapper, Better Auth sessions and local D1/R2/SQLite with synthetic accounts and intercepted email. It checks two-account isolation, listing draft preservation/resume, deletion and feature rollback. Browser tests exercise stale-work invalidation, guest consent and unavailable-service behavior with page-error checks.

IDE diagnostics and Playwright MCP are unavailable in this session. Verification uses ESLint on the application and every changed JavaScript module, the Next/Pages build checks, installed Playwright browser automation and native workerd/Miniflare fixtures. These are local results, not production acceptance.

## Exact remaining route and release decisions

1. Establish a documented subscription route covering this exact public multiuser deployment under the actual product/Personal-plan terms, or choose an explicitly approved user-owned experience. The previous assessment did not establish permission to use John's subscription for visitors' requests. No API project/key is requested as a workaround.
2. Verify Luna availability and supported authentication/protocol for that route without repurposing personal OAuth tokens or silently substituting another transport/model. Leave provider settings unset until this is resolved.
3. Qualify a website-only adapter with tools and inherited internal context disabled before execution, no operational endpoints, no fallback, verified caller/scope, bounded status/retry, cancellation fences and a complete controlled-copy inventory. Existing relay source does not establish these properties.
4. Prove actual provider/local retention settings and deletion behavior, runtime/source custody and hosted alarm delivery against the exact new artifact. Local handler execution alone is insufficient.
5. Only under separate release authorization, compare the full active Pages/seller/transport settings and migrations; preserve the seller baseline; retain cleanup-capable bindings/source during rollback; then qualify the deployed candidate before activation and customer acceptance.

All local feature flags remain off and the transport manifest remains disabled. These decisions do not prevent the completed local website work from being reviewed now.
