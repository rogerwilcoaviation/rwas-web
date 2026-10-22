import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, submit, png } from './fixture.mjs';

const clone = structuredClone;
const targetRows = (f, id) => Object.entries(f.state().outbox)
  .filter(([, row]) => row?.listingId === id);
const status = (f, owner, listing, next) => f.call(
  '/listing/' + listing.id + '/status', 'POST', { status: next }, owner,
);
const purge = (f, owner, listing) => f.call(
  '/listings/' + listing.id, 'DELETE', { confirm: listing.id }, owner,
);
async function ok(response, expected = 200) {
  assert.equal(response.status, expected);
  return response.json();
}
async function pendingWithMedia(count = 2) {
  const f = fixture(), owner = await f.login(), listing = await create(f, owner);
  for (let i = 0; i < count; i++) await ok(await f.call(
    '/upload?listingId=' + listing.id + '&category=photos&filename=' + i + '.png',
    'POST', png, owner,
  ));
  await ok(await submit(f, owner, listing));
  await ok(await status(f, owner, listing, 'deleted'));
  return { f, owner, listing, outbox: clone(f.state().outbox) };
}

test('permanent purge removes every target review row after QA publication and preserves unrelated history', async () => {
  const f = fixture(), owner = await f.login(), other = await f.login('other@example.test');
  const listing = await create(f, owner), sameOwner = await create(f, owner), foreign = await create(f, other);
  await ok(await f.call('/upload?listingId=' + listing.id + '&category=photos&filename=target.png', 'POST', png, owner));
  await ok(await submit(f, owner, listing));
  await ok(await f.call('/listings/' + listing.id, 'PUT', { description: 'Second synthetic revision' }, owner));
  await ok(await submit(f, owner, listing));
  await ok(await submit(f, owner, sameOwner));
  await ok(await submit(f, other, foreign));
  const revision = f.state().listings[listing.id].revision;
  Object.assign(f.env, { PUBLIC_LISTINGS_ENABLED: 'false', CLERK_ACCEPTANCE_ENABLED: 'true', CLERK_ACCEPTANCE_SCOPE: JSON.stringify({
    listingId: listing.id, ownerId: f.state().listings[listing.id].ownerId,
    revision, expiresAt: Date.now() + 120000,
  }) });
  for (const decision of ['acceptance-approve', 'acceptance-unpublish']) await ok(await f.call('/admin/review', 'POST', {
    listingId: listing.id, revision, decision,
  }, 'fixture-reviewer'));
  // Queue ownership is the row's listingId, not its key spelling. These local
  // synthetic retained rows ensure a prefix sweep cannot delete another row.
  f.state().outbox['nonstandard-target-key'] = { listingId: listing.id, revision: 99, status: 'awaiting-review' };
  f.state().outbox[listing.id + ':foreign-reference'] = { listingId: foreign.id, revision: 99, status: 'awaiting-review' };
  await ok(await status(f, owner, listing, 'deleted'));
  const before = clone(f.state()), unrelated = Object.fromEntries(Object.entries(before.outbox).filter(([, row]) => row?.listingId !== listing.id));
  assert.equal(targetRows(f, listing.id).length, 3);
  await ok(await purge(f, owner, listing));
  assert.deepEqual(targetRows(f, listing.id), []);
  assert.deepEqual(f.state().outbox, unrelated);
  assert.equal(f.state().listings[listing.id], undefined);
  assert.deepEqual(f.state().listings[sameOwner.id], before.listings[sameOwner.id]);
  assert.deepEqual(f.state().listings[foreign.id], before.listings[foreign.id]);
  assert.deepEqual(f.state().idempotency, before.idempotency, 'create tombstones and completed upload receipts are retained');
  assert.deepEqual(f.state().audit.slice(0, -1), before.audit);
  assert.equal(f.state().audit.at(-1).action, 'purge');
  assert.equal(f.state().audit.at(-1).listingId, listing.id);
  f.restart();
  assert.deepEqual(f.state().outbox, unrelated);
  await ok(await f.call('/my-listings', 'GET', undefined, owner));
  assert.equal(f.state().listings[listing.id], undefined);
  assert.equal(f.objects.size, 0);
});

test('archive, soft trash and restore retain review outbox exactly', async () => {
  const f = fixture(), owner = await f.login(), listing = await create(f, owner);
  await ok(await submit(f, owner, listing));
  const outbox = clone(f.state().outbox), idempotency = clone(f.state().idempotency);
  for (const next of ['archived', 'restore', 'deleted', 'restore']) {
    await ok(await status(f, owner, listing, next));
    assert.deepEqual(f.state().outbox, outbox);
    assert.deepEqual(f.state().idempotency, idempotency);
  }
});

test('owner and staff authorization failures cannot purge outbox or media', async () => {
  const { f, owner, listing } = await pendingWithMedia(1), stranger = await f.login('stranger@example.test');
  const before = clone(f.state().outbox), keys = [...f.objects.keys()];
  await ok(await purge(f, stranger, listing), 404);
  await ok(await status(f, stranger, listing, 'deleted'), 404);
  await ok(await purge(f, 'fixture-reviewer', listing), 401);
  await ok(await f.call('/admin/review', 'POST', { listingId: listing.id, revision: listing.revision, decision: 'reject' }, owner), 403);
  assert.deepEqual(f.state().outbox, before);
  assert.deepEqual([...f.objects.keys()], keys);
  assert.equal(f.state().listings[listing.id].purging, undefined);
});

test('failed purge-intent save preserves outbox and performs no R2 operation', async () => {
  const { f, owner, listing, outbox } = await pendingWithMedia();
  let mediaCalls = 0;
  const list = f.env.MEDIA.list, del = f.env.MEDIA.delete;
  f.env.MEDIA.list = (...args) => { mediaCalls++; return list(...args); };
  f.env.MEDIA.delete = (...args) => { mediaCalls++; return del(...args); };
  f.storageFailure(true);
  await ok(await purge(f, owner, listing), 503);
  assert.equal(mediaCalls, 0);
  assert.deepEqual(f.state().outbox, outbox);
  assert.equal(f.state().listings[listing.id].purging, undefined);
  f.storageFailure(false); f.restart();
  await ok(await purge(f, owner, listing));
  assert.deepEqual(targetRows(f, listing.id), []);
});

for (const failedOperation of ['list', 'delete']) test('interrupted R2 ' + failedOperation + ' preserves retryable outbox through restart', async () => {
  const { f, owner, listing, outbox } = await pendingWithMedia(3);
  const originalList = f.env.MEDIA.list, originalDelete = f.env.MEDIA.delete;
  let calls = 0;
  if (failedOperation === 'list') f.env.MEDIA.list = async () => { throw Error('Synthetic R2 list interruption'); };
  else f.env.MEDIA.delete = async key => { if (++calls === 2) throw Error('Synthetic R2 delete interruption'); return originalDelete(key); };
  await ok(await purge(f, owner, listing), 503);
  assert.deepEqual(f.state().outbox, outbox);
  assert.equal(f.state().listings[listing.id].purging, true);
  assert.equal(Object.values(f.state().files).every(file => file.deleting), true);
  assert.equal(f.objects.size, failedOperation === 'delete' ? 2 : 3);
  f.restart();
  await ok(await status(f, owner, listing, 'restore'), 409);
  assert.deepEqual(f.state().outbox, outbox);
  f.env.MEDIA.list = originalList; f.env.MEDIA.delete = originalDelete;
  // Exercise all remaining prefix pages, not just the first result.
  const snapshot = [...f.objects.keys()].filter(key => key.startsWith('listings/' + listing.id + '/'));
  f.env.MEDIA.list = async ({ cursor }) => { const at = Number(cursor || 0); return { objects: snapshot.slice(at, at + 1).map(key => ({ key })), truncated: at + 1 < snapshot.length, cursor: String(at + 1) }; };
  await ok(await purge(f, owner, listing));
  assert.equal(f.objects.size, 0);
  assert.deepEqual(targetRows(f, listing.id), []);
  assert.equal(f.state().listings[listing.id], undefined);
});

test('failed final metadata save retains outbox after R2 deletion and successful retry commits it once', async () => {
  const { f, owner, listing, outbox } = await pendingWithMedia(1);
  const del = f.env.MEDIA.delete;
  f.env.MEDIA.delete = async key => { await del(key); f.storageFailure(true); };
  await ok(await purge(f, owner, listing), 503);
  assert.equal(f.objects.size, 0);
  assert.deepEqual(f.state().outbox, outbox);
  assert.equal(f.state().listings[listing.id].purging, true);
  assert.equal(Object.values(f.state().files).every(file => file.deleting), true);
  assert.equal(f.state().audit.some(row => row.action === 'purge' && row.listingId === listing.id), false);
  f.restart(); f.storageFailure(false); f.env.MEDIA.delete = del;
  await ok(await purge(f, owner, listing));
  assert.deepEqual(targetRows(f, listing.id), []);
  assert.equal(f.state().listings[listing.id], undefined);
  assert.equal(f.state().audit.filter(row => row.action === 'purge' && row.listingId === listing.id).length, 1);
});
