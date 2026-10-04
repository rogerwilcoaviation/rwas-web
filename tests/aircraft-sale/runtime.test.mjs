import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdf } from './fixture.mjs';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
test('actual local workerd SQLite Durable Object/R2 login, concurrent create, review and private files', async () => {
  const mail = [];
  const mf = new Miniflare({
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
    r2Buckets: ['MEDIA'],
    serviceBindings: {
      MAILER: async (req) => {
        mail.push(await req.json());
        return Response.json({ ok: true });
      },
      ADMIN_AUTH: async (req) =>
        req.headers.get('Authorization') === 'Bearer fixture-reviewer'
          ? Response.json({ actor: 'reviewer' })
          : new Response(null, { status: 403 }),
    },
  });
  try {
    const call = async (path, method = 'GET', body, t, extra = {}) => {
      const response = await mf.dispatchFetch(
        'http://localhost/api/aircraft-sale' + path,
        {
          method,
          headers: {
            ...extra,
            ...(t ? { Authorization: 'Bearer ' + t } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return new Response(await response.arrayBuffer(), response);
    };
    assert.equal(
      (await call('/send-code', 'POST', { email: 'runtime@example.test' }))
        .status,
      200,
    );
    const code = mail[0].code;
    const t = (
      await (
        await call('/check-code', 'POST', {
          email: 'runtime@example.test',
          code,
        })
      ).json()
    ).session;
    assert.ok(t);
    const body = { make: 'Synthetic', model: 'Runtime', year: 2000, price: 1 };
    const [a, b] = await Promise.all([
      call('/listings', 'POST', body, t, { 'Idempotency-Key': 'one' }),
      call('/listings', 'POST', body, t, { 'Idempotency-Key': 'two' }),
    ]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const list = (
      await (await call('/my-listings', 'GET', undefined, t)).json()
    ).listings;
    assert.equal(list.length, 2);
    const l = list[0];
    const uploaded = await mf.dispatchFetch(
      'http://localhost/api/aircraft-sale/upload?listingId=' +
        l.id +
        '&category=airframe&filename=runtime.pdf',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + t,
          'Content-Type': 'application/pdf',
        },
        body: pdf,
      },
    );
    assert.equal(uploaded.status, 200);
    const file = (await uploaded.json()).file;
    const filePath = '/files/' + encodeURIComponent(file.key);
    assert.equal((await call(filePath)).status, 401);
    const privateFile = await call(filePath, 'GET', undefined, t);
    assert.equal(privateFile.status, 200);
    assert.deepEqual(
      new Uint8Array(await privateFile.arrayBuffer()),
      new Uint8Array(pdf),
    );
    l.revision = (
      await (await call('/my-listings', 'GET', undefined, t)).json()
    ).listings.find((x) => x.id === l.id).revision;
    await call(
      '/listing/' + l.id + '/status',
      'POST',
      { status: 'pending' },
      t,
    );
    assert.equal(
      (
        await call(
          '/admin/review',
          'POST',
          { listingId: l.id, revision: l.revision, decision: 'approve' },
          'fixture-reviewer',
        )
      ).status,
      200,
    );
    assert.equal((await (await call('/browse')).json()).listings.length, 1);
    await call('/logout', 'POST', {}, t);
    assert.equal((await call('/my-listings', 'GET', undefined, t)).status, 401);
  } finally {
    await mf.dispose();
  }
});
