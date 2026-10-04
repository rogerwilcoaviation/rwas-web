// Strict offline inventory evidence only. No source decoder, network client or apply path.
import { readFile, writeFile, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checksum } from './seller-legacy-dry-run.mjs';
const fail = (message) => {
  throw Error(message);
};
const text = (value) =>
  typeof value === 'string' &&
  value.trim().length >= 3 &&
  value.length <= 1000 &&
  !/[\u0000-\u001f]/.test(value);
const id = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const hash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys, label) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail('Invalid ' + label + ' schema.');
};
const statuses = new Set([
  'draft',
  'pending',
  'active',
  'paused',
  'sold',
  'archived',
  'deleted',
  'rejected',
  'unknown',
]);
const definitions = {
  profiles: ['id'],
  listings: ['id', 'ownerId', 'status'],
  savedDrafts: ['id', 'ownerId'],
  objects: ['key', 'size', 'sha256', 'contentType'],
};
function dataset(value, name) {
  exact(value, ['expectedTotal', 'sha256', 'pages'], name);
  if (
    !Number.isSafeInteger(value.expectedTotal) ||
    value.expectedTotal < 0 ||
    !hash(value.sha256) ||
    !Array.isArray(value.pages) ||
    !value.pages.length
  )
    fail('Complete inventory counts/pages/hash required.');
  const rows = [],
    cursors = new Set(),
    identities = new Set();
  let expectedCursor = null;
  for (let index = 0; index < value.pages.length; index++) {
    const page = value.pages[index];
    exact(page, ['cursor', 'nextCursor', 'rows'], 'inventory page');
    if (
      page.cursor !== expectedCursor ||
      cursors.has(page.cursor) ||
      !Array.isArray(page.rows) ||
      (page.nextCursor !== null && !text(page.nextCursor)) ||
      (index < value.pages.length - 1
        ? page.nextCursor === null
        : page.nextCursor !== null)
    )
      fail('Incomplete or inconsistent inventory pagination.');
    cursors.add(page.cursor);
    expectedCursor = page.nextCursor;
    for (const row of page.rows) {
      exact(row, definitions[name], 'inventory row');
      const identity = name === 'objects' ? row.key : row.id;
      if (identities.has(identity)) fail('Duplicate inventory identity.');
      if (name === 'objects') {
        if (
          typeof row.key !== 'string' ||
          !row.key ||
          row.key.length > 1024 ||
          /[\\%\u0000-\u001f]/.test(row.key) ||
          row.key
            .split('/')
            .some((part) => !part || part === '.' || part === '..') ||
          !Number.isSafeInteger(row.size) ||
          row.size < 0 ||
          !hash(row.sha256) ||
          !text(row.contentType)
        )
          fail('Invalid inventory object metadata.');
      } else if (
        !id(row.id) ||
        (name !== 'profiles' && !id(row.ownerId)) ||
        (name === 'listings' && !statuses.has(row.status))
      )
        fail('Invalid inventory record metadata.');
      identities.add(identity);
      rows.push(row);
    }
  }
  const field = name === 'objects' ? 'key' : 'id';
  const sorted = [...rows].sort((a, b) =>
    a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0,
  );
  if (rows.length !== value.expectedTotal || checksum(sorted) !== value.sha256)
    fail('Inventory count or checksum mismatch.');
  return rows;
}
export function inventoryPreflight(packet) {
  exact(
    packet,
    ['version', 'source', 'review', 'datasets'],
    'inventory packet',
  );
  if (packet.version !== 1) fail('Unsupported inventory version.');
  exact(
    packet.source,
    [
      'accountId',
      'workerName',
      'versionId',
      'storeRef',
      'bucketRef',
      'snapshotRef',
      'snapshotAt',
      'writeBoundaryRef',
    ],
    'source identity',
  );
  if (
    Object.entries(packet.source).some(
      ([key, value]) => key !== 'snapshotAt' && !text(value),
    ) ||
    !Number.isSafeInteger(packet.source.snapshotAt) ||
    packet.source.snapshotAt <= 0 ||
    packet.source.snapshotAt > Date.now()
  )
    fail('Pinned source identity and snapshot boundary required.');
  exact(
    packet.review,
    ['verifiedBy', 'evidenceRef', 'verifiedAt'],
    'inventory attestation',
  );
  if (
    !text(packet.review.verifiedBy) ||
    !text(packet.review.evidenceRef) ||
    !Number.isSafeInteger(packet.review.verifiedAt) ||
    packet.review.verifiedAt < packet.source.snapshotAt ||
    packet.review.verifiedAt > Date.now()
  )
    fail('Independent inventory review required.');
  exact(packet.datasets, Object.keys(definitions), 'complete datasets');
  const data = Object.fromEntries(
    Object.keys(definitions).map((name) => [
      name,
      dataset(packet.datasets[name], name),
    ]),
  );
  const owners = new Set(data.profiles.map((profile) => profile.id));
  if (
    [...data.listings, ...data.savedDrafts].some(
      (record) => !owners.has(record.ownerId),
    )
  )
    fail('Inventory ownership reconciliation failed.');
  const bytes = data.objects.reduce((total, object) => total + object.size, 0);
  if (!Number.isSafeInteger(bytes)) fail('Inventory byte count overflow.');
  const counts = Object.fromEntries(
    Object.entries(data).map(([name, rows]) => [name, rows.length]),
  );
  const empty = Object.values(counts).every((count) => count === 0);
  const states = Object.fromEntries(
    [...statuses].map((status) => [
      status,
      data.listings.filter((row) => row.status === status).length,
    ]),
  );
  return {
    mode: 'OFFLINE INVENTORY VALIDATED — OWNER VERIFICATION REQUIRED',
    source: packet.source,
    review: packet.review,
    digest: checksum(packet),
    counts,
    bytes,
    listingStates: states,
    proposedPath: empty ? 'clean-cutover-candidate' : 'preservation-required',
    needsPrivateExport: !empty,
    limits: [
      'Normalized inventory is owner-supplied evidence, not an independent deployed-source read.',
      'Counts/hash/pagination do not prove the exporter included all source namespaces.',
      'No source/configuration/account/data write, import, deletion, publication or production cutover is performed.',
    ],
  };
}
export async function writeInventoryPreflight(input, output) {
  const result = inventoryPreflight(JSON.parse(await readFile(input, 'utf8')));
  const temporary = output + '.tmp-' + randomUUID();
  try {
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n', {
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
  const args = process.argv.slice(2);
  if (args.length !== 2 || args.some((value) => value.startsWith('--')))
    fail(
      'Usage: node scripts/seller-inventory-preflight.mjs OWNER_INVENTORY.json NEW_REPORT.json (offline only; no apply option)',
    );
  await writeInventoryPreflight(...args);
  console.log(
    'Offline inventory report written. No source reads, import or cutover performed.',
  );
}
