import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { fixture, create, fields, submit } from './fixture.mjs';
import worker from '../../workers/aircraft-sale/worker.mjs';
import { reviewNotification } from '../../functions/_seller/review-notifications.mjs';
import {
  planListingNotifications,
  takeListingNotification,
  claimListingNotification,
  finishListingNotification,
  dispatchListingNotification,
  nextListingNotificationAt,
  notificationStatus,
} from '../../workers/aircraft-sale/review-notifications.mjs';

async function pendingFixture() {
  const f = fixture();
  f.env.FROM_EMAIL = 'Aviation Exchange <accounts@example.test>';
  f.env.RESEND_API_KEY = 'synthetic-key';
  f.env.LISTING_NOTIFICATIONS_ENABLED = 'true';
  const owner = await f.login('seller@example.test');
  const listing = await create(f, owner, fields);
  assert.equal((await submit(f, owner, listing)).status, 200);
  return { f, owner, listing, key: listing.id + ':' + listing.revision };
}
const ticketRequest = (ticket, origin = 'https://www.rogerwilcoaviation.com') =>
  new Request(origin + '/api/aircraft-sale/review-notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });

test('submission atomically queues fixed email and Teams alerts once per revision; existing pending listings are not backfilled', async () => {
  const { f, owner, listing, key } = await pendingFixture();
  const state = f.state();
  assert.equal(state.outbox[key].notificationVersion, 1);
  assert.deepEqual(JSON.parse(state.outbox[key].emailBody).to, [
    'admin@rwas.team',
  ]);
  assert.match(state.outbox[key].text, /seller@example.test/);
  assert.match(state.outbox[key].text, /seller-review\?listing=/);
  assert.doesNotMatch(JSON.stringify(state.outbox[key]), /synthetic-key/);
  const first = structuredClone(state.outbox[key]);
  planListingNotifications(state, structuredClone(state), f.env);
  assert.deepEqual(state.outbox[key], first);
  const old = structuredClone(state);
  delete old.outbox[key].notificationVersion;
  delete old.outbox[key].notifications;
  planListingNotifications(old, structuredClone(old), f.env);
  assert.equal(old.outbox[key].notificationVersion, undefined);
  await f.call(
    '/listings/' + listing.id,
    'PUT',
    { ...fields, description: 'New revision' },
    owner,
  );
  const changed = f.state().listings[listing.id];
  await submit(f, owner, changed);
  assert.equal(
    f.state().outbox[listing.id + ':' + changed.revision].notificationVersion,
    1,
  );
  assert.equal(f.state().listings[listing.id].status, 'pending');
});

test('Teams tickets are private, single-use, expiring and return canonical text only; caller cannot select a destination', async () => {
  const { f, key } = await pendingFixture();
  const state = f.state(),
    now = Date.now() + 2000;
  const email = await takeListingNotification(state, f.env, now);
  await finishListingNotification(
    state,
    email,
    { ok: true, code: 'accepted' },
    now,
  );
  const job = await takeListingNotification(state, f.env, now);
  assert.equal(job.channel, 'teams');
  assert.equal(
    await claimListingNotification(state, f.env, job.ticket + 'x', now),
    null,
  );
  const claimed = await claimListingNotification(state, f.env, job.ticket, now);
  assert.equal(claimed.target, 'Shop Talk');
  assert.equal(
    await claimListingNotification(state, f.env, job.ticket, now),
    null,
  );
  assert.equal(state.outbox[key].notifications.teams.status, 'claimed');
  assert.equal(
    (
      await worker.fetch(
        new Request(
          'https://www.rogerwilcoaviation.com/api/aircraft-sale/_notifications/claim',
          { method: 'POST' },
        ),
        f.env,
      )
    ).status,
    404,
  );
  state.outbox[key].notifications.teams.status = 'sending';
  assert.equal(
    await claimListingNotification(state, f.env, job.ticket, now + 120001),
    null,
  );
  state.listings[job.key.split(':')[0]].status = 'deleted';
  assert.equal(
    await claimListingNotification(state, f.env, job.ticket, now),
    null,
  );
});

test('Teams broker rejects guests, malformed tickets, previews and replay without sending; valid ticket uses only fixed Shop Talk relay', async () => {
  const { f } = await pendingFixture();
  const state = f.state(),
    now = Date.now() + 2000;
  const email = await takeListingNotification(state, f.env, now);
  await finishListingNotification(
    state,
    email,
    { ok: true, code: 'accepted' },
    now,
  );
  const job = await takeListingNotification(state, f.env, now);
  const sent = [];
  const env = {
    TEAMS_RELAY_TOKEN: 'synthetic-teams-key',
    SELLER_API: {
      claimReviewNotification: async ({ ticket }) => {
        const claimed = await claimListingNotification(
          state,
          f.env,
          ticket,
          now,
        );
        return claimed ? { ...claimed, status: 200 } : { status: 409 };
      },
    },
    LISTING_TEAMS_FETCH: {
      fetch: async (url, options) => {
        sent.push({ url, ...options });
        return Response.json({ ok: true });
      },
    },
  };
  assert.equal(
    (await reviewNotification(ticketRequest('fake'), env)).status,
    409,
  );
  assert.equal(
    (
      await reviewNotification(
        ticketRequest(job.ticket, 'https://preview.example.test'),
        env,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await reviewNotification(ticketRequest(job.ticket), {
        ...env,
        INTAKE_STAGING_MODE: 'true',
      })
    ).status,
    503,
  );
  const tampered = ticketRequest(job.ticket);
  const extra = new Request(tampered.url, {
    method: 'POST',
    headers: tampered.headers,
    body: JSON.stringify({ ticket: job.ticket, text: 'Forged text' }),
  });
  assert.equal((await reviewNotification(extra, env)).status, 400);
  assert.equal(sent.length, 0);
  const result = await reviewNotification(ticketRequest(job.ticket), env);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).delivered, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://teamsbot.rwas.team/post');
  const payload = JSON.parse(sent[0].body);
  assert.equal(payload.channel, 'Shop Talk');
  assert.equal(payload.idempotencyKey, job.notificationId + '/teams');
  assert.equal(
    (await reviewNotification(ticketRequest(job.ticket), env)).status,
    409,
  );
  assert.equal(sent.length, 1);
});

test('email retries retain the exact idempotency key and body, stop before provider window; accepted email is not sent again for Teams retry', async () => {
  const { f, key } = await pendingFixture();
  const state = f.state(),
    now = Date.now() + 2000;
  const requests = [];
  f.env.LISTING_NOTIFICATION_FETCH = {
    fetch: async (req) => {
      requests.push({
        key: req.headers.get('Idempotency-Key'),
        body: await req.text(),
      });
      return requests.length === 1
        ? new Response(null, { status: 503 })
        : Response.json({ id: 'synthetic-email-id' });
    },
  };
  let job = await takeListingNotification(state, f.env, now);
  await finishListingNotification(
    state,
    job,
    await dispatchListingNotification(f.env, job),
    now,
  );
  state.outbox[key].notifications.teams.nextAt = now + 3600000;
  job = await takeListingNotification(state, f.env, now + 60001);
  await finishListingNotification(
    state,
    job,
    await dispatchListingNotification(f.env, job),
    now + 60001,
  );
  assert.equal(state.outbox[key].notifications.email.status, 'delivered');
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[0].key, 'aviation-review/' + key + '/email');
  const retry = state.outbox[key].notifications.teams;
  retry.attempts = 1;
  retry.firstAttemptAt = now;
  retry.nextAt = now + 24 * 3600000;
  assert.equal(
    await takeListingNotification(state, f.env, now + 24 * 3600000),
    null,
  );
  assert.equal(retry.status, 'needs_review');
  assert.equal(nextListingNotificationAt(state, f.env), Infinity);
});

test('uncertain claimed Teams delivery is not resent; unclaimed network failure can retry with a different capability', async () => {
  const { f, key } = await pendingFixture();
  const state = f.state(),
    now = Date.now() + 2000;
  const email = await takeListingNotification(state, f.env, now);
  await finishListingNotification(
    state,
    email,
    { ok: true, code: 'accepted' },
    now,
  );
  let job = await takeListingNotification(state, f.env, now);
  const oldTicket = job.ticket;
  await finishListingNotification(
    state,
    job,
    { ok: false, code: 'network_unknown' },
    now,
  );
  assert.equal(
    await claimListingNotification(state, f.env, oldTicket, now),
    null,
  );
  job = await takeListingNotification(state, f.env, now + 60001);
  assert.notEqual(job.ticket, oldTicket);
  await claimListingNotification(state, f.env, job.ticket, now + 60001);
  await finishListingNotification(
    state,
    job,
    { ok: false, code: 'network_unknown' },
    now + 60001,
  );
  assert.equal(state.outbox[key].notifications.teams.status, 'needs_review');
  assert.equal(
    state.outbox[key].notifications.teams.code,
    'delivery_uncertain',
  );
  assert.equal(await takeListingNotification(state, f.env, now + 240000), null);
  assert.equal(
    JSON.stringify(notificationStatus(state.outbox[key])).includes('ticket'),
    false,
  );
});

test('store alarm delivers both channels after durable reservation and records results; only administrators may create a no-listing test', async () => {
  const { f, owner, key } = await pendingFixture();
  const state = f.state();
  for (const d of Object.values(state.outbox[key].notifications))
    d.nextAt = Date.now() - 1;
  f.durable.set('state', state);
  const sent = [];
  f.env.LISTING_NOTIFICATION_FETCH = {
    fetch: async (request) => {
      sent.push(request.url);
      if (request.url.startsWith('https://api.resend.com/'))
        return Response.json({ id: 'synthetic-email' });
      const { ticket } = await request.json();
      const claimed = await f.callRaw(
        new Request(
          'https://seller-service.internal/api/aircraft-sale/_notifications/claim',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket }),
          },
        ),
      );
      assert.equal(claimed.status, 200);
      return Response.json({
        delivered: true,
        notificationId: (await claimed.json()).notificationId,
      });
    },
  };
  await f.restart().alarm();
  assert.equal(sent.length, 2);
  assert.equal(f.state().outbox[key].notifications.email.status, 'delivered');
  assert.equal(f.state().outbox[key].notifications.teams.status, 'delivered');
  await f.restart().alarm();
  assert.equal(sent.length, 2);
  assert.equal(
    (await f.call('/admin/notifications', 'POST', { test: true }, owner))
      .status,
    403,
  );
  const before = Object.keys(f.state().listings).length;
  const response = await f.call(
    '/admin/notifications',
    'POST',
    { test: true },
    'fixture-reviewer',
  );
  assert.equal(response.status, 200);
  assert.equal(Object.keys(f.state().listings).length, before);
  assert.equal(
    (await response.json()).notifications.some((n) => n.test),
    true,
  );
});

test('native SQLite alarm and Pages-to-seller RPC deliver both channels without deadlock or customer services', async () => {
  const sellerScript = (
    await build({
      entryPoints: ['workers/aircraft-sale/entry.mjs'],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      external: ['cloudflare:workers', 'node:*'],
    })
  ).outputFiles[0].text;
  const pagesScript = (
    await build({
      stdin: {
        contents: `
    import { reviewNotification } from './functions/_seller/review-notifications.mjs';
    export default { async fetch(request, env) {
      if (request.url === 'https://api.resend.com/emails') return env.EMAIL_FIXTURE.fetch(request);
      return await reviewNotification(request, env) || new Response(null,{status:404});
    }};`,
        resolveDir: process.cwd(),
        sourcefile: 'notification-pages-fixture.mjs',
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
    })
  ).outputFiles[0].text;
  const codes = [],
    emails = [],
    teams = [];
  const mf = new Miniflare({
    workers: [
      {
        name: 'seller',
        modules: true,
        script: sellerScript,
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
        },
        bindings: {
          EMAIL_CODE_LOGIN_ENABLED: 'true',
          PUBLIC_LISTINGS_ENABLED: 'true',
          LISTING_NOTIFICATIONS_ENABLED: 'true',
          FROM_EMAIL: 'Aviation Exchange <accounts@example.test>',
          RESEND_API_KEY: 'synthetic-key',
        },
        serviceBindings: {
          LISTING_NOTIFICATION_FETCH: 'notification-pages',
          MAILER: async (request) => {
            codes.push(await request.json());
            return Response.json({ ok: true });
          },
          ADMIN_AUTH: async () => Response.json({ actor: 'synthetic-admin' }),
        },
        outboundService: () => {
          throw Error('EXTERNAL_NETWORK_FORBIDDEN');
        },
      },
      {
        name: 'notification-pages',
        modules: true,
        script: pagesScript,
        compatibilityDate: '2026-09-01',
        bindings: { TEAMS_RELAY_TOKEN: 'synthetic-teams-key' },
        serviceBindings: {
          SELLER_API: 'seller',
          EMAIL_FIXTURE: async (request) => {
            emails.push(await request.json());
            return Response.json({ id: 'native-synthetic-email' });
          },
          LISTING_TEAMS_FETCH: async (request) => {
            teams.push(await request.json());
            return Response.json({ ok: true });
          },
        },
        outboundService: () => {
          throw Error('EXTERNAL_NETWORK_FORBIDDEN');
        },
      },
    ],
  });
  try {
    const call = (path, method = 'GET', body, token) =>
      mf.dispatchFetch('http://localhost/api/aircraft-sale' + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal(
      (
        await call('/send-code', 'POST', {
          email: 'native-notifications@example.test',
        })
      ).status,
      200,
    );
    const session = (
      await (
        await call('/check-code', 'POST', {
          email: codes[0].to,
          code: codes[0].code,
        })
      ).json()
    ).session;
    const created = await mf.dispatchFetch(
      'http://localhost/api/aircraft-sale/listings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session,
          'Idempotency-Key': 'native-notification-qa',
        },
        body: JSON.stringify(fields),
      },
    );
    assert.equal(created.status, 201);
    const listing = (await created.json()).listing;
    assert.equal(
      (
        await call(
          '/listing/' + listing.id + '/status',
          'POST',
          { status: 'pending' },
          session,
        )
      ).status,
      200,
    );
    const deadline = Date.now() + 15000;
    let status;
    do {
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = await (
        await call('/admin/notifications', 'GET', undefined, 'fixture-admin')
      ).json();
    } while (
      Date.now() < deadline &&
      !status.notifications?.every((row) =>
        Object.values(row.channels).every((d) => d.status === 'delivered'),
      )
    );
    assert.equal(emails.length, 1, JSON.stringify(status));
    assert.equal(teams.length, 1);
    assert.deepEqual(emails[0].to, ['admin@rwas.team']);
    assert.equal(teams[0].channel, 'Shop Talk');
    assert.equal(
      status.notifications[0].channels.teams.status,
      'delivered',
      JSON.stringify(status),
    );
    assert.equal(status.notifications[0].channels.email.status, 'delivered');
    // A subsequent read observes the persisted per-channel receipts and must
    // not enqueue another send after the natural alarm has completed.
    const after = await (
      await call('/admin/notifications', 'GET', undefined, 'fixture-admin')
    ).json();
    assert.equal(after.notifications[0].channels.teams.attempts, 1);
    assert.equal(after.notifications[0].channels.email.attempts, 1);
  } finally {
    await mf.dispose();
  }
});
