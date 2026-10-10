import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { CLERK_PRODUCTION } from '../../workers/aircraft-sale/clerk-production.mjs';

globalThis.crypto ||= webcrypto;

const config = readFileSync(
  new URL(
    '../../workers/aircraft-sale/wrangler.production.toml',
    import.meta.url,
  ),
  'utf8',
);

test('production Worker routes same-zone Clerk fetches through the public front door', () => {
  assert.match(
    config,
    /^compatibility_flags = \["global_fetch_strictly_public"\]$/m,
  );
  assert.doesNotMatch(config, /global_fetch_private_origin/);
  assert.equal((config.match(/global_fetch_strictly_public/g) || []).length, 1);
});

test(
  'live public Clerk JWKS exposes usable unique RSA signing keys',
  { skip: process.env.RWAS_CHECK_PUBLIC_CLERK_JWKS !== 'true' },
  async () => {
    const response = await fetch(
      CLERK_PRODUCTION.issuer + '/.well-known/jwks.json',
      {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'application/json' },
      },
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-type') || '',
      /application\/json/i,
    );
    const body = await response.json();
    assert.ok(Array.isArray(body.keys));
    assert.ok(body.keys.length >= 1);
    const kids = new Set();
    for (const key of body.keys) {
      assert.equal(key.kty, 'RSA');
      assert.equal(key.alg, 'RS256');
      assert.ok(key.use === undefined || key.use === 'sig');
      assert.equal(typeof key.kid, 'string');
      assert.ok(key.kid.length > 0 && key.kid.length <= 256);
      assert.equal(kids.has(key.kid), false);
      kids.add(key.kid);
      const imported = await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      assert.equal(imported.type, 'public');
    }
  },
);
