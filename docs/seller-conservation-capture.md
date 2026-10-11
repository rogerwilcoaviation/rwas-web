# Seller conservation capture

This source adds an account-administrator, digest-only read of the complete known seller business store and the entire bound `MEDIA` bucket. It is an undeployed engineering capability. Its presence in a candidate checkout does not establish a production baseline or authorize a release, a new acceptance run, an additional mutation group, or a change to the original 28 primary + 28 readback / 10 bounded primary-group contract.

## Authority and read-only boundary

The external route is `GET /api/aircraft-sale/admin/accounts/_conservation/capture`. The equivalent internal Worker path is `/admin/accounts/_conservation/capture`. Every request, including continuation and terminal verification, calls the existing `assertAccountOrigin(request, env, false)` and `accountAdministrator(request, false)`. The existing separate `seller-accounts` Access audience and account-administrator role apply; listing-reviewer authority and ordinary seller sessions do not grant access. The account origin must be configured already. Capture additionally requires HTTPS and, when supplied, an exact matching `Origin` and `Sec-Fetch-Site: same-origin` or `none`. No new binding, audience, environment value, or Access configuration is introduced.

Capture runs on the existing SellerStore fetch/alarm queue, but branches before normal `loadState`, success persistence, failure rollback/persistence, or audit work. It performs no durable `put`, SQL write/DDL, R2 `put`/`delete`, mail operation, or alarm scheduling. The old constructor initializer is deferred to the first ordinary `loadState`; an initial capture on a missing table fails without creating it. Ordinary requests and alarms retain their normal initializer and persistence paths. Authentication may perform its existing read-only provider verification; the capture's 20-second page-work budget starts after that verification.

Responses use the existing `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Success contains only scope labels, counts, byte lengths, timestamps, opaque cursors/IDs, and SHA-256 digests. Error responses contain sanitized condition codes, not provider messages or data. Deterministic opaque hashes are account-admin data, not public anonymization; protect the manifests and do not publish them as a public inventory.

## Complete scope and explicit exclusions

The durable target is the `SELLER_STORE` object selected by `idFromName('seller-v2')`, with the exact `seller_records(bucket TEXT, record_key TEXT, value TEXT)` layout. Each included row hashes canonical JSON `{bucket,key,value}` with every JSON field retained, including future additional business fields. No owner, status, listing reference, or caller-selected filter narrows enumeration.

| Included business namespace | Conserved content |
| --- | --- |
| `profiles` | Full profile/account business values |
| `identities` | Full identity/ownership mapping values |
| `listings` | Full listings in every status |
| `drafts` | Full saved/intake drafts |
| `files` | Full file catalogue and ownership metadata, including deleting entries |
| `idempotency` | Full business submission records |

The pinned schema explicitly excludes these mutable authentication, security, operation receipt, delivery, and audit namespaces: `identitySecurity`, `authTransactions`, `authEvents`, `auth0EventReceipts`, `securityOperations`, `accountAdminOperations`, `sessions`, `codes`, `mailRequests`, `mailSequences`, `rates`, `audit`, `outbox`. The returned manifest does not attest conservation of those values. Unknown persisted bucket names, unknown user tables/views, additional generated/hidden columns, nonempty separate Durable Object KV storage, missing SQL support, malformed rows, ambiguous stored JSON, and unsafe canonical values fail closed. Cloudflare's hidden `__cf_kv` table is permitted only with an independently empty KV-interface read.

The installed native runtime creates a differently named `_cf_KV` table after a synthetic KV write. That name is not the hidden table named in the [official SQLite storage documentation](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). Capture deliberately rejects it as `UNKNOWN_PERSISTED_SCHEMA`, even after its synthetic key is removed; it does not silently allow an unreviewed persisted namespace. Production needs an independently verified actual layout. A real `_cf_KV` layout requires a separate reviewed provider-layout/read-capability extension before complete capture; its absence cannot be assumed. The unit fixture separately verifies nonempty documented `__cf_kv` interface scope rejects as `UNEXPECTED_KV_STATE`.

`MEDIA` enumeration has no prefix, delimiter, listing filter, or status filter. It follows every R2 cursor until `truncated` is false and includes unreferenced/orphan objects, zero-byte objects, and objects associated with deleting files or deleted listings. Every persisted `files` reference must exist in that inventory; missing references fail rather than being suppressed. A logically deleted object whose bytes are already absent is a blocker when the catalogue still references it. This scope is the current bucket inventory, not R2 historical versions, removed bytes, Cloudflare Images, another bucket, or another backend.

The inventory binds each actual R2 key, version, etag, length, upload time, storage class, full supported HTTP metadata, and full custom metadata. Conditional GET checks the listed etag, then rechecks the full listed metadata/version. `crypto.DigestStream('SHA-256')` hashes the streamed body without retaining its contents, verifies the exact declared length, and a subsequent HEAD verifies the same metadata/version and provider checksums/SSE-C key digest. Raw keys, owner IDs, emails, values, metadata, checksums and bytes stay inside the authenticated Worker and are never returned. Unsupported HTTP metadata, invalid checksum lengths, missing stream hashing, and provider failures fail closed.

Root's actual guarded native fixture characterized R2 `storageClass` as the empty string, with valid version/etag/date/HTTP/custom metadata. Capture conserves that exact empty native marker, distinctly from documented `Standard`/`InfrequentAccess` values and the null marker for an absent property. It does not infer that an empty value means Standard or make any claim about production representation. Other storage-class values remain unsupported and fail closed.

The same native fixture reports `{offset: 0, length: object.size}` for complete GET and HEAD objects, including zero-byte objects. Capture permits only an absent range or that exact plain two-field, safe-integer full range. Null, partial, suffix, additional fields and malformed ranges fail; the body must still stream exactly the pinned number of bytes. Final metadata digests bind the exact complete GET `bodyRange` and HEAD `headRange` independently, with a null marker for an absent property. This preserves provider range representation without assuming optional GET/HEAD properties always have identical presence; it drops no byte, version, metadata or checksum checks.

## Protocol and canonical digests

Start with the exact route and no query. Continue with `?cursor=<nextCursor>` only; duplicate or other query keys are rejected. Cursors are random UUIDs, actor-bound, single-use, in-memory, expire ten minutes after start, and disappear on instance restart. Authorization is repeated on every page. A validated continuation consumes its cursor before work; delivery uncertainty or failure requires a fresh start. A different actor cannot consume another actor's valid cursor. Origin/authentication/request validation failures do not revoke another capture.

The sequence is `start` (sequence 0, empty arrays), zero or more `records` pages (at most 100 descriptors), zero or more `media` pages (one object), and a separate `complete` page. Even an empty store/bucket requires terminal verification. Every page has these exact fields:

```text
schema: 1
type: "RWAS_SELLER_CONSERVATION_PAGE"
captureId: UUID
schemaSha256: hex SHA-256 of canonical CONSERVATION_SCHEMA
endpointAlgorithmSha256: hex SHA-256 of algorithm domain + canonical schema
scope: { store: "seller-v2", includedBuckets: [six names],
         excludedBuckets: [thirteen names], media: "entire-MEDIA-binding",
         atomicAcrossStores: false }
stateRootSha256, inventoryRootSha256: hex SHA-256
recordCounts: { profiles, identities, listings, drafts, files, idempotency }
recordCount, mediaCount, mediaBytes: nonnegative integer totals
sequence: consecutive nonnegative integer
phase: "start" | "records" | "media" | "complete"
records: [{ bucket, objectId, fullFieldsSha256, fullFieldsBytes }]
media: [{ objectKey, bytesSha256, bytes,
          inventoryMetadataSha256, metadataSha256 }]
nextCursor: UUID | null
complete: boolean
observedAt: actual ISO timestamp
```

Only terminal has `complete: true` and `nextCursor: null`; its descriptor arrays are empty. Root/count/scope/identity fields remain identical on all pages. Consumers must reject missing, duplicate, extra, reordered, truncated or inconsistent descriptors/pages rather than infer completeness from an HTTP 200.

Canonical JSON sorts plain object keys, preserves array order, uses JSON string escaping and UTF-8, and rejects nonfinite numbers, negative zero, sparse/custom/accessor arrays, accessors/symbols, non-JSON objects and excessive depth. Stored SQL values must match the existing writer's unambiguous `JSON.stringify` representation. Opaque-ID keys reject NUL, excessive length and lone surrogates. Domain separators below contain actual NUL bytes:

- Record ID: `bucket + ':' + SHA256('seller-v2-record-key-v1\0' + bucket + '\0' + key)`.
- Full record digest: SHA256(canonical `{bucket,key,value}`); length is its UTF-8 byte length.
- State root: SHA256(canonical complete record-descriptor array sorted lexicographically by opaque `objectId`).
- Media ID: SHA256(`'seller-v2-media-key-v1\0' + key`).
- Inventory metadata digest: SHA256(canonical listed full R2 metadata).
- Inventory root: SHA256(canonical `[{objectKey,inventoryMetadataSha256}]` sorted lexicographically by opaque `objectKey`). A collector can independently recompute it from every returned media descriptor.
- Body digest: SHA256(actual complete streamed bytes).
- Final media metadata digest: SHA256(canonical listed R2 metadata plus actual GET checksum values, `ssecKeyMd5`, `bodyRange`, and `headRange`).
- Algorithm marker: SHA256(`'seller-conservation-algorithm-v1\0' + canonical CONSERVATION_SCHEMA`).

The schema and algorithm markers describe this protocol. They are self-reported and do not attest actual deployed source, binding identities, actor ownership, run authorization or trustworthy delivery. Independent source/build/deployment/resource pins and normal supported owner-tool delivery evidence remain required. The collector binds the existing nine run fields and run seal outside this endpoint; it must not treat invented browser-log IDs or pasted responses as actual tool invocation evidence.

For a final comparison, derive every original record/media opaque selector independently from the pinned complete before-capture. Enumerate the entire after scope first, then require every original selector and its full digest/length to remain equal. New QA rows/media are separately accounted for and cleaned; caller-supplied selectors cannot decide what was original. Empty inventories need independently verified actual resource scope, not an assumed empty baseline.

## Stability, limits and failure handling

The queued Worker business store is re-read and rehashed on each continuation; any included row/schema change fails capture. Each media object is checked against its initial version/metadata during GET and HEAD; the terminal page re-enumerates the entire bucket and requires the identical inventory root. This demonstrates observed stability across the reads. It is not an atomic transaction between SQLite and R2, a global no-writer promise, or proof that an unrelated writer did not change and restore data between observations. A writer outside this object's queue remains outside its isolation boundary.

| Hard bound | Value |
| --- | --- |
| Included records | 10,000 |
| Canonical record | 2 MiB |
| Complete canonical included state | 32 MiB |
| Records per output page | 100 |
| Whole-bucket objects | 10,000 |
| R2 inventory pages per pass | 100, with up to 1,000 objects per provider page |
| Full inventory metadata | 8 MiB, with at most 32 KiB per object |
| One media body | 512 MiB |
| Whole inventory declared bytes | 1 TiB |
| Concurrent in-memory captures | 4 |
| Capture lifetime | 10 minutes |
| Digest/inventory work per HTTP request | 20 seconds |

SQL count/serialized-value-length preflight fails oversized included state before materializing its row array. Streaming counts actual bytes and rejects short or long bodies. Work abort, elapsed budget, cursor loss, schema drift, duplicate inventory keys, cursor loops/missing cursors, metadata/version drift, or terminal changes cannot produce a complete result. A timed-out provider read may settle afterward; it initiates no write and cannot restore the consumed cursor. Larger real inventories require an explicitly reviewed capability/limit design and compatible acceptance-operation budget; this implementation does not silently extend policy.

## Prepared local verification

Root should execute from the isolated checkout using already installed dependencies, synthetic fixtures and its external-network/private-directory denial. No dependency install, source config, dotenv, credential or live resource is needed:

```sh
node --test --test-concurrency=1 tests/aircraft-sale/conservation.test.mjs tests/aircraft-sale/conservation-runtime.test.mjs
```

The unit suite exercises full-field and opaque digest oracles, public-output privacy, complete record/provider pagination, actor/expiry/cursor boundaries, reference coverage, streamed length/version/metadata failures, limits, cancellation, SQLite/KV/schema rejection, and actual SellerStore authorization/no-load/no-save/no-audit interception. The native case uses actual workerd SQLite `sqlite_schema`/`table_xinfo`, R2 list/GET/HEAD and `crypto.DigestStream`, with an independent Node byte-hash oracle and fictional account authority. It checks first-capture missing-schema/no-DDL, ordinary `/health` initialization, orphan/deleting/zero-byte coverage, unchanged durable rows/counters, terminal inventory drift, `sqliteExtra` wildcard-name regression, hidden KV and generated-column drift. Fixture write/probe endpoints exist only in the test's bundled subclass, never the product Worker. External outbound requests throw. Parent also runs the existing backend regressions for the startup initializer change. These tests have been authored, not executed by this implementation agent.

## Production and original legacy gates

1. Review and verify this capability and its account authority on the exact independently pinned seller resource. A new candidate-only endpoint cannot establish a preactivation baseline retroactively. A separately authorized preparation step must make an accepted read capability available before a fresh acceptance run's `startedAt`, with actual before-capture delivery/resource/source evidence. No release or preparation step is authorized by this source document.
2. Obtain a complete current seller baseline within the existing capture/operation budgets; missing/deleting references or unsupported real inventory bounds are concrete fail-closed conditions. Do not count the old two-listing Staff projection as full profiles/drafts/files/orphan-byte coverage.
3. Preserve a separate complete original legacy backend capture. Read-only owner UI metadata observed legacy `sale-api.rogerwilcoaviation.com` targeting Worker `rwas-aircraft-sale`, `SALEDATA` KV namespace `31f1484f5eb34f4a85feb819d7414308`, `SALEBUCKET` R2 bucket `rwas-aircraft-sale`, and an `IMAGES` binding whose source behavior has not been established. Current seller production uses a distinct seller Worker, `MEDIA` bucket and `SELLER_STORE` namespace. Metadata/source pins are not customer-record/media-byte conservation. This endpoint has no legacy binding and cannot capture legacy KV, R2, or Images; public IDs `mo3esi1e-t1lck` and `mnvmpdlz-ng1n0` and public continuity alone do not prove private original fields/bytes.
4. The legacy source/schema gap is an engineering investigation, not evidence that owner access is impossible. Cloudflare documents a normal authenticated [Worker source read](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/get/) and a [content-only source read](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/content/methods/get/). With existing authorized owner tooling, source-only export could pin actual code/version and identify every legacy KV/media namespace and its schema without reading customer records. Actual source export availability/source bytes have not been proved here. Do not extract tokens/cookies/credential files, invent schemas, add access, or use internal Cloudflare browser APIs. A separately approved complete digest-only legacy capture still needs actual rows/bytes/metadata and authoritative whole-scope enumeration.
5. Pages' separate `INTAKE_RECEIPTS` D1 is outside seller route/state/media scope. The known service-intake receipt integration does not make it a seller conservation backend; inspect exact authorized action writes before including or explicitly excluding it in the independently pinned capture plan. This source makes no machine-wide no-write claim.

The frozen receipt schema, original counts, action-group budgets, supplemental-action authority, baseline ownership and actual authenticated owner-tool evidence remain separate gates. Binding separation plus continuity can inform a prospective proposal, but cannot silently replace the original private-field/media equality predicate or be reported as a completed original conservation capture.
