import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../workers/aircraft-sale/worker.mjs';
import { fixture } from './fixture.mjs';
import {
  sellerMail,
  sellerDestinationAllowed,
  SELLER_STAGING_ORIGIN as origin,
} from '../../functions/_seller/mail.mjs';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';

function broker() {
  const f = fixture();
  f.env.MAIL_VIA_PAGES = 'true';
  const invoke = async (path, body, authorization = '') => {
    const r = await f.ctxStore.fetch(
      new Request(
        'https://seller-service.internal/api/aircraft-sale/_mail/' + path,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
          },
          body: JSON.stringify(body),
        },
      ),
    );
    return { status: r.status, ...(await r.json()) };
  };
  // The fixture exposes the same serialized DO, without making its private route public.
  f.ctxStore = { fetch: (req) => f.callRaw(req) };
  const api = {
    createVerification: (b) => invoke('start', b, b.authorization),
    confirmVerification: (b) => invoke('confirm', b, b.authorization),
    cancelVerification: (b) => invoke('cancel', b),
  };
  const delivered = [];
  const env = {
    INTAKE_STAGING_MODE: 'true',
    SELLER_STAGING_ORIGIN: origin,
    SELLER_MAIL_VIA_PAGES: 'true',
    SELLER_API: api,
    SELLER_MAILER: {
      fetch: async (req) => {
        delivered.push(await req.json());
        return new Response(null, { status: 200 });
      },
    },
  };
  const send = (
    address = 'private@example.test',
    path = '/send-code',
    session,
  ) =>
    sellerMail(
      new Request(origin + '/api/aircraft-sale' + path, {
        method: 'POST',
        headers: {
          Origin: origin,
          ...(session ? { Authorization: 'Bearer ' + session } : {}),
        },
        body: JSON.stringify({ email: address }),
      }),
      env,
    );
  return { f, api, env, delivered, send, invoke };
}

test('private mail delivery activates only after acceptance, stores no plaintext, and never returns codes to HTTP clients', async () => {
  const b = broker();
  const pending = await b.api.createVerification({
    email: 'private@example.test',
    purpose: 'login',
  });
  assert.equal(pending.status, 200);
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: pending.to,
        code: pending.code,
      })
    ).status,
    400,
  );
  assert.ok(
    !JSON.stringify(b.f.state()).includes('"code":"' + pending.code + '"'),
  );
  assert.equal(
    (await b.api.confirmVerification({ ticket: pending.ticket })).status,
    200,
  );
  const login = await b.f.call('/check-code', 'POST', {
    email: pending.to,
    code: pending.code,
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await b.api.confirmVerification({ ticket: pending.ticket })).status,
    200,
  );
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: pending.to,
        code: pending.code,
      })
    ).status,
    400,
  );
  const response = await b.send('other@example.test');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, sent: true });
  assert.equal(b.delivered.length, 1);
});

test('delayed acknowledgement cannot overwrite or resurrect a newer consumed verification code', async () => {
  const b = broker();
  const old = await b.api.createVerification({
    email: 'race@example.test',
    purpose: 'login',
  });
  const fresh = await b.api.createVerification({
    email: 'race@example.test',
    purpose: 'login',
  });
  assert.equal(
    (await b.api.confirmVerification({ ticket: fresh.ticket })).status,
    200,
  );
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: fresh.to,
        code: fresh.code,
      })
    ).status,
    200,
  );
  assert.equal(
    (await b.api.confirmVerification({ ticket: old.ticket })).status,
    409,
  );
  assert.equal(
    (await b.api.confirmVerification({ ticket: fresh.ticket })).status,
    200,
  );
  assert.equal(
    (await b.f.call('/check-code', 'POST', { email: old.to, code: old.code }))
      .status,
    400,
  );
});

test('failed mail preserves the previous active code; cancelled and expired tickets never activate', async () => {
  const b = broker();
  await b.send();
  const first = b.delivered[0];
  b.env.SELLER_MAILER.fetch = async () => new Response(null, { status: 503 });
  assert.equal((await b.send()).status, 503);
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: first.to,
        code: first.code,
      })
    ).status,
    200,
  );
  const cancelled = await b.api.createVerification({
    email: 'cancel@example.test',
    purpose: 'login',
  });
  assert.equal(
    (await b.api.cancelVerification({ ticket: cancelled.ticket })).status,
    200,
  );
  assert.equal(
    (await b.api.cancelVerification({ ticket: cancelled.ticket })).status,
    200,
  );
  assert.equal(
    (await b.api.confirmVerification({ ticket: cancelled.ticket })).status,
    409,
  );
  const expired = await b.api.createVerification({
    email: 'expired@example.test',
    purpose: 'login',
  });
  const state = b.f.state();
  state.mailRequests[expired.ticket].createdAt -= 900001;
  await b.f.ctx.storage.put('state', state);
  assert.equal(
    (await b.api.confirmVerification({ ticket: expired.ticket })).status,
    400,
  );
});

test('storage outage prevents email delivery; rate limit counts persist across failed delivery and restart', async () => {
  const b = broker();
  b.f.storageFailure(true);
  assert.equal((await b.send()).status, 503);
  assert.equal(b.delivered.length, 0);
  b.f.storageFailure(false);
  b.env.SELLER_MAILER.fetch = async () => new Response(null, { status: 503 });
  for (let i = 0; i < 5; i++) assert.equal((await b.send()).status, 503);
  b.f.restart();
  assert.equal((await b.send()).status, 429);
});

test('email change requires recent authenticated ownership at preparation and acknowledgement', async () => {
  const b = broker();
  assert.equal(
    (await b.send('change@example.test', '/account/email-code')).status,
    401,
  );
  await b.send();
  const mail = b.delivered[0];
  const session = (
    await (
      await b.f.call('/check-code', 'POST', { email: mail.to, code: mail.code })
    ).json()
  ).session;
  const request = await b.api.createVerification({
    email: 'change@example.test',
    purpose: 'email-change',
    authorization: 'Bearer ' + session,
  });
  assert.equal(request.status, 200);
  await b.f.call('/logout', 'POST', {}, session);
  assert.equal(
    (
      await b.api.confirmVerification({
        ticket: request.ticket,
        authorization: 'Bearer ' + session,
      })
    ).status,
    401,
  );
});

test('public HTTP cannot invoke mail preparation even with internal origin, fabricated headers or method names', async () => {
  const b = broker();
  for (const destination of [origin, 'https://seller-service.internal']) {
    for (const path of [
      '/_mail/start',
      '/api/aircraft-sale/_mail/start',
      '/api/aircraft-sale/_mail/confirm',
    ]) {
      const r = await worker.fetch(
        new Request(destination + path, {
          method: 'POST',
          headers: { Origin: origin, 'X-Internal': 'true' },
          body: '{}',
        }),
        b.f.env,
      );
      assert.equal(r.status, 404);
    }
  }
  assert.equal(
    (
      await b.f.call('/_mail/start', 'POST', {
        email: 'attack@example.test',
        purpose: 'login',
      })
    ).status,
    404,
  );
  assert.equal(
    (await b.f.call('/send-code', 'POST', { email: 'attack@example.test' }))
      .status,
    503,
  );
  for (const other of ['https://evil.test', 'null', '']) {
    const response = await sellerMail(
      new Request(origin + '/api/aircraft-sale/send-code', {
        method: 'POST',
        headers: { Origin: other },
        body: '{}',
      }),
      b.env,
    );
    assert.equal(response.status, 403);
  }
  assert.equal(Object.keys(b.f.state()?.mailRequests || {}).length, 0);
});

test('seller destination is an exact separate staging origin and does not authorize production or arbitrary previews', () => {
  const env = { INTAKE_STAGING_MODE: 'true', SELLER_STAGING_ORIGIN: origin };
  for (const other of [
    'https://www.rogerwilcoaviation.com',
    'https://intake-restoration-20260922.rwas-web.pages.dev',
    'https://abc.rwas-web.pages.dev',
  ])
    assert.equal(
      sellerDestinationAllowed(
        new Request(other),
        env,
        'https://intake.fixture.test',
      ),
      false,
    );
  assert.equal(
    sellerDestinationAllowed(
      new Request(origin),
      env,
      'https://intake.fixture.test',
    ),
    true,
  );
  assert.equal(
    sellerDestinationAllowed(
      new Request(origin),
      { ...env, INTAKE_STAGING_MODE: 'false' },
      'https://intake.fixture.test',
    ),
    false,
  );
  assert.equal(
    sellerDestinationAllowed(
      new Request(origin),
      { ...env, SELLER_STAGING_ORIGIN: 'https://evil.test' },
      'https://intake.fixture.test',
    ),
    false,
  );
});

test('restart and delivery acknowledgement outages preserve durable activation boundaries', async () => {
  const b = broker();
  const prepared = await b.api.createVerification({
    email: 'restart@example.test',
    purpose: 'login',
  });
  b.f.restart();
  assert.equal(
    (await b.api.confirmVerification({ ticket: prepared.ticket })).status,
    200,
  );
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: prepared.to,
        code: prepared.code,
      })
    ).status,
    200,
  );
  const confirm = b.api.confirmVerification;
  b.api.confirmVerification = async (request) => {
    await confirm(request);
    throw Error('Response lost');
  };
  assert.equal((await b.send('lost@example.test')).status, 503);
  const accepted = b.delivered.at(-1);
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: accepted.to,
        code: accepted.code,
      })
    ).status,
    200,
  );
  b.api.confirmVerification = confirm;
  b.env.SELLER_MAILER.fetch = async (request) => {
    b.delivered.push(await request.json());
    b.f.storageFailure(true);
    return new Response(null, { status: 200 });
  };
  assert.equal((await b.send('storage@example.test')).status, 503);
  const notActivated = b.delivered.at(-1);
  b.f.storageFailure(false);
  b.f.restart();
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: notActivated.to,
        code: notActivated.code,
      })
    ).status,
    400,
  );
});

test('concurrent Pages mail deliveries acknowledge the newest request without activating a stale code', async () => {
  const b = broker();
  const releases = [],
    arrivals = [];
  const arrived = [0, 1].map(
    (i) =>
      new Promise((resolve) => {
        arrivals[i] = resolve;
      }),
  );
  b.env.SELLER_MAILER.fetch = async (request) => {
    const i = b.delivered.length;
    b.delivered.push(await request.json());
    arrivals[i]();
    await new Promise((resolve) => {
      releases[i] = resolve;
    });
    return new Response(null, { status: 200 });
  };
  const old = b.send('concurrent@example.test');
  await arrived[0];
  const fresh = b.send('concurrent@example.test');
  await arrived[1];
  releases[1]();
  assert.equal((await fresh).status, 200);
  const newest = b.delivered[1];
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: newest.to,
        code: newest.code,
      })
    ).status,
    200,
  );
  releases[0]();
  assert.equal((await old).status, 503);
  assert.equal(
    (
      await b.f.call('/check-code', 'POST', {
        email: newest.to,
        code: b.delivered[0].code,
      })
    ).status,
    400,
  );
});

test('actual workerd service-binding RPC completes private Pages mail delivery into SQLite with public code routes denied', async () => {
  const buildScript = async (entry) =>
    (
      await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        external: ['cloudflare:workers'],
      })
    ).outputFiles[0].text;
  const pagesScript = (
    await build({
      stdin: {
        contents: `import {sellerMail} from './functions/_seller/mail.mjs'; export default {async fetch(req, env) { return await sellerMail(req,env) || env.SELLER_API.fetch(req); }}`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
    })
  ).outputFiles[0].text;
  const delivered = [];
  const mf = new Miniflare({
    workers: [
      {
        name: 'pages',
        modules: true,
        script: pagesScript,
        compatibilityDate: '2026-09-01',
        bindings: {
          INTAKE_STAGING_MODE: 'true',
          SELLER_STAGING_ORIGIN: origin,
          SELLER_MAIL_VIA_PAGES: 'true',
        },
        serviceBindings: {
          SELLER_API: 'seller',
          SELLER_MAILER: async (req) => {
            delivered.push(await req.json());
            return new Response(null, { status: 200 });
          },
        },
      },
      {
        name: 'seller',
        modules: true,
        script: await buildScript('workers/aircraft-sale/entry.mjs'),
        compatibilityDate: '2026-09-01',
        bindings: { MAIL_VIA_PAGES: 'true' },
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
        },
        r2Buckets: ['MEDIA'],
      },
    ],
  });
  try {
    const response = await mf.dispatchFetch(
      origin + '/api/aircraft-sale/send-code',
      {
        method: 'POST',
        headers: { Origin: origin },
        body: JSON.stringify({ email: 'rpc@example.test' }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, sent: true });
    assert.equal(delivered.length, 1);
    const login = await mf.dispatchFetch(
      origin + '/api/aircraft-sale/check-code',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'rpc@example.test',
          code: delivered[0].code,
        }),
      },
    );
    assert.equal(login.status, 200);
    assert.ok((await login.json()).session);
    assert.equal(
      (
        await mf.dispatchFetch(origin + '/api/aircraft-sale/_mail/start', {
          method: 'POST',
          body: '{}',
        })
      ).status,
      404,
    );
  } finally {
    await mf.dispose();
  }
});
