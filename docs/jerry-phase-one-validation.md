# Jerry phase-one local validation — October 24, 2026

This is the original phase-one snapshot. See the [later local readiness continuation](jerry-readiness-validation-20261024.md) for subsequent admission controls, final candidate checks and remaining hosted/provider gates.

The approved scope was source edits and local tests only. This candidate is not deployed; its feature gates remain off in production. No customer login, transcript, listing, account, provider credential or production configuration was modified for these tests. Big D supplied an independent architecture review, and this implementation addresses the concrete publication, translation-boundary, cleanup and responder-validation findings.

## Results

| Check                                                                                  | Result                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| New protocol, storage, permission, draft, cleanup, provider and native RPC/Pages tests | 28 passed                                                                                                                       |
| Browser contract tests using the actual widget/controller                              | 6 passed                                                                                                                        |
| Existing seller regression                                                             | 404 passed, 1 existing skip                                                                                                     |
| Service intake regression                                                              | 16 passed                                                                                                                       |
| Site-language regression                                                               | 10 passed                                                                                                                       |
| ESLint                                                                                 | Passed with zero warnings                                                                                                       |
| Production-shaped Pages build                                                          | Passed; local artifact only                                                                                                     |
| Artifact routing and source readback                                                   | Controller matches source; Jerry routes included; operations exclusions preserved; administrator/staff activity RPC paths match |
| Whitespace/error check                                                                 | `git diff --check` passed                                                                                                       |

The Pages build used `NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG=true NEXT_PUBLIC_SELLER_CLERK_PRODUCTION=false npm run pages:build`. Its account chat controller SHA-256 is `445895edd49985ec5589ceae080f96db4768034204a86dd296e28033f1c93bed`.

## Acceptance evidence

1. Verified account ownership: foreign owner/surface binding, stale provider session, revoked credentials and held profiles are rejected. A role change during private status translation prevents finalization.
2. Durable history: native SQLite transactions and actual service-binding RPC survive worker restart. Browser reload and a second browser page reopen the same account conversation without repeating inference.
3. Explicit guest consent: guest messages stay tab-local before sign-in, attach only through the affirmative control, retain untrusted provenance, and import once. Legacy unbound history is not silently imported.
4. Retention: a no-further-traffic alarm test expires canonical turns/title metadata, import markers, intake result receipts and matching legacy log content. Read-time expiry rejects access even while cleanup is pending.
5. Deletion and recovery: canonical tombstones reject late replies and ID reuse. Storage-failure/restart/alarm tests prove cleanup retries. Independently saved draft fields and unrelated business records remain.
6. Guided listing persistence: the business mutation and replay receipt commit together. Lost-finalize retry returns the same answer, two tabs cannot both advance one expected draft revision, and manual/Jerry resume retains existing fields.
7. Client fencing: sign-out during a delayed reply clears private rendering; late completion does not repaint it or alter the current send control. Deletion clears another open same-browser view.
8. Locale and identifiers: selected locale reaches the responder; deterministic workflow translation uses the same stateless contract, validates identifiers/numbers and gives an explicit fallback notice. Locale changes preserve typed chat input.
9. Troubleshooting access: Exchange log rows contain verified account attribution and content-free canonical references. Success/failure outboxes recover from outages. Administrator detail resolves only Exchange transcripts and cannot restore deleted text. Public chat stays out of that log.
10. Responder capability: the separate service has no public response route, internal Jerry fallback, tools, business bindings or application transcript/session persistence. Provider requests use a fixed HTTPS destination, reject redirects, disable stored Response objects, and validate context, reference shape, locale and payload budget.

All model/provider responses were injected synthetic fixtures. These results do not establish live model answer quality, provider retention settings, production migrations, deployment success or customer acceptance. The established old public chat Worker was read for source-custody/retention analysis, but deployed-bundle equivalence with the older checkout was not established; the new stateless transport does not reuse that source or alter the running relay.

IDE diagnostics and Playwright MCP were unavailable in this session. ESLint, Next’s build/type checks, native Miniflare and the workstation’s installed Playwright supplied the captured local evidence instead.

## Before any enablement

See [the implementation and release notes](jerry-phase-one.md). A separately approved release must qualify the complete deployment configuration, new bindings/migration, actual provider/model/credential and data handling for both chat and translation, durable guest/concurrency admission, isolated end-to-end behavior and production readback. No such activation or additional access is authorized by this local validation.
