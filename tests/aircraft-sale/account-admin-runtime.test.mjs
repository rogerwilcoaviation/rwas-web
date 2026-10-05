import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('native workerd verifies actual user login with optional fields and refuses identity redirects', async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  jwk.kid = 'ephemeral-native-account-admin';
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const input =
    encode({ alg: 'RS256', kid: jwk.kid }) +
    '.' +
    encode({
      iss: 'https://fixture.cloudflareaccess.com',
      aud: ['fixture-account-admin'],
      email: 'admin@example.test',
      sub: 'fixture-user',
      iat: now,
      auth_time: now,
      exp: now + 3600,
    });
  const token =
    input +
    '.' +
    Buffer.from(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(input),
      ),
    ).toString('base64url');
  const normalIdentity = {
    email: 'admin@example.test',
    user_uuid: 'fixture-user',
    iat: now,
  };
  let identity = normalIdentity;
  let identityStatus = 200;
  const requests = [];
  const script = (
    await build({
      stdin: {
        contents:
          "import { authorizeAccountAdministrator } from './workers/aircraft-sale/adapters.mjs'; export default { fetch: authorizeAccountAdministrator };",
        resolveDir: process.cwd(),
        sourcefile: 'native-account-admin-fixture.mjs',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
    })
  ).outputFiles[0].text;
  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    bindings: {
      ACCOUNT_ADMIN_ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com',
      ACCOUNT_ADMIN_ACCESS_AUD: 'fixture-account-admin',
      ACCOUNT_ADMIN_EMAILS: 'admin@example.test',
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      requests.push(url.origin + url.pathname);
      assert.equal(url.origin, 'https://fixture.cloudflareaccess.com');
      if (url.pathname.endsWith('/certs'))
        return Response.json({ keys: [jwk] });
      assert.equal(url.pathname, '/cdn-cgi/access/get-identity');
      assert.equal(request.headers.get('Cookie'), 'CF_Authorization=' + token);
      return identityStatus === 302
        ? new Response(null, {
            status: 302,
            headers: { Location: 'https://untrusted.example/identity' },
          })
        : Response.json(identity, { status: identityStatus });
    },
  });
  const authorize = async () => {
    const response = await mf.dispatchFetch('http://localhost/authorize', {
      headers: { 'Cf-Access-Jwt-Assertion': token },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const fresh = await authorize();
    assert.equal(fresh.actor, 'admin@example.test');
    assert.equal(fresh.authenticatedAt, now * 1000);
    assert.ok(
      requests.includes(
        'https://fixture.cloudflareaccess.com/cdn-cgi/access/get-identity',
      ),
    );
    identity = { ...normalIdentity, iat: now - 700 };
    assert.equal((await authorize()).authenticatedAt, (now - 700) * 1000);
    for (const unsafe of [
      { ...normalIdentity, iat: null },
      { ...normalIdentity, user_uuid: 'wrong-user' },
      { ...normalIdentity, service_token_status: true },
    ]) {
      identity = unsafe;
      assert.equal((await authorize()).authenticatedAt, null);
    }
    identity = normalIdentity;
    identityStatus = 302;
    assert.equal((await authorize()).authenticatedAt, null);
    assert.ok(
      requests.every((url) =>
        url.startsWith('https://fixture.cloudflareaccess.com/'),
      ),
    );
    identityStatus = 503;
    assert.equal((await authorize()).authenticatedAt, null);
  } finally {
    await mf.dispose();
  }
});

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
