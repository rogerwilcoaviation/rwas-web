# Durable intake activation evidence — 2026-09-30

Verdict: deployment is proven; complete production activation and provider delivery are **not verified**. Unknown external state must not be reported as either configured or missing.

## Reviewed source and GitHub evidence

- Merge: [`1cf67f2d5804f16075aee6d017721736e6e8941f`](https://github.com/rogerwilcoaviation/rwas-web/commit/1cf67f2d5804f16075aee6d017721736e6e8941f).
- Main inspected: [`2c0a3f77bd8f495de63ced4b0dd89bbc55c2e24d`](https://github.com/rogerwilcoaviation/rwas-web/commit/2c0a3f77bd8f495de63ced4b0dd89bbc55c2e24d). The backend, API handlers, tests and intake packaging script were unchanged from the merge before this review's safety fixes.
- The all-events Actions API query `actions/runs?head_sha=1cf67f2d5804f16075aee6d017721736e6e8941f&per_page=100` returned one **push** run: [35790150149](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/35790150149), successful on September 22. The commit-workflow helper filters to pull-request events; an empty result from that helper does not mean no deployment ran. Combined legacy commit statuses were also empty; those are not the Actions run list.
- [Deploy job logs](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/35790150149/job/106956426714) show `rwas-intake.js` attached, Worker bundle and routes uploaded, and `pages deploy --project-name=rwas-web --branch=main` completed at `https://f9c7b1b0.rwas-web.pages.dev`. This proves artifact deployment, not D1 migration, runtime secrets, scheduling or email acceptance/delivery. That workflow did not run the intake suites; its production smoke only fetched documents/static assets.
- Among the 20 recent main Actions runs inspected, the latest successful production deployment was [36269824130](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/36269824130) at `5ef2773fedb7c8e77785330639ec90593c018c7f` on September 26; logs show `https://f1d9ee34.rwas-web.pages.dev` and the same intake module. This does not exclude direct/platform deployments outside Actions.
- Current main's [run 36604473462](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/36604473462) failed before build/deploy: `scripts/seo-remediation-test.mjs:8` asserts a fixed 195 policy products. No deployment or production smoke step ran. Do not identify current main as the live revision on this evidence. Repairing the unrelated retail/SEO expectation is outside this intake change.
- [PR #28](https://github.com/rogerwilcoaviation/rwas-web/pull/28) reports a dedicated D1 and applied schema, but explicitly lists production binding/scoped secret/scheduler activation as pending and provider configuration as unverified. Its Cloudflare bot comment proves an isolated preview deployment. Neither is a current production configuration attestation.

## Safe live observations

At approximately 09:53–09:54 UTC on September 30:

- `GET https://www.rogerwilcoaviation.com/api/service-intake-config` returned HTTP 200, `{"staging":false,"siteKey":"0x4AAAAAADBTcvCdprG6EEdl"}`, with `Cache-Control: no-store`. Production config currently exposes public widget values without calling `configured()`, D1 or Turnstile; **this is not a health/readiness check**.
- `POST /api/service-intake`, exact production Origin, `Content-Type: application/json`, body `null`, returned HTTP 400 `{"error":"Invalid submission."}`. Reviewed control flow checks `configured(env, true)` before parsing/validation, so this supports that the responding deployment passed its basic presence/format checks. The invalid body returns before any D1 query/write, Turnstile request or Resend request. It does not prove binding identity/schema or credential validity.
- No valid intake was submitted; no authenticated dispatch, provider call or email was attempted. No receipt or rate record is created by the invalid-body path.

## Activation requirements and remaining external state

| Requirement | What the evidence supports | Still needed from the production owner/provider |
| --- | --- | --- |
| `INTAKE_RECEIPTS` D1 binding | Source requires it; safe invalid-body response supports truthy binding presence. PR #28 reports dedicated schema work. | Production Pages environment binding's actual database ID/name; verify it is the dedicated approved database and inspect its applied schema against `migrations/intake/0001_receipts.sql`. Confirm preview environments cannot access production D1. No current remote schema inspected. |
| `INTAKE_DISPATCH_SECRET` | Safe response supports the deployed code's minimum length/presence check. | Verify securely provisioned random secret (at least 32 random bytes), usable Bearer encoding, matching scheduled Worker credential, access controls and rotation/recovery plan. Do not reveal or casually rotate it: it also derives receipt tokens. |
| `RESEND_API_KEY` | Source requires a nonblank value; safe response supports presence. | Valid production key, correct account/scope, domain verification and applicable account quota/rate limits. Presence does not prove provider authorization. |
| `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | Safe response supports syntax checks only. Source snapshots them into immutable queued payloads. | Owner-approved actual fixed sender/recipient; authorized sender domain. Inspect queued-row configuration before any change/revocation. No mailbox values or approval inferred. |
| `TURNSTILE_SECRET_KEY` and public site key | Secret presence check passed; runtime returned public site key. Source requires verdict hostname equal to the allowed Origin hostname and action `service_intake`. | Confirm matching real production widget/secret, both intended production hostnames, action and actual managed challenge/siteverify behavior. No real challenge performed. |
| Five-minute parent-owned dispatcher | Repository contains the authenticated dispatch route and bounded drain, but no scheduled Worker implementation, cron configuration or scheduler workflow. | Identify deployed Worker, exact production target URL, `*/5 * * * *` trigger, secret match, awaited response and non-2xx alerting without bearer logging. Inspect recent invocations/results. Absence from this repo is not proof no external Worker exists. |
| Production persistence, acceptance and delivery | Offline real local D1 tests and mocked HTTP cover contracts. GitHub deployment does not establish production execution. | Separately authorized synthetic production intake/receipt verification, then separately authorized provider attempt with approved recipient. Record durable row/attempt status, provider ID and provider/inbox evidence. `provider_accepted` means acceptance, never delivery. Reconcile ambiguous outcomes; never blindly redrive terminal rows. |

No authenticated Cloudflare runtime/database/scheduler or Resend account evidence was available in this review. These external requirements remain unverified, not declared absent. No production bindings, secrets, database, scheduler or mailbox configuration was changed.

## Minimal repository improvements

- Require exact production destination origins in all four handlers, even if production bindings leak into a preview/hash alias; preserve the exact isolated staging exception. Origin headers alone do not fence request destinations.
- Reject dispatch secrets outside 32–512 printable ASCII characters before admitting receipts. Whitespace and oversized secrets previously passed intake configuration but could not satisfy the Bearer parser; non-ASCII secrets can also be unrepresentable in HTTP headers. Randomness remains an operator responsibility.
- Run existing real-local-D1 and bundled-wrapper suites before deployment; add a separate read-only-permission, credentials-free Actions test workflow so commerce failures do not hide intake regression results.
- Add missing-environment, invalid-secret and production-binding destination regression cases, asserting no provider calls or unintended database writes.

These fixes do not activate production or create/send any mail. Review and merge remain separate from the external activation verification above.

## Completion follow-up

John requested completion after the initial draft review. The deployment-blocking SEO count is stale relative to commits `36c5633` and `d235b8b`: they added exactly four GI 275 price-display records, so there are now 199 records, with the original 195 audit rows intact. The regression now pins those four full identity/price/provenance records, preserves the 195-row audit and 521-product scope, and retains all negative identity/price and purchase-restriction checks. No catalog data or retail authorization changed. All existing scoped deployment regressions, lint and TypeScript checks passed locally. The intake suites already passed all 16 cases on Node 22 in [CI](https://github.com/rogerwilcoaviation/rwas-web/actions/runs/36700007420).

The production workflow now attempts a read-only Cloudflare configuration/schema audit after deployment using its existing credential. It reads Pages metadata and only `sqlite_master` schema metadata in the bound D1; it never prints variable values, database IDs, provider errors or customer rows. The output distinguishes binding presence, production/preview database sharing, variable metadata and exact migration-schema match. API denial remains unverified, not missing configuration or successful activation. No provider call, intake submission, dispatch or remote configuration write is made by this audit. A synthetic offline fixture verified the SELECT-only request and secret redaction.

The app confirmed Resend was connected on this follow-up. Provider account checks still require actual callable account tools and evidence; connection alone does not prove key/domain validity or delivery. The dispatcher remains separately owned and is never invoked by the configuration audit.

While completing this change, PR #35 merged as `dc09dc6`, including a stricter version of the same GI 275 correction and independent exact-SKU retail regressions. This branch incorporates that main commit, retains its SEO regression unchanged, and preserves both the Garmin CI job and intake CI/deployment gates. No concurrent catalog work was replaced.
