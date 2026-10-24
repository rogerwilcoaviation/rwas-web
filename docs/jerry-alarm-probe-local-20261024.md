# Provider-neutral alarm fixture: local qualification

Status: implemented, locally tested and bundled; **unarmed, not deployed, no hosted automatic-delivery acceptance**. No provider, email, credential, new access, billing or production configuration/record change occurred. John's subscription-only direction is recorded in the [read-only OAuth assessment](jerry-oauth-assessment-20261024.md); direct-provider work remains stopped.

## Exact isolated shape

`workers/jerry-alarm-qualification/wrangler.local.toml` is an unarmed local template. It has no start/stop timestamps or Cron, disables workers.dev and preview URLs, has an empty route list and no service/D1/R2/KV bindings. The provider variables are absent and the application feature flag is false. The pure resource manifest rejects any change selecting an existing Worker, external binding or production route. This is not deployment authorization.

Proposed Worker: `rwas-jerry-alarm-qa-20261024`, in the previously observed Cloudflare account `08c51088fd98ea9214af8a0ae226663c`. Three new SQLite class namespaces only:

| Class                     | Object names                             |
| ------------------------- | ---------------------------------------- |
| `JerryConversationsProbe` | `synthetic:public`, `synthetic:exchange` |
| `JerryAdmissionProbe`     | `website-admission-v1`                   |
| `ProbeControl`            | `seller-v2`                              |

Four objects total. Both `SELLER_STORE` and `PROBE_CONTROL` refer to the same isolated class/namespace/object; the sink uses `seller-v2` because that is the unchanged native conversation handler's callback name. It is **not** the production SellerStore namespace. No existing service is bound. The sink holds only synthetic copies and a fake independent draft. No actual seller account or listing is created. The fixture does not import the paused direct responder.

## Behavior and guards

- Native `JerryConversations` and `JerryAdmission` are imported unchanged. Thin wrappers add private setup, direct storage inspection, real `ctx.abort()` reset, metadata and lifetime guards. There is no HTTP control route or handler-invocation endpoint in the deployable fixture. `fetch` returns 404. Only private native capabilities and a future single exact-date Cron can bootstrap it; both remain inaccessible/unconfigured in the checked-in template.
- Two synthetic conversations contain one fixed reply and one explicit guest import each. Only their stored expiry is shortened to +60 seconds. Exchange copy cleanup receives time-based synthetic 503 responses until +150 seconds; other callbacks succeed. Admission seeds are still-valid old operations whose original 24-hour receipts expire at +180 seconds. Real clock methods and the native sweep/retry/cleanup algorithms are retained.
- Reset intent, per-instance boot IDs, build IDs and callback origin/status metadata distinguish reset, rollback and delivery. The alarm wrapper labels controlled local calls, runtime callbacks with platform alarm metadata, and unverified callers separately. It calls the native handler only from its own alarm callback. A runtime label alone is not hosted attestation; source custody and actual platform event/readback evidence remain required.
- Durable guards admit at most two native operations/alarms in flight, 200 metadata events, 30 control requests including bootstrap/replays, eight normal conversation requests and 60 admission protocol requests. Synthetic inputs are capped at 4,096 bytes/request and 256 characters/string. The setup admits at most 20 operation groups. Control state checks its UTF-8 size against 4 MiB; native data is bounded by these closed request counts and native schema limits, with logical record/byte readback. The planning envelope is 1,000 logical application records and 4 MiB, not a claim about physical SQLite/WAL or billable storage.
- New work closes on rollback and after the 15-minute active window. Native self-acknowledgments remain usable for already pending alarms. Capacity contention reschedules rather than deleting work; an exhausted event/time budget stops alarms while retaining pending data. A separate maximum 24-hour cleanup capability window cannot silently extend the run.
- Teardown requires verified zero pending copies, live/import/turn content, outboxes, admission/rate rows and alarms. Until then it returns a preserve-capability plan and refuses erasure. Once drained, it clears only the four isolated objects. Remote class-deletion migrations, Cron removal and Worker deletion are **planning steps only**, not commands executed by this source or builder.

One refinement to the original proposal: **200 metadata events is not 200 total Cloudflare invocations**. Coordinator/sink instrumentation adds RPC overhead. The exact resource manifest now carries a conservative planned envelope of 1,024 invocations for the bounded run, separate from the enforced application event/control limits. Neither number is a billing hard cap. Future execution approval must use this updated envelope and verified account cost controls; no paid-plan upgrade or billing permission is inferred.

## Final local evidence

| Check                                                                                       | Result                   |
| ------------------------------------------------------------------------------------------- | ------------------------ |
| Focused probe tests                                                                         | 5 passed                 |
| Related native conversation, cleanup, authorization, draft/intake and admission regressions | 39 passed                |
| Repository ESLint                                                                           | Passed, zero warnings    |
| Focused fixture/builder/test lint and Node syntax                                           | Passed                   |
| Deterministic esbuild fixture bundle                                                        | Passed, 54,311 bytes     |
| Native production source/manifest comparison                                                | Unchanged from `bb6b475` |
| Provider calls, emails, hosted deployments                                                  | Zero                     |

Tests prove real local `ctx.abort()` changes boot IDs without losing persisted data; controlled native alarms preserve failure state, retry across a simulated rollback, erase synthetic content/copies/imports while retaining the fake draft, expire admission/rate state, and permit teardown only after drain. They also cover manifest isolation, unarmed/public rejection, expired-window preservation, concurrency, payload, event and control limits.

**All elapsed-time advancement and handler delivery in these fast tests are explicitly local simulations.** The test-only module supplies a clock and `/__test/alarm` driver; neither is bundled into the fixture. No natural local or hosted automatic-delivery pass is claimed. The complete real-time sequence, no-target-traffic windows, reset/build provenance, scheduled/delivered timestamps, delayed recovery and hosted teardown still require a separately authorized hosted run. The fake copy sink also does not qualify real SellerStore deletion or hosted identity/Pages behavior.

Commands: `npm run test:jerry:alarm-probe`, `npm run build:jerry:alarm-probe`. The builder has no deployment/network client, reads no environment credentials, and records exact dependency/test/source hashes plus the resource manifest. Build evidence and logs are retained locally in `artifacts/jerry-alarm-probe-20261024/`, outside the commit.

Final bundle SHA-256: `f9642d90cc0e598783c53f289eea71d7a3cac9a68db4f58a5f4040166629b2ed`.

Fixture entry source SHA-256: `6952a08c53f2df1f01a11181d539137943fd35e644cf4e90eb2f0293197f4819`.

The complete immutable source/test/config digests, manifest digest, dependency list and hash-named bundle are in `build-receipt.json` beside the local artifacts. The receipt explicitly records `hostedDeliveryQualified: false` and `deployed: false`.

## Remaining gates

Hosted execution still needs the account cost/ceiling evidence, existing deploy/delete/log-read permission confirmation, UTC run window, cleanup owner, exact armed configuration/Cron and teardown authorization. The prior billing metadata 403 was not retried or bypassed. All production routes/settings remain unchanged. No automatically scheduled follow-up was created.

The public subscription-backed website transport is a separate unresolved architecture/permission and privacy question. No public/private website traffic may enter the old relay or paused direct responder on the strength of this fixture's results. Interrupted direct-provider source/test edits remain uncommitted, preserved separately in `paused-direct-api.patch`; they are excluded from this provider-neutral change and are not newly qualified or selected.
