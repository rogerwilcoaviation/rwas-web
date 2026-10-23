import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
test('activity table survives real SQLite DO restart, filters safely and preserves business state', async () => {
  const mail = [];
  const script = (
    await build({
      entryPoints: ['workers/aircraft-sale/entry.mjs'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      conditions: ['workerd', 'worker', 'browser'],
      external: ['cloudflare:workers', 'node:*'],
      logLevel: 'silent',
    })
  ).outputFiles[0].text;
  const options = {
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    durableObjects: {
      SELLER_STORE: { className: 'SellerStore', useSQLite: true },
    },
    bindings: {
      EMAIL_CODE_LOGIN_ENABLED: 'true',
      PUBLIC_LISTINGS_ENABLED: 'true',
      ACCOUNT_ADMIN_SITE_ORIGIN: 'http://localhost',
    },
    serviceBindings: {
      MAILER: async (req) => {
        mail.push(await req.json());
        return Response.json({ ok: true });
      },
      ACCOUNT_ADMIN_AUTH: async (req) =>
        req.headers.get('Authorization') === 'Bearer runtime-admin'
          ? Response.json({
              actor: 'admin@example.test',
              scope: 'seller-accounts',
              expiresAt: Date.now() + 3600000,
              authenticatedAt: Date.now(),
            })
          : new Response(null, { status: 403 }),
    },
  };
  const mf = new Miniflare(options);
  const call = (path, method = 'GET', body, token) =>
    mf.dispatchFetch('http://localhost/api/aircraft-sale' + path, {
      method,
      headers: {
        Origin: 'http://localhost',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    await call('/send-code', 'POST', { email: 'runtime@example.test' });
    const session = (
      await (
        await call('/check-code', 'POST', {
          email: 'runtime@example.test',
          code: mail[0].code,
        })
      ).json()
    ).session;
    const failed = await call(
      '/account',
      'PATCH',
      { name: 'PRIVATE'.repeat(100) },
      session,
    );
    assert.equal(failed.status, 400);
    const read = await call(
      '/admin/activity?result=failure&q=runtime%40example.test',
      'GET',
      undefined,
      'runtime-admin',
    );
    assert.equal(read.status, 200, await read.clone().text());
    const rows = (await read.json()).events;
    assert.ok(
      rows.some(
        (row) => row.requestId === failed.headers.get('X-RWAS-Request-ID'),
      ),
    );
    assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
    await mf.setOptions(options);
    assert.equal(
      (await call('/account', 'GET', undefined, session)).status,
      200,
    );
    const after = await (
      await call(
        '/admin/activity?q=runtime%40example.test',
        'GET',
        undefined,
        'runtime-admin',
      )
    ).json();
    assert.ok(after.events.length >= 2);
    assert.equal(
      (await call('/admin/activity', 'GET', undefined, session)).status,
      403,
    );
    assert.equal(
      (await call('/_activity/identity', 'POST', { subject: 'forged' })).status,
      404,
    );
    // Entry point identity result is logged without credentials, even with auth disabled.
    const identity = await call('/identity/sign-in/email', 'POST', {
      email: 'PRIVATE-EMAIL',
      password: 'PRIVATE-PASSWORD',
    });
    assert.equal(identity.status, 404);
    assert.ok(identity.headers.get('X-RWAS-Request-ID'));
    for (let i = 0; i < 20; i++) {
      const events = (
        await (
          await call(
            '/admin/activity?source=server',
            'GET',
            undefined,
            'runtime-admin',
          )
        ).json()
      ).events;
      if (
        events.some(
          (row) => row.requestId === identity.headers.get('X-RWAS-Request-ID'),
        )
      ) {
        assert.ok(!JSON.stringify(events).includes('PRIVATE-PASSWORD'));
        assert.ok(!JSON.stringify(events).includes('PRIVATE-EMAIL'));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(
      'Identity result was not recorded by the internal service path.',
    );
  } finally {
    await mf.dispose();
  }
});
