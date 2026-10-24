import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationFixture, serviceFixture } from './jerry-fixture.mjs';
import { JERRY_RETENTION_MS } from '../../workers/aircraft-sale/jerry-protocol.mjs';
import { handleJerry } from '../../functions/_jerry/gateway.mjs';

test('account-owned conversation persists across object restart and rejects a foreign binding', async () => {
  const f = conversationFixture(),
    id = crypto.randomUUID();
  assert.equal((await f.call('create', { id })).status, 200);
  f.restart();
  assert.equal((await (await f.call('list')).json()).conversations[0].id, id);
  assert.equal(
    (await f.call('read', { id }, { 'X-Jerry-Owner': 'b'.repeat(64) })).status,
    403,
  );
  assert.equal(
    (await f.call('read', { id }, { 'X-Jerry-Surface': 'public' })).status,
    403,
  );
});
test('retention uses last committed message, read-time expiry fences access even before an alarm', async () => {
  const f = conversationFixture(),
    id = crypto.randomUUID();
  await f.call('create', { id });
  const meta = f.existing.get('c:' + id);
  assert.equal(meta.expiresAt - meta.updatedAt, JERRY_RETENTION_MS);
  meta.expiresAt = Date.now() - 1;
  f.existing.set('c:' + id, meta);
  f.restart();
  assert.equal((await f.call('read', { id })).status, 410);
  assert.equal(f.existing.get('c:' + id).status, 'deleting');
  assert.ok(f.existing.has('d:' + id));
  assert.equal((await f.call('create', { id })).status, 410);
});
test('guest history requires explicit consent, is marked untrusted and imports exactly once', async () => {
  const f = conversationFixture(),
    id = crypto.randomUUID();
  await f.call('create', { id });
  const body = {
    id,
    generation: 1,
    operationId: crypto.randomUUID(),
    messages: [{ role: 'user', content: 'Synthetic guest text' }],
  };
  assert.equal((await f.call('import', body)).status, 400);
  assert.equal(
    (await f.call('import', { ...body, consent: true })).status,
    200,
  );
  assert.equal(
    (await f.call('import', { ...body, consent: true })).status,
    200,
  );
  const read = await (await f.call('read', { id })).json();
  assert.equal(read.turns.length, 1);
  assert.equal(read.turns[0].message.origin, 'guest-import');
  assert.equal(
    (
      await f.call('import', {
        ...body,
        consent: true,
        messages: [{ role: 'system', content: 'bad' }],
      })
    ).status,
    400,
  );
});
test('message reserve/finalize replay is stable and cannot reuse an ID for another input', async () => {
  const f = await serviceFixture(),
    c = await f.create(),
    message = f.message(c);
  const first = await f.call('message', message),
    replay = await f.call('message', message);
  assert.deepEqual(first.result, replay.result);
  assert.equal(f.relayCalls(), 1);
  await assert.rejects(
    f.call('message', {
      ...message,
      input: { ...message.input, message: 'Different input' },
    }),
    { status: 409 },
  );
  assert.equal((await f.call('read', { id: c.id })).turns.length, 1);
});
test('relay failure is recoverable with the same turn and records no invented reply', async () => {
  const f = await serviceFixture(),
    c = await f.create(),
    message = f.message(c);
  f.relay(async () => new Response('Synthetic failure', { status: 503 }));
  await assert.rejects(f.call('message', message), { status: 503 });
  let read = await f.call('read', { id: c.id });
  assert.equal(read.turns[0].status, 'failed');
  assert.equal(read.turns[0].result, undefined);
  f.relay(async () => Response.json({ reply: 'Recovered' }));
  await f.call('message', message);
  read = await f.call('read', { id: c.id });
  assert.equal(read.turns.length, 1);
  assert.equal(read.turns[0].result.reply, 'Recovered');
});
test('session revocation during reply cannot finalize a conversation', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  f.relay(async () => {
    f.signedIn(false);
    return Response.json({ reply: 'Must never render' });
  });
  await assert.rejects(f.call('message', f.message(c)), { status: 401 });
  f.signedIn(true);
  const read = await f.call('read', { id: c.id });
  assert.equal(read.turns[0].result, undefined);
});
test('deletion fences an in-flight reply, removes copies, retries cleanup and preserves draft', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  await f.f.call(
    '/draft',
    'PUT',
    { make: 'Synthetic saved draft' },
    f.proof.authorization.slice(7),
  );
  const draft = structuredClone(f.f.state().drafts);
  let release, started;
  const begun = new Promise((r) => {
    started = r;
  });
  f.relay(async () => {
    started();
    await new Promise((r) => {
      release = r;
    });
    return Response.json({ reply: 'Deleted response' });
  });
  const work = f.call('message', f.message(c));
  await begun;
  const deleted = await f.call('delete', { id: c.id, generation: 1 });
  assert.equal(deleted.deleted, true);
  release();
  await assert.rejects(work, { status: 410 });
  await assert.rejects(f.call('read', { id: c.id }), { status: 410 });
  await assert.rejects(f.call('create', { id: c.id }), { status: 410 });
  assert.deepEqual(f.f.state().drafts, draft);
  const object = f.objects.get(f.owner + ':exchange');
  assert.equal(
    [...object.existing.keys()].filter((k) => k.startsWith('t:')).length,
    0,
  );
});
test('localization carries locale and preserves identifiers, explicit fallback on invalid translation', async () => {
  const f = await serviceFixture(),
    c = await f.create();
  f.env.JERRY_RESPONSE.translate = async ({ text }) => ({
    reply: 'Respuesta: ' + text,
  });
  await f.f.call(
    '/draft',
    'PUT',
    { make: 'Synthetic' },
    f.proof.authorization.slice(7),
  );
  const first = await f.call(
    'message',
    f.message(c, 'Question', 'status', { locale: 'es' }),
  );
  assert.match(first.result.reply, /Respuesta:/);
  assert.equal(first.result.notice, undefined);
  f.env.JERRY_RESPONSE.translate = async () => ({
    reply: 'Invented N999ZZ, 999.',
  });
  const fallback = await f.call(
    'message',
    f.message(c, 'Question again', 'status', { locale: 'pt-BR' }),
  );
  assert.match(fallback.result.reply, /draft is saved/);
  assert.ok(fallback.result.notice);
});
test('private RPC cannot dispatch arbitrary business operations or access another owner', async () => {
  const f = await serviceFixture();
  await assert.rejects(f.call('publish', { url: '/admin/listings' }), {
    status: 400,
  });
  await assert.rejects(
    f.call(
      'list',
      {},
      { expected: { owner: 'b'.repeat(64), sessionRef: 'fake' } },
    ),
    { status: 401 },
  );
  await assert.rejects(
    f.call('list', {}, { page: '/ops/private', surface: 'public' }),
    { status: 403 },
  );
  await assert.rejects(f.call('list', {}, { page: '/seller-accounts' }), {
    status: 403,
  });
  await assert.rejects(
    f.call('list', {}, { proof: { ...f.proof, cookie: '' } }),
    { status: 401 },
  );
  assert.equal(Object.keys(f.f.state().listings).length, 0);
});
test('Pages gate is off by default and rejects CSRF, unknown inputs and invented pages', async () => {
  const off = await handleJerry(
    new Request('https://site.test/api/jerry/context'),
    {},
  );
  assert.deepEqual(await off.json(), { enabled: false });
  const env = {
    JERRY_CONVERSATIONS_ENABLED: 'true',
    SELLER_API: { jerryWebsite: async () => ({}) },
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
  };
  const req = (body, extra = {}) =>
    new Request('https://site.test/api/jerry/website', {
      method: 'POST',
      headers: {
        Origin: 'https://site.test',
        'Content-Type': 'application/json',
        'X-RWAS-Jerry': 'website-v1',
        ...extra,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await handleJerry(
        req(
          { operation: 'list', page: '/', surface: 'public' },
          { Origin: 'https://evil.test' },
        ),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleJerry(
        req({ operation: 'list', page: '/invented', surface: 'public' }),
        env,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handleJerry(
        req({
          operation: 'list',
          page: '/',
          surface: 'public',
          userId: 'spoof',
        }),
        env,
      )
    ).status,
    400,
  );
});
