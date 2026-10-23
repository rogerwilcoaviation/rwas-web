import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fields } from './fixture.mjs';
import {
  listingCategories,
  categoryFields,
} from '../../lib/marketplace/schema.mjs';

const draft = async (f, token) =>
  (await f.call('/draft', 'GET', undefined, token)).json();
const resume = (f, token) =>
  f.call(
    '/intake',
    'POST',
    {
      resume: true,
      messages: [
        { role: 'user', content: 'I want to resume my saved listing.' },
      ],
    },
    token,
  );

test('resuming an absent draft never silently starts a new listing', async () => {
  const f = fixture(),
    token = await f.login();
  assert.equal((await resume(f, token)).status, 404);
  assert.equal((await draft(f, token)).draft, null);
});
for (const type of ['aircraft', 'hangars', 'parts', 'tools']) {
  test(`manual ${type} draft resumes with Jerry without losing answers or specifications`, async () => {
    const f = fixture(),
      token = await f.login();
    const saved = {
      workflowVersion: '3',
      listingType: type,
      category: listingCategories.find((c) => c.type === type).id,
      title: 'Synthetic saved ' + type,
      description: 'Preserve this description',
      sellerLocation: 'Synthetic location',
    };
    const spec = categoryFields(saved).find(
      (field) => !field.options && field.type !== 'number',
    );
    if (spec)
      saved.specifications = {
        [spec.name.slice(5)]: 'Preserved optional detail',
      };
    assert.equal((await f.call('/draft', 'PUT', saved, token)).status, 200);
    const result = await resume(f, token);
    assert.equal(result.status, 200, await result.clone().text());
    assert.match((await result.json()).reply, /Continuing your saved draft/);
    const restored = (await draft(f, token)).draft;
    for (const [key, value] of Object.entries(saved))
      assert.deepEqual(restored.fields[key], value);
    const repeated = await resume(f, token);
    assert.equal(repeated.status, 200);
    assert.deepEqual(
      (await draft(f, token)).draft,
      restored,
      'Repeated resume does not advance or mutate answers',
    );
    f.restart();
    assert.deepEqual(
      (await draft(f, token)).draft,
      restored,
      'Saved answers survive restart',
    );
    assert.equal(Object.keys(f.state().listings).length, 0);
  });
}
test('legacy aircraft details survive switching to Jerry and repeat resume keeps the cursor', async () => {
  const f = fixture(),
    token = await f.login();
  await f.call(
    '/draft',
    'PUT',
    { ...fields, description: 'Existing description' },
    token,
  );
  const response = await resume(f, token);
  assert.equal(response.status, 200, await response.clone().text());
  const saved = await draft(f, token);
  assert.equal(saved.draft.fields.make, fields.make);
  assert.equal(saved.draft.fields.description, 'Existing description');
  assert.match((await response.json()).reply, /Avionics/);
});
test('resumed intake becomes one listing atomically, replay retains identity, and stale/foreign snapshots cannot consume drafts', async () => {
  const f = fixture(),
    token = await f.login(),
    other = await f.login('other@example.test');
  await f.call(
    '/intake',
    'POST',
    { messages: [{ role: 'user', content: 'I want to create a listing.' }] },
    token,
  );
  const source = await draft(f, token);
  const headers = {
    'Idempotency-Key': 'resume-once',
    'X-RWAS-Draft-Revision': source.revision,
  };
  const foreign = await f.call('/listings', 'POST', fields, other, headers);
  assert.equal(foreign.status, 409);
  const first = await f.call(
    '/listings',
    'POST',
    { ...fields, description: 'Manual edits to the intake' },
    token,
    headers,
  );
  assert.equal(first.status, 201, await first.clone().text());
  const listing = (await first.json()).listing;
  assert.equal((await draft(f, token)).draft, null);
  const replay = await f.call(
    '/listings',
    'POST',
    { ...fields, description: 'Manual edits to the intake' },
    token,
    headers,
  );
  assert.equal((await replay.json()).listing.id, listing.id);
  await f.call('/draft', 'PUT', { make: 'Newer draft' }, token);
  const stale = await f.call('/listings', 'POST', fields, token, {
    ...headers,
    'Idempotency-Key': 'stale',
  });
  assert.equal(stale.status, 409);
  assert.equal((await draft(f, token)).draft.make, 'Newer draft');
  assert.equal(Object.keys(f.state().listings).length, 1);
});
