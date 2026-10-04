import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('actual workerd SQLite persists account operation and replay after process restart without revoking newer sessions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seller-account-admin-'));
  const mail = [];
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
    bindings: { ACCOUNT_ADMIN_SITE_ORIGIN: 'http://localhost' },
    serviceBindings: {
      MAILER: async (request) => {
        mail.push(await request.json());
        return Response.json({ ok: true });
      },
      ACCOUNT_ADMIN_AUTH: async (request) =>
        request.headers.get('Authorization') ===
        'Bearer synthetic-account-admin'
          ? Response.json({
              actor: 'admin@example.test',
              scope: 'seller-accounts',
              authenticatedAt: Date.now(),
              expiresAt: Date.now() + 3600000,
            })
          : new Response(null, { status: 403 }),
    },
  };
  let mf;
  const call = async (path, method = 'GET', body, token) => {
    const response = await mf.dispatchFetch(
      'http://localhost/api/aircraft-sale' + path,
      {
        method,
        headers: {
          Connection: 'close',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body
            ? { 'Content-Type': 'application/json', Origin: 'http://localhost' }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return new Response(await response.arrayBuffer(), response);
  };
  const login = async () => {
    assert.equal(
      (await call('/send-code', 'POST', { email: 'runtime@example.test' }))
        .status,
      200,
    );
    const r = await call('/check-code', 'POST', {
      email: 'runtime@example.test',
      code: mail.at(-1).code,
    });
    assert.equal(r.status, 200);
    return (await r.json()).session;
  };
  try {
    mf = new Miniflare(options);
    const first = await login();
    const profile = (
      await (await call('/account', 'GET', undefined, first)).json()
    ).profile;
    const body = {
      id: 'persisted-revocation',
      operation: 'revoke-sessions',
      reasonCode: 'maintenance',
    };
    const prefix = '/admin/accounts/' + profile.id;
    assert.equal(
      (await call('/admin/accounts', 'GET', undefined, first)).status,
      403,
    );
    const proposal = await (
      await call(prefix + '/preview', 'POST', body, 'synthetic-account-admin')
    ).json();
    const packet = { ...body, confirmation: proposal.confirmation };
    assert.equal(
      (await call(prefix + '/apply', 'POST', packet, 'synthetic-account-admin'))
        .status,
      200,
    );
    assert.equal((await call('/account', 'GET', undefined, first)).status, 401);
    const newer = await login();
    await mf.dispose();
    mf = new Miniflare(options);
    assert.equal(
      (
        await (
          await call(
            prefix + '/apply',
            'POST',
            packet,
            'synthetic-account-admin',
          )
        ).json()
      ).replayed,
      true,
    );
    assert.equal((await call('/account', 'GET', undefined, newer)).status, 200);
    const detail = await (
      await call(prefix, 'GET', undefined, 'synthetic-account-admin')
    ).json();
    assert.equal(detail.account.id, profile.id);
    assert.equal(detail.audit.length, 1);
    assert.equal(detail.audit[0].operationId, body.id);
    assert.equal(detail.account.activeSessions, 1);
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
