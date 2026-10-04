# Offline inventory completeness preflight

Run `node scripts/seller-inventory-preflight.mjs OWNER_INVENTORY.json NEW_REPORT.json` on an owner-supplied, reviewed normalized inventory. This tool does not obtain/export/decode the legacy source, read Cloudflare, import, publish or delete. It has no network client or apply option. It writes a new exclusive mode-0600 report and refuses to overwrite it. No real inventory was supplied or processed during implementation.

## Packet contract

Every field listed below is required; unknown fields are rejected, including credential/session fields. The format is a reviewed inventory summary, not an assumed deployed legacy schema. An exporter must explicitly reconcile all source namespaces and preserve mapping/provenance through the legitimate owner process.

| Field        | Contract                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `version`    | `1`                                                                                                                                  |
| `source`     | `accountId`, `workerName`, `versionId`, `storeRef`, `bucketRef`, `snapshotRef`, `snapshotAt` (Unix milliseconds), `writeBoundaryRef` |
| `review`     | Independent `verifiedBy`, `evidenceRef`, `verifiedAt`, at/after snapshot and not future                                              |
| `datasets`   | Exactly `profiles`, `listings`, `savedDrafts`, `objects`                                                                             |
| Each dataset | `expectedTotal`, `sha256`, nonempty `pages` array                                                                                    |
| Each page    | `cursor`, `nextCursor`, `rows`                                                                                                       |

Pagination starts with `cursor:null`; each next page's cursor must equal the prior `nextCursor`; the final `nextCursor` is null. Missing/repeated/looping cursors, duplicate records, false totals and mismatched hashes halt. An empty dataset still needs one complete empty page and an independently checked zero count/hash. Row schemas:

| Dataset       | Row fields                             |
| ------------- | -------------------------------------- |
| `profiles`    | `id`                                   |
| `listings`    | `id`, `ownerId`, `status`              |
| `savedDrafts` | `id`, `ownerId`                        |
| `objects`     | `key`, `size`, `sha256`, `contentType` |

Normalized record IDs are 1–128 alphanumeric/underscore/hyphen characters, excluding prototype keys. Listing/draft owners must exist in `profiles`. Statuses cover draft/pending/active/paused/sold/archived/deleted/rejected/unknown; no record state is silently excluded. Object keys disallow traversal/encoding/control ambiguity. Sizes are nonnegative safe integers, including zero-byte orphan objects.

Dataset SHA256 uses `checksum()` from `seller-legacy-dry-run.mjs` over all rows sorted by ID (objects by key) using JavaScript string/code-unit order. The canonicalizer sorts object-property names while preserving that row order. Hashes attest to the supplied inventory, not exporter completeness or actual file bytes. The existing migration engine separately checks byte/signature/backup integrity.

Only zero profiles, listings, saved drafts and objects produces `clean-cutover-candidate` / `needsPrivateExport:false`. Any retained item produces `preservation-required` / `needsPrivateExport:true`, including profiles without listings and zero-byte files. The report includes counts/status totals/byte totals/source-review references and a packet digest, without copying private row IDs/object keys. **Every report still says OWNER VERIFICATION REQUIRED.** Self-consistent empty JSON is not proof that the live store is empty, nor authorization to deploy.

## Remaining real-data gate

An authorized owner must verify actual source/resource/version and complete snapshot namespaces/write boundary. The denied legacy source/version read must not be retried or rerouted. Proven empty inventory can avoid data import; existing source identities/access routes still need an approved cutover. Any data requires private export, independent ownership, complete file bytes/manifests/checksums, backups and reviewed real decoder/storage adapters. See [MIGRATION.md](MIGRATION.md). The new preflight does not relax the migration engine's synthetic-only apply boundary.
