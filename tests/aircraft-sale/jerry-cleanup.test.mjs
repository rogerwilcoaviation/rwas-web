import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceFixture } from './jerry-fixture.mjs';
import { jerryActivity } from '../../workers/aircraft-sale/jerry-service.mjs';
test('failed response attempts retain a content-free troubleshooting reference even when the user does not retry', async () => {
  const f = await serviceFixture(),
    c = await f.create(),
    input = f.message(c);
  f.relay(async () =>
    Response.json(
      {
        error: 'Synthetic capacity limit',
        status: 429,
        code: 'JERRY_ADMISSION_CAPACITY',
      },
      { status: 429 },
    ),
  );
  await assert.rejects(f.call('message', input), { status: 429 });
  const object = f.objects.get(f.owner + ':exchange'),
    meta = object.existing.get('c:' + c.id);
  for (const item of Object.values(meta.logsToWrite))
    if (typeof item === 'object') item.at = Date.now() - 1;
  object.existing.set('c:' + c.id, meta);
  await object.object().alarm();
  const log = await f.store.activityLog.query(
    new URL('http://localhost?type=conversation&result=failure'),
  );
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].details.conversationRef.turnId, input.turnId);
  assert.equal(log.events[0].actor.email, f.profile.email);
  assert.equal(log.events[0].status, 429);
  assert.equal(log.events[0].details.failureCode, 'JERRY_ADMISSION_CAPACITY');
  assert.deepEqual(object.existing.get('c:' + c.id).logsToWrite, {});
  assert.ok(!JSON.stringify(log).includes(input.input.message));
});
test('expiry alarm erases content without any further user traffic, including imported/log/receipt copies', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  await f.call('import', {
    id: c.id,
    generation: 1,
    operationId: crypto.randomUUID(),
    consent: true,
    messages: [{ role: 'user', content: 'SYNTHETIC IMPORT CONTENT' }],
  });
  const input = f.message(c, 'I want to create a listing.', 'listing');
  await f.call('message', input);
  const saved = structuredClone(f.f.state().drafts);
  await f.store.activityLog.append([
    {
      id: crypto.randomUUID(),
      at: Date.now(),
      actor: { id: f.profile.id },
      details: {
        conversation: {
          id: c.id,
          messages: [{ role: 'assistant', content: 'SYNTHETIC LEGACY COPY' }],
        },
      },
    },
  ]);
  const object = f.objects.get(f.owner + ':exchange'),
    meta = object.existing.get('c:' + c.id);
  meta.expiresAt = Date.now() - 1;
  object.existing.set('c:' + c.id, meta);
  object.restart();
  await object.object().alarm();
  assert.equal(object.existing.has('c:' + c.id), false);
  assert.ok(object.existing.has('d:' + c.id));
  const remaining = JSON.stringify([...object.existing]);
  assert.ok(!remaining.includes('SYNTHETIC IMPORT CONTENT'));
  assert.ok(!remaining.includes('I want to create a listing.'));
  assert.ok(!remaining.includes('New conversation'));
  assert.ok(
    !JSON.stringify(f.f.durable.get('exchange-activity')).includes(
      'SYNTHETIC LEGACY COPY',
    ),
  );
  assert.ok(
    Object.values(f.f.state().idempotency)
      .filter((r) => r.kind === 'jerry-intake')
      .every((r) => r.result === undefined),
  );
  assert.deepEqual(f.f.state().drafts, saved);
});
test('an unsuccessful local outbox acknowledgment backs off and recovers after restart', async () => {
  const f = await serviceFixture(),
    c = await f.create(),
    input = f.message(c);
  await f.call('message', input);
  const fixture = f.objects.get(f.owner + ':exchange'),
    object = fixture.object(),
    meta = fixture.existing.get('c:' + c.id);
  meta.logsToWrite[input.turnId] = Date.now() - 1;
  fixture.existing.set('c:' + c.id, meta);
  const originalFetch = object.fetch.bind(object);
  object.fetch = (request) =>
    new URL(request.url).pathname === '/log-complete'
      ? new Response(null, { status: 503 })
      : originalFetch(request);
  await object.alarm();
  const pending = fixture.existing.get('c:' + c.id);
  assert.ok(pending.logsToWrite[input.turnId] >= Date.now() + 59000);
  pending.logsToWrite[input.turnId] = Date.now() - 1;
  fixture.existing.set('c:' + c.id, pending);
  fixture.restart();
  await fixture.object().alarm();
  assert.deepEqual(fixture.existing.get('c:' + c.id).logsToWrite, {});
});
const internal = (f, path, body) =>
  f.store.fetch(
    new Request(
      'https://seller-service.internal/api/aircraft-sale/_jerry/' + path,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  );

test('copy cleanup survives a storage outage and completes through a durable alarm', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  await f.call('message', f.message(c));
  f.f.storageFailure(true);
  const deleted = await f.call('delete', { id: c.id, generation: 1 });
  assert.equal(deleted.pending, true);
  await assert.rejects(f.call('read', { id: c.id }), { status: 410 });
  const object = f.objects.get(f.owner + ':exchange');
  assert.equal(object.existing.get('c:' + c.id).status, 'deleting');
  f.f.storageFailure(false);
  object.restart();
  await object.object().alarm();
  assert.equal(object.existing.has('c:' + c.id), false);
  assert.equal(f.f.state().jerryConversationRefs[c.id].cleanupComplete, true);
});
test('content-free log outbox retries outage without cookies and admin read resolves only Exchange content', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  const original = f.store.activityLog.append.bind(f.store.activityLog);
  let broken = true;
  f.store.activityLog.append = async (...args) => {
    if (broken) throw Error('Synthetic activity outage');
    return original(...args);
  };
  const input = f.message(c);
  await f.call('message', input);
  const object = f.objects.get(f.owner + ':exchange'),
    meta = object.existing.get('c:' + c.id);
  assert.ok(meta.logsToWrite[input.turnId]);
  meta.logsToWrite[input.turnId] = Date.now() - 1;
  object.existing.set('c:' + c.id, meta);
  broken = false;
  await object.object().alarm();
  const event = await f.store.activityLog.get(input.turnId);
  assert.deepEqual(object.existing.get('c:' + c.id).logsToWrite, {});
  assert.equal(event.details.conversation, undefined);
  assert.equal(event.details.conversationRef.conversationId, c.id);
  assert.equal(event.actor.email, f.profile.email);
  f.env.ACCOUNT_ADMIN_SITE_ORIGIN = 'http://localhost';
  f.env.ACCOUNT_ADMIN_AUTH = {
    fetch: async (req) =>
      req.headers.get('Authorization') === 'Bearer synthetic-admin'
        ? Response.json({
            actor: 'fixture-admin',
            scope: 'seller-accounts',
            expiresAt: Date.now() + 100000,
            authenticatedAt: Date.now(),
          })
        : new Response(null, { status: 403 }),
  };
  const proof = {
    origin: 'http://localhost',
    authorization: 'Bearer synthetic-admin',
  };
  const detail = await jerryActivity(f.env, { proof, eventId: input.turnId });
  assert.equal(detail.exchanges[0].messages[0].content, input.input.message);
  await assert.rejects(
    jerryActivity(f.env, {
      proof: { ...proof, authorization: 'Bearer not-admin' },
      eventId: input.turnId,
    }),
    { status: 403 },
  );
  await f.call('delete', { id: c.id, generation: 1 });
  const removed = await jerryActivity(f.env, { proof, eventId: input.turnId });
  assert.deepEqual(removed.exchanges, []);
  assert.equal(removed.conversationUnavailable, 'Deleted or expired');
  const pub = await f.call(
    'create',
    { id: crypto.randomUUID() },
    { surface: 'public', page: '/' },
  );
  await f.call(
    'message',
    {
      ...f.message(pub.conversation),
      input: {
        message: 'PUBLIC MUST STAY OUT',
        page: '/',
        locale: 'en',
        mode: 'chat',
      },
    },
    { surface: 'public', page: '/' },
  );
  assert.ok(
    !JSON.stringify(
      await f.store.activityLog.query(
        new URL('http://localhost?type=conversation'),
      ),
    ).includes('PUBLIC MUST STAY OUT'),
  );
});
test('permanent account removal schedules canonical cleanup without deleting independent business records', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  await f.call('message', f.message(c));
  const state = f.f.state();
  delete state.profiles[f.profile.id];
  state.drafts['different-owner'] = { title: 'Preserve another owner' };
  f.f.durable.set('state', state);
  await f.store.alarm();
  const object = f.objects.get(f.owner + ':exchange');
  assert.equal(object.existing.has('c:' + c.id), false);
  assert.equal(object.existing.has('d:' + c.id), true);
  assert.equal(
    f.f.state().drafts['different-owner'].title,
    'Preserve another owner',
  );
});
