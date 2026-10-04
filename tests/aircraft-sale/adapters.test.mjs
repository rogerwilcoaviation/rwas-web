import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeReviewer,
  deliverCode,
} from '../../workers/aircraft-sale/adapters.mjs';
test('reviewer JWT requires signature, approved audience, issuer, expiry and allowlisted identity', async () => {
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
  jwk.kid = 'ephemeral-fixture';
  let calls = 0;
  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      'https://fixture.cloudflareaccess.com/cdn-cgi/access/certs',
    );
    calls++;
    return Response.json({ keys: [jwk] });
  };
  const env = {
    ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com',
    ACCESS_AUD: 'fixture-audience',
    REVIEWER_EMAILS: 'reviewer@example.test',
  };
  const claims = {
    iss: 'https://fixture.cloudflareaccess.com',
    aud: ['fixture-audience'],
    exp: Math.floor(Date.now() / 1000) + 60,
    email: 'reviewer@example.test',
  };
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const make = async (c) => {
    const input = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode(c);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      pair.privateKey,
      new TextEncoder().encode(input),
    );
    return new Request('https://offline.invalid', {
      headers: {
        'Cf-Access-Jwt-Assertion':
          input + '.' + Buffer.from(signature).toString('base64url'),
      },
    });
  };
  assert.equal((await authorizeReviewer(await make(claims), env)).status, 200);
  for (const change of [
    { aud: ['wrong'] },
    { email: 'other@example.test' },
    { iss: 'https://wrong.test' },
    { exp: 1 },
  ])
    assert.equal(
      (await authorizeReviewer(await make({ ...claims, ...change }), env))
        .status,
      403,
    );
  assert.equal(
    (await authorizeReviewer(new Request('https://offline.invalid'), env))
      .status,
    403,
  );
  assert.equal((await authorizeReviewer(await make(claims), {})).status, 503);
  assert.equal(calls, 1);
});
test('mail adapter requires configured existing sender/key and surfaces provider failure', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.deepEqual(JSON.parse(init.body).to, ['fixture@example.test']);
    return new Response(null, { status: 500 });
  };
  assert.equal((await deliverCode({}, {})).status, 503);
  assert.equal(calls, 0);
  assert.equal(
    (
      await deliverCode(
        {
          RESEND_API_KEY: 'synthetic-only',
          FROM_EMAIL: 'fixture@example.test',
        },
        { to: 'fixture@example.test', code: '123456' },
      )
    ).status,
    503,
  );
  assert.equal(calls, 1);
});
