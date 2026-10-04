import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { digest, randomProof } from '../../workers/aircraft-sale/identity.mjs';
let keys;
export async function identityFixture(origin = 'http://localhost') {
  keys ||= await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  jwk.kid = 'ephemeral';
  const f = fixture(),
    codes = new Map(),
    calls = [];
  Object.assign(f.env, {
    AUTH_ISSUER: 'https://identity.fixture.test/',
    AUTH_CLIENT_ID: 'synthetic-public-client',
    AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
    AUTH_CONNECTIONS: JSON.stringify({
      password: 'fixture-database',
      google: 'google-oauth2',
      apple: 'apple',
    }),
    AUTH_EVENT_SECRET: 'synthetic-event-secret-not-a-real-credential',
  });
  f.env.AUTH_PROVIDER = {
    fetch: async (req) => {
      calls.push(new URL(req.url).pathname);
      assert.equal(new URL(req.url).origin, 'https://identity.fixture.test');
      if (new URL(req.url).pathname === '/.well-known/jwks.json')
        return Response.json({ keys: [jwk] });
      assert.equal(new URL(req.url).pathname, '/oauth/token');
      const body = await req.json(),
        expected = codes.get(body.code);
      codes.delete(body.code);
      if (!expected) return new Response(null, { status: 400 });
      assert.equal(body.client_id, f.env.AUTH_CLIENT_ID);
      assert.equal(body.redirect_uri, f.env.AUTH_REDIRECT_URI);
      assert.equal(body.code_verifier, expected.verifier);
      const encode = (v) =>
        Buffer.from(JSON.stringify(v)).toString('base64url');
      const input =
        encode({ alg: 'RS256', kid: 'ephemeral', ...expected.header }) +
        '.' +
        encode(expected.claims);
      let signature = Buffer.from(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          keys.privateKey,
          new TextEncoder().encode(input),
        ),
      ).toString('base64url');
      if (expected.tamper)
        signature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      return Response.json({ id_token: input + '.' + signature });
    },
  };
  const begin = async (method = 'google', token, link = false) => {
    const proof = randomProof();
    const r = await f.call(
      '/auth/start',
      'POST',
      { method, proof, link },
      token,
    );
    return { response: r, ...(await r.json()), proof };
  };
  const issueCode = async (start, changes = {}, options = {}) => {
    const tx = f.state().authTransactions[await digest(start.state)],
      code = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    codes.set(code, {
      verifier: tx.verifier,
      header: options.header,
      tamper: options.tamper,
      claims: {
        iss: f.env.AUTH_ISSUER,
        aud: f.env.AUTH_CLIENT_ID,
        exp: now + 60,
        iat: now,
        nonce: tx.nonce,
        sub: 'google|synthetic',
        email: 'identity@example.test',
        email_verified: true,
        name: 'Synthetic Identity',
        ...changes,
      },
    });
    return code;
  };
  const finish = async (start, changes = {}, token, options = {}) => {
    const code = await issueCode(start, changes, options);
    return f.call(
      '/auth/finish',
      'POST',
      { state: start.state, proof: start.proof, code },
      token,
    );
  };
  return { f, calls, begin, finish, codes, issueCode };
}
