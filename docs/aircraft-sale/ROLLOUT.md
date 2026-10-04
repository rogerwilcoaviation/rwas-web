# Seller rollout, recovery and rollback runbook

This runbook is preparatory. User release/publication approval is already recorded; the remaining blockers are verified resource/configuration/data facts and secure owner actions. No command here authorizes new credentials, purchases, grants or customer data edits. Templates have deliberate placeholders and `.example` extensions. None is production configuration. Warranty remains draft-only.

## 1. Freeze the release packet and identify resources

Record exact PR/head, seller Worker bundle SHA256, Pages artifact SHA256, deployed source/version, Cloudflare account, Worker/service names/routes, SQLite namespace/migration tags, private R2 buckets, existing mail adapter/sender and staff/security operator identity policies. Separate staging resources from production. Export nonsecret setting/binding metadata only. Do not dump secrets or request them in chat. Current release is draft PR36 published head `9a899195`; local follow-ups must be included and verified before selecting a cutover head.

The available credential could not read the deployed sale Worker. An already authorized operator must supply source/version/export and execute resource operations through their authorized path. Do not retry denied access or expand grants to get around that failure. The unversioned local legacy source is not proof of deployed source.

Confirm whether RWAS already has a managed identity tenant and owned Google/Apple registrations. Reuse those if supplied; adapt the Auth0 reference if another provider is chosen. The setup and secret boundaries are in [MANAGED-LOGIN.md](MANAGED-LOGIN.md).

## 2. Prepare isolated staging

Review copies of the four [environment templates](environments/worker.staging.toml.example). Fill real account/resource names only after verifying them; preserve existing Pages intake/CSP/D1 settings. Private MEDIA means no public bucket/custom-domain bypass. Configure SELLER_STORE SQLite plus its first-release migration, approved mail/reviewer bindings and Pages SELLER_API.

Staging requests must match `STAGING_ORIGIN` exactly with `INTAKE_STAGING_MODE=true`; current source permits only `https://intake-restoration-20260922.rwas-web.pages.dev`. Verify ownership/isolation of that shared intake environment, or prepare a reviewed source/test change for a dedicated seller host. Branch preview hosts currently fail503 by design. Do not remove the guard to make an arbitrary preview work. Confirm noindex/robots protection and that API/file/detail routes use the staging Worker and bucket, never the legacy production API.

Have the owner configure identity secrets and registrations directly. Protect `/api/aircraft-sale/ops/security/*` with a distinct security-operator audience/allowlist or trusted OPERATOR_AUTH. Regular listing reviewers must not gain recovery authority. Access authorization requires an explicit verified `auth_time` within ten minutes, not a recent `iat`; if the deployed Access token lacks that claim, use a trusted adapter that verifies fresh human reauthentication. Its response contract is `{actor,scope:"seller-security",authenticatedAt:<Unix milliseconds>}`. Returning a current timestamp without verifying reauthentication violates the contract. Confirm MFA/reauthentication in the approved policy/service; no policies or memberships are provisioned by this code.

## 3. Local validation and migration evidence

Using the selected Node22 runtime, run:

```sh
node --test tests/aircraft-sale/*.test.mjs tests/intake/*.test.mjs
node tests/aircraft-sale/full-shell.mjs
node tests/aircraft-sale/identity-browser.mjs
```

Browser commands require the built `out` export and Playwright. They use only disposable state, intercepted identity pages and fake mail/review/operator services. These checks are not live provider acceptance.

Have the authorized source operator take a consistent current snapshot with an identified write boundary: deployed source/version/hash, raw listing export, complete paginated object manifest (key, byte size, content type, SHA256), independently verified listing ownership ledger and private backups. Reconcile changes after the snapshot or freeze legacy writes during final export. Store exports/backups with restrictive access outside Git; never include secrets, passwords, OTPs or session dumps in the release packet.

The strict offline bundle has this shape:

```json
{
  "source": {
    "accountId": "VERIFIED_ACCOUNT",
    "workerName": "VERIFIED_WORKER",
    "versionId": "VERIFIED_VERSION",
    "snapshotRef": "PRIVATE_BACKUP_REFERENCE",
    "sourceSha256": "64-lowercase-hex-characters",
    "exportedAt": 1,
    "listingsSha256": "checksum-of-canonical-listing-array",
    "objectsSha256": "checksum-of-canonical-object-array"
  },
  "listings": [],
  "ownership": [
    {
      "listingId": "ID",
      "ownerEmail": "owner@example.test",
      "verifiedBy": "OPERATOR",
      "evidenceRef": "VERIFIED_OWNERSHIP_CASE",
      "verifiedAt": 1
    }
  ],
  "objects": [
    {
      "key": "listings/ID/photos/FILE.png",
      "size": 12,
      "contentType": "image/png",
      "sha256": "64-lowercase-hex-characters"
    }
  ]
}
```

The example is illustrative and intentionally not a valid real snapshot. `checksum(value)` exported from `scripts/seller-legacy-dry-run.mjs` sorts object keys recursively and hashes canonical JSON; array order remains significant. Record raw export/source checksums separately as well. Operator attestations and supplied manifests are evidence to review, not automatic proof of ownership or actual object bytes.

```sh
node scripts/seller-legacy-dry-run.mjs EVIDENCE.json NEW_REVIEW_PLAN.json
```

This validates only and writes an exclusive mode0600 artifact. Failure or retry cannot overwrite an existing reviewed plan. It refuses checksum/owner mismatches, duplicate IDs/objects, missing files, malformed categories/fields, destination year/price/N-number/length violations, traversal/cross-category keys and destination size/type/count violations. Unreferenced objects are quarantined for private review rather than copied or deleted. API and planner share the same field validator; trimming, numeric conversion and N-number case normalization are identified in the plan. All listings become drafts. No production importer or storage copy adapter is implemented; the synthetic-only resumable framework is described below. Legacy key layouts/document types that do not match destination rules require an explicitly reviewed transformation and provenance mapping, not silent relaxation.

The [resumable migration framework](MIGRATION.md) now implements those checks against synthetic filesystem-backed fixtures: explicit source-format/owner/listing mappings, actual backup/source/destination bytes, private conditional copies, atomic draft/receipt commits, durable checkpoints and final count/hash reconciliation. CLI remains dry-run only; no production adapter or verified deployed-source decoder exists. The [exact owner handoff](OWNER-HANDOFF.md) requests the missing evidence without another blanket approval or a denied-read retry through another principal.

Before implementing/applying the real adapter against the verified schema, prove the durable exclusive lease includes every writer and that append-only import receipts survive ordinary purge/cleanup/restore. Inject interruption before/after copy and commit, restart with the same mapping, and prove no duplicated ownership or lost objects on the actual isolated destination. The synthetic framework tests do not establish those deployed guarantees or import acceptance. Never interpret a dry-run artifact as permission or proof of import success.

## 4. Real-provider staging acceptance

Owner operates the real password/MFA/consent screens with dedicated noncustomer seller/mailbox and staff/operator staging identities. Agent must not enter/reset passwords or create persistent credentials. Verify signup and email verification; incorrect/correct password; recovery and old-password rejection; Google/Apple consent/cancel/private relay; missing-state/proof; explicit linking preserves existing listings; account email/profile changes; logout/all-session revocation; blocking and all-email/social fallback; staff revision/media review; full draft→review→active→pause/sold/archive/trash/restore/purge lifecycle and stale public URL disappearance. Record environment/head and redacted results, not tokens/codes or customer records.

Verify actual password-reset/block event delivery, duplicate/out-of-order events, provider/Worker outage and reconciliation. A lost hook can leave existing app sessions until expiry, so delivery monitoring, an owner response procedure and reconciliation are required before release. Test fresh operator authorization and both independent/linked identity holds.

## 5. Audited missed-event reconciliation and unblock

Only a separately authorized security operator may call these endpoints through the protected exact site origin. Browser claims, seller sessions, shared event secret and ordinary review access cannot clear blocks. The operator verifies the provider's current state using their already authorized administrative path and records a case/export reference; the app records that attestation, not an automatic provider lookup.

Prepare an operation with unique stable `id`, `kind` (`password-reset`, `account-blocked` or `account-unblocked`), exact provider `subject`, actual source `occurredAt` in Unix milliseconds, meaningful `reason`, and nonsecret `evidenceRef`. Historical events are accepted only on this operator path. Unblock requires a current block and a verified provider unblock time not preceding the latest block. Independent profile holds remain effective; unblocking one identity does not clear another linked identity's block.

1. POST operation JSON to `/api/aircraft-sale/ops/security/preview`. Inspect affected profile, sessionsToRevoke and otherBlockedSubjects. Preserve the returned confirmation digest in the operator case.
2. POST the same operation plus its `confirmation` to `/api/aircraft-sale/ops/security/apply`. Changes between preview/apply cause409; obtain a new preview and inspect it. Missing/stale authentication fails403; missing configuration fails503. No manual database edits are needed.
3. A successful apply commits a durable audit and receipt with trusted actor, operation/evidence/reason, affected revocation counts and timestamp. It revokes all profile sessions, fences in-flight logins and requires fresh sign-in after unblock. It does not resurrect old sessions, publish aircraft or change provider account state. Persist the receipt in the operator case.
4. If the response is lost or saving fails503, retry the exact ID/body after the outage. Already committed operations return `replayed:true` without revoking newly issued sessions again. Reusing an ID with changed input or actor fails409. Retrieve the persisted receipt with POST `{ "id":"OPERATION_ID" }` to `/ops/security/receipt` under the same protected API prefix.
5. Pre-unblock delayed provider events at/before the verified unblock time are recorded as already reconciled. A genuinely newer block still disables the account. Do not fabricate timestamps to suppress later events. An independently disabled profile is preserved and requires its separate authorized hold-resolution process.

The audit is durable application evidence, not a tamper-proof external ledger. Export receipts to the owner's approved incident/audit system; this change sends no external notifications. Failed authorization does not reveal profile data.

## 6. Production cutover order

Select the exact validated release head and reviewed configuration. Confirm approved source ownership, backups, mappings/import implementation, private buckets, provider/event/reviewer/operator policies and rollback packet. Existing general release approval remains valid; resolve concrete scope for any new credentials/grants/security-policy changes, purchases or destructive customer-data actions before executing them.

Authorized operator establishes the final write boundary/export, applies the reviewed resumable import/copy into the new backend, verifies counts/actual bytes/ownership/private records, and retires legacy writes/sessions and public record URLs. Purge relevant old CDN caches; cached/downloaded files cannot be made private merely by changing code. Keep migrated listings draft until exact content/media review—do not publish all legacy records automatically.

Deploy the compatible backend and bindings first. Confirm health, fail-closed anonymous/private access and staging-origin separation. Only then merge PR36's chosen head: main automatically deploys Pages. GitHub's repair-branch fence does not control Cloudflare native previews. Verify no accidental preview→production bindings. Production smoke is read-only except already concretely authorized dedicated acceptance operations; preserve warranty draft-only.

## 7. Rollback and recovery

Trigger rollback for ownership/privacy failure, bypassed review, missing data, failed revocation/event processing, severe errors or unreconciled copies. Stop new seller writes/publication and make affected inventory fail closed. Capture versions, operation receipts and a fresh private snapshot of post-cutover changes before reverting. Do not delete the new namespace/bucket or reopen insecure legacy routes/public records.

Restore the last verified compatible safe Worker/Pages pair and binding configuration. The legacy insecure service is not an acceptable public fallback; use maintenance503 if there is no prior safe pair. Do not mix old Pages with an incompatible backend. Restore/copy data from verified private backups only after reconciling post-snapshot writes and security events. Reapply password-reset/block/unblock decisions and revocation fences newer than the restored snapshot through the audited operator path before reopening auth traffic; otherwise a snapshot restore could resurrect revoked access. Use a fresh operation ID for a restore incident, retaining original evidence; never clear blocks based on old/browser tokens.

Reconcile listing/profile/object counts, hashes, private media and exact revision publication, event backlog, session revocation and failure retries. Unfreeze traffic only after these checks pass and the incident operator records the chosen safe state. Keep backups/quarantined objects private under an owner-approved retention policy; cleanup is a separate concrete operation, not part of an automatic rollback.
