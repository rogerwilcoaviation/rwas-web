# Website Jerry provider assessment — October 24, 2026

**Superseded as a delivery plan:** John subsequently required subscription OAuth and rejected direct API use. Direct-provider work is stopped, with interrupted edits preserved but uncommitted. See the [read-only OAuth/relay assessment](jerry-oauth-assessment-20261024.md). The evidence below is the earlier direct-candidate snapshot, not a request to create/configure an API project or key.

This is a read-only assessment for the gated local candidate, not provider or deployment approval. No API credential was obtained, no new access was acquired, and no live model received a customer message or private website data. Synthetic tests intercept all provider requests. The existing running Jerry relay was not edited or reused.

## What the candidate enforces

The separate response Worker accepts native service-binding RPC only; its public HTTP handler returns 404. It has no seller/business bindings, tools, OpenClaw session, operational access or fallback. Both ordinary chat and deterministic-text translation require an explicit `OPENAI_PROJECT_ID`, direct `JERRY_MODEL` ID, `JERRY_PROMPT_CACHE_RETENTION` (`in_memory` or `24h`) and a separately authorized `OPENAI_API_KEY` binding. None is configured in the candidate manifest. Provider requests use the fixed global Responses API endpoint, `OpenAI-Project`, `store: false`, a 30-second abort signal and a 2,400-token output limit. Redirects are returned without following and rejected. Admission metadata is stripped before the provider request.

Only the trusted seller service derives purpose-separated HMAC admission labels using its existing identity secret. Raw edge addresses, account IDs, email addresses, cookies and credentials are not admission-ledger fields. The ledger retains no prompt or reply. This does not prevent a person from typing identifying information in a message; approved provider processing must cover chat text, bounded history, public references and translated account/workflow text.

## Official documentation findings

`store: false` controls stored Response objects; it does not establish Zero Data Retention. Standard abuse monitoring may retain customer content for up to 30 days, with stated exceptions. Modified Abuse Monitoring and Zero Data Retention require approval, and project settings may inherit or override organization settings. The actual project's regime has not been established. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Prompt-cache options and defaults depend on the model and project regime. Compatibility must be established for the chosen model; the candidate requires an explicit policy rather than relying on a default. [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

`OpenAI-Project` selects a project. A legacy relay alias or a ChatGPT login does not establish the direct API model, project access or data settings for this new service. [OpenAI API overview](https://developers.openai.com/api/reference/overview).

Rate limits depend on the organization, project and model. The candidate's conservative admission limits are application controls, not proof of API entitlement, throughput or a hard spend cap. [OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits).

## Permitted configuration evidence

At **2026-10-24 17:53:47 UTC (1:53:47 p.m. EDT)**, read-only Cloudflare settings metadata for `rwas-seller-production-20261006` showed the existing `BETTER_AUTH_SECRET` secret binding, `SELLER_STORE`, `SELLER_AUTH_DB` and `MEDIA`. The secret's value was not read or printed. `JERRY_CONVERSATIONS_ENABLED`, `JERRY_RESPONSE` and the new conversation/admission bindings were absent. Absence of the feature flag means this path is disabled. No settings were changed.

The older intake service exposed legacy model and relay-token binding names. Those do not establish a project/model/credential for the direct response candidate. No read access to an OpenAI project's actual data-control or capacity settings was established. These observations are timestamped evidence, not a claim that live settings cannot subsequently change.

## Exact remaining release inputs

1. An approved direct API project ID and model ID, with evidence of model access. The existing relay's `openai/...` alias is not a substitute.
2. Project-owner evidence of the actual retention regime, inherited settings, cache compatibility and any required data residency. The candidate uses the global endpoint; a regional endpoint would need a separate source/configuration review.
3. An explicit model-compatible cache choice. `store: false` alone does not resolve this decision.
4. Separate authorization to provision the credential binding. The current authorization expressly excludes obtaining keys or expanding access.
5. API rate/spend settings and an approved traffic/cost envelope before changing the conservative local admission limits.
6. Separately authorized isolated hosted qualification of automatic alarm delivery, actual provider responses, answer quality, latency and error behavior, followed by complete production configuration comparison and an approved release/readback.

The already approved 90-day application retention, conversation deletion and affirmative guest-import behavior remain unchanged. This work confers no automatic account approval, listing publication or internal operational authority.
