import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLegacy } from '../../scripts/seller-legacy-plan.mjs';
test('offline legacy plan excludes credentials, requires ownership, drafts every imported listing', () => {
  const base = {
    id: 'synthetic-1',
    sellerEmail: 'owner@example.test',
    status: 'active',
    make: 'Synthetic',
    session: 'should-never-import',
    photos: [{ key: 'listings/synthetic-1/photos/a.png' }],
    logbooks: { airframe: [{ key: 'listings/synthetic-1/airframe/a.pdf' }] },
  };
  const plan = planLegacy([base]);
  assert.equal(plan.listings[0].proposedStatus, 'draft');
  assert.equal(plan.files.length, 2);
  assert.equal(JSON.stringify(plan).includes('should-never-import'), false);
  assert.throws(() => planLegacy([{ ...base, sellerEmail: '' }]));
  assert.throws(() =>
    planLegacy([{ ...base, photos: [{ key: 'listings/other/photos/a.png' }] }]),
  );
  assert.throws(() => planLegacy([base, base]));
});

import {
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  migrationDryRun,
  checksum,
  writeDryRun,
} from '../../scripts/seller-legacy-dry-run.mjs';
function bundle() {
  const listings = [
    {
      id: 'synthetic-1',
      sellerEmail: 'owner@example.test',
      status: 'active',
      make: 'Synthetic',
      year: 2000,
      price: 1,
      nNumber: 'n123ab',
      session: 'EXCLUDED-SESSION',
      photos: [{ key: 'listings/synthetic-1/photos/a.png' }],
      videos: [{ key: 'listings/synthetic-1/videos/a.mp4' }],
      logbooks: { airframe: [{ key: 'listings/synthetic-1/airframe/a.pdf' }] },
    },
  ];
  const objects = [
    {
      key: listings[0].photos[0].key,
      size: 12,
      contentType: 'image/png',
      sha256: 'a'.repeat(64),
    },
    {
      key: listings[0].videos[0].key,
      size: 20,
      contentType: 'video/mp4',
      sha256: 'b'.repeat(64),
    },
    {
      key: listings[0].logbooks.airframe[0].key,
      size: 18,
      contentType: 'application/pdf',
      sha256: 'c'.repeat(64),
    },
    {
      key: 'unowned/source.pdf',
      size: 10,
      contentType: 'application/pdf',
      sha256: 'd'.repeat(64),
    },
  ];
  return {
    listings,
    objects,
    ownership: [
      {
        listingId: 'synthetic-1',
        ownerEmail: 'owner@example.test',
        verifiedBy: 'synthetic-operator',
        evidenceRef: 'fixture://verified-owner',
        verifiedAt: 1,
      },
    ],
    source: {
      accountId: 'synthetic-account',
      workerName: 'synthetic-worker',
      versionId: 'synthetic-version',
      snapshotRef: 'fixture://immutable-export',
      sourceSha256: 'e'.repeat(64),
      exportedAt: 1,
      listingsSha256: checksum(listings),
      objectsSha256: checksum(objects),
      secret: 'EXCLUDED-SECRET',
    },
    credentials: 'EXCLUDED-CREDENTIALS',
  };
}
function resign(value) {
  value.source.listingsSha256 = checksum(value.listings);
  value.source.objectsSha256 = checksum(value.objects);
  return value;
}
test('strict migration dry run covers independent attestations, byte checksums, video and private orphan quarantine deterministically', () => {
  const source = bundle(),
    plan = migrationDryRun(source);
  assert.equal(plan.listingCount, 1);
  assert.equal(plan.fileCount, 3);
  assert.equal(plan.bytesToCopy, 50);
  assert.equal(plan.quarantine.length, 1);
  assert.equal(plan.listings[0].proposedStatus, 'draft');
  assert.equal(plan.ownership[0].evidenceRef, 'fixture://verified-owner');
  assert.equal(plan.listings[0].fields.nNumber, 'N123AB');
  assert.deepEqual(plan, migrationDryRun(structuredClone(source)));
  for (const sentinel of [
    'EXCLUDED-SESSION',
    'EXCLUDED-SECRET',
    'EXCLUDED-CREDENTIALS',
  ])
    assert.equal(JSON.stringify(plan).includes(sentinel), false);
  assert.equal(checksum({ b: 2, a: 1 }), checksum({ a: 1, b: 2 }));
});
test('migration refuses tampered source hashes and absent/ambiguous ownership evidence before import planning', () => {
  const cases = [
    (b) => (b.listings[0].make = 'changed after export'),
    (b) => (b.objects[0].size = 99),
    (b) => (b.source.sourceSha256 = 'missing'),
    (b) => (b.source.versionId = ''),
    (b) => (b.source.exportedAt = Date.now() + 100000),
    (b) => (b.ownership = []),
    (b) => (b.ownership[0].ownerEmail = 'other@example.test'),
    (b) => b.ownership.push({ ...b.ownership[0] }),
    (b) => (b.ownership[0].evidenceRef = ''),
    (b) => (b.ownership[0].verifiedAt = Date.now() + 100000),
  ];
  for (const mutate of cases) {
    const b = bundle();
    mutate(b);
    assert.throws(() => migrationDryRun(b));
  }
});
test('migration refuses missing/duplicate/unsupported object metadata, unsafe associations and malformed legacy fields', () => {
  const cases = [
    (b) => b.objects.splice(0, 1),
    (b) => b.objects.push({ ...b.objects[0] }),
    (b) => (b.objects[0].sha256 = 'not-a-checksum'),
    (b) => (b.objects[0].size = 0),
    (b) => (b.objects[0].size = 50 * 1024 * 1024 + 1),
    (b) => (b.objects[0].contentType = 'application/pdf'),
    (b) => (b.listings[0].logbooks.unknown = []),
    (b) => (b.listings[0].logbooks.airframe = {}),
    (b) => (b.listings[0].photos = {}),
    (b) => (b.listings[0].photos[0].key = 'listings/synthetic-1/videos/a.png'),
    (b) =>
      (b.listings[0].photos[0].key =
        'listings/synthetic-1/photos/../other.png'),
    (b) =>
      (b.listings[0].photos[0].key = 'listings/synthetic-1/photos/%2e%2e.png'),
    (b) => b.listings[0].photos.push({ ...b.listings[0].photos[0] }),
    (b) => (b.listings[0].id = '__proto__'),
    (b) => (b.listings[0].price = { hidden: 'invalid' }),
    (b) => (b.listings[0].year = -1),
    (b) => (b.listings[0].price = -1),
    (b) => (b.listings[0].nNumber = 'INVALID-TAIL'),
    (b) => (b.listings[0].description = 'x'.repeat(10001)),
  ];
  for (const mutate of cases) {
    const b = bundle();
    mutate(b);
    assert.throws(() => migrationDryRun(resign(b)));
  }
});
test('migration refuses categories beyond destination capacity rather than silently dropping files', () => {
  const b = bundle();
  b.listings[0].photos = Array.from({ length: 41 }, (_, i) => ({
    key: `listings/synthetic-1/photos/${i}.png`,
  }));
  b.objects = b.objects.filter((object) => !object.key.includes('/photos/'));
  b.objects.push(
    ...b.listings[0].photos.map((file) => ({
      ...file,
      size: 12,
      contentType: 'image/png',
      sha256: 'a'.repeat(64),
    })),
  );
  assert.throws(() => migrationDryRun(resign(b)), /destination file limit/);
});
test('offline artifact generation is exclusive and atomic; concurrent/repeated/invalid runs preserve reviewed output and recover safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seller-migration-fixture-'));
  try {
    const input = join(root, 'evidence.json'),
      output = join(root, 'plan.json');
    await writeFile(input, JSON.stringify(bundle()));
    const results = await Promise.allSettled([
      writeDryRun(input, output),
      writeDryRun(input, output),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected')[0].reason.code,
      'EEXIST',
    );
    const bytes = await readFile(output, 'utf8');
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    await assert.rejects(writeDryRun(input, output), { code: 'EEXIST' });
    await writeFile(input, 'invalid interrupted export');
    await assert.rejects(writeDryRun(input, output));
    assert.equal(await readFile(output, 'utf8'), bytes);
    await writeFile(input, JSON.stringify(bundle()));
    await writeDryRun(input, join(root, 'plan-retry.json'));
    assert.equal(await readFile(join(root, 'plan-retry.json'), 'utf8'), bytes);
    assert.equal(
      (await readdir(root)).some((name) => name.includes('.tmp-')),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
