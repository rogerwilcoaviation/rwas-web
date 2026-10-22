import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, fields } from './fixture.mjs';

globalThis.fetch = () => {
  throw Error('External network forbidden in local account maintenance checks');
};

async function account(f, token) {
  const response = await f.call('/account', 'GET', undefined, token);
  assert.equal(response.status, 200);
  return response.json();
}

test('established seller data stays with the same account across logout and token switching', async () => {
  const f = fixture();
  const owner = await f.login();
  const original = await account(f, owner);
  const contact = {
    name: 'Established owner',
    phone: '555-0101',
    location: 'Fixture hangar',
  };
  assert.equal((await f.call('/account', 'PATCH', contact, owner)).status, 200);
  const listing = await create(f, owner);
  assert.equal(
    (
      await f.call(
        '/draft',
        'PUT',
        { ...fields, model: 'Owner saved draft' },
        owner,
      )
    ).status,
    200,
  );
  const other = await f.login('other@example.test');
  const unrelated = await account(f, other);
  assert.notEqual(original.profile.id, unrelated.profile.id);
  assert.equal(
    (await f.call('/account', 'PATCH', { name: 'Other seller' }, other)).status,
    200,
  );

  for (const [
    token,
    expectedId,
    expectedName,
    expectedListings,
    draftModel,
  ] of [
    [
      owner,
      original.profile.id,
      contact.name,
      [listing.id],
      'Owner saved draft',
    ],
    [other, unrelated.profile.id, 'Other seller', [], null],
    [
      owner,
      original.profile.id,
      contact.name,
      [listing.id],
      'Owner saved draft',
    ],
  ]) {
    const current = await account(f, token);
    assert.equal(current.profile.id, expectedId);
    assert.equal(current.profile.name, expectedName);
    assert.equal(current.sessions.length, 1);
    assert.equal(current.sessions[0].current, true);
    const mine = await (
      await f.call('/my-listings', 'GET', undefined, token)
    ).json();
    assert.deepEqual(
      mine.listings.map((row) => row.id),
      expectedListings,
    );
    const saved = await (
      await f.call('/draft', 'GET', undefined, token)
    ).json();
    assert.equal(saved.draft?.model || null, draftModel);
  }

  assert.equal((await f.call('/logout', 'POST', {}, owner)).status, 200);
  assert.equal((await f.call('/account', 'GET', undefined, owner)).status, 401);
  f.restart();
  const again = await f.login();
  const restored = await account(f, again);
  assert.equal(restored.profile.id, original.profile.id);
  for (const [key, value] of Object.entries(contact))
    assert.equal(restored.profile[key], value);
  assert.equal((await account(f, other)).profile.id, unrelated.profile.id);
  assert.equal(f.state().listings[listing.id].ownerId, original.profile.id);
});

test('seller session management revokes only selected own sessions and preserves the current account when switching', async () => {
  const f = fixture();
  const first = await f.login();
  const current = await f.login();
  const third = await f.login();
  const other = await f.login('other@example.test');
  const otherAgain = await f.login('other@example.test');
  const ownerAccount = await account(f, current);
  const otherAccount = await account(f, other);
  assert.equal(ownerAccount.sessions.length, 3);
  assert.equal(otherAccount.sessions.length, 2);
  assert.equal(
    (
      await f.call(
        '/account/sessions',
        'DELETE',
        { id: ownerAccount.sessions[0].id },
        other,
      )
    ).status,
    200,
  );
  assert.equal((await account(f, current)).sessions.length, 3);

  assert.equal(
    (await f.call('/account/sessions', 'DELETE', { all: true }, current))
      .status,
    200,
  );
  assert.equal((await f.call('/account', 'GET', undefined, first)).status, 401);
  assert.equal((await f.call('/account', 'GET', undefined, third)).status, 401);
  const retained = await account(f, current);
  assert.equal(retained.sessions.length, 1);
  assert.equal(retained.sessions[0].current, true);
  assert.equal((await account(f, other)).sessions.length, 2);
  assert.equal(
    (await account(f, otherAgain)).profile.id,
    otherAccount.profile.id,
  );

  assert.equal(
    (
      await f.call(
        '/account/sessions',
        'DELETE',
        { id: retained.sessions[0].id },
        current,
      )
    ).status,
    200,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, current)).status,
    401,
  );
  assert.equal((await account(f, other)).profile.id, otherAccount.profile.id);
});

test('self deletion requires recent authentication, the exact current email, and no retained listing even in archive or trash', async () => {
  const f = fixture();
  const owner = await f.login();
  const other = await f.login('other@example.test');
  const profile = (await account(f, owner)).profile;
  const state = f.state();
  const ownSession = Object.values(state.sessions).find(
    (session) => session.userId === profile.id,
  );
  const createdAt = ownSession.createdAt;
  ownSession.createdAt = Date.now() - 600001;
  f.durable.set('state', state);
  assert.equal(
    (await f.call('/account', 'DELETE', { confirm: profile.email }, owner))
      .status,
    401,
  );
  assert.equal((await account(f, owner)).profile.id, profile.id);
  const restored = f.state();
  Object.values(restored.sessions).find(
    (session) => session.userId === profile.id,
  ).createdAt = createdAt;
  f.durable.set('state', restored);
  for (const confirm of ['', 'OWNER@example.test', 'other@example.test']) {
    assert.equal(
      (await f.call('/account', 'DELETE', { confirm }, owner)).status,
      400,
    );
    assert.ok(f.state().profiles[profile.id]);
  }
  const listing = await create(f, owner);
  for (const status of ['draft', 'archived', 'deleted']) {
    if (status !== 'draft')
      assert.equal(
        (
          await f.call(
            '/listing/' + listing.id + '/status',
            'POST',
            { status },
            owner,
          )
        ).status,
        200,
      );
    const before = structuredClone(f.state().listings[listing.id]);
    assert.equal(
      (await f.call('/account', 'DELETE', { confirm: profile.email }, owner))
        .status,
      409,
    );
    assert.deepEqual(f.state().listings[listing.id], before);
    assert.equal((await account(f, owner)).profile.id, profile.id);
    assert.equal((await account(f, other)).profile.email, 'other@example.test');
  }
  assert.equal(
    f.state().audit.filter((entry) => entry.action === 'account-delete').length,
    0,
  );
});

test('empty account deletion removes its own established records and sessions while preserving another seller after restart', async () => {
  const f = fixture();
  const owner = await f.login();
  const ownerAgain = await f.login();
  const other = await f.login('other@example.test');
  const profile = (await account(f, owner)).profile;
  const otherProfile = (await account(f, other)).profile;
  assert.equal((await f.call('/draft', 'PUT', fields, owner)).status, 200);
  const otherListing = await create(f, other);
  assert.equal(
    (
      await f.call(
        '/draft',
        'PUT',
        { ...fields, model: 'Other saved draft' },
        other,
      )
    ).status,
    200,
  );
  const state = f.state();
  for (const [key, userId] of [
    ['owner-fixture-link', profile.id],
    ['other-fixture-link', otherProfile.id],
  ]) {
    state.identities[key] = {
      userId,
      method: 'password',
      issuer: 'https://fixture.invalid',
      subject: key,
    };
    state.authTransactions[key] = { linkUserId: userId, fixture: true };
  }
  f.durable.set('state', state);
  const untouched = {
    profile: structuredClone(state.profiles[otherProfile.id]),
    listing: structuredClone(state.listings[otherListing.id]),
    draft: structuredClone(state.drafts[otherProfile.id]),
    identity: structuredClone(state.identities['other-fixture-link']),
    transaction: structuredClone(state.authTransactions['other-fixture-link']),
  };
  assert.equal(
    (await f.call('/account', 'DELETE', { confirm: profile.email }, owner))
      .status,
    200,
  );
  f.restart();
  for (const token of [owner, ownerAgain])
    assert.equal(
      (await f.call('/account', 'GET', undefined, token)).status,
      401,
    );
  assert.equal((await account(f, other)).profile.id, otherProfile.id);
  const after = f.state();
  assert.equal(after.profiles[profile.id], undefined);
  assert.equal(after.drafts[profile.id], undefined);
  assert.equal(
    Object.values(after.sessions).some(
      (session) => session.userId === profile.id,
    ),
    false,
  );
  assert.equal(after.identities['owner-fixture-link'], undefined);
  assert.equal(after.authTransactions['owner-fixture-link'], undefined);
  assert.deepEqual(after.profiles[otherProfile.id], untouched.profile);
  assert.deepEqual(after.listings[otherListing.id], untouched.listing);
  assert.deepEqual(after.drafts[otherProfile.id], untouched.draft);
  assert.deepEqual(after.identities['other-fixture-link'], untouched.identity);
  assert.deepEqual(
    after.authTransactions['other-fixture-link'],
    untouched.transaction,
  );
  assert.equal(
    after.audit.filter(
      (entry) =>
        entry.action === 'account-delete' && entry.actor === profile.id,
    ).length,
    1,
  );
});

test('each existing account hold blocks ordinary account reads and maintenance without affecting an unrelated seller', async () => {
  for (const hold of ['disabled', 'identityBlocked', 'adminSuspended']) {
    const f = fixture();
    const owner = await f.login();
    const other = await f.login('other@example.test');
    const profile = (await account(f, owner)).profile;
    assert.equal(
      (await f.call('/account', 'PATCH', { [hold]: false }, owner)).status,
      400,
    );
    const state = f.state();
    state.profiles[profile.id][hold] = true;
    f.durable.set('state', state);
    for (const [path, method, body] of [
      ['/account', 'GET', undefined],
      ['/account', 'PATCH', { name: 'Forbidden edit' }],
      ['/account', 'DELETE', { confirm: profile.email }],
      ['/account/sessions', 'DELETE', { all: true }],
      ['/logout', 'POST', {}],
    ])
      assert.equal(
        (await f.call(path, method, body, owner)).status,
        401,
        hold + ' ' + method + ' ' + path,
      );
    assert.equal(f.state().profiles[profile.id][hold], true);
    assert.equal(f.state().profiles[profile.id].name, profile.name);
    assert.equal((await account(f, other)).profile.email, 'other@example.test');
  }
});

test('staff preview and replay cannot bypass authorization or freshness checks at apply time', async () => {
  const f = fixture();
  const owner = await f.login();
  const profile = (await account(f, owner)).profile;
  const identity = {
    actor: 'staff@example.test',
    scope: 'seller-accounts',
    authenticatedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };
  f.env.ACCOUNT_ADMIN_SITE_ORIGIN = 'http://localhost';
  f.env.ACCOUNT_ADMIN_AUTH = { fetch: async () => Response.json(identity) };
  const body = {
    id: 'local-maintenance-operation',
    operation: 'update-profile',
    reasonCode: 'maintenance',
    changes: { name: 'Reviewed contact correction' },
  };
  const prefix = '/admin/accounts/' + profile.id;
  const call = (action, packet) =>
    f.call(prefix + '/' + action, 'POST', packet, 'synthetic-staff', {
      Origin: 'http://localhost',
    });
  const preview = await call('preview', body);
  assert.equal(preview.status, 200);
  const packet = { ...body, confirmation: (await preview.json()).confirmation };
  const original = { ...identity };
  for (const change of [
    { scope: 'listing-review' },
    { expiresAt: Date.now() - 1 },
    { authenticatedAt: Date.now() - 600001 },
  ]) {
    Object.assign(identity, original, change);
    assert.equal((await call('apply', packet)).status, 403);
    assert.equal(f.state().profiles[profile.id].name, profile.name);
    assert.equal(f.state().accountAdminOperations[body.id], undefined);
  }
  Object.assign(identity, original, { actor: 'different-staff@example.test' });
  assert.equal((await call('apply', packet)).status, 409);
  Object.assign(identity, original);
  assert.equal((await call('apply', packet)).status, 200);
  identity.expiresAt = Date.now() - 1;
  assert.equal((await call('apply', packet)).status, 403);
  Object.assign(identity, original);
  assert.equal((await (await call('apply', packet)).json()).replayed, true);
  assert.equal(
    f
      .state()
      .audit.filter((entry) => entry.action === 'account-admin-operation')
      .length,
    1,
  );
});
