import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFixture } from './jerry-fixture.mjs';
import { jerryDraftStamp } from '../../workers/aircraft-sale/jerry-authority.mjs';
import { listingCategories } from '../../lib/marketplace/schema.mjs';

test('guided intake commits draft and replay receipt together; lost response retry never advances twice', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  const seed = f.message(c, 'I want to create a listing.', 'listing');
  const first = await f.call('message', seed);
  assert.ok(first.result.state);
  const before = structuredClone(f.f.state().drafts[f.profile.id]);
  const replay = await f.call('message', seed);
  assert.deepEqual(replay.result, first.result);
  assert.deepEqual(f.f.state().drafts[f.profile.id], before);
  const answer = f.message(c, 'aircraft', 'listing', {
    draftStamp: first.result.draftStamp,
  });
  const completed = await f.call('message', answer),
    after = structuredClone(f.f.state().drafts[f.profile.id]);
  // Simulate successful business mutation followed by a dropped finalize write.
  const object = f.objects.get(f.owner + ':exchange'),
    key = 't:' + c.id + ':' + answer.turnId;
  const turn = object.existing.get(key);
  turn.status = 'failed';
  delete turn.result;
  object.existing.set(key, turn);
  const recovered = await f.call('message', answer);
  assert.deepEqual(recovered.result, completed.result);
  assert.deepEqual(f.f.state().drafts[f.profile.id], after);
  assert.equal(f.relayCalls(), 0);
});
test('two tabs answering the same draft revision cannot both advance it', async () => {
  const f = await serviceFixture(),
    a = await f.create(),
    b = await f.create();
  const start = await f.call(
    'message',
    f.message(a, 'I want to create a listing.', 'listing'),
  );
  const inputs = [
    f.message(a, 'aircraft', 'listing', {
      draftStamp: start.result.draftStamp,
    }),
    f.message(b, 'parts', 'listing', { draftStamp: start.result.draftStamp }),
  ];
  const outcomes = await Promise.allSettled(
    inputs.map((input) => f.call('message', input)),
  );
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((x) => x.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.code, 'JERRY_DRAFT_CHANGED');
});
test('fresh conversation resumes the existing manual draft and deletion removes receipts, not saved fields', async () => {
  const f = await serviceFixture(),
    token = f.proof.authorization.slice(7);
  const saved = await f.f.call(
    '/draft/autosave',
    'PUT',
    {
      expectedRevision: null,
      step: 3,
      values: {
        workflowVersion: '3',
        listingType: 'parts',
        category: listingCategories.find((c) => c.type === 'parts').id,
        title: 'Synthetic component',
        description: 'Preserve original description',
        sellerLocation: 'Synthetic City',
      },
    },
    token,
  );
  assert.equal(saved.status, 200, await saved.clone().text());
  const before = structuredClone(f.f.state().drafts[f.profile.id]),
    c = await f.create();
  const stamp = await jerryDraftStamp(before);
  const result = await f.call(
    'message',
    f.message(c, 'I want to resume my saved listing.', 'listing', {
      draftStamp: stamp,
      resume: true,
    }),
  );
  const draft = f.f.state().drafts[f.profile.id];
  assert.equal(draft.fields.title, before.values.title);
  assert.equal(draft.fields.description, before.values.description);
  assert.ok(result.result.state);
  await f.call('delete', { id: c.id, generation: 1 });
  const receipt = Object.values(f.f.state().idempotency).find(
    (r) => r.kind === 'jerry-intake',
  );
  assert.equal(receipt.result, undefined);
  assert.equal(receipt.deleted, true);
  assert.deepEqual(f.f.state().drafts[f.profile.id], draft);
  const fresh = await f.create();
  const resumed = await f.call(
    'message',
    f.message(fresh, 'I want to resume my saved listing.', 'listing', {
      draftStamp: await jerryDraftStamp(draft),
      resume: true,
    }),
  );
  assert.match(resumed.result.reply, /Continuing your saved draft/);
});
