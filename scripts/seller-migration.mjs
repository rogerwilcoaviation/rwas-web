// Validated migration framework. CLI is offline/dry-run only; apply accepts synthetic adapters only.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, open, rename, unlink, link } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checksum, migrationDryRun } from './seller-legacy-dry-run.mjs';
import { listingFields } from '../workers/aircraft-sale/listing-fields.mjs';

const error = (message) => {
  throw Error(message);
};
const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys, name) => {
  if (!plain(x) || Object.keys(x).some((k) => !keys.includes(k)))
    error('Invalid ' + name + ' schema.');
};
const text = (x) =>
  typeof x === 'string' &&
  x.trim().length >= 3 &&
  x.length <= 1000 &&
  !/[\u0000-\u001f]/.test(x);
const id = (x) =>
  typeof x === 'string' &&
  /^[a-zA-Z0-9_-]{1,128}$/.test(x) &&
  !['__proto__', 'constructor', 'prototype'].includes(x);
const uuid = (x) =>
  typeof x === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const key = (x) =>
  typeof x === 'string' &&
  x.length > 0 &&
  x.length <= 1024 &&
  !/[\\%\u0000-\u001f]/.test(x) &&
  x.split('/').every((p) => p && p !== '.' && p !== '..');
const hash = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const attested = (x) =>
  text(x?.verifiedBy) &&
  text(x?.evidenceRef) &&
  Number.isSafeInteger(x?.verifiedAt) &&
  x.verifiedAt > 0 &&
  x.verifiedAt <= Date.now();
const sorted = (items, field) =>
  [...items].sort((a, b) => a[field].localeCompare(b[field]));
const totals = (snapshot) => ({
  listings: snapshot.listings.length,
  objects: snapshot.objects.length,
  bytes: snapshot.objects.reduce((n, o) => n + o.size, 0),
});
function snapshot(value) {
  exact(value, ['listings', 'objects'], 'snapshot');
  if (!Array.isArray(value.listings) || !Array.isArray(value.objects))
    error('Complete listing/object snapshot required.');
  const ids = new Set(),
    keys = new Set();
  for (const l of value.listings) {
    if (!plain(l) || !id(l.id) || ids.has(l.id))
      error('Invalid snapshot listing identity.');
    ids.add(l.id);
  }
  for (const o of value.objects) {
    if (
      !plain(o) ||
      !key(o.key) ||
      keys.has(o.key) ||
      !Number.isSafeInteger(o.size) ||
      o.size <= 0 ||
      !hash(o.sha256) ||
      !text(o.contentType)
    )
      error('Invalid snapshot object metadata.');
    keys.add(o.key);
  }
  if (!Number.isSafeInteger(totals(value).bytes))
    error('Snapshot byte count overflow.');
  return value;
}
function backupProof(proof, expected) {
  exact(
    proof,
    [
      'ref',
      'verifiedBy',
      'evidenceRef',
      'verifiedAt',
      'listingsSha256',
      'objectsSha256',
      'counts',
    ],
    'backup proof',
  );
  if (
    !text(proof.ref) ||
    !attested(proof) ||
    proof.listingsSha256 !== checksum(expected.listings) ||
    proof.objectsSha256 !== checksum(expected.objects) ||
    checksum(proof.counts) !== checksum(totals(expected))
  )
    error('Missing or mismatched verified backup/count/hash evidence.');
}

export function prepareMigration(bundle, inputs) {
  exact(
    bundle,
    ['source', 'listings', 'ownership', 'objects'],
    'evidence bundle',
  );
  exact(
    bundle.source,
    [
      'accountId',
      'workerName',
      'versionId',
      'snapshotRef',
      'sourceSha256',
      'exportedAt',
      'listingsSha256',
      'objectsSha256',
    ],
    'source evidence',
  );
  const plan = migrationDryRun(bundle);
  for (const owner of bundle.ownership)
    exact(
      owner,
      ['listingId', 'ownerEmail', 'verifiedBy', 'evidenceRef', 'verifiedAt'],
      'ownership ledger',
    );
  // This is an explicitly reviewed normalized contract, not a guessed deployed legacy decoder.
  for (const l of bundle.listings) {
    if (typeof l.sellerEmail !== 'string' || l.sellerEmail.length > 254)
      error(
        'Destination-compatible owner email required; no implicit identity coercion.',
      );
    exact(
      l,
      [
        'id',
        'sellerEmail',
        'status',
        'photos',
        'videos',
        'logbooks',
        ...listingFields,
      ],
      'normalized source listing',
    );
    if (!['draft', 'pending', 'active', 'paused', 'sold'].includes(l.status))
      error(
        'Source state requires a reviewed exclusion/transform; archived/deleted records cannot be resurrected implicitly.',
      );
    const media = [
      ...(l.photos || []),
      ...(l.videos || []),
      ...Object.values(l.logbooks || {}).flat(),
    ];
    for (const f of media) exact(f, ['key'], 'normalized media association');
  }
  for (const o of bundle.objects)
    exact(
      o,
      ['key', 'size', 'sha256', 'contentType'],
      'normalized source object',
    );
  snapshot({ listings: bundle.listings, objects: bundle.objects });
  exact(
    inputs,
    [
      'version',
      'migrationId',
      'review',
      'destination',
      'ownerMap',
      'listingMap',
      'backups',
      'destinationBaseline',
      'writeBoundary',
    ],
    'migration inputs',
  );
  if (inputs.version !== 1 || !id(inputs.migrationId))
    error('Reviewed migration version/ID required.');
  exact(
    inputs.review,
    ['sourceFormat', 'sourceSha256', 'verifiedBy', 'evidenceRef', 'verifiedAt'],
    'source format review',
  );
  if (
    inputs.review.sourceFormat !== 'normalized-listings-v2' ||
    inputs.review.sourceSha256 !== plan.source.sourceSha256 ||
    !attested(inputs.review)
  )
    error('Verified deployed-source format review required.');
  exact(
    inputs.destination,
    [
      'accountId',
      'storeId',
      'bucketName',
      'private',
      'isolated',
      'receiptRetention',
    ],
    'destination',
  );
  const destination = inputs.destination;
  if (
    !['accountId', 'storeId', 'bucketName'].every((k) =>
      text(destination[k]),
    ) ||
    destination.private !== true ||
    destination.isolated !== true ||
    destination.receiptRetention !== 'append-only'
  )
    error(
      'Verified isolated private destination with append-only receipts required.',
    );
  exact(
    inputs.writeBoundary,
    ['ref', 'verifiedBy', 'evidenceRef', 'verifiedAt'],
    'write boundary',
  );
  if (!text(inputs.writeBoundary.ref) || !attested(inputs.writeBoundary))
    error('Verified write boundary required.');
  const baseline = snapshot(inputs.destinationBaseline);
  exact(inputs.backups, ['source', 'destination'], 'backups');
  backupProof(inputs.backups.source, {
    listings: bundle.listings,
    objects: bundle.objects,
  });
  backupProof(inputs.backups.destination, baseline);
  if (inputs.backups.source.ref === inputs.backups.destination.ref)
    error('Distinct source/destination backup references required.');
  if (!Array.isArray(inputs.ownerMap) || !Array.isArray(inputs.listingMap))
    error('Explicit verified owner/listing mappings required.');
  const owners = new Map(),
    ownerIds = new Set(),
    listings = new Map(),
    listingIds = new Set();
  for (const o of inputs.ownerMap) {
    exact(
      o,
      ['ownerEmail', 'ownerId', 'verifiedBy', 'evidenceRef', 'verifiedAt'],
      'owner mapping',
    );
    if (
      !attested(o) ||
      typeof o.ownerEmail !== 'string' ||
      o.ownerEmail !== o.ownerEmail.trim().toLowerCase() ||
      !Object.hasOwn(plan.owners, o.ownerEmail) ||
      !uuid(o.ownerId) ||
      owners.has(o.ownerEmail) ||
      ownerIds.has(o.ownerId)
    )
      error('Missing or ambiguous independently verified owner mapping.');
    owners.set(o.ownerEmail, o.ownerId);
    ownerIds.add(o.ownerId);
  }
  if (owners.size !== Object.keys(plan.owners).length)
    error('Owner mappings must exactly cover the source.');
  for (const l of inputs.listingMap) {
    exact(l, ['sourceId', 'destinationId'], 'listing mapping');
    if (
      !plan.listings.some((p) => p.id === l.sourceId) ||
      !uuid(l.destinationId) ||
      listings.has(l.sourceId) ||
      listingIds.has(l.destinationId) ||
      baseline.listings.some((b) => b.id === l.destinationId)
    )
      error('Ambiguous destination listing mapping or baseline collision.');
    listings.set(l.sourceId, l.destinationId);
    listingIds.add(l.destinationId);
  }
  if (listings.size !== plan.listingCount)
    error('Listing mappings must exactly cover the source.');
  const digest = checksum({ plan, inputs });
  const files = plan.files.map((f) => {
    const listingId = listings.get(f.listingId),
      ownerId = owners.get(f.ownerEmail);
    const name = f.sourceKey.split('/').pop();
    const extension = name.split('.').pop().toLowerCase();
    const extensions = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'video/mp4': ['mp4'],
      'video/webm': ['webm'],
      'application/pdf': ['pdf'],
    };
    if (
      name.length > 200 ||
      !/^[a-zA-Z0-9._-]+$/.test(name) ||
      !extensions[f.contentType]?.includes(extension)
    )
      error('Reviewed source filename/type transform required.');
    const destinationKey = `listings/${listingId}/${f.category}/migration-${checksum(f.sourceKey)}.${extension}`;
    if (baseline.objects.some((o) => o.key === destinationKey))
      error('Destination object collides with baseline.');
    const metadata = {
      key: destinationKey,
      size: f.size,
      sha256: f.sha256,
      contentType: f.contentType,
      listingId,
      ownerId,
      category: f.category,
      migration: {
        id: inputs.migrationId,
        digest,
        sourceKeySha256: checksum(f.sourceKey),
      },
    };
    return { ...f, name, destinationKey, metadata };
  });
  const drafts = plan.listings.map((l) => ({
    id: listings.get(l.id),
    ownerId: owners.get(l.ownerEmail),
    status: 'draft',
    revision: 1,
    approvedRevision: null,
    createdAt: plan.source.exportedAt,
    updatedAt: plan.source.exportedAt,
    fields: l.fields,
    files: files
      .filter((f) => f.listingId === l.id)
      .map((f) => ({
        key: f.destinationKey,
        category: f.category,
        name: f.name,
        size: f.size,
        type: f.contentType,
        sha256: f.sha256,
      })),
  }));
  const final = {
    listings: sorted([...baseline.listings, ...drafts], 'id'),
    objects: sorted(
      [...baseline.objects, ...files.map((f) => f.metadata)],
      'key',
    ),
  };
  return {
    version: 1,
    migrationId: inputs.migrationId,
    digest,
    mode: 'DRY_RUN — NOT IMPORTED',
    destination,
    source: plan.source,
    counts: {
      source: totals({ listings: bundle.listings, objects: bundle.objects }),
      baseline: totals(baseline),
      imported: {
        listings: drafts.length,
        objects: files.length,
        bytes: plan.bytesToCopy,
      },
      final: totals(final),
    },
    backupRefs: {
      source: inputs.backups.source.ref,
      destination: inputs.backups.destination.ref,
    },
    drafts,
    files,
    quarantine: plan.quarantine,
    finalHashes: {
      listings: checksum(final.listings),
      objects: checksum(final.objects),
    },
    limits: [
      'Source format and ownership are operator attestations until independently verified.',
      'Actual bytes/backups/resource policy are checked only during synthetic adapter execution.',
      'No production storage adapter or CLI apply path is available.',
    ],
  };
}

function signature(category, name, prefix, contentType) {
  const ext = name.split('.').pop().toLowerCase(),
    ascii = new TextDecoder().decode(prefix);
  const starts = (values) => values.every((n, i) => prefix[i] === n);
  let actual;
  if (category === 'photos') {
    if (['jpg', 'jpeg'].includes(ext) && starts([255, 216, 255]))
      actual = 'image/jpeg';
    if (ext === 'png' && starts([137, 80, 78, 71, 13, 10, 26, 10]))
      actual = 'image/png';
    if (ext === 'gif' && /^GIF8[79]a/.test(ascii)) actual = 'image/gif';
    if (
      ext === 'webp' &&
      ascii.startsWith('RIFF') &&
      ascii.slice(8, 12) === 'WEBP'
    )
      actual = 'image/webp';
  } else if (category === 'videos') {
    if (ext === 'mp4' && ascii.slice(4, 8) === 'ftyp') actual = 'video/mp4';
    if (ext === 'webm' && starts([26, 69, 223, 163])) actual = 'video/webm';
  } else if (ext === 'pdf' && ascii.startsWith('%PDF-'))
    actual = 'application/pdf';
  if (actual !== contentType)
    error('Actual file signature/extension does not match reviewed type.');
}
async function verifiedBytes(
  value,
  file,
  { retain = false, media = false } = {},
) {
  if (!value || value.contentType !== file.contentType || !value.body)
    error('Missing object bytes or content-type mismatch.');
  const body = value.body instanceof Uint8Array ? [value.body] : value.body;
  if (!body[Symbol.iterator] && !body[Symbol.asyncIterator])
    error('Readable object bytes required.');
  const h = createHash('sha256'),
    parts = [],
    prefix = new Uint8Array(12);
  let length = 0,
    prefixLength = 0;
  for await (const part of body) {
    if (!(part instanceof Uint8Array)) error('Binary object stream required.');
    length += part.byteLength;
    if (length > file.size) error('Actual object exceeds reviewed byte count.');
    const n = Math.min(part.byteLength, 12 - prefixLength);
    prefix.set(part.subarray(0, n), prefixLength);
    prefixLength += n;
    h.update(part);
    if (retain) parts.push(part.slice());
  }
  if (length !== file.size || h.digest('hex') !== file.sha256)
    error('Actual object byte count/hash mismatch.');
  if (media)
    signature(
      file.category,
      file.name,
      prefix.subarray(0, prefixLength),
      file.contentType,
    );
  return retain ? Buffer.concat(parts) : null;
}
const snapshotEqual = (a, b) =>
  checksum(sorted(a.listings, 'id')) === checksum(sorted(b.listings, 'id')) &&
  checksum(sorted(a.objects, 'key')) === checksum(sorted(b.objects, 'key'));
const receiptFor = (plan, draft) => ({
  version: 1,
  migrationId: plan.migrationId,
  digest: plan.digest,
  listingId: draft.id,
  recordSha256: checksum(draft),
});
function currentIsAllowed(current, baseline, plan) {
  snapshot(current);
  const drafts = new Map(plan.drafts.map((l) => [l.id, l])),
    objects = new Map(plan.files.map((f) => [f.destinationKey, f.metadata]));
  for (const l of current.listings) {
    const expected =
      baseline.listings.find((b) => b.id === l.id) || drafts.get(l.id);
    if (!expected || checksum(expected) !== checksum(l))
      error('Destination listing changed or conflicts with reviewed import.');
  }
  for (const o of current.objects) {
    const expected =
      baseline.objects.find((b) => b.key === o.key) || objects.get(o.key);
    if (!expected || checksum(expected) !== checksum(o))
      error('Destination object changed or is outside reviewed import.');
  }
  for (const l of baseline.listings)
    if (!current.listings.some((x) => x.id === l.id))
      error('Baseline listing missing.');
  for (const o of baseline.objects)
    if (!current.objects.some((x) => x.key === o.key))
      error('Baseline object missing.');
}
function checkpointValid(state, plan) {
  if (
    !plain(state) ||
    state.version !== 1 ||
    state.migrationId !== plan.migrationId ||
    state.digest !== plan.digest ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 1 ||
    !['copying', 'committing', 'complete'].includes(state.phase)
  )
    error('Checkpoint conflicts with reviewed migration.');
  for (const [field, allowed] of [
    ['copied', plan.files.map((f) => f.destinationKey)],
    ['committed', plan.drafts.map((l) => l.id)],
  ]) {
    if (
      !Array.isArray(state[field]) ||
      new Set(state[field]).size !== state[field].length ||
      state[field].some((x) => !allowed.includes(x))
    )
      error('Invalid checkpoint membership.');
  }
  if (state.phase !== 'copying' && state.copied.length !== plan.files.length)
    error('Checkpoint phase lacks complete copy receipts.');
  if (
    state.phase === 'complete' &&
    (state.committed.length !== plan.drafts.length ||
      checksum(state.reconciliation) !==
        checksum({
          counts: plan.counts,
          finalHashes: plan.finalHashes,
          backupRefs: plan.backupRefs,
        }))
  )
    error('Invalid completed checkpoint reconciliation.');
}

export async function runMigration(
  bundle,
  inputs,
  { mode = 'dry-run', adapters } = {},
) {
  const plan = prepareMigration(bundle, inputs);
  if (mode === 'dry-run') return plan;
  if (mode !== 'apply' || adapters?.kind !== 'synthetic-fixture')
    error(
      'No verified production apply adapter: execution is limited to synthetic fixtures.',
    );
  const required = {
    source: ['snapshot', 'readObject'],
    backup: ['snapshot', 'readObject'],
    destination: [
      'describe',
      'withExclusiveLock',
      'inspect',
      'readOwner',
      'readObject',
      'putObjectIfAbsent',
      'readReceipt',
      'commitDraftIfAbsent',
    ],
    journal: ['load', 'save'],
  };
  for (const [component, methods] of Object.entries(required))
    if (methods.some((m) => typeof adapters[component]?.[m] !== 'function'))
      error('Missing required migration adapter method: ' + component);
  const { source, backup, destination, journal } = adapters;
  return destination.withExclusiveLock(async () => {
    const described = await destination.describe();
    if (
      checksum(described) !==
      checksum({
        ...inputs.destination,
        writeBoundaryRef: inputs.writeBoundary.ref,
      })
    )
      error('Actual destination resource/privacy/write-boundary mismatch.');
    let state = await journal.load();
    if (state) checkpointValid(state, plan);
    const persist = async (changes) => {
      const next = {
        version: 1,
        migrationId: plan.migrationId,
        digest: plan.digest,
        phase: 'copying',
        copied: [],
        committed: [],
        ...state,
        ...changes,
        revision: (state?.revision || 0) + 1,
      };
      await journal.save(state?.revision || 0, next);
      state = next;
    };
    const original = { listings: bundle.listings, objects: bundle.objects },
      baseline = inputs.destinationBaseline;
    if (
      !snapshotEqual(
        snapshot(await source.snapshot(plan.source.snapshotRef)),
        original,
      )
    )
      error('Source snapshot changed since review.');
    for (const [proof, expected] of [
      [inputs.backups.source, original],
      [inputs.backups.destination, baseline],
    ]) {
      if (!snapshotEqual(snapshot(await backup.snapshot(proof.ref)), expected))
        error('Actual backup snapshot/count/hash mismatch.');
      for (const file of expected.objects)
        await verifiedBytes(await backup.readObject(proof.ref, file.key), file);
    }
    for (const owner of inputs.ownerMap) {
      const actual = await destination.readOwner(owner.ownerId);
      if (
        !actual ||
        actual.id !== owner.ownerId ||
        actual.email !== owner.ownerEmail
      )
        error(
          'Existing destination owner identity mismatch; account creation is not supported.',
        );
    }
    const current = await destination.inspect();
    currentIsAllowed(current, baseline, plan);
    for (const draft of plan.drafts) {
      const exists = current.listings.some((l) => l.id === draft.id),
        receipt = await destination.readReceipt(draft.id);
      if (
        exists !== !!receipt ||
        (receipt && checksum(receipt) !== checksum(receiptFor(plan, draft)))
      )
        error(
          'Draft/receipt conflict; never resurrect missing committed data.',
        );
      if (state?.committed.includes(draft.id) && !exists)
        error('Committed draft missing; operator reconciliation required.');
    }
    for (const f of plan.files)
      if (
        state?.copied.includes(f.destinationKey) &&
        !current.objects.some((o) => o.key === f.destinationKey)
      )
        error('Receipted object missing; operator reconciliation required.');
    for (const f of baseline.objects)
      await verifiedBytes(await destination.readObject(f.key), f);
    // Verify every referenced source's actual bytes before the first destination mutation.
    for (const f of plan.files)
      await verifiedBytes(
        await source.readObject(plan.source.snapshotRef, f.sourceKey),
        f,
        { media: true },
      );
    if (!state) await persist({});
    for (const f of plan.files) {
      const existing = await destination.readObject(f.destinationKey);
      if (existing) await verifiedBytes(existing, f, { media: true });
      else {
        const bytes = await verifiedBytes(
          await source.readObject(plan.source.snapshotRef, f.sourceKey),
          f,
          { retain: true, media: true },
        );
        await destination.putObjectIfAbsent(f.metadata, bytes);
        await verifiedBytes(await destination.readObject(f.destinationKey), f, {
          media: true,
        });
      }
      if (!state.copied.includes(f.destinationKey))
        await persist({ copied: [...state.copied, f.destinationKey] });
    }
    // Checkpoints are hints; actual destination bytes and receipts are authoritative on every retry.
    currentIsAllowed(await destination.inspect(), baseline, plan);
    if (state.phase === 'copying') await persist({ phase: 'committing' });
    for (const draft of plan.drafts) {
      const expected = receiptFor(plan, draft);
      await destination.commitDraftIfAbsent(draft, expected);
      if (
        checksum(await destination.readReceipt(draft.id)) !== checksum(expected)
      )
        error('Atomic draft/receipt reconciliation failed.');
      if (!state.committed.includes(draft.id))
        await persist({ committed: [...state.committed, draft.id] });
    }
    const final = snapshot(await destination.inspect());
    currentIsAllowed(final, baseline, plan);
    if (
      checksum(totals(final)) !== checksum(plan.counts.final) ||
      checksum(sorted(final.listings, 'id')) !== plan.finalHashes.listings ||
      checksum(sorted(final.objects, 'key')) !== plan.finalHashes.objects
    )
      error('Final listing/object/count/hash reconciliation failed.');
    // Read all final bytes, including unchanged baseline objects, rather than trust metadata hashes.
    for (const f of final.objects)
      await verifiedBytes(await destination.readObject(f.key), f);
    const reconciliation = {
      counts: plan.counts,
      finalHashes: plan.finalHashes,
      backupRefs: plan.backupRefs,
    };
    if (
      state.phase !== 'complete' ||
      checksum(state.reconciliation) !== checksum(reconciliation)
    )
      await persist({ phase: 'complete', reconciliation });
    return {
      mode: 'SYNTHETIC FIXTURE IMPORT — NOT LIVE ACCEPTANCE',
      migrationId: plan.migrationId,
      digest: plan.digest,
      phase: state.phase,
      reconciliation,
      quarantine: plan.quarantine,
    };
  });
}

// The destination adapter must hold an exclusive durable lease for the entire operation.
// Atomic file journals provide crash/restart checkpoints, not a standalone cross-process lock.
export class AtomicFileJournal {
  constructor(path) {
    this.path = path;
  }
  async load() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  async save(expectedRevision, next) {
    const current = await this.load();
    if (
      (current?.revision || 0) !== expectedRevision ||
      next.revision !== expectedRevision + 1
    )
      error('Checkpoint revision conflict.');
    const temporary = this.path + '.tmp-' + randomUUID();
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(next));
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, this.path);
      const directory = await open(dirname(this.path), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await handle?.close();
      await unlink(temporary).catch(() => {});
    }
  }
}
export async function writeMigrationPlan(input, config, output) {
  const plan = await runMigration(
    JSON.parse(await readFile(input, 'utf8')),
    JSON.parse(await readFile(config, 'utf8')),
  );
  const temporary = output + '.tmp-' + randomUUID();
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(plan, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporary, output);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return plan;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, config, output, ...extra] = process.argv.slice(2);
  if (
    !input ||
    !config ||
    !output ||
    extra.length ||
    [input, config, output].some((s) => s.startsWith('--'))
  )
    error(
      'Usage: node scripts/seller-migration.mjs EVIDENCE.json VERIFIED_INPUTS.json NEW_PLAN.json (dry-run only; --apply unavailable)',
    );
  await writeMigrationPlan(input, config, output);
  console.log(
    'Validated migration framework plan written. No resources/accounts changed.',
  );
}
