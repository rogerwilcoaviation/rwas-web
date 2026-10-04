import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  writeFile,
  stat,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checksum } from '../../scripts/seller-legacy-dry-run.mjs';
import {
  prepareMigration,
  runMigration,
  AtomicFileJournal,
  writeMigrationPlan,
} from '../../scripts/seller-migration.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const clone = (x) => structuredClone(x);
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const attestation = {
  verifiedBy: 'synthetic-operator',
  evidenceRef: 'fixture://independent-review',
  verifiedAt: 1,
};
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
const pdf = Buffer.from('%PDF-1.7\nfixture only\n');
const mp4 = Buffer.from([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
]);
const metadata = (key, bytes, contentType) => ({
  key,
  size: bytes.length,
  sha256: sha(bytes),
  contentType,
});
const count = (s) => ({
  listings: s.listings.length,
  objects: s.objects.length,
  bytes: s.objects.reduce((n, o) => n + o.size, 0),
});
const proof = (ref, s) => ({
  ref,
  ...attestation,
  listingsSha256: checksum(s.listings),
  objectsSha256: checksum(s.objects),
  counts: count(s),
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'seller-import-synthetic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceBodies = new Map([
    ['listings/legacy-a/photos/a.png', png],
    ['listings/legacy-a/videos/a.mp4', mp4],
    ['listings/legacy-a/airframe/a.pdf', pdf],
    ['listings/legacy-b/photos/b.png', png],
    [
      'private-orphan/retain.bin',
      Buffer.from('orphan retained only in backup'),
    ],
  ]);
  const listings = [
    {
      id: 'legacy-a',
      sellerEmail: 'owner-a@example.test',
      status: 'active',
      make: 'Synthetic',
      model: 'A',
      year: 2000,
      price: 1,
      nNumber: 'n123ab',
      photos: [{ key: 'listings/legacy-a/photos/a.png' }],
      videos: [{ key: 'listings/legacy-a/videos/a.mp4' }],
      logbooks: { airframe: [{ key: 'listings/legacy-a/airframe/a.pdf' }] },
    },
    {
      id: 'legacy-b',
      sellerEmail: 'owner-b@example.test',
      status: 'sold',
      make: 'Synthetic',
      model: 'B',
      photos: [{ key: 'listings/legacy-b/photos/b.png' }],
    },
  ];
  const objects = [...sourceBodies].map(([key, bytes]) =>
    metadata(
      key,
      bytes,
      key.endsWith('.pdf')
        ? 'application/pdf'
        : key.endsWith('.mp4')
          ? 'video/mp4'
          : key.endsWith('.png')
            ? 'image/png'
            : 'application/octet-stream',
    ),
  );
  const bundle = {
    listings,
    objects,
    ownership: listings.map((l) => ({
      listingId: l.id,
      ownerEmail: l.sellerEmail,
      ...attestation,
    })),
    source: {
      accountId: 'synthetic-source-account',
      workerName: 'synthetic-source-worker',
      versionId: 'synthetic-version',
      snapshotRef: 'fixture://frozen-source',
      sourceSha256: 'a'.repeat(64),
      exportedAt: 1,
      listingsSha256: checksum(listings),
      objectsSha256: checksum(objects),
    },
  };
  const baseline = {
    listings: [
      {
        id: uid(300),
        ownerId: uid(3),
        status: 'active',
        fields: { make: 'Existing synthetic listing' },
        revision: 3,
        approvedRevision: 3,
      },
    ],
    objects: [
      metadata(`listings/${uid(300)}/photos/existing.png`, png, 'image/png'),
    ],
  };
  const inputs = {
    version: 1,
    migrationId: 'synthetic-migration-1',
    review: {
      sourceFormat: 'normalized-listings-v2',
      sourceSha256: bundle.source.sourceSha256,
      ...attestation,
    },
    destination: {
      accountId: 'synthetic-destination-account',
      storeId: 'synthetic-store',
      bucketName: 'synthetic-private-bucket',
      private: true,
      isolated: true,
      receiptRetention: 'append-only',
    },
    writeBoundary: {
      ref: 'fixture://exclusive-write-boundary',
      ...attestation,
    },
    ownerMap: [
      { ownerEmail: 'owner-a@example.test', ownerId: uid(1), ...attestation },
      { ownerEmail: 'owner-b@example.test', ownerId: uid(2), ...attestation },
    ],
    listingMap: [
      { sourceId: 'legacy-a', destinationId: uid(100) },
      { sourceId: 'legacy-b', destinationId: uid(200) },
    ],
    destinationBaseline: clone(baseline),
    backups: {
      source: proof('fixture://source-backup', { listings, objects }),
      destination: proof('fixture://destination-backup', baseline),
    },
  };
  const disk = new AtomicFileJournal(join(root, 'synthetic-destination.json'));
  await disk.save(0, {
    revision: 1,
    listings: clone(baseline.listings),
    objects: baseline.objects.map((o) => ({
      metadata: clone(o),
      bytes: png.toString('base64'),
    })),
    receipts: [],
  });
  const f = {
    root,
    bundle,
    inputs,
    sourceBodies,
    sourceSnapshot: clone({ listings, objects }),
    backupSnapshots: new Map([
      [inputs.backups.source.ref, clone({ listings, objects })],
      [inputs.backups.destination.ref, clone(baseline)],
    ]),
    backupBodies: new Map([
      [
        inputs.backups.source.ref,
        new Map([...sourceBodies].map(([k, b]) => [k, Buffer.from(b)])),
      ],
      [
        inputs.backups.destination.ref,
        new Map([[baseline.objects[0].key, Buffer.from(png)]]),
      ],
    ]),
    owners: new Map([
      [
        uid(1),
        {
          id: uid(1),
          email: 'owner-a@example.test',
          disabled: true,
          identityBlocked: true,
        },
      ],
      [uid(2), { id: uid(2), email: 'owner-b@example.test' }],
    ]),
    disk,
    lock: Promise.resolve(),
    events: {},
    fault: null,
    copies: 0,
    commits: 0,
    sourceReads: new Map(),
    mutation: null,
  };
  f.hit = (name) => {
    f.events[name] = (f.events[name] || 0) + 1;
    if (f.fault?.name === name && f.events[name] === f.fault.nth) {
      f.fault = null;
      throw Error('Injected interruption: ' + name);
    }
  };
  f.modify = async (fn) => {
    const s = await f.disk.load();
    fn(s);
    await f.disk.save(s.revision, { ...s, revision: s.revision + 1 });
  };
  return f;
}
function adapters(f) {
  // Each fresh adapter reads actual fixture files again, rather than carrying runner state across retries.
  const journal = new AtomicFileJournal(join(f.root, 'checkpoint.json'));
  const read = (meta, bytes) =>
    bytes === undefined
      ? null
      : { contentType: meta.contentType, body: Buffer.from(bytes) };
  return {
    kind: 'synthetic-fixture',
    source: {
      snapshot: async (ref) => {
        assert.equal(ref, f.bundle.source.snapshotRef);
        return clone(f.sourceSnapshot);
      },
      readObject: async (ref, key) => {
        assert.equal(ref, f.bundle.source.snapshotRef);
        f.sourceReads.set(key, (f.sourceReads.get(key) || 0) + 1);
        await f.mutation?.(key, f.sourceReads.get(key));
        return read(
          f.bundle.objects.find((o) => o.key === key),
          f.sourceBodies.get(key),
        );
      },
    },
    backup: {
      snapshot: async (ref) => clone(f.backupSnapshots.get(ref)),
      readObject: async (ref, key) =>
        read(
          f.backupSnapshots.get(ref)?.objects.find((o) => o.key === key),
          f.backupBodies.get(ref)?.get(key),
        ),
    },
    destination: {
      describe: async () =>
        clone({
          ...f.inputs.destination,
          writeBoundaryRef: f.inputs.writeBoundary.ref,
          ...f.describeOverride,
        }),
      withExclusiveLock: async (fn) => {
        const before = f.lock;
        let release;
        f.lock = new Promise((resolve) => {
          release = resolve;
        });
        await before;
        try {
          return await fn();
        } finally {
          release();
        }
      },
      inspect: async () => {
        const s = await f.disk.load();
        return {
          listings: clone(s.listings),
          objects: s.objects.map((o) => clone(o.metadata)),
        };
      },
      readOwner: async (id) => clone(f.owners.get(id)),
      readObject: async (key) => {
        const s = await f.disk.load(),
          o = s.objects.find((o) => o.metadata.key === key);
        return o ? read(o.metadata, Buffer.from(o.bytes, 'base64')) : null;
      },
      putObjectIfAbsent: async (meta, bytes) => {
        f.hit('copy-before');
        const s = await f.disk.load(),
          old = s.objects.find((o) => o.metadata.key === meta.key);
        if (old) {
          assert.equal(checksum(old.metadata), checksum(meta));
          assert.equal(sha(Buffer.from(old.bytes, 'base64')), sha(bytes));
          return;
        }
        s.objects.push({
          metadata: clone(meta),
          bytes: Buffer.from(bytes).toString('base64'),
        });
        await f.disk.save(s.revision, { ...s, revision: s.revision + 1 });
        f.copies++;
        f.hit('copy-after');
      },
      readReceipt: async (id) => {
        const s = await f.disk.load();
        return clone(s.receipts.find((r) => r.listingId === id) || null);
      },
      commitDraftIfAbsent: async (draft, receipt) => {
        f.hit('commit-before');
        const s = await f.disk.load(),
          old = s.listings.find((l) => l.id === draft.id),
          oldReceipt = s.receipts.find((r) => r.listingId === draft.id);
        if (old || oldReceipt) {
          assert.equal(checksum(old), checksum(draft));
          assert.equal(checksum(oldReceipt), checksum(receipt));
          return;
        }
        s.listings.push(clone(draft));
        s.receipts.push(clone(receipt));
        await f.disk.save(s.revision, { ...s, revision: s.revision + 1 });
        f.commits++;
        f.hit('commit-after');
      },
    },
    journal: {
      load: () => journal.load(),
      save: async (revision, next) => {
        f.hit('journal-before');
        await journal.save(revision, next);
        f.hit('journal-after');
      },
    },
  };
}
const apply = (f, options = {}) =>
  runMigration(f.bundle, f.inputs, {
    mode: 'apply',
    adapters: adapters(f),
    ...options,
  });
const refreshEvidence = (f) => {
  f.bundle.source.listingsSha256 = checksum(f.bundle.listings);
  f.bundle.source.objectsSha256 = checksum(f.bundle.objects);
  f.inputs.backups.source = proof(f.inputs.backups.source.ref, {
    listings: f.bundle.listings,
    objects: f.bundle.objects,
  });
  f.sourceSnapshot = clone({
    listings: f.bundle.listings,
    objects: f.bundle.objects,
  });
  f.backupSnapshots.set(f.inputs.backups.source.ref, clone(f.sourceSnapshot));
};

test('framework defaults to pure dry run; CLI cannot apply and exclusive mode0600 output preserves reviewed plans', async (t) => {
  const f = await fixture(t),
    before = await readFile(f.disk.path, 'utf8');
  const plan = await runMigration(f.bundle, f.inputs, {
    adapters: {
      get source() {
        throw Error('Dry run called an adapter');
      },
    },
  });
  assert.match(plan.mode, /DRY_RUN/);
  assert.equal(plan.counts.imported.listings, 2);
  assert.equal(plan.counts.imported.objects, 4);
  assert.equal(plan.quarantine.length, 1);
  assert.equal(
    plan.drafts.every(
      (l) => l.status === 'draft' && l.approvedRevision === null,
    ),
    true,
  );
  assert.equal(await readFile(f.disk.path, 'utf8'), before);
  await assert.rejects(
    runMigration(f.bundle, f.inputs, {
      mode: 'apply',
      adapters: { kind: 'production' },
    }),
    /No verified production apply adapter/,
  );
  await assert.rejects(
    runMigration(f.bundle, f.inputs, {
      mode: 'apply',
      adapters: { kind: 'synthetic-fixture' },
    }),
    /Missing required/,
  );
  const input = join(f.root, 'evidence.json'),
    config = join(f.root, 'verified-inputs.json'),
    output = join(f.root, 'review-plan.json');
  await writeFile(input, JSON.stringify(f.bundle));
  await writeFile(config, JSON.stringify(f.inputs));
  const execute = promisify(execFile);
  await execute(process.execPath, [
    'scripts/seller-migration.mjs',
    input,
    config,
    output,
  ]);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  const saved = await readFile(output, 'utf8');
  await assert.rejects(writeMigrationPlan(input, config, output), {
    code: 'EEXIST',
  });
  await assert.rejects(
    execute(process.execPath, [
      'scripts/seller-migration.mjs',
      input,
      config,
      join(f.root, 'unused.json'),
      '--apply',
    ]),
    /dry-run only/,
  );
  assert.equal(await readFile(output, 'utf8'), saved);
  assert.equal(await readFile(f.disk.path, 'utf8'), before);
});

test('strict migration framework halts on absent evidence, ambiguous owners/mappings, unsafe schemas and backup/count/hash mismatches', async (t) => {
  const f = await fixture(t);
  const cases = [
    (b, i) => delete i.review,
    (b, i) => (i.review.sourceFormat = 'guessed-live-format'),
    (b, i) => (i.review.sourceSha256 = 'b'.repeat(64)),
    (b, i) => (i.review.evidenceRef = ''),
    (b, i) => (i.destination.private = false),
    (b, i) => (i.destination.isolated = false),
    (b, i) => (i.destination.receiptRetention = 'purge-with-listing'),
    (b, i) => i.ownerMap.pop(),
    (b, i) => (i.ownerMap[0].ownerId = 'missing-existing-profile'),
    (b, i) => (i.ownerMap[1].ownerId = i.ownerMap[0].ownerId),
    (b, i) => i.ownerMap.push(clone(i.ownerMap[0])),
    (b, i) => i.listingMap.pop(),
    (b, i) => (i.listingMap[1].destinationId = i.listingMap[0].destinationId),
    (b, i) =>
      (i.listingMap[0].destinationId = i.destinationBaseline.listings[0].id),
    (b, i) => delete i.backups,
    (b, i) => i.backups.source.counts.bytes++,
    (b, i) => (i.backups.destination.objectsSha256 = 'f'.repeat(64)),
    (b, i) => (i.backups.destination.ref = i.backups.source.ref),
    (b, i) => (i.writeBoundary.evidenceRef = ''),
    (b, i) => (i.migrationId = '__proto__'),
    (b) => (b.source.secret = 'MUST-NOT-PASS'),
    (b) => (b.listings[0].session = 'MUST-NOT-PASS'),
    (b) => (b.listings[0].status = 'deleted'),
    (b) => (b.objects[4].key = '../unsafe-orphan'),
    (b) => (b.listings[0].photos[0].key = 'listings/legacy-b/photos/other.png'),
    (b) => (b.listings[0].price = -1),
    (b) => {
      const old = b.listings[0].photos[0].key,
        next = old.replace('.png', '.pdf');
      b.listings[0].photos[0].key = next;
      b.objects.find((o) => o.key === old).key = next;
    },
    (b) => {
      const old = b.listings[0].photos[0].key,
        next = 'listings/legacy-a/photos/' + 'x'.repeat(201) + '.png';
      b.listings[0].photos[0].key = next;
      b.objects.find((o) => o.key === old).key = next;
    },
    (b) => (b.ownership[0].ownerEmail = 'attacker@example.test'),
    (b, i) => {
      const email = 'x'.repeat(250) + '@example.test';
      b.listings[0].sellerEmail = email;
      b.ownership[0].ownerEmail = email;
      i.ownerMap[0].ownerEmail = email;
    },
  ];
  for (const mutate of cases) {
    const b = clone(f.bundle),
      i = clone(f.inputs);
    mutate(b, i);
    b.source.listingsSha256 = checksum(b.listings);
    b.source.objectsSha256 = checksum(b.objects);
    if (i.backups)
      i.backups.source = {
        ...i.backups.source,
        listingsSha256: checksum(b.listings),
        objectsSha256: checksum(b.objects),
      };
    assert.throws(() => prepareMigration(b, i));
  }
  assert.equal(f.copies, 0);
  assert.equal(f.commits, 0);
});

test('synthetic import reads verified backups/actual bytes, maps existing owners, preserves source/baseline/holds and reconciles exact counts and hashes', async (t) => {
  const f = await fixture(t),
    sourceBefore = checksum(f.sourceSnapshot),
    ownersBefore = checksum([...f.owners]),
    plan = prepareMigration(f.bundle, f.inputs);
  const done = await apply(f);
  assert.equal(done.phase, 'complete');
  assert.match(done.mode, /NOT LIVE ACCEPTANCE/);
  assert.deepEqual(done.reconciliation.counts.final, plan.counts.final);
  const state = await f.disk.load();
  assert.equal(state.listings.length, 3);
  assert.equal(state.objects.length, 5);
  assert.equal(state.receipts.length, 2);
  assert.deepEqual(state.listings[0], f.inputs.destinationBaseline.listings[0]);
  assert.equal(
    state.listings
      .slice(1)
      .every(
        (l) =>
          l.status === 'draft' &&
          l.approvedRevision === null &&
          l.revision === 1,
      ),
    true,
  );
  assert.equal(state.listings.find((l) => l.id === uid(100)).ownerId, uid(1));
  assert.equal(state.listings.find((l) => l.id === uid(200)).ownerId, uid(2));
  assert.equal(
    state.objects.some((o) => o.metadata.key.includes('orphan')),
    false,
  );
  assert.equal(checksum(f.sourceSnapshot), sourceBefore);
  assert.equal(checksum([...f.owners]), ownersBefore);
  const journalBefore = await readFile(join(f.root, 'checkpoint.json'), 'utf8');
  assert.deepEqual(await apply(f), done);
  assert.equal(f.copies, 4);
  assert.equal(f.commits, 2);
  assert.equal(
    await readFile(join(f.root, 'checkpoint.json'), 'utf8'),
    journalBefore,
  );
  for (const path of [f.disk.path, join(f.root, 'checkpoint.json')])
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(
    (await readdir(f.root)).some((n) => n.includes('.tmp-')),
    false,
  );
});

test('interruptions before/after copy, atomic draft commit and checkpoint saves resume from durable files without duplicate ownership or objects', async (t) => {
  const faults = [
    ['copy-before', 2],
    ['copy-after', 2],
    ['commit-before', 2],
    ['commit-after', 1],
    ['journal-before', 1],
    ['journal-after', 1],
    ['journal-before', 2],
    ['journal-after', 2],
    ['journal-before', 9],
    ['journal-after', 9],
  ];
  for (const [name, nth] of faults)
    await t.test(`${name}-${nth}`, async (t) => {
      const f = await fixture(t);
      f.fault = { name, nth };
      await assert.rejects(apply(f), /Injected interruption/);
      // Reload both destination and checkpoint with new instances; prior runner state is discarded.
      f.disk = new AtomicFileJournal(f.disk.path);
      assert.equal((await apply(f)).phase, 'complete');
      assert.equal(f.copies, 4);
      assert.equal(f.commits, 2);
      const s = await f.disk.load();
      assert.equal(new Set(s.listings.map((l) => l.id)).size, 3);
      assert.equal(new Set(s.objects.map((o) => o.metadata.key)).size, 5);
      assert.equal(s.receipts.length, 2);
      assert.equal(
        (await readdir(f.root)).some((n) => n.includes('.tmp-')),
        false,
      );
    });
});

test('backup snapshot/bytes, actual source hashes/types and existing owner mismatch halt before destination mutation', async (t) => {
  const changes = [
    (f) => f.backupSnapshots.delete(f.inputs.backups.source.ref),
    (f) =>
      (f.backupSnapshots.get(
        f.inputs.backups.destination.ref,
      ).listings[0].fields.make = 'wrong backup'),
    (f) =>
      f.backupBodies
        .get(f.inputs.backups.source.ref)
        .delete('private-orphan/retain.bin'),
    (f) =>
      f.backupBodies
        .get(f.inputs.backups.source.ref)
        .set('private-orphan/retain.bin', Buffer.from('wrong bytes')),
    (f) => (f.sourceSnapshot.listings[0].model = 'changed snapshot'),
    (f) => f.sourceBodies.delete('listings/legacy-a/photos/a.png'),
    (f) =>
      f.sourceBodies.set(
        'listings/legacy-a/photos/a.png',
        Buffer.from('wrong bytes'),
      ),
    (f) => (f.owners.get(uid(1)).email = 'other@example.test'),
    (f) => f.owners.delete(uid(2)),
    (f) => (f.describeOverride = { private: false }),
    (f) => (f.describeOverride = { bucketName: 'unreviewed-bucket' }),
    (f) => (f.describeOverride = { receiptRetention: 'purge-with-listing' }),
  ];
  for (let n = 0; n < changes.length; n++)
    await t.test(String(n), async (t) => {
      const f = await fixture(t),
        before = await readFile(f.disk.path, 'utf8');
      changes[n](f);
      await assert.rejects(apply(f));
      assert.equal(f.copies, 0);
      assert.equal(f.commits, 0);
      assert.equal(await readFile(f.disk.path, 'utf8'), before);
    });
  await t.test('hash-correct spoofed media signature', async (t) => {
    const f = await fixture(t),
      k = 'listings/legacy-a/photos/a.png',
      bad = Buffer.from('not a png!!!');
    f.sourceBodies.set(k, bad);
    f.backupBodies.get(f.inputs.backups.source.ref).set(k, bad);
    Object.assign(
      f.bundle.objects.find((o) => o.key === k),
      metadata(k, bad, 'image/png'),
    );
    refreshEvidence(f);
    await assert.rejects(apply(f), /signature/);
    assert.equal(f.copies, 0);
    assert.equal(f.commits, 0);
  });
});

test('stream overrun cancels consumption and changed bytes between preflight and copy leave private resumable objects, never committed listings', async (t) => {
  const f = await fixture(t),
    a = adapters(f);
  let cancelled = false;
  const originalRead = a.source.readObject;
  a.source.readObject = async (ref, key) =>
    key !== 'listings/legacy-a/photos/a.png'
      ? originalRead(ref, key)
      : {
          contentType: 'image/png',
          body: (async function* () {
            try {
              yield png;
              yield Buffer.from('overrun');
            } finally {
              cancelled = true;
            }
          })(),
        };
  await assert.rejects(apply(f, { adapters: a }), /exceeds/);
  assert.equal(cancelled, true);
  assert.equal(f.copies, 0);
  f.mutation = (key, reads) => {
    if (key === 'listings/legacy-a/airframe/a.pdf' && reads === 2)
      f.sourceBodies.set(key, Buffer.from('changed after preflight'));
  };
  await assert.rejects(apply(f), /byte count\/hash mismatch|exceeds/);
  assert.equal(f.copies > 0, true);
  assert.equal(f.commits, 0);
  f.mutation = null;
  f.sourceBodies.set('listings/legacy-a/airframe/a.pdf', pdf);
  assert.equal((await apply(f)).phase, 'complete');
  assert.equal(f.copies, 4);
});

test('destination corruption, foreign writes and changed baseline are never overwritten or mistaken for reconciliation', async (t) => {
  await t.test('baseline actual bytes', async (t) => {
    const f = await fixture(t);
    await f.modify(
      (s) => (s.objects[0].bytes = Buffer.from('tampered').toString('base64')),
    );
    await assert.rejects(apply(f), /byte count\/hash mismatch|exceeds/);
    assert.equal(f.copies, 0);
  });
  await t.test('foreign metadata', async (t) => {
    const f = await fixture(t);
    await f.modify((s) =>
      s.objects.push({
        metadata: metadata('foreign/extra.png', png, 'image/png'),
        bytes: png.toString('base64'),
      }),
    );
    await assert.rejects(apply(f), /outside reviewed import/);
    assert.equal(f.copies, 0);
  });
  await t.test('listing details changed', async (t) => {
    const f = await fixture(t);
    await f.modify((s) => (s.listings[0].fields.make = 'independent change'));
    await assert.rejects(apply(f), /listing changed/);
    assert.equal(f.copies, 0);
  });
  await t.test('stored copy corrupt despite matching metadata', async (t) => {
    const f = await fixture(t),
      a = adapters(f),
      put = a.destination.putObjectIfAbsent;
    a.destination.putObjectIfAbsent = async (meta, bytes) => {
      await put(meta, bytes);
      await f.modify(
        (s) =>
          (s.objects.find((o) => o.metadata.key === meta.key).bytes =
            Buffer.from('corrupt').toString('base64')),
      );
    };
    await assert.rejects(
      apply(f, { adapters: a }),
      /byte count\/hash mismatch|exceeds/,
    );
    assert.equal(f.commits, 0);
    const before = await readFile(f.disk.path, 'utf8');
    await assert.rejects(apply(f), /byte count\/hash mismatch|exceeds/);
    assert.equal(await readFile(f.disk.path, 'utf8'), before);
  });
  await t.test(
    'extra object after commit prevents completed receipt',
    async (t) => {
      const f = await fixture(t),
        a = adapters(f),
        commit = a.destination.commitDraftIfAbsent;
      a.destination.commitDraftIfAbsent = async (record, receipt) => {
        await commit(record, receipt);
        if (record.id === uid(200))
          await f.modify((s) =>
            s.objects.push({
              metadata: metadata('foreign/extra.png', png, 'image/png'),
              bytes: png.toString('base64'),
            }),
          );
      };
      await assert.rejects(
        apply(f, { adapters: a }),
        /outside reviewed import/,
      );
      assert.equal(
        (await new AtomicFileJournal(join(f.root, 'checkpoint.json')).load())
          .phase,
        'committing',
      );
    },
  );
});

test('completed retry never republishes, clears holds, resurrects removed data or accepts changed input/checkpoints', async (t) => {
  for (const variant of [
    'missing-listing',
    'missing-object',
    'missing-receipt',
    'published-listing',
    'changed-input',
    'forged-checkpoint',
  ])
    await t.test(variant, async (t) => {
      const f = await fixture(t);
      await apply(f);
      if (variant === 'missing-listing')
        await f.modify(
          (s) => (s.listings = s.listings.filter((l) => l.id !== uid(100))),
        );
      if (variant === 'missing-object')
        await f.modify(
          (s) =>
            (s.objects = s.objects.filter(
              (o) => !o.metadata.migration || o.metadata.listingId !== uid(100),
            )),
        );
      if (variant === 'missing-receipt')
        await f.modify((s) => (s.receipts = []));
      if (variant === 'published-listing')
        await f.modify(
          (s) => (s.listings.find((l) => l.id === uid(100)).status = 'active'),
        );
      if (variant === 'changed-input') {
        f.inputs.review.evidenceRef = 'fixture://different-case';
      }
      if (variant === 'forged-checkpoint') {
        const p = join(f.root, 'checkpoint.json'),
          s = JSON.parse(await readFile(p));
        s.committed = [];
        await writeFile(p, JSON.stringify(s));
      }
      const before = await readFile(f.disk.path, 'utf8');
      await assert.rejects(apply(f));
      assert.equal(await readFile(f.disk.path, 'utf8'), before);
      assert.equal(f.copies, 4);
      assert.equal(f.commits, 2);
      assert.equal(f.owners.get(uid(1)).disabled, true);
      assert.equal(f.owners.get(uid(1)).identityBlocked, true);
    });
});

test('lost commit response followed by listing removal before journal update halts on permanent receipt and never resurrects', async (t) => {
  const f = await fixture(t);
  f.fault = { name: 'commit-after', nth: 1 };
  await assert.rejects(apply(f), /Injected interruption/);
  const journal = await new AtomicFileJournal(
    join(f.root, 'checkpoint.json'),
  ).load();
  assert.deepEqual(journal.committed, []);
  const committed = (await f.disk.load()).receipts[0].listingId;
  await f.modify((s) => {
    s.listings = s.listings.filter((l) => l.id !== committed);
  });
  const before = await readFile(f.disk.path, 'utf8');
  await assert.rejects(apply(f), /never resurrect/);
  assert.equal(await readFile(f.disk.path, 'utf8'), before);
  assert.equal(f.commits, 1);
});

test('exclusive destination lease serializes concurrent resume; atomic journal rejects stale revisions and corrupt files', async (t) => {
  const f = await fixture(t);
  const results = await Promise.all([apply(f), apply(f), apply(f)]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
  assert.equal(f.copies, 4);
  assert.equal(f.commits, 2);
  const journal = new AtomicFileJournal(join(f.root, 'checkpoint.json')),
    s = await journal.load();
  await assert.rejects(
    journal.save(s.revision - 1, { ...s, revision: s.revision }),
    /revision conflict/,
  );
  await writeFile(journal.path, 'interrupted/invalid JSON');
  const before = await readFile(f.disk.path, 'utf8');
  await assert.rejects(apply(f));
  assert.equal(await readFile(f.disk.path, 'utf8'), before);
});
