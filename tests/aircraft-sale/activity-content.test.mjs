import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import { ActivityLog } from '../../workers/aircraft-sale/activity-log.mjs';
import {
  troubleshootingText,
  reviewSnapshot,
} from '../../workers/aircraft-sale/activity-content.mjs';
test('existing opaque seller sessions identify John without an identityUserId or readable browser cookie', async () => {
  const f = fixture(),
    token = await f.login('john@halsted.team');
  const response = await f.call(
    '/activity',
    'POST',
    {
      events: [
        {
          action: 'control.click',
          control: 'jerry',
          page: '/aircraft-for-sale',
          clientAt: Date.now(),
        },
      ],
    },
    token,
    { Origin: 'http://localhost' },
  );
  assert.equal(response.status, 202);
  const events = await f.ctx.storage.get('exchange-activity');
  assert.equal(
    events.filter((event) => event.source === 'browser').at(-1).actor.email,
    'john@halsted.team',
  );
});
function setup() {
  const f = fixture(),
    origin = 'http://localhost';
  Object.assign(f.env, {
    ACCOUNT_ADMIN_SITE_ORIGIN: origin,
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: 'isolated-jerry-log-fixture-not-a-secret',
    SELLER_AUTH_DB: {
      prepare() {
        throw Error('No external identity calls');
      },
    },
    ACCOUNT_ADMIN_AUTH: {
      fetch: async (req) =>
        req.headers.get('Authorization') === 'Bearer private-admin'
          ? Response.json({
              actor: 'admin@example.test',
              scope: 'seller-accounts',
              authenticatedAt: Date.now(),
              expiresAt: Date.now() + 600000,
            })
          : new Response(null, { status: 403 }),
    },
  });
  let identity = {
    issuer: 'rwas-better-auth',
    subject: 'verified-john',
    providerSessionId: 'john-session',
    email: 'john@halsted.team',
    emailVerified: true,
    name: 'John',
    createdAt: Date.now() - 10000,
    expiresAt: Date.now() + 3600000,
  };
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async () => identity,
  });
  const call = (...args) => store.fetch(f.request(...args));
  const headers = { Origin: origin, Cookie: 'synthetic-HttpOnly-cookie' };
  const login = async () =>
    await (
      await call('/auth/better-auth', 'POST', {}, undefined, headers)
    ).json();
  const admin = (path) =>
    call(path, 'GET', undefined, 'private-admin', { Origin: origin });
  return {
    ...f,
    call,
    headers,
    login,
    admin,
    setIdentity: (value) => (identity = value),
  };
}
test('John is identified before hydration, unknown/stale references cannot claim another account, and conversation contents are protected', async () => {
  const f = setup(),
    login = await f.login();
  await f.call(
    '/activity',
    'POST',
    {
      events: [
        {
          action: 'page.view',
          page: '/aircraft-for-sale',
          clientAt: Date.now(),
        },
      ],
    },
    undefined,
    f.headers,
  );
  let rows = (await (await f.admin('/admin/activity?source=browser')).json())
    .events;
  assert.equal(rows[0].actor.email, 'john@halsted.team');
  const id = crypto.randomUUID();
  const body = {
    page: '/aircraft-for-sale',
    accountRef: 'verified-john',
    clientAt: Date.now(),
    id,
    user: 'Can you help price this aircraft? password: do-not-retain',
    assistant: 'Compare condition and maintenance history.',
    status: 200,
  };
  assert.equal(
    (await f.call('/activity/conversation', 'POST', body, undefined, f.headers))
      .status,
    202,
  );
  rows = (await (await f.admin('/admin/activity?type=conversation')).json())
    .events;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor.email, 'john@halsted.team');
  assert.equal(rows[0].hasConversation, true);
  assert.equal(
    rows[0].details.conversation,
    undefined,
    'Bulk table response does not include full transcripts',
  );
  const detail = await (await f.admin('/admin/activity/' + rows[0].id)).json();
  assert.equal(detail.exchanges.length, 1);
  assert.match(detail.exchanges[0].messages[0].content, /\[redacted\]/);
  assert.ok(!JSON.stringify(detail).includes('do-not-retain'));
  assert.equal(
    (
      await f.call(
        '/admin/activity/' + rows[0].id,
        'GET',
        undefined,
        login.session,
        { ...f.headers, 'X-RWAS-CSRF': login.csrf },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call(
        '/activity/conversation',
        'POST',
        { ...body, accountRef: 'another-account' },
        undefined,
        f.headers,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call(
        '/activity/conversation',
        'POST',
        { ...body, page: '/services' },
        undefined,
        f.headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call(
        '/activity/conversation',
        'POST',
        { ...body, review: { recommendation: 'approve' } },
        undefined,
        f.headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call(
        '/activity/conversation',
        'POST',
        { ...body, status: 0, assistant: '' },
        undefined,
        f.headers,
      )
    ).status,
    202,
  );
  const failures = (
    await (
      await f.admin('/admin/activity?type=conversation&result=failure')
    ).json()
  ).events;
  assert.equal(failures[0].status, null);
  const failedDetail = await (
    await f.admin('/admin/activity/' + failures[0].id)
  ).json();
  assert.equal(failedDetail.event.details.conversation.messages.length, 1);
  assert.match(
    failedDetail.event.details.conversation.error,
    /before an HTTP response/,
  );
  f.setIdentity(null);
  assert.equal(
    (
      await f.call(
        '/activity',
        'POST',
        {
          events: [
            {
              action: 'page.view',
              page: '/aircraft-for-sale',
              accountRef: 'verified-john',
              clientAt: Date.now(),
            },
          ],
        },
        undefined,
        f.headers,
      )
    ).status,
    202,
  );
  rows = (await (await f.admin('/admin/activity?source=browser')).json())
    .events;
  assert.ok(rows[0].actor.email !== 'john@halsted.team');
});
test('listing assistant preserves actual exchanges in order under the verified seller, without exposing them in public browse', async () => {
  const f = setup(),
    login = await f.login();
  const headers = { ...f.headers, 'X-RWAS-CSRF': login.csrf };
  for (const text of ['I want to create a listing', 'parts']) {
    const response = await f.call(
      '/intake',
      'POST',
      { messages: [{ role: 'user', content: text }] },
      login.session,
      headers,
    );
    assert.equal(response.status, 200, await response.clone().text());
  }
  const rows = (
    await (await f.admin('/admin/activity?type=conversation')).json()
  ).events;
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every(
      (row) =>
        row.source === 'server' && row.actor.email === 'john@halsted.team',
    ),
  );
  const detail = await (await f.admin('/admin/activity/' + rows[0].id)).json();
  assert.equal(detail.exchanges.length, 2);
  assert.equal(
    detail.exchanges[0].messages[0].content,
    'I want to create a listing',
  );
  assert.equal(detail.exchanges[1].messages[0].content, 'parts');
  assert.ok(
    detail.exchanges.every(
      (turn) =>
        turn.messages[1].role === 'assistant' && turn.messages[1].content,
    ),
  );
  assert.ok(!(await (await f.call('/browse')).text()).includes('messages'));
});
test('review snapshots retain their own reasoning and current reports are available without rewriting historical events', async () => {
  const f = setup();
  await f.login();
  const profile = Object.values(f.state().profiles)[0];
  const review = {
    status: 'completed',
    recommendation: 'needs_attention',
    completedAt: Date.now(),
    summary: 'Inspect the inconsistent model year.',
    findings: ['FAA year differs'],
    evidence: {
      faa: {
        status: 'attention',
        summary: 'Year mismatch',
        sources: ['https://registry.faa.gov/aircraftinquiry/'],
        aircraft: { year: '2000' },
        matches: { year: 'different' },
      },
    },
  };
  const log = new ActivityLog(f.ctx.storage);
  await log.append([
    {
      at: Date.now(),
      requestId: crypto.randomUUID(),
      actor: { type: 'account', id: profile.id, email: profile.email },
      action: 'jerry.research',
      route: '/research',
      resourceId: profile.id,
      source: 'system',
      result: 'success',
      details: {
        kind: 'account',
        review: reviewSnapshot(review),
        reviewScope: 'historical-snapshot',
      },
    },
  ]);
  const seed = f.state();
  seed.profiles[profile.id].jerryReview = {
    ...review,
    summary: 'A newer account report.',
  };
  await f.ctx.storage.put('state', seed);
  const rows = (await (await f.admin('/admin/activity?type=review')).json())
    .events;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hasReview, true);
  assert.equal(rows[0].details.review, undefined);
  const detail = await (await f.admin('/admin/activity/' + rows[0].id)).json();
  assert.equal(detail.event.details.review.summary, review.summary);
  const current = await (
    await f.admin('/admin/activity/current?q=john%40halsted.team')
  ).json();
  assert.equal(
    current.reports[0].details.review.summary,
    'A newer account report.',
  );
  assert.equal(current.reports[0].actor.email, 'john@halsted.team');
  assert.equal((await f.call('/admin/activity/current')).status, 403);
  assert.equal(
    troubleshootingText(
      'Bearer abc.def.ghi password=private sk-123456789012345678901234 https://x.test/?token=private',
    ).includes('private'),
    false,
  );
});
