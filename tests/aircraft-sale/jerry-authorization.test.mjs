import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFixture } from './jerry-fixture.mjs';
import { jerrySnapshot } from '../../workers/aircraft-sale/jerry-authority.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
test('role changes during private status translation reject finalization', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  f.identity.isAdministrator = true;
  f.env.JERRY_RESPONSE.translate = async ({ text }) => {
    f.identity.isAdministrator = false;
    return { reply: text };
  };
  await assert.rejects(
    f.call('message', f.message(c, 'Status', 'status', { locale: 'es' })),
    { status: 401 },
  );
  assert.equal((await f.call('read', { id: c.id })).turns[0].result, undefined);
});
test('listing references honor publication switch, revision/hold/purge fences and public field privacy', async () => {
  const f = await serviceFixture();
  f.store.state = f.f.state();
  const listing = {
    id: crypto.randomUUID(),
    ownerId: f.profile.id,
    status: 'active',
    revision: 2,
    approvedRevision: 2,
    fields: {
      title: 'Synthetic listing',
      nNumber: 'N123AB',
      specifications: {
        'general-display-registration-with-this-listing': 'No',
      },
    },
  };
  f.store.state.listings[listing.id] = listing;
  const ref = { type: 'listing', id: listing.id },
    owner = { profileId: f.profile.id, role: 'seller' },
    other = { profileId: 'unrelated', role: 'seller' },
    staff = { role: 'admin' };
  assert.equal((await jerrySnapshot(f.store, null, ref)).listing.nNumber, '');
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  await assert.rejects(jerrySnapshot(f.store, null, ref), { status: 404 });
  await assert.rejects(jerrySnapshot(f.store, other, ref), { status: 404 });
  assert.equal(
    (await jerrySnapshot(f.store, owner, ref)).listing.id,
    listing.id,
  );
  assert.equal(
    (await jerrySnapshot(f.store, staff, ref)).listing.id,
    listing.id,
  );
  f.env.PUBLIC_LISTINGS_ENABLED = 'true';
  listing.status = 'sold';
  assert.equal(
    (await jerrySnapshot(f.store, null, ref)).listing.status,
    'sold',
  );
  listing.approvedRevision = 1;
  await assert.rejects(jerrySnapshot(f.store, null, ref), { status: 404 });
  listing.approvedRevision = 2;
  f.store.state.profiles[f.profile.id].adminSuspended = true;
  await assert.rejects(jerrySnapshot(f.store, null, ref), { status: 404 });
  delete f.store.state.profiles[f.profile.id].adminSuspended;
  listing.purging = true;
  await assert.rejects(jerrySnapshot(f.store, null, ref), { status: 404 });
});
test('bounded acceptance publication expires and is not widened by Jerry', async () => {
  const f = await serviceFixture();
  f.store.state = f.f.state();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const expiresAt = Date.now() + 60000,
    listing = {
      id: crypto.randomUUID(),
      ownerId: f.profile.id,
      status: 'pending',
      revision: 1,
      acceptanceApprovedRevision: 1,
      acceptancePublicUntil: expiresAt,
      fields: { make: 'Synthetic' },
    };
  f.store.state.listings[listing.id] = listing;
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({
    listingId: listing.id,
    ownerId: listing.ownerId,
    revision: 1,
    expiresAt,
  });
  assert.equal(
    (await jerrySnapshot(f.store, null, { type: 'listing', id: listing.id }))
      .listing.id,
    listing.id,
  );
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({
    listingId: listing.id,
    ownerId: listing.ownerId,
    revision: 1,
    expiresAt: Date.now() - 1,
  });
  await assert.rejects(
    jerrySnapshot(f.store, null, { type: 'listing', id: listing.id }),
    { status: 404 },
  );
});
test('current credentials, provider revocation and held account fences reject saved-chat access', async () => {
  const f = await serviceFixture();
  await f.create();
  const state = f.f.state();
  state.identitySecurity[f.owner] = {
    revokedProviderSessions: {
      [await digest(f.identity.providerSessionId)]: true,
    },
  };
  f.f.durable.set('state', state);
  await assert.rejects(f.call('list', {}), { status: 401 });
  state.identitySecurity[f.owner] = { credentialsChangedAt: Date.now() };
  f.f.durable.set('state', state);
  await assert.rejects(f.call('list', {}), { status: 401 });
  state.identitySecurity[f.owner] = {};
  state.profiles[f.profile.id].adminSuspended = true;
  f.f.durable.set('state', state);
  await assert.rejects(f.call('list', {}), { status: 401 });
});
