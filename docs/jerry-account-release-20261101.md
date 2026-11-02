# Account-linked Jerry — November 1, 2026

John authorized completion, deployment and signed-in seller/admin verification. He explicitly selected the existing **Cloudflare Workers AI** service for account-linked replies after the provider choice was presented. The existing public chatbot remains separate. No personal OAuth token or OpenAI API key is used by the new account service.

## Implemented behavior

- Verified seller/admin identity owns saved conversations. Owner, current session, role, surface, generation and operation checks remain server-side. Session/role changes invalidate delayed responses. Public website and Exchange history remain separate.
- Seller controls show saved work and resume options. Administrator/super-administrator controls show administration overview and do not expose seller draft actions. Genuine administrator MFA is checked by the existing identity service. Jerry does not gain listing publication, deletion, account-management or email authority.
- Account chat uses the service-only `rwas-jerry-accounts-20261101` Worker and its native Workers AI binding, fixed model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. No tools, inherited operational workspace, relay, Gateway cache, credentials, provider conversation or fallback is configured. Model input is bounded while preserving the current message and authorized listing identifiers. Provider/tool/error output cannot become a website action.
- Signed-out users continue through the established public chatbot with credentials omitted. The account service rejects guest inference in production. Guest import into an account still requires explicit consent. Account transitions fence and clear the previous view; private account history never goes to the public endpoint.
- Canonical and controlled response/translation copies retain the existing 90-day policy, durable cancellation/deletion fences, expiry alarms and retry obligations. Independent drafts, listings, uploads and support records survive conversation deletion. Parts/tools retain their listing titles in saved-work summaries.
- Privacy text and the account UI disclose Cloudflare Workers AI processing. Standard inference is used without AI Gateway logging/caching or stateful provider features. Cloudflare describes its processing, retention exceptions and no-training commitments in its [Workers AI data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

## Qualification and release order

The local native suite includes a real Better Auth/D1 MFA enrollment/verification and administrator journey, seller isolation, saved draft preservation and role restrictions. Browser checks cover seller/admin/super-admin controls, history reload, account changes, guest consent and preservation of the existing public chatbot. Existing seller, intake, language, safe-renderer and lint checks are retained.

A separate synthetic-only Cloudflare QA Worker ran one fixed model prompt. Natural platform alarm callbacks, with runtime retry metadata, expired both canonical turns and response copies after a shortened test TTL. The status reader inspects storage without forcing cleanup. Final readback showed zero canonical turns/live conversations, zero response content copies, no remaining alarms, and preservation of the fake draft marker. This proves hosted callback delivery for the native classes; it is not a claim of deleting customer records. The real seller-store copy chain is separately exercised in native local tests.

Release sequence: qualify locally/hosted; capture current seller/Pages settings; deploy the service-only AI transport; deploy the seller service with the new conversation migration/binding while preserving existing resources; publish and qualify the new frontend; enable the Pages feature flag; verify authenticated seller and administrator sessions. Keep the feature off until the new frontend is serving. Do not deploy a synthetic transport as a live AI service.

Rollback closes new account chat through the Pages feature flag while retaining cleanup-capable conversation/transport bindings and migrations. The existing public chatbot remains available. Do not remove durable resources while content or cleanup obligations remain.

The source worktree is `/private/tmp/rwas-jerry-account-20261101`. Exact deployment, test and live verification receipts are recorded in `/private/tmp/rwas-jerry-release-20261101/` and the final user-facing report. The four paused direct-API files in the earlier worktree are outside this change.

At this document's initial commit, implementation and hosted synthetic qualification are complete; production activation and real signed-in verification are separate subsequent steps and must be reported from their actual results.
