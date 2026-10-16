import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const wranglerRequire = createRequire(
  new URL('../../node_modules/wrangler/package.json', import.meta.url),
);
const { Miniflare } = await import(wranglerRequire.resolve('miniflare'));

const origin = 'https://www.rogerwilcoaviation.com';
const issuer = 'https://clerk.rogerwilcoaviation.com';
const audience = 'rwas-aircraft-seller-production';
const secret = 'sk_live_fixture';

function fixture(modulusLength = 2048) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  Object.assign(jwk, { kid: 'miniflare-contract', alg: 'RS256', use: 'sig' });
  const token = (overrides = {}, signature = true) => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: issuer,
        aud: audience,
        azp: origin,
        sub: 'user_Miniflare',
        sid: 'sess_Miniflare',
        iat: Math.floor(Date.now() / 1000) - 1,
        exp: Math.floor(Date.now() / 1000) + 300,
        ...overrides,
      }),
    ).toString('base64url');
    const input = header + '.' + payload;
    const encodedSignature = signature
      ? sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')
      : Buffer.from('invalid').toString('base64url');
    return input + '.' + encodedSignature;
  };
  return { jwk, token };
}

async function run({ outbound, token }) {
  const mf = new Miniflare({
    modules: true,
    scriptPath: new URL(
      './fixtures/clerk-miniflare-runtime.mjs',
      import.meta.url,
    ).pathname,
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['global_fetch_strictly_public'],
    bindings: {
      CLERK_PRODUCTION_ENABLED: 'true',
      CLERK_PRODUCTION_SECRET_KEY: secret,
      PUBLIC_LISTINGS_ENABLED: 'false',
    },
    outboundService: outbound,
  });
  try {
    const response = await mf.dispatchFetch(
      origin + '/api/aircraft-sale/auth/clerk-production/start',
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'X-Clerk-Session-Token': token,
        },
      },
    );
    return {
      status: response.status,
      stage: response.headers.get('X-RWAS-Clerk-Failure-Stage'),
      body: await response.json(),
    };
  } finally {
    await mf.dispose();
  }
}

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('Miniflare runtime preserves valid signature and canonical claims', async () => {
  const f = fixture();
  const result = await run({
    token: f.token(),
    outbound: async (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'clerk.rogerwilcoaviation.com')
        return json({ keys: [f.jwk] });
      if (url.pathname.endsWith('/sessions/sess_Miniflare'))
        return json({
          id: 'sess_Miniflare',
          user_id: 'user_Miniflare',
          status: 'active',
          expire_at: Date.now() + 300000,
          created_at: Date.now() - 1000,
        });
      if (url.pathname.endsWith('/users/user_Miniflare'))
        return json({
          id: 'user_Miniflare',
          banned: false,
          locked: false,
          primary_email_address_id: 'email_primary',
          password_last_updated_at: 1,
          first_name: 'Runtime',
          last_name: 'Fixture',
          email_addresses: [
            {
              id: 'email_primary',
              email_address: 'runtime@example.test',
              verification: { status: 'verified' },
            },
          ],
        });
      return new Response(null, { status: 404 });
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.stage, null);
  assert.deepEqual(result.body, { ok: true });
});

test('workerd rejects redirect error before issuing the JWKS request', async () => {
  let outboundCalls = 0;
  const mf = new Miniflare({
    modules: true,
    script: `export default { async fetch() {
      try {
        await fetch('https://clerk.rogerwilcoaviation.com/.well-known/jwks.json', {
          method: 'GET',
          redirect: 'error',
          headers: { Accept: 'application/json' },
        });
        return Response.json({ rejected: false });
      } catch (error) {
        return Response.json({ rejected: true, name: error.name });
      }
    } }`,
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['global_fetch_strictly_public'],
    outboundService: async () => {
      outboundCalls += 1;
      return json({ keys: [] });
    },
  });
  try {
    const response = await mf.dispatchFetch(origin + '/probe');
    assert.deepEqual(await response.json(), {
      rejected: true,
      name: 'TypeError',
    });
    assert.equal(outboundCalls, 0);
  } finally {
    await mf.dispose();
  }
});

test('Miniflare runtime separates bounded JWKS and JWT failure categories', async () => {
  const cases = [
    {
      name: 'status',
      outbound: async () => new Response('denied', { status: 403 }),
      status: 503,
      stage: 'jwt-jwks-status',
    },
    {
      name: 'json',
      outbound: async () => new Response('<html>', { status: 200 }),
      status: 503,
      stage: 'jwt-jwks-json',
    },
    {
      name: 'schema',
      outbound: async () => json({}),
      status: 503,
      stage: 'jwt-jwks-schema',
    },
    {
      name: 'kid selection',
      outbound: async () => json({ keys: [] }),
      status: 401,
      stage: 'jwt-key-selection',
    },
  ];
  for (const item of cases) {
    const f = fixture();
    const result = await run({ token: f.token(), outbound: item.outbound });
    assert.equal(result.status, item.status, item.name);
    assert.equal(result.stage, item.stage, item.name);
    assert.deepEqual(
      Object.keys(result.body).sort(),
      ['ok', 'stage'],
      item.name,
    );
  }

  const weak = fixture(1024);
  const paddedWeakKey = {
    ...weak.jwk,
    n: weak.jwk.n.padStart(342, 'A'),
  };
  assert.equal(paddedWeakKey.n.length, 342);
  const weakResult = await run({
    token: weak.token(),
    outbound: async () => json({ keys: [paddedWeakKey] }),
  });
  assert.equal(weakResult.status, 503);
  assert.equal(weakResult.stage, 'jwt-jwks-schema');

  const invalidImport = fixture();
  const badImport = await run({
    token: invalidImport.token(),
    outbound: async () =>
      json({
        keys: [{ ...invalidImport.jwk, n: 'A'.repeat(342), e: 'AA' }],
      }),
  });
  assert.equal(badImport.status, 503);
  assert.equal(badImport.stage, 'jwt-key-import');

  const signature = fixture();
  const badSignature = await run({
    token: signature.token({}, false),
    outbound: async () => json({ keys: [signature.jwk] }),
  });
  assert.equal(badSignature.status, 401);
  assert.equal(badSignature.stage, 'jwt-signature');

  const claims = fixture();
  const badClaims = await run({
    token: claims.token({ aud: 'wrong-audience' }),
    outbound: async () => json({ keys: [claims.jwk] }),
  });
  assert.equal(badClaims.status, 401);
  assert.equal(badClaims.stage, 'jwt-claims');
});
