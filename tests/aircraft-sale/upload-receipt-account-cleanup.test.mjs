import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, png } from './fixture.mjs';
import { identityFixture } from './identity-fixture.mjs';

globalThis.fetch = () => {
  throw Error('Receipt cleanup fixtures prohibit external requests.');
};
const operation = () => `rwas-upload-v1.${Date.now()}.${crypto.randomUUID()}`;
const receipts = (f, ownerId) =>
  Object.entries(f.state().idempotency).filter(
    ([, value]) => value?.kind === 'upload-v1' && value.ownerId === ownerId,
  );
const checked = async (response, status = 200) => {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
};
const profile = async (f, session) =>
  (await checked(await f.call('/account', 'GET', undefined, session))).profile;
const upload = (f, session, listing, id) =>
  f.call(
    '/upload?' +
      new URLSearchParams({
        listingId: listing.id,
        category: 'photos',
        filename: 'receipt-test.png',
      }),
    'POST',
    png,
    session,
    { 'Idempotency-Key': id },
  );
async function purge(f, session, listing) {
  await checked(
    await f.call(
      '/listing/' + listing.id + '/status',
      'POST',
      { status: 'deleted' },
      session,
    ),
  );
  await checked(
    await f.call(
      '/listings/' + listing.id,
      'DELETE',
      { confirm: listing.id },
      session,
    ),
  );
}
async function setup() {
  const f = fixture(),
    session = await f.login(),
    owner = await profile(f, session),
    listing = await create(f, session),
    id = operation();
  await checked(await upload(f, session, listing, id));
  return { f, session, owner, listing, id };
}
function prohibitMedia(f) {
  for (const method of ['put', 'get', 'list', 'delete', 'head'])
    f.env.MEDIA[method] = async () => {
      assert.fail('Account deletion must not access R2: ' + method);
    };
}

test('purge retains live operation binding; only the full account fence retires its completed receipts', async () => {
  const s = await setup(),
    { f, session, owner, listing, id } = s,
    secondSession = await f.login(),
    foreignSession = await f.login('other@example.test'),
    foreignOwner = await profile(f, foreignSession),
    foreignListing = await create(f, foreignSession);
  await checked(await upload(f, foreignSession, foreignListing, operation()));
  const otherListing = await create(f, session);
  await purge(f, session, listing);
  await checked(await upload(f, session, listing, id), 404);
  await checked(await upload(f, session, otherListing, id), 409);
  assert.equal(receipts(f, owner.id).length, 1);
  await purge(f, session, otherListing);
  const before = structuredClone(f.state()),
    foreignReceipts = receipts(f, foreignOwner.id),
    otherFamilies = Object.fromEntries(
      Object.entries(before.idempotency).filter(
        ([, r]) => r.kind !== 'upload-v1',
      ),
    ),
    objects = structuredClone(f.objects);
  prohibitMedia(f);
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
  );
  f.restart();
  assert.equal(receipts(f, owner.id).length, 0);
  assert.deepEqual(receipts(f, foreignOwner.id), foreignReceipts);
  for (const [key, value] of Object.entries(otherFamilies))
    assert.deepEqual(f.state().idempotency[key], value);
  assert.deepEqual(f.objects, objects);
  assert.deepEqual(f.state().files, before.files);
  assert.deepEqual(f.state().listings, before.listings);
  assert.deepEqual(
    f.state().profiles[foreignOwner.id],
    before.profiles[foreignOwner.id],
  );
  for (const token of [session, secondSession]) {
    await checked(await f.call('/account', 'GET', undefined, token), 401);
    await checked(await upload(f, token, listing, id), 401);
  }
  assert.equal((await profile(f, foreignSession)).id, foreignOwner.id);
  const newSession = await f.login(owner.email),
    newOwner = await profile(f, newSession);
  assert.notEqual(newOwner.id, owner.id);
  assert.equal(f.state().profiles[owner.id], undefined);
});

test('pending, unknown and inconsistent receipt states block deletion without losing an orphan reference', async () => {
  const variants = [
    (r) => {
      r.status = 'pending';
    },
    (r) => {
      r.status = 'unknown';
    },
    (r) => {
      r.file.ownerId = 'foreign-owner';
    },
    (r) => {
      delete r.file.key;
    },
    (r) => {
      delete r.file.listingId;
    },
    (r, state) => {
      state.files[r.file.key] = structuredClone(r.file);
    },
    (r, state) => {
      state.listings[r.file.listingId] = {
        id: r.file.listingId,
        ownerId: 'foreign-owner',
      };
    },
    (_r, state, owner) => {
      state.files['unrelated-orphan'] = { ownerId: owner.id };
    },
  ];
  for (const change of variants) {
    const { f, session, owner, listing } = await setup();
    await purge(f, session, listing);
    const state = f.state(),
      receipt = receipts(f, owner.id)[0][1];
    change(receipt, state, owner);
    f.durable.set('state', structuredClone(state));
    const before = structuredClone(f.state());
    prohibitMedia(f);
    await checked(
      await f.call('/account', 'DELETE', { confirm: owner.email }, session),
      409,
    );
    assert.deepEqual(f.state(), before);
    assert.equal((await profile(f, session)).id, owner.id);
  }
});

test('an actual uncertain R2 write blocks account cleanup even after ordinary listing purge', async () => {
  const f = fixture(),
    session = await f.login(),
    owner = await profile(f, session),
    listing = await create(f, session),
    originalPut = f.env.MEDIA.put;
  f.env.MEDIA.put = async (...args) => {
    await originalPut(...args);
    throw Error('Synthetic response lost after R2 accepted bytes');
  };
  await checked(await upload(f, session, listing, operation()), 503);
  assert.equal(receipts(f, owner.id)[0][1].status, 'pending');
  assert.equal(f.objects.size, 1);
  await purge(f, session, listing);
  assert.equal(f.objects.size, 0);
  const before = structuredClone(f.state());
  prohibitMedia(f);
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
    409,
  );
  assert.deepEqual(f.state(), before);
  f.restart();
  assert.equal(receipts(f, owner.id).length, 1);
});

test('storage failure preserves the owner fence and receipt together for safe reconciliation', async () => {
  const { f, session, owner, listing, id } = await setup();
  await purge(f, session, listing);
  const before = structuredClone(f.state());
  prohibitMedia(f);
  f.storageFailure(true);
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
    503,
  );
  f.storageFailure(false);
  f.restart();
  assert.deepEqual(f.state(), before);
  assert.equal((await profile(f, session)).id, owner.id);
  assert.equal(receipts(f, owner.id).length, 1);
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
  );
  await checked(await upload(f, session, listing, id), 401);
});

test('current confirmation, recent authentication and zero listings still precede receipt retirement', async () => {
  const { f, session, owner, listing } = await setup();
  const before = structuredClone(f.state());
  await checked(
    await f.call(
      '/account',
      'DELETE',
      { confirm: 'wrong@example.test' },
      session,
    ),
    400,
  );
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
    409,
  );
  assert.deepEqual(f.state(), before);
  await purge(f, session, listing);
  const state = f.state();
  Object.values(state.sessions).find((s) => s.userId === owner.id).createdAt =
    Date.now() - 600001;
  f.durable.set('state', state);
  const stale = structuredClone(f.state());
  await checked(
    await f.call('/account', 'DELETE', { confirm: owner.email }, session),
    401,
  );
  assert.deepEqual(f.state(), stale);
});

test('a previously started provider transaction cannot recreate the retired owner namespace', async () => {
  const { f, begin, finish } = await identityFixture();
  const first = await begin('password'),
    signedIn = await checked(await finish(first)),
    owner = await profile(f, signedIn.session),
    listing = await create(f, signedIn.session),
    id = operation();
  await checked(await upload(f, signedIn.session, listing, id));
  const outstanding = await begin('password');
  await purge(f, signedIn.session, listing);
  await checked(
    await f.call(
      '/account',
      'DELETE',
      { confirm: owner.email },
      signedIn.session,
    ),
  );
  assert.equal(receipts(f, owner.id).length, 0);
  const relogin = await checked(await finish(outstanding)),
    replacement = await profile(f, relogin.session);
  assert.notEqual(replacement.id, owner.id);
  assert.equal(f.state().profiles[owner.id], undefined);
  await checked(await upload(f, signedIn.session, listing, id), 401);
  const freshListing = await create(f, relogin.session);
  await checked(await upload(f, relogin.session, freshListing, id));
  assert.equal(receipts(f, replacement.id).length, 1);
});
