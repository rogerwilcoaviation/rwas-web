# Jerry local readiness continuation — October 24, 2026

**Later direction:** The direct-provider delivery plan is stopped following John's subscription-only request. See the [OAuth/relay evidence](jerry-oauth-assessment-20261024.md) and the [independent provider-neutral alarm fixture](jerry-alarm-probe-local-20261024.md). Results below qualify the earlier local candidate, not a currently approved provider architecture.

The authorized continuation permits source changes, local synthetic qualification, read-only provider/configuration assessment and a local commit. It excludes deployment, pushing, production record changes, credential acquisition, expanded access and live private-data/model calls. This report supplements the original [phase-one evidence](jerry-phase-one-validation.md); it does not relabel that earlier evidence as a hosted release.

## Implemented behavior

- Durable response admission uses a separate native SQLite `JerryAdmission` class in the response Worker. One object coordinates public/Exchange and chat/translation provider work. Its metadata contains HMAC labels and fingerprints, operation IDs, timestamps, states and lease nonces; it contains no prompt, reply, raw address, email or credential.
- Conservative candidate limits: 40 attempts per principal and 240 globally per five minutes; one guest or two account requests in flight, four globally; 90-second leases; 8,192 operation receipts, expiring 24 hours after original issue. Replays and rejected valid attempts consume attempt budgets. Fixed-window limits are not a provider spend cap or a load qualification.
- An unstarted expired reservation can be reacquired. Work marked running becomes uncertain after lease expiry and cannot automatically invoke again. Provider failure holds concurrency through the original lease. Lost start/finish acknowledgments do not repeat inference. Reads sweep expired admission records independently of alarm delivery.
- Guests preserve the same pending operation ID, timestamp, input and bounded history in tab-local session storage across reloads. An uncertain/completed/failed terminal attempt offers an explicit new request; the server does not retain a guest reply for replay. Chat retries never silently repeat inference. Guided listing mutations retain their separate transactional receipt/fingerprint protections and cannot use this control to repeat a business mutation.
- Verified accounts use canonical cached replies when available. Account and guest admission are aggregate across the two surfaces. Switching identities, addresses or HMAC keys cannot reuse an existing operation ID for another inference while its receipt remains.
- Exchange failure references preserve the actual safe HTTP status and bounded error code. Outbox completion acknowledges only its strict protocol fields, checks acknowledgment status and backs off after failure. Canonical transcript access, public/Exchange separation, deletion fences and independent draft preservation remain enforced.
- The provider contract now requires explicit project/model/cache settings. The existing production manifest remains byte-for-byte unchanged. An offline, pure configuration planner preserves the existing seller baseline/migration and appends candidate resources with the feature off; it does not apply or deploy the plan.

## Qualification results

| Check                                                                      | Final result                    |
| -------------------------------------------------------------------------- | ------------------------------- |
| Jerry protocol, storage, admission, provider and native candidate suite    | 47 passed                       |
| Browser contracts using the actual widget/controller                       | 9 passed                        |
| Existing seller regression                                                 | 404 passed, 1 existing skip     |
| Service intake regression                                                  | 16 passed                       |
| Site-language regression                                                   | 10 passed                       |
| Repository ESLint and focused lint of changed Worker/browser/test modules  | Passed, zero warnings           |
| Node syntax checks for changed JavaScript modules                          | Passed                          |
| Production-shaped Pages build                                              | Passed; local artifact only     |
| Full final Pages artifact with native seller/response/DO/D1/R2 wiring      | 2 passed                        |
| Controller source/artifact equality, route inclusion, operations exclusion | Passed                          |
| Production manifest equality with parent `3288716`                         | Passed, byte-for-byte unchanged |

The build command was `NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG=true NEXT_PUBLIC_SELLER_CLERK_PRODUCTION=false npm run pages:build`. The full-artifact check was `JERRY_PAGES_ARTIFACT=.vercel/output/static npm run test:jerry:candidate`. It loaded every emitted Worker module unchanged through Miniflare's explicit module API; no substitute application bundle was used. The final controller SHA-256 is `3c5dd0305876a40567be693efdef327b294d0f0067c2ad0bce87c4653e3f6ebf`. The unchanged production manifest SHA-256 is `918b6bc1ed5ee3e5a197f21addf463d3c059a7c52377499461df23362b7d98fa`.

Logs, built-module hashes and source/artifact readback are retained locally under `artifacts/jerry-readiness-20261024/` (not committed). The initial failed seller run is retained: an older mail test harness could not bundle the new `node:net` import. Its fixture now supplies the same Node compatibility used by the real Worker, and both the focused mail test and entire seller suite pass. The initial full-artifact harness discovery error is also retained; explicit module enumeration resolves that parser limitation without changing emitted code. Existing seller native tests still emit unread-stream workerd diagnostics; their assertions pass and the diagnostics remain in the log. No such diagnostic appeared in the final Jerry suite or full-artifact candidate run.

The full candidate fixture compiles the actual Pages wrapper and native seller/response entrypoints, uses synthetic Better Auth sessions with local D1/R2/SQLite, and intercepts all external delivery/provider calls. It checks pre-enable feature-off behavior, adds only the candidate binding, preserves an existing manual draft and seller session, exercises account replay/isolation and attributed administrator resolution, guest concurrency/replay/restart, conversation deletion, rollback and business-record preservation.

Two cleanup paths are distinguished. Ordinary deletion succeeds with unmodified conversation source. For pending cleanup after rollback and cold restart, a test-only subclass invokes the inherited real alarm handler and proves the native receipt copy becomes unavailable. **Automatic local alarm delivery was not observed within the bounded waits**, despite a due scheduled alarm. This test therefore does not prove platform alarm delivery. Separate ledger tests control time to exercise the real alarm handler without new user traffic, including storage-failure recovery. Cloudflare documents local hot-reload alarm limitations; that documentation does not diagnose the cold-restart observation. [Known issues](https://developers.cloudflare.com/durable-objects/platform/known-issues/), [alarm delivery semantics](https://developers.cloudflare.com/durable-objects/api/alarms/).

No fixture-only endpoint or clock override is included in deployable source. IDE diagnostics and Playwright MCP were unavailable; ESLint, Node syntax checks, native Miniflare/workerd, the installed Playwright and the Next/Pages build provide the captured local evidence.

## Release boundary and rollback

The feature remains off in the checked-in seller fixture manifest; provider settings remain unset. Synthetic test harnesses alone enable fixtures. Production Worker configuration and the running relay were not edited. This qualification does not establish a live API project, provider retention, real model quality/latency, hosted alarm delivery, production migrations or customer acceptance. See the [provider assessment and exact missing inputs](jerry-provider-readiness-20261024.md).

A later approved release must compare the complete active seller settings, preserve all existing bindings and migrations, separately provision the response/admission service, add the conversation class and binding, and qualify the complete deployed artifact before activation. The offline planner is evidence of a candidate shape, not permission to replace active settings. Turning the feature off must retain both cleanup-capable conversation source/bindings and the response admission class/storage until pending cleanup and 24-hour receipts drain. Never copy canonical history into the legacy widget or create replacement drafts during rollback.
