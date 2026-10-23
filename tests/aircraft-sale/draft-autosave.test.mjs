import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fields, png } from './fixture.mjs';
const read = async (f, t) =>
  (await f.call('/draft', 'GET', undefined, t)).json();
const auto = (f, t, values, expectedRevision = null, extra = {}) =>
  f.call(
    '/draft/autosave',
    'PUT',
    {
      values,
      step: 3,
      listingId: null,
      listingRevision: null,
      expectedRevision,
      ...extra,
    },
    t,
  );
test('autosave retains incomplete, invalid and whitespace text across restarts, privately and without publishing', async () => {
  const f = fixture(),
    t = await f.login(),
    other = await f.login('other@example.test');
  const values = {
    __legacyAircraft: 'true',
    make: 'Cessna',
    year: '19',
    description: '  Unsaved typing\nsecond line  ',
  };
  assert.equal((await auto(f, undefined, values)).status, 401);
  const response = await auto(f, t, values);
  assert.equal(response.status, 200, await response.clone().text());
  const saved = await response.json();
  assert.deepEqual(saved.draft.values, values);
  assert.equal(saved.draft.step, 3);
  f.restart();
  assert.deepEqual((await read(f, t)).draft.values, values);
  assert.equal((await read(f, other)).draft, null);
  assert.equal(Object.keys(f.state().listings).length, 0);
  assert.equal(
    (await auto(f, t, { ...values, year: '2000' })).status,
    409,
    'Another tab cannot overwrite an existing draft without its revision',
  );
  const newer = await auto(f, t, { ...values, year: '2000' }, saved.revision);
  assert.equal(newer.status, 200);
  assert.equal((await auto(f, t, values, saved.revision)).status, 409);
});
test('autosave rejects unexpected fields, oversized snapshots and other users’ listing identities', async () => {
  const f = fixture(),
    t = await f.login(),
    other = await f.login('other@example.test');
  assert.equal((await auto(f, t, { password: 'secret' })).status, 400);
  assert.equal(
    (await auto(f, t, { description: 'x'.repeat(10001) })).status,
    400,
  );
  const response = await f.call('/listings', 'POST', fields, t, {
    'Idempotency-Key': 'base',
  });
  const listing = (await response.json()).listing;
  assert.equal(
    (
      await auto(f, other, { make: 'x' }, null, {
        listingId: listing.id,
        listingRevision: listing.revision,
      })
    ).status,
    404,
  );
});
test('autosaved new draft is consumed once; linked autosave updates the same listing and cannot create a duplicate', async () => {
  const f = fixture(),
    t = await f.login();
  const saved = await (await auto(f, t, { make: 'Synthetic' })).json();
  const created = await (
    await f.call('/listings', 'POST', fields, t, {
      'Idempotency-Key': 'new',
      'X-RWAS-Draft-Revision': saved.revision,
    })
  ).json();
  assert.equal((await read(f, t)).draft, null);
  const snapshot = await (
    await auto(f, t, { make: 'Changed' }, null, {
      listingId: created.listing.id,
      listingRevision: created.listing.revision,
    })
  ).json();
  assert.equal(
    (
      await f.call('/listings', 'POST', fields, t, {
        'Idempotency-Key': 'duplicate',
        'X-RWAS-Draft-Revision': snapshot.revision,
      })
    ).status,
    409,
  );
  const update = await f.call(
    '/listings/' + created.listing.id,
    'PUT',
    { make: 'Changed' },
    t,
    { 'X-RWAS-Draft-Revision': snapshot.revision },
  );
  assert.equal(update.status, 200, await update.clone().text());
  assert.equal((await update.json()).listing.id, created.listing.id);
  assert.equal(Object.keys(f.state().listings).length, 1);
  assert.equal((await read(f, t)).draft, null);
});
test('Jerry resumes an autosaved partial year instead of losing it or treating resume as an answer', async () => {
  const f = fixture(),
    t = await f.login();
  await auto(f, t, {
    __legacyAircraft: 'true',
    make: 'Cessna',
    model: '172',
    year: '19',
    nNumber: 'N123AB',
    description: 'Keep my text',
    sellerLocation: 'Synthetic airport',
  });
  const resume = await f.call(
    '/intake',
    'POST',
    { resume: true, messages: [{ role: 'user', content: 'Resume' }] },
    t,
  );
  assert.equal(resume.status, 200, await resume.clone().text());
  assert.match((await resume.json()).reply, /year/i);
  const saved = (await read(f, t)).draft;
  assert.equal(saved.fields.year, '19');
  assert.equal(saved.fields.description, 'Keep my text');
  const next = await f.call(
    '/intake',
    'POST',
    { messages: [{ role: 'user', content: '2000' }] },
    t,
  );
  assert.equal(next.status, 200);
  assert.equal((await read(f, t)).draft.fields.year, 2000);
});
test('linked autosave detects changed listing content and refuses to overwrite it', async () => {
  const f = fixture(),
    t = await f.login();
  const listing = (
    await (
      await f.call('/listings', 'POST', fields, t, {
        'Idempotency-Key': 'base',
      })
    ).json()
  ).listing;
  const saved = await (
    await auto(f, t, { make: 'Local typing' }, null, {
      listingId: listing.id,
      listingRevision: listing.revision,
    })
  ).json();
  await f.call(
    '/listings/' + listing.id,
    'PUT',
    { make: 'Newer server text' },
    t,
  );
  assert.equal((await read(f, t)).listingConflict, true);
  assert.equal(
    (
      await f.call(
        '/listings/' + listing.id,
        'PUT',
        { make: 'Local typing' },
        t,
        { 'X-RWAS-Draft-Revision': saved.revision },
      )
    ).status,
    409,
  );
  assert.equal((await read(f, t)).draft.values.make, 'Local typing');
});

test('media uploads preserve a linked draft and do not cause a false content conflict', async () => {
  const f = fixture(),
    t = await f.login();
  const listing = (
    await (
      await f.call('/listings', 'POST', fields, t, {
        'Idempotency-Key': 'media-base',
      })
    ).json()
  ).listing;
  const saved = await (
    await auto(f, t, { make: 'Changed after photos' }, null, {
      listingId: listing.id,
      listingRevision: listing.revision,
    })
  ).json();
  const uploaded = await f.call(
    '/upload?listingId=' + listing.id + '&category=photos&filename=a.png',
    'POST',
    png,
    t,
  );
  assert.equal(uploaded.status, 200, await uploaded.clone().text());
  assert.equal((await read(f, t)).listingConflict, false);
  const update = await f.call(
    '/listings/' + listing.id,
    'PUT',
    { make: 'Changed after photos' },
    t,
    { 'X-RWAS-Draft-Revision': saved.revision },
  );
  assert.equal(update.status, 200, await update.clone().text());
  assert.equal((await update.json()).listing.photos.length, 1);
});
