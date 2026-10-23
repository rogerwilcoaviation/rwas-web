import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create } from './fixture.mjs';
import {
  ActivityLog,
  activityRoute,
  browserActivity,
  ACTIVITY_RETENTION_DAYS,
} from '../../workers/aircraft-sale/activity-log.mjs';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
const site = 'http://localhost';
function setup() {
  const f = fixture();
  f.env.ACCOUNT_ADMIN_SITE_ORIGIN = site;
  f.env.ACCOUNT_ADMIN_AUTH = {
    fetch: async (req) =>
      req.headers.get('Authorization') === 'Bearer log-admin'
        ? Response.json({
            actor: 'admin@example.test',
            scope: 'seller-accounts',
            expiresAt: Date.now() + 600000,
            authenticatedAt: Date.now(),
          })
        : new Response(null, { status: 403 }),
  };
  return f;
}
const logs = async (f, query = '') =>
  (
    await f.call('/admin/activity' + query, 'GET', undefined, 'log-admin')
  ).json();
test('server activity records verified accounts, results and request IDs without bodies, secrets, query values or unrelated paths', async () => {
  const f = setup(),
    t = await f.login('seller@example.test');
  const l = await create(f, t);
  const denied = await f.call(
    '/listings/' + l.id + '?token=DO-NOT-LOG',
    'PUT',
    { make: 'PRIVATE-LISTING-TEXT', year: 1, password: 'PASSWORD-SECRET' },
    t,
  );
  assert.equal(denied.status, 400);
  const rows = (await logs(f)).events;
  const failed = rows.find(
    (row) => row.requestId === denied.headers.get('X-RWAS-Request-ID'),
  );
  assert.equal(failed.result, 'failure');
  assert.equal(failed.status, 400);
  assert.equal(failed.actor.email, 'seller@example.test');
  assert.equal(failed.resourceId, l.id);
  assert.equal(failed.route, '/listings/:id');
  const all = JSON.stringify(rows);
  for (const secret of [
    'PASSWORD-SECRET',
    'DO-NOT-LOG',
    'PRIVATE-LISTING-TEXT',
    t,
  ])
    assert.ok(!all.includes(secret));
  f.restart();
  assert.ok((await logs(f)).events.some((row) => row.id === failed.id));
  assert.equal(
    activityRoute(new Request(site + '/api/aircraft-sale/_mail/start')),
    null,
  );
  assert.equal(
    activityRoute(new Request(site + '/api/aircraft-sale/health')),
    null,
  );
});
test('activity reads require account administration; filters, pagination, date bounds and read-only controls work', async () => {
  const f = setup(),
    seller = await f.login();
  assert.equal((await f.call('/admin/activity')).status, 403);
  assert.equal(
    (await f.call('/admin/activity', 'GET', undefined, seller)).status,
    403,
  );
  assert.equal(
    (
      await f.call('/admin/activity', 'DELETE', {}, 'log-admin', {
        Origin: site,
      })
    ).status,
    405,
  );
  await f.call('/draft', 'GET', undefined, seller);
  await f.call('/draft', 'GET');
  const failed = await logs(f, '?result=failure&q=draft');
  assert.ok(failed.events.length);
  assert.ok(
    failed.events.every(
      (row) => row.status >= 400 && row.action.includes('draft'),
    ),
  );
  const first = await logs(f, '?limit=2');
  assert.equal(first.events.length, 2);
  assert.ok(first.nextCursor);
  const second = await logs(f, '?limit=2&cursor=' + first.nextCursor);
  assert.ok(
    second.events.every((row) => !first.events.some((a) => a.id === row.id)),
  );
  const old = await logs(f, '?to=2020-01-01T00:00:00Z');
  assert.equal(old.error, 'Invalid activity filter.');
  for (const query of [
    '?limit=1001',
    '?source=forged',
    '?cursor=-1',
    '?from=bad',
    '?q=' + 'a'.repeat(101),
    '?token=secret',
  ])
    assert.equal(
      (await f.call('/admin/activity' + query, 'GET', undefined, 'log-admin'))
        .status,
      400,
    );
});
test('browser activity is marketplace scoped, rate limited and cannot forge actors or server results', async () => {
  const f = setup(),
    seller = await f.login('verified@example.test');
  const post = (events, headers = {}, session) =>
    f.call('/activity', 'POST', { events }, session, {
      Origin: site,
      ...headers,
    });
  const event = {
    action: 'page.view',
    page: '/aircraft-for-sale',
    viewport: 'small',
    clientAt: Date.now(),
  };
  assert.equal(
    (await post([event], { Origin: 'https://evil.test' })).status,
    403,
  );
  for (const variant of [
    { page: '/services' },
    { page: '/aircraft-for-sale?token=secret' },
    { actor: 'admin@example.test' },
    { password: 'no' },
    { action: 'approve-listing' },
    { control: 'free text' },
  ])
    assert.equal((await post([{ ...event, ...variant }])).status, 400);
  assert.equal((await post([event], {}, seller)).status, 202);
  const row = (await logs(f, '?source=browser')).events[0];
  assert.equal(row.actor.email, 'verified@example.test');
  assert.equal(row.result, 'observed');
  assert.equal(row.source, 'browser');
  assert.equal(row.details.viewport, 'small');
  for (let i = 0; i < 61; i++) await post([event]);
  assert.equal((await post([event])).status, 429);
});
test('log storage is independent of business rollback and excludes old rows', async () => {
  const f = setup(),
    seller = await f.login();
  const before = structuredClone(f.state());
  await f.call('/account', 'PATCH', { name: 'x'.repeat(1000) }, seller);
  assert.deepEqual(f.state().profiles, before.profiles);
  assert.ok((await logs(f, '?result=failure')).events.length);
  const now = Date.now(),
    old = now - (ACTIVITY_RETENTION_DAYS + 1) * 86400000;
  const store = new Map(),
    storage = {
      get: async (k) => store.get(k),
      put: async (k, v) => store.set(k, v),
    };
  const log = new ActivityLog(storage);
  await log.append(
    [
      { at: old, action: 'old' },
      {
        at: now,
        action: 'new',
        result: 'success',
        source: 'system',
        actor: {},
      },
    ],
    now,
  );
  assert.equal(store.get('exchange-activity').length, 1);
  assert.equal((await log.query(new URL(site), now)).events[0].action, 'new');
  assert.throws(() =>
    browserActivity({
      events: Array(21).fill({
        action: 'page.view',
        page: '/aircraft-for-sale',
      }),
    }),
  );
});
test('current verified staff identity is required and browser cookie attribution cannot impersonate an account', async () => {
  const f = setup();
  Object.assign(f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: site,
    BETTER_AUTH_SECRET: 'local-activity-fixture-only-not-real',
    BETTER_AUTH_ADMIN_USER_IDS: 'staff-fixture',
    SELLER_AUTH_DB: {
      prepare() {
        throw Error('No D1 calls in unit fixture');
      },
    },
  });
  let current = {
    issuer: 'rwas-better-auth',
    subject: 'staff-fixture',
    providerSessionId: 'provider-session',
    email: 'staff@example.test',
    emailVerified: true,
    name: 'Fixture',
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 600000,
  };
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async () => current,
  });
  const call = (...args) => store.fetch(f.request(...args));
  const login = await (
    await call('/auth/better-auth', 'POST', {}, undefined, {
      Origin: site,
      Cookie: 'synthetic',
    })
  ).json();
  const headers = {
    Origin: site,
    Cookie: 'synthetic',
    'X-RWAS-CSRF': login.csrf,
  };
  assert.equal(
    (await call('/staff/activity', 'GET', undefined, login.session, headers))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        '/activity',
        'POST',
        {
          events: [
            {
              action: 'page.view',
              page: '/aircraft-for-sale',
              accountRef: 'staff-fixture',
            },
          ],
        },
        undefined,
        headers,
      )
    ).status,
    202,
  );
  const log = await (
    await call(
      '/staff/activity?source=browser',
      'GET',
      undefined,
      login.session,
      headers,
    )
  ).json();
  assert.equal(log.events[0].actor.email, 'staff@example.test');
  await call(
    '/activity',
    'POST',
    {
      events: [
        {
          action: 'page.view',
          page: '/aircraft-for-sale',
          accountRef: 'another-account',
        },
      ],
    },
    undefined,
    headers,
  );
  const mismatched = (await f.ctx.storage.get('exchange-activity'))
    .filter((row) => row.source === 'browser')
    .at(-1);
  assert.equal(
    mismatched.actor.type,
    'anonymous',
    'Queued actions cannot be attributed to a different signed-in account',
  );
  current = { ...current, providerSessionId: 'replacement-provider-session' };
  assert.equal(
    (await call('/staff/activity', 'GET', undefined, login.session, headers))
      .status,
    401,
  );
  current = null;
  assert.equal(
    (
      await call(
        '/activity',
        'POST',
        { events: [{ action: 'page.view', page: '/aircraft-for-sale' }] },
        undefined,
        headers,
      )
    ).status,
    202,
  );
  const stored = await f.ctx.storage.get('exchange-activity');
  assert.equal(
    stored.filter((row) => row.source === 'browser').at(-1).actor.type,
    'anonymous',
  );
});
