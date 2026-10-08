import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFixture } from './identity-fixture.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const pause = () => new Promise((resolve) => setTimeout(resolve, 3));
const source = 'urn:auth0:identity.fixture.test';
const streamId = 'est_' + 'A'.repeat(22);
const token = 'synthetic-stream-proof-never-a-real-credential';
const notification = (changes = {}) => ({
  specversion: '1.0',
  type: 'user.updated',
  source,
  a0tenant: 'fixture-tenant',
  a0stream: streamId,
  id: 'evt_' + 'B'.repeat(22),
  time: new Date().toISOString(),
  data: {
    object: {
      user_id: 'auth0|owner',
      blocked: true,
      blockedPresent: true,
      email: 'PRIVATE-METADATA@example.test',
      user_metadata: { note: 'PRIVATE-METADATA' },
    },
    previous_object: { user_id: 'auth0|owner', blocked: false },
  },
  ...changes,
});

test('actual workerd commits stream receipt with SQLite state and preserves duplicate acknowledgement after process restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'auth0-stream-fixture-'));
  const options = {
    modules: true,
    script: (
      await build({
        entryPoints: ['workers/aircraft-sale/worker.mjs'],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
      })
    ).outputFiles[0].text,
    compatibilityDate: '2026-09-01',
    durableObjects: {
      SELLER_STORE: { className: 'SellerStore', useSQLite: true },
    },
    durableObjectsPersist: root,
    bindings: {
      AUTH_ISSUER: 'https://identity.fixture.test/',
      AUTH_CLIENT_ID: 'synthetic-client',
      AUTH_REDIRECT_URI: 'http://localhost/aircraft-for-sale',
      AUTH_STREAM_SECRET: token,
      AUTH_EVENT_SOURCE: source,
      AUTH_EVENT_STREAM_ID: streamId,
      AUTH_EVENT_TENANT: 'fixture-tenant',
    },
  };
  let mf;
  const input = notification();
  const send = async (body = input, proof = token) => {
    const response = await mf.dispatchFetch(
      'http://localhost/api/aircraft-sale/auth/auth0-events',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/cloudevents+json',
          Authorization: 'Bearer ' + proof,
        },
        body: JSON.stringify(body),
      },
    );
    // Consume the runtime response even in assertions that only inspect status.
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    });
  };
  try {
    mf = new Miniflare(options);
    assert.equal((await send(input, 'untrusted')).status, 403);
    assert.equal((await send()).status, 200);
    await mf.dispose();
    mf = new Miniflare(options);
    assert.equal((await (await send()).json()).replayed, true);
    const collision = structuredClone(input);
    collision.time = new Date(Date.now() + 1).toISOString();
    assert.equal((await send(collision)).status, 409);
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
async function setup() {
  const s = await identityFixture();
  Object.assign(s.f.env, {
    AUTH_STREAM_SECRET: token,
    AUTH_EVENT_SOURCE: source,
    AUTH_EVENT_STREAM_ID: streamId,
    AUTH_EVENT_TENANT: 'fixture-tenant',
  });
  return {
    ...s,
    send: (body, proof = token, headers) =>
      s.f.call('/auth/auth0-events', 'POST', body, proof, headers),
  };
}

test('stream configuration and proof fail closed; reset/reviewer/seller authority cannot send blocks', async () => {
  const s = await setup();
  const seller = await s.f.login();
  for (const proof of [
    'anonymous',
    seller,
    'fixture-reviewer',
    s.f.env.AUTH_EVENT_SECRET,
  ])
    assert.equal((await s.send(notification(), proof)).status, 403);
  for (const key of [
    'AUTH_STREAM_SECRET',
    'AUTH_EVENT_SOURCE',
    'AUTH_EVENT_STREAM_ID',
    'AUTH_EVENT_TENANT',
    'AUTH_ISSUER',
  ]) {
    const previous = s.f.env[key];
    delete s.f.env[key];
    assert.equal((await s.send(notification())).status, 503);
    s.f.env[key] = previous;
  }
  s.f.env.AUTH_STREAM_SECRET = s.f.env.AUTH_EVENT_SECRET;
  assert.equal(
    (await s.send(notification(), s.f.env.AUTH_EVENT_SECRET)).status,
    503,
  );
  assert.equal(Object.keys(s.f.state().auth0EventReceipts).length, 0);
});

test('native block event revokes linked password/social sessions, fences login and prohibits email-code fallback', async () => {
  const s = await setup();
  const old = await (
    await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
  ).json();
  const linked = await (
    await s.finish(await s.begin('google', old.session, true), {
      sub: 'google|owner',
    })
  ).json();
  const pending = await s.begin('google');
  await pause();
  assert.equal((await s.send(notification())).status, 200);
  for (const session of [old.session, linked.session])
    assert.equal(
      (await s.f.call('/account', 'GET', undefined, session)).status,
      401,
    );
  assert.equal((await s.finish(pending, { sub: 'google|owner' })).status, 403);
  assert.equal(
    (await s.finish(await s.begin('google'), { sub: 'google|owner' })).status,
    403,
  );
  const mailCount = s.f.mail.length;
  assert.equal(
    (await s.f.call('/send-code', 'POST', { email: 'identity@example.test' }))
      .status,
    403,
  );
  assert.equal(s.f.mail.length, mailCount);
  assert.ok(!JSON.stringify(s.f.state()).includes('PRIVATE-METADATA'));
});

test('wrong tenant/stream/source/type/schema, malformed time, mismatched subject and oversized bodies cannot mutate security state', async () => {
  const s = await setup();
  const changes = [
    (e) => {
      e.a0tenant = 'other-tenant';
    },
    (e) => {
      e.a0stream = 'est_' + 'C'.repeat(22);
    },
    (e) => {
      e.source = 'urn:auth0:other';
    },
    (e) => {
      e.type = 'user.deleted';
    },
    (e) => {
      e.specversion = '2.0';
    },
    (e) => {
      e.time = 'invalid';
    },
    (e) => {
      e.time = new Date(Date.now() - 360000).toISOString();
    },
    (e) => {
      e.time = new Date(Date.now() + 360000).toISOString();
    },
    (e) => {
      e.id = '__proto__';
    },
    (e) => {
      e.data.previous_object.user_id = 'auth0|other';
    },
    (e) => {
      e.data.object.blocked = 'true';
    },
    (e) => {
      e.data.object.user_id = '';
    },
  ];
  for (const change of changes) {
    const e = notification();
    change(e);
    assert.equal((await s.send(e)).status, 400);
  }
  assert.equal(
    (await s.send(notification(), token, { Origin: 'https://evil.test' }))
      .status,
    403,
  );
  const oversized = notification();
  oversized.data.object.user_metadata.large = 'x'.repeat(64000);
  assert.equal((await s.send(oversized)).status, 413);
  assert.equal(Object.keys(s.f.state().authEvents).length, 0);
  assert.equal(Object.keys(s.f.state().identitySecurity).length, 0);
  assert.equal(Object.keys(s.f.state().auth0EventReceipts).length, 0);
});

test('ordinary user updates/provider unblocks never clear a sticky block', async () => {
  const s = await setup();
  const owner = await (
    await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
  ).json();
  const profile = (
    await (await s.f.call('/account', 'GET', undefined, owner.session)).json()
  ).profile;
  await s.send(notification());
  const update = notification({ id: 'evt_' + 'D'.repeat(22) });
  update.data.object.blocked = false;
  assert.equal(
    (await (await s.send(update)).json()).outcome,
    'ignored-unblocked',
  );
  delete update.data.object.blocked;
  update.data.object.blockedPresent = false;
  update.id = 'evt_' + 'F'.repeat(22);
  assert.equal(
    (await (await s.send(update)).json()).outcome,
    'ignored-no-blocked',
  );
  assert.equal(s.f.state().profiles[profile.id].identityBlocked, true);
  assert.equal(
    (await s.finish(await s.begin('password'), { sub: 'auth0|owner' })).status,
    403,
  );
});

test('durable receipts make retries atomic after restart, reject identity reuse, and acknowledge a delayed duplicate without changing security', async () => {
  const s = await setup(),
    e = notification();
  s.f.storageFailure(true);
  assert.equal((await s.send(e)).status, 503);
  s.f.storageFailure(false);
  s.f.restart();
  assert.equal(Object.keys(s.f.state()?.auth0EventReceipts || {}).length, 0);
  assert.equal((await s.send(e)).status, 200);
  const before = structuredClone(s.f.state().identitySecurity);
  s.f.restart();
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 360000;
    assert.equal((await (await s.send(e)).json()).replayed, true);
  } finally {
    Date.now = originalNow;
  }
  assert.deepEqual(s.f.state().identitySecurity, before);
  const collision = structuredClone(e);
  collision.data.object.user_id = 'auth0|different';
  collision.data.previous_object.user_id = 'auth0|different';
  assert.equal((await s.send(collision)).status, 409);
  assert.equal(Object.keys(s.f.state().auth0EventReceipts).length, 1);
});

test('unknown subject is tombstoned; pre-recovery/out-of-order delivery cannot reblock an operator-reconciled identity', async () => {
  const s = await setup();
  const e = notification();
  assert.equal((await s.send(e)).status, 200);
  assert.equal(
    (await s.finish(await s.begin('password'), { sub: 'auth0|owner' })).status,
    403,
  );
  s.f.env.OPERATOR_AUTH = {
    fetch: async () =>
      Response.json({
        actor: 'fixture-operator',
        scope: 'seller-security',
        authenticatedAt: Date.now(),
      }),
  };
  await pause();
  const operation = {
    id: 'fixture-unblock',
    kind: 'account-unblocked',
    subject: 'auth0|owner',
    occurredAt: Date.now(),
    reason: 'Synthetic verified recovery',
    evidenceRef: 'fixture://provider-recovered',
  };
  const previewResponse = await s.f.call(
    '/ops/security/preview',
    'POST',
    operation,
    'fixture-operator',
  );
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(
    (
      await s.f.call(
        '/ops/security/apply',
        'POST',
        { ...operation, confirmation: preview.confirmation },
        'fixture-operator',
      )
    ).status,
    200,
  );
  const late = structuredClone(e);
  late.id = 'evt_' + 'E'.repeat(22);
  assert.equal((await s.send(late)).status, 200);
  const key = await digest(s.f.env.AUTH_ISSUER + '|auth0|owner');
  assert.equal(s.f.state().identitySecurity[key].blocked, false);
  await pause();
  assert.equal(
    (await s.finish(await s.begin('password'), { sub: 'auth0|owner' })).status,
    200,
  );
});

test('ignored receipts are durable, private-data-free and readable only through the bounded account-admin route', async () => {
  const s = await setup();
  const absent = notification({ id: 'evt_' + 'G'.repeat(22) });
  delete absent.data.object.blocked;
  absent.data.object.blockedPresent = false;
  const ack = await (await s.send(absent)).json();
  assert.equal(ack.outcome, 'ignored-no-blocked');
  assert.match(ack.receiptId, /^a0_[a-f0-9]{64}$/);
  assert.deepEqual(s.f.state().profiles, {});
  assert.deepEqual(s.f.state().sessions, {});
  assert.deepEqual(s.f.state().identitySecurity, {});
  const stored = s.f.state().auth0EventReceipts[ack.receiptId];
  assert.equal(stored.outcome, 'ignored-no-blocked');
  assert.equal(stored.expiresAt - stored.receivedAt, 86400000);
  const serialized = JSON.stringify(stored);
  for (const privateValue of [
    absent.id,
    absent.data.object.user_id,
    absent.data.object.email,
    'PRIVATE-METADATA',
    token,
  ])
    assert.equal(serialized.includes(privateValue), false);
  assert.equal(
    (await s.f.call('/admin/auth0-event-receipts/' + ack.receiptId)).status,
    503,
  );
  s.f.env.ACCOUNT_ADMIN_SITE_ORIGIN = 'http://localhost';
  s.f.env.ACCOUNT_ADMIN_AUTH = {
    fetch: async (request) =>
      request.headers.get('Authorization') === 'Bearer fixture-account-admin'
        ? Response.json({
            actor: 'admin@example.test',
            scope: 'seller-accounts',
            authenticatedAt: Date.now(),
            expiresAt: Date.now() + 60000,
          })
        : new Response(null, { status: 403 }),
  };
  assert.equal(
    (
      await s.f.call(
        '/admin/auth0-event-receipts/' + ack.receiptId,
        'GET',
        undefined,
        'wrong',
      )
    ).status,
    403,
  );
  const receipt = await (
    await s.f.call(
      '/admin/auth0-event-receipts/' + ack.receiptId,
      'GET',
      undefined,
      'fixture-account-admin',
    )
  ).json();
  assert.deepEqual(Object.keys(receipt).sort(), [
    'outcome',
    'receiptId',
    'receivedAt',
    'source',
    'stream',
    'tenant',
    'time',
    'type',
  ]);
  assert.equal(receipt.outcome, 'ignored-no-blocked');
  assert.equal(JSON.stringify(receipt).includes(absent.id), false);
  const realNow = Date.now;
  try {
    Date.now = () => stored.expiresAt + 1;
    assert.equal(
      (
        await s.f.call(
          '/admin/auth0-event-receipts/' + ack.receiptId,
          'GET',
          undefined,
          'fixture-account-admin',
        )
      ).status,
      404,
    );
  } finally {
    Date.now = realNow;
  }
  assert.equal(s.f.state().auth0EventReceipts[ack.receiptId], undefined);
  const freshAck = await (await s.send(absent)).json();
  assert.equal(freshAck.replayed, false);
  s.f.restart();
  assert.equal((await (await s.send(absent)).json()).replayed, true);
});
