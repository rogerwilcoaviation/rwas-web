import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, fields, png, pdf } from './fixture.mjs';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';

globalThis.fetch = () => {
  throw Error('Upload idempotency fixtures prohibit external requests.');
};
const DAY = 86400000;
const operation = (at = Date.now()) =>
  `rwas-upload-v1.${at}.${crypto.randomUUID()}`;
const receipts = (f) =>
  Object.entries(f.state().idempotency).filter(
    ([, value]) => value?.kind === 'upload-v1',
  );
const pending = (f) =>
  receipts(f).filter(([, value]) => value.status === 'pending');
async function setup() {
  const f = fixture(),
    owner = await f.login(),
    listing = await create(f, owner);
  let puts = 0;
  const originalPut = f.env.MEDIA.put;
  f.env.MEDIA.put = async (...args) => {
    puts++;
    return originalPut(...args);
  };
  const upload = (id, bytes = png, options = {}) => {
    const req = f.request(
      '/upload?' +
        new URLSearchParams({
          listingId: options.listingId || listing.id,
          category: options.category || 'photos',
          filename: options.name || 'photo.png',
        }),
      'POST',
      bytes,
      options.session === null ? undefined : options.session || owner,
    );
    if (id === null) req.headers.delete('Idempotency-Key');
    else req.headers.set('Idempotency-Key', id);
    return f.callRaw(req);
  };
  return { f, owner, listing, upload, puts: () => puts };
}
const expectStatus = async (response, status) => {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
};

test('upload operation IDs fail closed and never become authorization capabilities', async () => {
  const s = await setup();
  for (const id of [
    null,
    '',
    'old-client',
    'rwas-upload-v1.1.' + crypto.randomUUID(),
  ])
    await expectStatus(await s.upload(id), 400);
  await expectStatus(await s.upload(operation(Date.now() - DAY)), 409);
  await expectStatus(await s.upload(operation(Date.now() + 301000)), 409);
  await expectStatus(await s.upload(null, png, { session: null }), 401);
  const stranger = await s.f.login('stranger@example.test');
  await expectStatus(await s.upload(null, png, { session: stranger }), 404);
  assert.equal(s.puts(), 0);
  assert.equal(receipts(s.f).length, 0);
});

test('seven concurrent replays commit one object, metadata row and revision across restart', async () => {
  const s = await setup(),
    id = operation(),
    initial = s.f.state().listings[s.listing.id].revision;
  const results = await Promise.all(
    Array.from({ length: 7 }, () => s.upload(id)),
  );
  const bodies = await Promise.all(
    results.map((response) => expectStatus(response, 200)),
  );
  assert.equal(bodies.filter((body) => body.replayed).length, 6);
  assert.equal(new Set(bodies.map((body) => body.file.key)).size, 1);
  assert.equal(s.puts(), 1);
  assert.equal(s.f.objects.size, 1);
  assert.equal(Object.keys(s.f.state().files).length, 1);
  assert.equal(s.f.state().listings[s.listing.id].revision, initial + 1);
  const before = structuredClone(s.f.state());
  s.f.restart();
  const replay = await expectStatus(await s.upload(id), 200);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.file, bodies[0].file);
  assert.deepEqual(
    s.f.state(),
    before,
    'replay changes no persisted business or receipt state',
  );
  assert.equal(s.puts(), 1);
});

test('operation binds canonical filename, listing, size, type, category and byte hash', async () => {
  const s = await setup(),
    id = operation();
  const first = await expectStatus(
    await s.upload(id, png, { name: 'photo space.png' }),
    200,
  );
  assert.equal(first.file.name, 'photo_space.png');
  assert.equal(
    (
      await expectStatus(
        await s.upload(id, png, { name: 'photo_space.png' }),
        200,
      )
    ).replayed,
    true,
  );
  for (const bytes of [
    new Uint8Array([...png, 0]),
    Uint8Array.from(png, (value, i) => (i === 11 ? 1 : value)),
  ])
    await expectStatus(
      await s.upload(id, bytes, { name: 'photo_space.png' }),
      409,
    );
  await expectStatus(await s.upload(id, png, { name: 'other.png' }), 409);
  const other = await create(s.f, s.owner, {
    ...fields,
    model: 'Other target',
  });
  await expectStatus(
    await s.upload(id, png, { listingId: other.id, name: 'photo_space.png' }),
    409,
  );
  const docID = operation();
  await expectStatus(
    await s.upload(docID, pdf, { category: 'airframe', name: 'records.pdf' }),
    200,
  );
  await expectStatus(
    await s.upload(docID, pdf, { category: 'powerplant', name: 'records.pdf' }),
    409,
  );
  assert.equal(s.puts(), 2);
});

test('same ID is owner-scoped and different IDs intentionally allow duplicate content', async () => {
  const s = await setup(),
    id = operation();
  const first = await expectStatus(await s.upload(id), 200);
  const stranger = await s.f.login('separate-owner@example.test'),
    ownListing = await create(s.f, stranger);
  await expectStatus(await s.upload(id, png, { session: stranger }), 404);
  const other = await expectStatus(
    await s.upload(id, png, { session: stranger, listingId: ownListing.id }),
    200,
  );
  assert.notEqual(first.file.key, other.file.key);
  assert.notEqual(first.file.ownerId, other.file.ownerId);
  const fresh = await expectStatus(await s.upload(operation()), 200);
  assert.notEqual(first.file.key, fresh.file.key);
  assert.equal(s.f.objects.size, 3);
  assert.equal(s.puts(), 3);
  const namespaceID = operation();
  await create(s.f, s.owner, fields, namespaceID);
  await expectStatus(await s.upload(namespaceID), 200);
  assert.equal(
    Object.keys(s.f.state().idempotency).some(
      (key) =>
        key.startsWith(s.listing.ownerId + ':') && key.endsWith(namespaceID),
    ),
    true,
  );
  assert.equal(
    receipts(s.f).length,
    4,
    'listing-create and upload IDs never collide',
  );
});

test('R2 accepted-then-threw retains pending intent and resumes at the same key after restart', async () => {
  const s = await setup(),
    id = operation(),
    original = s.f.env.MEDIA.put;
  let loseResponse = true;
  s.f.env.MEDIA.put = async (...args) => {
    await original(...args);
    if (loseResponse) {
      loseResponse = false;
      throw Error('R2 response lost after write');
    }
  };
  const revision = s.f.state().listings[s.listing.id].revision;
  await expectStatus(await s.upload(id), 503);
  assert.equal(s.f.objects.size, 1);
  assert.equal(Object.keys(s.f.state().files).length, 0);
  assert.equal(pending(s.f).length, 1);
  assert.equal(s.f.state().listings[s.listing.id].revision, revision);
  const key = [...s.f.objects.keys()][0];
  s.f.restart();
  const result = await expectStatus(await s.upload(id), 200);
  assert.equal(result.file.key, key);
  assert.equal(s.f.objects.size, 1);
  assert.equal(
    s.puts(),
    2,
    'uncertain pending R2 write may overwrite its one stable object',
  );
  assert.equal(s.f.state().listings[s.listing.id].revision, revision + 1);
});

test('pending intent survives process loss before R2; completed commit survives loss before response', async (t) => {
  await t.test('before R2 acceptance', async () => {
    const s = await setup(),
      id = operation(),
      original = s.f.env.MEDIA.put;
    let reached;
    const ready = new Promise((resolve) => {
      reached = resolve;
    });
    s.f.env.MEDIA.put = async () => {
      reached();
      await new Promise(() => {});
    };
    void s.upload(id);
    await ready;
    assert.equal(pending(s.f).length, 1);
    assert.equal(s.f.objects.size, 0);
    s.f.env.MEDIA.put = original;
    s.f.restart();
    await expectStatus(await s.upload(id), 200);
    assert.equal(s.f.objects.size, 1);
    assert.equal(Object.keys(s.f.state().files).length, 1);
  });
  await t.test('after atomic final metadata commit', async () => {
    const s = await setup(),
      id = operation(),
      original = s.f.ctx.storage.put;
    let reached;
    const ready = new Promise((resolve) => {
      reached = resolve;
    });
    s.f.ctx.storage.put = async (key, value) => {
      await original(key, value);
      if (
        Object.values(value.idempotency).some(
          (receipt) =>
            receipt?.kind === 'upload-v1' && receipt.status === 'complete',
        )
      ) {
        reached();
        await new Promise(() => {});
      }
    };
    void s.upload(id);
    await ready;
    s.f.ctx.storage.put = original;
    s.f.restart();
    const before = structuredClone(s.f.state());
    assert.equal((await expectStatus(await s.upload(id), 200)).replayed, true);
    assert.equal(s.puts(), 1);
    assert.deepEqual(s.f.state(), before);
  });
});

test('failed final persistence leaves one recoverable object, never an untracked new-key retry', async (t) => {
  for (const afterCommit of [false, true])
    await t.test(
      afterCommit ? 'uncertain committed save' : 'save rejected before commit',
      async () => {
        const s = await setup(),
          id = operation(),
          original = s.f.ctx.storage.put;
        let failOnce = true;
        s.f.ctx.storage.put = async (key, value) => {
          const complete = Object.values(value.idempotency).some(
            (receipt) =>
              receipt?.kind === 'upload-v1' && receipt.status === 'complete',
          );
          if (failOnce && complete) {
            failOnce = false;
            if (afterCommit) await original(key, value);
            throw Error('Final durable save response lost');
          }
          return original(key, value);
        };
        const revision = s.f.state().listings[s.listing.id].revision;
        await expectStatus(await s.upload(id), 503);
        assert.equal(pending(s.f).length, 1);
        assert.equal(s.f.objects.size, 1);
        assert.equal(Object.keys(s.f.state().files).length, 0);
        s.f.restart();
        await expectStatus(await s.upload(id), 200);
        assert.equal(s.f.objects.size, 1);
        assert.equal(Object.keys(s.f.state().files).length, 1);
        assert.equal(s.f.state().listings[s.listing.id].revision, revision + 1);
      },
    );
});

test('replay is read-only after reorder and cannot resurrect deleted, trashed or purging targets', async () => {
  const s = await setup(),
    firstID = operation(),
    secondID = operation();
  const a = (await expectStatus(await s.upload(firstID), 200)).file;
  const b = (await expectStatus(await s.upload(secondID), 200)).file;
  await expectStatus(
    await s.f.call(
      '/listings/' + s.listing.id + '/photos/order',
      'PUT',
      { order: [b.key, a.key] },
      s.owner,
    ),
    200,
  );
  const reordered = structuredClone(s.f.state());
  assert.equal(
    (await expectStatus(await s.upload(firstID), 200)).file.order,
    1,
  );
  assert.deepEqual(s.f.state(), reordered);
  await expectStatus(
    await s.f.call(
      '/delete-file',
      'POST',
      { listingId: s.listing.id, fileKey: a.key, category: 'photos' },
      s.owner,
    ),
    200,
  );
  await expectStatus(await s.upload(firstID), 409);
  assert.equal(s.f.objects.has(a.key), false);
  for (const status of ['archived', 'deleted']) {
    s.f.state().listings[s.listing.id].status = status;
    await expectStatus(await s.upload(secondID), 409);
  }
  s.f.state().listings[s.listing.id].status = 'draft';
  s.f.state().listings[s.listing.id].purging = true;
  await expectStatus(await s.upload(secondID), 409);
  delete s.f.state().listings[s.listing.id];
  await expectStatus(await s.upload(secondID), 404);
  assert.equal(s.puts(), 2);
});

test('revoked, held and expired sessions cannot read an otherwise matching receipt', async (t) => {
  for (const kind of ['revoked', 'held', 'expired'])
    await t.test(kind, async () => {
      const s = await setup(),
        id = operation();
      await expectStatus(await s.upload(id), 200);
      if (kind === 'revoked') s.f.state().sessions = {};
      if (kind === 'held')
        s.f.state().profiles[s.listing.ownerId].adminSuspended = true;
      if (kind === 'expired')
        for (const session of Object.values(s.f.state().sessions))
          session.expiresAt = Date.now() - 1;
      const denied = await expectStatus(await s.upload(id), 401);
      assert.equal('file' in denied, false);
      assert.equal(s.puts(), 1);
    });
});

test('pending reservations count toward category capacity and append after later cover changes', async () => {
  const s = await setup(),
    failedID = operation(),
    original = s.f.env.MEDIA.put;
  const a = (await expectStatus(await s.upload(operation()), 200)).file;
  s.f.env.MEDIA.put = async () => {
    throw Error('Before R2 write');
  };
  await expectStatus(await s.upload(failedID), 503);
  s.f.env.MEDIA.put = original;
  const b = (await expectStatus(await s.upload(operation()), 200)).file;
  await expectStatus(
    await s.f.call(
      '/listings/' + s.listing.id + '/photos/order',
      'PUT',
      { order: [b.key, a.key] },
      s.owner,
    ),
    200,
  );
  const completed = (await expectStatus(await s.upload(failedID), 200)).file;
  assert.equal(completed.order, 2);
  assert.equal(
    s.f.state().files[b.key].order,
    0,
    'pending completion preserves chosen cover',
  );
  // Fill only metadata in this ordinary fixture to isolate the boundary.
  for (let i = 3; i < 39; i++)
    s.f.state().files['capacity-' + i] = {
      ...a,
      key: 'capacity-' + i,
      order: i,
    };
  s.f.env.MEDIA.put = async () => {
    throw Error('Pending capacity reservation');
  };
  await expectStatus(await s.upload(operation()), 503);
  assert.equal(pending(s.f).length, 1);
  s.f.env.MEDIA.put = original;
  await expectStatus(await s.upload(operation()), 400);
  assert.equal(
    (await expectStatus(await s.upload(failedID), 200)).replayed,
    true,
    'completed replay works at category capacity',
  );
});

test('owner and global receipt caps reject only fresh intents; expired IDs stay invalid after cleanup', async (t) => {
  for (const scope of ['owner', 'global'])
    await t.test(scope, async () => {
      const s = await setup(),
        id = operation();
      await expectStatus(await s.upload(id), 200);
      const existing = receipts(s.f)[0][1],
        count = scope === 'owner' ? 512 : 4096;
      for (let i = 1; i < count; i++)
        s.f.state().idempotency['upload-v1|fixture-' + i] = {
          ...existing,
          ownerId: scope === 'owner' ? existing.ownerId : 'other-fixture-owner',
        };
      await expectStatus(await s.upload(operation()), 429);
      assert.equal(
        (await expectStatus(await s.upload(id), 200)).replayed,
        true,
      );
      assert.equal(s.puts(), 1);
      for (const [, value] of receipts(s.f).slice(1))
        value.expiresAt = Date.now() - 1;
      await expectStatus(await s.upload(operation()), 200);
      assert.equal(receipts(s.f).length, 2);
      const expiredID = operation(Date.now() - DAY - 1);
      await expectStatus(await s.upload(expiredID), 409);
    });
});

test('expiry alarm preserves live files, cleans orphan intents and retries failed deletion boundedly', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const s = await setup(),
      liveID = operation(),
      pendingID = operation(),
      alarms = [];
    s.f.ctx.storage.setAlarm = async (at) => alarms.push(at);
    s.f.state().auth0EventReceipts.fixture = { expiresAt: now + 60000 };
    const live = (await expectStatus(await s.upload(liveID), 200)).file;
    assert.equal(
      alarms.at(-1),
      now + 60000,
      'Auth0 earlier expiry retains precedence',
    );
    const originalPut = s.f.env.MEDIA.put;
    s.f.env.MEDIA.put = async (...args) => {
      await originalPut(...args);
      throw Error('Orphan response lost');
    };
    await expectStatus(await s.upload(pendingID), 503);
    const orphanKey = pending(s.f)[0][1].file.key;
    now += 120000;
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(
      alarms.at(-1),
      Number(pendingID.split('.')[1]) + DAY,
      'upload expiry survives Auth0 alarm',
    );
    now += DAY;
    s.f.deleteFailure(true);
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(
      receipts(s.f).length,
      1,
      'expired completed receipt pruned without deleting live file',
    );
    assert.equal(
      pending(s.f).length,
      1,
      'failed orphan cleanup keeps bounded reservation',
    );
    assert.equal(s.f.objects.has(live.key), true);
    assert.equal(s.f.objects.has(orphanKey), true);
    assert.equal(alarms.at(-1), now + 3600000);
    now += 3600001;
    s.f.deleteFailure(false);
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(receipts(s.f).length, 0);
    assert.equal(s.f.objects.has(orphanKey), false);
    assert.equal(s.f.objects.has(live.key), true);
    // Reauthentication does not make an expired operation valid again.
    const freshOwner = await s.f.login();
    await expectStatus(
      await s.upload(pendingID, png, { session: freshOwner }),
      409,
    );
    assert.equal(s.f.objects.size, 1);
  } finally {
    Date.now = originalNow;
  }
});

test('partial batch accepted item replays once, invalid item does not reserve, later item stays independent', async () => {
  const s = await setup(),
    firstID = operation(),
    invalidID = operation(),
    laterID = operation();
  await expectStatus(await s.upload(firstID), 200);
  await expectStatus(await s.upload(invalidID, new Uint8Array([1, 2, 3])), 400);
  await expectStatus(await s.upload(laterID), 200);
  const revision = s.f.state().listings[s.listing.id].revision;
  await expectStatus(await s.upload(firstID), 200);
  assert.equal(receipts(s.f).length, 2);
  assert.equal(s.f.objects.size, 2);
  assert.equal(s.puts(), 2);
  assert.equal(s.f.state().listings[s.listing.id].revision, revision);
});

test('intent persistence failure cannot write R2; later purge removes a pending orphan without resurrection', async () => {
  const s = await setup(),
    id = operation();
  s.f.storageFailure(true);
  await expectStatus(await s.upload(id), 503);
  assert.equal(s.puts(), 0);
  assert.equal(s.f.objects.size, 0);
  assert.equal(receipts(s.f).length, 0);
  s.f.storageFailure(false);
  const originalPut = s.f.env.MEDIA.put;
  s.f.env.MEDIA.put = async (...args) => {
    await originalPut(...args);
    throw Error('Accepted write before failed response');
  };
  await expectStatus(await s.upload(id), 503);
  assert.equal(s.f.objects.size, 1);
  await expectStatus(
    await s.f.call(
      '/listing/' + s.listing.id + '/status',
      'POST',
      { status: 'deleted' },
      s.owner,
    ),
    200,
  );
  await expectStatus(
    await s.f.call(
      '/listings/' + s.listing.id,
      'DELETE',
      { confirm: s.listing.id },
      s.owner,
    ),
    200,
  );
  assert.equal(s.f.objects.size, 0);
  s.f.restart();
  await expectStatus(await s.upload(id), 404);
  assert.equal(s.puts(), 1);
  assert.equal(
    pending(s.f).length,
    1,
    'retained bounded receipt expires normally after purge',
  );
});

test('orphan cleanup uses eight-object batches and completed replay skips unrelated cleanup', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const s = await setup(),
      id = operation(),
      alarms = [];
    s.f.ctx.storage.setAlarm = async (at) => alarms.push(at);
    await expectStatus(await s.upload(id), 200);
    const complete = receipts(s.f)[0][1],
      originalDelete = s.f.env.MEDIA.delete;
    let deletions = 0;
    s.f.env.MEDIA.delete = async (...args) => {
      deletions++;
      return originalDelete(...args);
    };
    for (let i = 0; i < 20; i++) {
      const key = 'listings/' + s.listing.id + '/photos/orphan-' + i;
      s.f.objects.set(key, { body: png });
      s.f.state().idempotency['upload-v1|orphan-' + i] = {
        ...complete,
        status: 'pending',
        expiresAt: now - 1,
        file: { ...complete.file, key },
      };
    }
    await expectStatus(await s.upload(id), 200);
    assert.equal(
      deletions,
      0,
      'a valid replay never waits for unrelated R2 cleanup',
    );
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(deletions, 8);
    assert.equal(pending(s.f).length, 12);
    assert.equal(
      alarms.at(-1),
      now + 1000,
      'unprocessed expired intents receive a near-term alarm',
    );
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(deletions, 16);
    await new SellerStore(s.f.ctx, s.f.env).alarm();
    assert.equal(deletions, 20);
    assert.equal(pending(s.f).length, 0);
    assert.equal(s.f.objects.size, 1);
  } finally {
    Date.now = originalNow;
  }
});

test('operation expiry crossing awaited hash or cleanup work cannot readmit a file', async (t) => {
  for (const kind of ['new', 'complete', 'deleted'])
    await t.test('hash boundary: ' + kind, async () => {
      const originalNow = Date.now,
        originalDigest = crypto.subtle.digest;
      let now = originalNow();
      Date.now = () => now;
      try {
        const s = await setup(),
          issued = now,
          id = operation(issued);
        if (kind !== 'new') {
          const file = (await expectStatus(await s.upload(id), 200)).file;
          if (kind === 'deleted')
            await expectStatus(
              await s.f.call(
                '/delete-file',
                'POST',
                {
                  listingId: s.listing.id,
                  fileKey: file.key,
                  category: 'photos',
                },
                s.owner,
              ),
              200,
            );
        }
        now = issued + DAY - 1;
        crypto.subtle.digest = async function (algorithm, bytes) {
          const result = await originalDigest.call(this, algorithm, bytes);
          if (new TextDecoder().decode(bytes).includes(id))
            now = issued + DAY + 1;
          return result;
        };
        const before = structuredClone(s.f.state()),
          puts = s.puts(),
          objects = s.f.objects.size;
        const response = await expectStatus(await s.upload(id), 409);
        assert.match(response.error, /expired/);
        assert.equal(s.puts(), puts);
        assert.equal(s.f.objects.size, objects);
        assert.deepEqual(s.f.state(), before);
      } finally {
        Date.now = originalNow;
        crypto.subtle.digest = originalDigest;
      }
    });
  await t.test('new intent after cleanup boundary', async () => {
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const s = await setup(),
        issued = now,
        id = operation(issued);
      const file = (await expectStatus(await s.upload(operation()), 200)).file;
      s.f.state().idempotency['upload-v1|expired-orphan'] = {
        ...receipts(s.f)[0][1],
        status: 'pending',
        expiresAt: issued - 1,
        file: {
          ...file,
          key: 'listings/' + s.listing.id + '/photos/orphan-boundary',
        },
      };
      now = issued + DAY - 1;
      const originalDelete = s.f.env.MEDIA.delete;
      s.f.env.MEDIA.delete = async (...args) => {
        await originalDelete(...args);
        now = issued + DAY + 1;
      };
      const puts = s.puts();
      await expectStatus(await s.upload(id), 409);
      assert.equal(s.puts(), puts);
      assert.equal(s.f.objects.size, 1);
      assert.equal(Object.keys(s.f.state().files).length, 1);
    } finally {
      Date.now = originalNow;
    }
  });
});
