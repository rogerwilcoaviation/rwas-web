// Strict offline evidence validation only. No importer, provider call or network access.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, link, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { planLegacy } from './seller-legacy-plan.mjs';
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const checksum = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
const hash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value) =>
  typeof value === 'string' && value.trim().length >= 3 && value.length <= 1000;
export function migrationDryRun(bundle) {
  if (
    !bundle ||
    !Array.isArray(bundle.listings) ||
    !Array.isArray(bundle.ownership) ||
    !Array.isArray(bundle.objects)
  )
    throw Error(
      'Expected listings, independent ownership ledger and complete object manifest.',
    );
  const source = bundle.source;
  if (
    !source ||
    !['accountId', 'workerName', 'versionId', 'snapshotRef'].every((key) =>
      text(source[key]),
    ) ||
    !hash(source.sourceSha256) ||
    !Number.isSafeInteger(source.exportedAt) ||
    source.exportedAt <= 0 ||
    source.exportedAt > Date.now()
  )
    throw Error('Verified source/version/snapshot metadata required.');
  if (
    source.listingsSha256 !== checksum(bundle.listings) ||
    source.objectsSha256 !== checksum(bundle.objects)
  )
    throw Error('Snapshot checksum mismatch.');
  const plan = planLegacy(bundle.listings);
  const ledger = new Map();
  for (const owner of bundle.ownership) {
    if (
      !owner ||
      ledger.has(owner.listingId) ||
      !text(owner.verifiedBy) ||
      !text(owner.evidenceRef) ||
      !Number.isSafeInteger(owner.verifiedAt) ||
      owner.verifiedAt <= 0 ||
      owner.verifiedAt > Date.now()
    )
      throw Error('Invalid or duplicate ownership attestation.');
    ledger.set(owner.listingId, owner);
  }
  if (ledger.size !== plan.listingCount)
    throw Error('Ownership ledger must exactly cover the listing snapshot.');
  for (const listing of plan.listings) {
    const owner = ledger.get(listing.id);
    if (!owner || owner.ownerEmail?.trim().toLowerCase() !== listing.ownerEmail)
      throw Error('Owner mismatch for ' + listing.id);
  }
  const manifest = new Map();
  for (const object of bundle.objects) {
    if (
      !object ||
      typeof object.key !== 'string' ||
      !object.key ||
      manifest.has(object.key) ||
      !Number.isSafeInteger(object.size) ||
      object.size <= 0 ||
      !hash(object.sha256) ||
      typeof object.contentType !== 'string'
    )
      throw Error('Invalid or duplicate object manifest entry.');
    manifest.set(object.key, object);
  }
  const files = plan.files.map((file) => {
    const object = manifest.get(file.sourceKey);
    if (!object) throw Error('Missing object: ' + file.sourceKey);
    const types =
      file.category === 'photos'
        ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        : file.category === 'videos'
          ? ['video/mp4', 'video/webm']
          : ['application/pdf'];
    if (object.size > 50 * 1024 * 1024 || !types.includes(object.contentType))
      throw Error('Unsupported object metadata: ' + file.sourceKey);
    return {
      ...file,
      size: object.size,
      sha256: object.sha256,
      contentType: object.contentType,
    };
  });
  const referenced = new Set(files.map((file) => file.sourceKey));
  const counts = new Map();
  for (const file of files) {
    const key = file.listingId + ':' + file.category;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (counts.get(key) > 40)
      throw Error('Category exceeds destination file limit: ' + key);
  }
  return {
    ...plan,
    mode: 'OFFLINE VALIDATED DRY RUN — NOT IMPORTED',
    source: Object.fromEntries(
      [
        'accountId',
        'workerName',
        'versionId',
        'snapshotRef',
        'sourceSha256',
        'exportedAt',
        'listingsSha256',
        'objectsSha256',
      ].map((key) => [key, source[key]]),
    ),
    ownership: plan.listings.map((listing) => {
      const owner = ledger.get(listing.id);
      return {
        listingId: listing.id,
        ownerEmail: listing.ownerEmail,
        verifiedBy: owner.verifiedBy,
        evidenceRef: owner.evidenceRef,
        verifiedAt: owner.verifiedAt,
      };
    }),
    files,
    bytesToCopy: files.reduce((sum, file) => sum + file.size, 0),
    quarantine: bundle.objects
      .filter((object) => !referenced.has(object.key))
      .map((object) => ({
        sourceKey: object.key,
        reason:
          'Unreferenced source object; exclude from import, retain in private backup for operator review.',
      })),
    validationLimits: [
      'Ownership ledger is an operator attestation, not automatic identity proof.',
      'Manifest checksums describe exported evidence; actual copied bytes and file signatures require verification.',
      'No storage import, account enrollment, object copy, deletion or publication is performed.',
    ],
  };
}
// Atomic exclusive output: an interrupted or repeated invocation never replaces a reviewed artifact.
export async function writeDryRun(input, output) {
  const result = migrationDryRun(JSON.parse(await readFile(input, 'utf8')));
  const temporary = output + '.tmp-' + randomUUID();
  try {
    await writeFile(temporary, JSON.stringify(result, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    await link(temporary, output);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      'Usage: node scripts/seller-legacy-dry-run.mjs EVIDENCE.json NEW_PLAN.json (offline only)',
    );
  await writeDryRun(input, output);
  console.log(
    'Validated offline dry run written. No import or deployment performed.',
  );
}
