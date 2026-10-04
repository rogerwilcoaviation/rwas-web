import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readFile,
  stat,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checksum } from '../../scripts/seller-legacy-dry-run.mjs';
import {
  inventoryPreflight,
  writeInventoryPreflight,
} from '../../scripts/seller-inventory-preflight.mjs';
globalThis.fetch = () => {
  throw Error('Network forbidden');
};
const makeDataset = (rows = []) => ({
  expectedTotal: rows.length,
  sha256: checksum(
    [...rows].sort((a, b) => (a.id || a.key).localeCompare(b.id || b.key)),
  ),
  pages: [{ cursor: null, nextCursor: null, rows }],
});
const packet = () => ({
  version: 1,
  source: {
    accountId: 'fixture-account',
    workerName: 'fixture-worker',
    versionId: 'fixture-version',
    storeRef: 'fixture://store',
    bucketRef: 'fixture://private-bucket',
    snapshotRef: 'fixture://complete-snapshot',
    snapshotAt: 1,
    writeBoundaryRef: 'fixture://snapshot-boundary',
  },
  review: {
    verifiedBy: 'fixture-owner',
    evidenceRef: 'fixture://independent-completeness-proof',
    verifiedAt: 2,
  },
  datasets: {
    profiles: makeDataset(),
    listings: makeDataset(),
    savedDrafts: makeDataset(),
    objects: makeDataset(),
  },
});
test('only complete empty profiles/listings/private drafts/objects produce a clean-cutover candidate, never approval', () => {
  const p = packet(),
    result = inventoryPreflight(p);
  assert.equal(result.proposedPath, 'clean-cutover-candidate');
  assert.equal(result.needsPrivateExport, false);
  assert.match(result.mode, /OWNER VERIFICATION REQUIRED/);
  assert.deepEqual(result, inventoryPreflight(structuredClone(p)));
  for (const missing of ['profiles', 'listings', 'savedDrafts', 'objects']) {
    const partial = packet();
    delete partial.datasets[missing];
    assert.throws(() => inventoryPreflight(partial));
  }
});
test('profiles alone, private saved drafts, deleted listings and even zero-byte orphan objects require preservation', () => {
  const p = packet();
  p.datasets.profiles = makeDataset([{ id: 'owner-1' }]);
  assert.equal(inventoryPreflight(p).needsPrivateExport, true);
  p.datasets.savedDrafts = makeDataset([{ id: 'draft-1', ownerId: 'owner-1' }]);
  p.datasets.listings = makeDataset([
    { id: 'listing-1', ownerId: 'owner-1', status: 'deleted' },
  ]);
  p.datasets.objects = makeDataset([
    {
      key: 'private/orphan.bin',
      size: 0,
      sha256: 'a'.repeat(64),
      contentType: 'application/octet-stream',
    },
  ]);
  const result = inventoryPreflight(p);
  assert.equal(result.proposedPath, 'preservation-required');
  assert.equal(result.listingStates.deleted, 1);
  assert.equal(result.counts.savedDrafts, 1);
  assert.equal(result.bytes, 0);
  assert.ok(!JSON.stringify(result).includes('owner-1'));
  assert.ok(!JSON.stringify(result).includes('private/orphan.bin'));
});
test('missing pages, cursor loops, duplicate identities, false counts and modified hashes fail', () => {
  const p = packet();
  p.datasets.profiles = {
    expectedTotal: 2,
    sha256: checksum([{ id: 'owner-1' }, { id: 'owner-2' }]),
    pages: [
      { cursor: null, nextCursor: 'page-two', rows: [{ id: 'owner-1' }] },
      { cursor: 'page-two', nextCursor: null, rows: [{ id: 'owner-2' }] },
    ],
  };
  assert.equal(inventoryPreflight(p).counts.profiles, 2);
  const changes = [
    (x) => x.datasets.profiles.pages.pop(),
    (x) => {
      x.datasets.profiles.pages[1].cursor = 'wrong';
    },
    (x) => {
      x.datasets.profiles.pages[1].nextCursor = 'page-two';
    },
    (x) => {
      x.datasets.profiles.pages[1].rows[0].id = 'owner-1';
    },
    (x) => {
      x.datasets.profiles.expectedTotal = 0;
    },
    (x) => {
      x.datasets.profiles.sha256 = 'b'.repeat(64);
    },
  ];
  for (const change of changes) {
    const bad = structuredClone(p);
    change(bad);
    assert.throws(() => inventoryPreflight(bad));
  }
});
test('owner omissions, unknown secret fields, traversal keys, unsafe counts and unverified source boundaries fail closed', () => {
  const changes = [
    (p) => {
      p.datasets.listings = makeDataset([
        { id: 'private-1', ownerId: 'missing-owner', status: 'draft' },
      ]);
    },
    (p) => {
      p.secret = 'credential-sentinel';
    },
    (p) => {
      p.datasets.profiles = makeDataset([
        { id: 'owner-1', session: 'credential-sentinel' },
      ]);
    },
    (p) => {
      p.datasets.objects = makeDataset([
        {
          key: '../private.bin',
          size: 1,
          sha256: 'a'.repeat(64),
          contentType: 'application/octet-stream',
        },
      ]);
    },
    (p) => {
      p.datasets.profiles.expectedTotal = Number.MAX_SAFE_INTEGER + 1;
    },
    (p) => {
      p.source.writeBoundaryRef = '';
    },
    (p) => {
      p.review.verifiedAt = 0;
    },
    (p) => {
      p.source.snapshotAt = Date.now() + 360000;
    },
  ];
  for (const change of changes) {
    const p = packet();
    change(p);
    assert.throws(() => inventoryPreflight(p));
  }
});
test('CLI writes private exclusive review reports, preserves input and rejects apply/network flags', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'seller-inventory-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'input.json'),
    output = join(root, 'report.json');
  const bytes = JSON.stringify(packet());
  await writeFile(input, bytes);
  await writeInventoryPreflight(input, output);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  const report = await readFile(output, 'utf8');
  await assert.rejects(writeInventoryPreflight(input, output), {
    code: 'EEXIST',
  });
  assert.equal(await readFile(output, 'utf8'), report);
  assert.equal(await readFile(input, 'utf8'), bytes);
  for (const flag of ['--apply', '--network'])
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          'scripts/seller-inventory-preflight.mjs',
          input,
          join(root, 'forbidden.json'),
          flag,
        ],
        { stdio: 'pipe' },
      ),
    );
  assert.deepEqual((await readdir(root)).sort(), ['input.json', 'report.json']);
});
