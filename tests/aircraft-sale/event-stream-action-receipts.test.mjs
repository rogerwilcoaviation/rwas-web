import { test } from 'node:test';
import assert from 'node:assert/strict';
import action from '../../workers/aircraft-sale/auth0/event-stream-receipts.cjs';

const now = Date.now();
const secret = 'synthetic-stream-secret-not-a-real-credential';
const event = (blocked = Symbol.for('absent')) => {
  const object = {
    user_id: 'auth0|6ac289869ba8663d62970c1a',
    email: 'PRIVATE@example.test',
    identities: [{ private: true }],
    user_metadata: { private: true },
  };
  if (blocked !== Symbol.for('absent')) object.blocked = blocked;
  return {
    secrets: {
      QA_AUTH0_SUBJECT: object.user_id,
      RWAS_SECURITY_EVENT_URL:
        'https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/auth0-events',
      AUTH_EVENT_TENANT: 'dev-enkgj0dnenb3r4f8',
      AUTH_EVENT_SOURCE: 'urn:auth0:dev-enkgj0dnenb3r4f8:users',
      AUTH_EVENT_STREAM_ID: 'est_ebUFHYC2eJ3cqcn7tXPtrh',
      AUTH_STREAM_SECRET: secret,
    },
    message: {
      specversion: '1.0',
      type: 'user.updated',
      source: 'urn:auth0:dev-enkgj0dnenb3r4f8:users',
      a0tenant: 'dev-enkgj0dnenb3r4f8',
      a0stream: 'est_ebUFHYC2eJ3cqcn7tXPtrh',
      id: 'evt_' + 'A'.repeat(22),
      time: new Date(now).toISOString(),
      data: { object, previous_object: { user_id: object.user_id } },
    },
  };
};

test('Action forwards absent, false and true using only the minimal QA projection', async () => {
  for (const [blocked, present] of [
    [Symbol.for('absent'), false],
    [false, true],
    [true, true],
  ]) {
    let request;
    const send = action.createHandler({
      now: () => now,
      log: () => {},
      fetch: async (_, init) => {
        request = init;
        return Response.json({ ok: true, receiptId: 'a0_' + 'b'.repeat(64) });
      },
    });
    await send(event(blocked));
    const body = JSON.parse(request.body);
    assert.deepEqual(Object.keys(body).sort(), [
      'a0stream',
      'a0tenant',
      'data',
      'id',
      'source',
      'specversion',
      'time',
      'type',
    ]);
    assert.deepEqual(
      Object.keys(body.data.object).sort(),
      present
        ? ['blocked', 'blockedPresent', 'user_id']
        : ['blockedPresent', 'user_id'],
    );
    assert.equal(body.data.object.blockedPresent, present);
    if (present) assert.equal(body.data.object.blocked, blocked);
    const text = JSON.stringify(body);
    for (const privateValue of [
      'PRIVATE@example.test',
      'identities',
      'user_metadata',
      secret,
    ])
      assert.equal(text.includes(privateValue), false);
  }
});

test('Action remains exact-subject and exact-stream fail closed', async () => {
  let calls = 0;
  const send = action.createHandler({
    fetch: async () => {
      calls++;
      return Response.json({ ok: true });
    },
  });
  const other = event(false);
  other.message.data.object.user_id = 'auth0|other';
  await send(other);
  assert.equal(calls, 0);
  const wrong = event(false);
  wrong.message.a0stream = 'est_' + 'Z'.repeat(22);
  await assert.rejects(send(wrong));
  assert.equal(calls, 0);
});
