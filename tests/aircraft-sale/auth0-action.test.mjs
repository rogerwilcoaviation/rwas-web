import { test } from 'node:test';
import assert from 'node:assert/strict';
import action from '../../workers/aircraft-sale/auth0/post-change-password.cjs';
import { identityFixture } from './identity-fixture.mjs';

const origin = 'https://repair-aircraft-seller-workf.rwas-web.pages.dev';
const endpoint = origin + '/api/aircraft-sale/auth/events';
const pause = () => new Promise((resolve) => setTimeout(resolve, 3));
const event = (issuedAt = Date.now()) => ({
  secrets: {
    RWAS_SECURITY_EVENT_URL: endpoint,
    RWAS_AUTH0_TENANT: 'fixture-tenant',
    AUTH_EVENT_SECRET: 'synthetic-event-secret-not-a-real-credential',
  },
  tenant: { id: 'fixture-tenant' },
  connection: { strategy: 'auth0' },
  user: {
    user_id: 'auth0|owner',
    last_password_reset: new Date(issuedAt).toISOString(),
  },
});
const failed =
  /RWAS password-reset notification failed; operator reconciliation required\./;

test('actual Action contract revokes linked sessions and fences a pending social login', async () => {
  const s = await identityFixture(origin);
  const old = await (
    await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
  ).json();
  const linked = await (
    await s.finish(await s.begin('google', old.session, true), {
      sub: 'google|owner',
    })
  ).json();
  const pending = await s.begin('google');
  const requests = [];
  const send = action.createHandler({
    fetch: async (url, init) => {
      requests.push({
        url,
        body: JSON.parse(init.body),
        redirect: init.redirect,
      });
      assert.ok(init.signal instanceof AbortSignal);
      return s.f.callRaw(new Request(url, init));
    },
  });
  await pause();
  const input = event();
  await send(input);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].redirect, 'error');
  assert.equal(
    requests[0].body.issuedAt,
    Date.parse(input.user.last_password_reset),
  );
  for (const session of [old.session, linked.session])
    assert.equal(
      (await s.f.call('/account', 'GET', undefined, session)).status,
      401,
    );
  assert.equal((await s.finish(pending, { sub: 'google|owner' })).status, 401);
});

test('a lost acknowledgement retries the stable event without revoking a later session', async () => {
  const s = await identityFixture(origin);
  await s.finish(await s.begin('password'), { sub: 'auth0|owner' });
  await pause();
  const input = event();
  let fresh;
  const bodies = [];
  const send = action.createHandler({
    sleep: async () => {},
    fetch: async (url, init) => {
      bodies.push(init.body);
      const response = await s.f.callRaw(new Request(url, init));
      if (bodies.length === 1) {
        assert.equal(response.status, 200);
        await pause();
        fresh = await (
          await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
        ).json();
        throw new Error('Synthetic response loss');
      }
      return response;
    },
  });
  await send(input);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, fresh.session)).status,
    200,
  );
  assert.equal(Object.keys(s.f.state().authEvents).length, 1);
});

test('event identity ignores user correlation input and normalizes equivalent reset timestamps', async () => {
  const bodies = [];
  const send = action.createHandler({
    fetch: async (_, init) => {
      bodies.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    },
  });
  const input = event();
  input.transaction = { correlation_id: 'untrusted-client-input' };
  await send(input);
  input.transaction.correlation_id = 'different-input';
  input.user.last_password_reset = input.user.last_password_reset.replace(
    'Z',
    '+00:00',
  );
  await send(input);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.match(bodies[0].id, /^pw_[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(bodies[0]).sort(), [
    'id',
    'issuedAt',
    'kind',
    'subject',
  ]);
});

test('missing time, stale events, wrong tenant and unapproved destinations fail before any send', async () => {
  let calls = 0;
  const send = action.createHandler({
    fetch: async () => {
      calls++;
      throw Error('Should never send');
    },
  });
  const changes = [
    (e) => delete e.user.last_password_reset,
    (e) => {
      e.user.last_password_reset = 'invalid';
    },
    (e) => {
      e.user.last_password_reset = new Date(Date.now() - 300001).toISOString();
    },
    (e) => {
      e.user.last_password_reset = new Date(Date.now() + 360000).toISOString();
    },
    (e) => {
      e.tenant.id = 'other-tenant';
    },
    (e) => {
      e.connection.strategy = 'google-oauth2';
    },
    (e) => {
      e.user.user_id = '';
    },
    (e) => {
      e.secrets.AUTH_EVENT_SECRET = 'short';
    },
    (e) => {
      e.secrets.RWAS_SECURITY_EVENT_URL = 'https://attacker.test/auth/events';
    },
    (e) => {
      e.secrets.RWAS_SECURITY_EVENT_URL = endpoint + '?redirect=evil';
    },
  ];
  for (const change of changes) {
    const input = event();
    change(input);
    await assert.rejects(send(input), failed);
  }
  assert.equal(calls, 0);
});

test('transient failures retry at most three times and reject bad acknowledgements', async () => {
  const sleeps = [],
    bodies = [];
  const statuses = [429, 503, 200];
  const send = action.createHandler({
    sleep: async (ms) => sleeps.push(ms),
    fetch: async (_, init) => {
      bodies.push(init.body);
      const status = statuses.shift();
      return Response.json({ ok: true }, { status });
    },
  });
  await send(event());
  assert.deepEqual(sleeps, [250, 500]);
  assert.equal(new Set(bodies).size, 1);
  for (const response of [
    () => Response.json({ ok: false }),
    () => new Response('invalid-json'),
    () => {
      throw Error('Synthetic aborted request');
    },
  ]) {
    let calls = 0;
    await assert.rejects(
      action.createHandler({
        sleep: async () => {},
        fetch: async () => {
          calls++;
          return response();
        },
      })(event()),
      failed,
    );
    assert.equal(calls, 3);
  }
});

test('authorization failures are terminal and transport errors never leak sensitive details', async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      action.createHandler({
        fetch: async () => {
          calls++;
          return new Response('private-provider-subject secret-value', {
            status,
          });
        },
      })(event()),
      failed,
    );
    assert.equal(calls, 1);
  }
  const input = event();
  await assert.rejects(
    action.createHandler({
      sleep: async () => {},
      fetch: async (_, init) => {
        assert.equal(init.redirect, 'error');
        throw Error(input.secrets.AUTH_EVENT_SECRET + ' ' + input.user.user_id);
      },
    })(input),
    (error) => {
      assert.match(error.message, failed);
      assert.ok(!error.message.includes(input.secrets.AUTH_EVENT_SECRET));
      assert.ok(!error.message.includes(input.user.user_id));
      return true;
    },
  );
});

test('retry expiry preserves actual event time and stops rather than fabricating a fresh reset', async () => {
  const time = Date.now();
  let elapsed = time,
    calls = 0;
  const send = action.createHandler({
    now: () => elapsed,
    sleep: async () => {
      elapsed = time + 300001;
    },
    fetch: async (_, init) => {
      calls++;
      assert.equal(JSON.parse(init.body).issuedAt, time);
      throw Error('Synthetic outage');
    },
  });
  await assert.rejects(send(event(time)), failed);
  assert.equal(calls, 1);
});
