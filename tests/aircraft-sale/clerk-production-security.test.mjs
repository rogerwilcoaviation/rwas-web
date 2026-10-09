import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import {
  CLERK_PRODUCTION,
  clerkProductionConfig,
  clerkProductionIdentity,
} from '../../workers/aircraft-sale/clerk-production.mjs';
import { fixture } from './fixture.mjs';

globalThis.crypto ||= webcrypto;

const secret = 'sk_live_fixture_not_a_credential';
const origin = CLERK_PRODUCTION.origin;

function providerFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  Object.assign(jwk, { kid: 'production-fixture', alg: 'RS256', use: 'sig' });
  const session = {
    id: 'sess_Production',
    user_id: 'user_Production',
    status: 'active',
    expire_at: Date.now() + 3600000,
    created_at: Date.now() - 10000,
  };
  const user = {
    id: 'user_Production',
    banned: false,
    locked: false,
    primary_email_address_id: 'email_primary',
    email_addresses: [
      {
        id: 'email_primary',
        email_address: 'owner@example.test',
        verification: { status: 'verified' },
      },
    ],
    password_last_updated_at: 1000,
    first_name: 'Fixture',
    last_name: 'Owner',
    public_metadata: { role: 'admin' },
    totp_enabled: true,
  };
  const jwt = (overrides = {}) => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: CLERK_PRODUCTION.issuer,
        aud: CLERK_PRODUCTION.audience,
        azp: origin,
        sub: user.id,
        sid: session.id,
        iat: Math.floor(Date.now() / 1000) - 1,
        exp: Math.floor(Date.now() / 1000) + 300,
        role: 'admin',
        ...overrides,
      }),
    ).toString('base64url');
    const input = header + '.' + payload;
    return (
      input +
      '.' +
      sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')
    );
  };
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === CLERK_PRODUCTION.issuer + '/.well-known/jwks.json')
      return Response.json({ keys: [jwk] });
    assert.equal(init.headers.Authorization, 'Bearer ' + secret);
    if (String(url).endsWith('/sessions/' + session.id))
      return Response.json(session);
    if (String(url).endsWith('/users/' + user.id)) return Response.json(user);
    return new Response(null, { status: 404 });
  };
  return { session, user, jwt, fetch, calls };
}

const env = () => ({
  CLERK_PRODUCTION_ENABLED: 'true',
  CLERK_PRODUCTION_SECRET_KEY: secret,
  PUBLIC_LISTINGS_ENABLED: 'false',
});

const request = (token, requestOrigin = origin) =>
  new Request(origin + '/api/aircraft-sale/account', {
    headers: {
      Origin: requestOrigin,
      'X-Clerk-Session-Token': token,
    },
  });

async function rejectsStatus(operation, status) {
  await assert.rejects(operation, (error) => error.status === status);
}

test('production adapter is OFF by default and hard-codes the canonical deployment boundary', async () => {
  const p = providerFixture();
  assert.equal(clerkProductionConfig({}, request(p.jwt())), null);
  await rejectsStatus(
    () => clerkProductionIdentity({}, request(p.jwt()), p.fetch),
    404,
  );
  for (const bad of [
    { ...env(), CLERK_PRODUCTION_SECRET_KEY: '' },
    { ...env(), CLERK_PRODUCTION_SECRET_KEY: 'sk_test_fixture' },
    { ...env(), PUBLIC_LISTINGS_ENABLED: 'true' },
  ])
    assert.throws(
      () => clerkProductionConfig(bad, request(p.jwt())),
      (error) => error.status === 503,
    );
  assert.throws(
    () =>
      clerkProductionConfig(
        env(),
        new Request('https://rogerwilcoaviation.com/api/aircraft-sale/account'),
      ),
    (error) => error.status === 503,
  );
  await rejectsStatus(
    () =>
      clerkProductionIdentity(
        env(),
        request(p.jwt(), 'https://evil.test'),
        p.fetch,
      ),
    403,
  );
  assert.equal(p.calls.length, 0);
});

test('browser same-origin GET/HEAD omit Origin; mutations require exact Origin', async () => {
  const p = providerFixture();
  for (const path of ['/account', '/media/private-fixture']) {
    for (const method of ['GET', 'HEAD']) {
      const req = new Request(origin + '/api/aircraft-sale' + path, {
        method,
        headers: {
          'Sec-Fetch-Site': 'same-origin',
          'X-Clerk-Session-Token': p.jwt(),
        },
      });
      assert.equal(
        (await clerkProductionIdentity(env(), req, p.fetch)).subject,
        p.user.id,
      );
      req.headers.set('Sec-Fetch-Site', 'cross-site');
      await rejectsStatus(
        () => clerkProductionIdentity(env(), req, p.fetch),
        403,
      );
    }
  }
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    for (const value of [
      null,
      'null',
      'https://evil.test',
      'https://rogerwilcoaviation.com',
    ]) {
      const headers = {
        'X-Clerk-Session-Token': p.jwt(),
        'Sec-Fetch-Site': 'same-origin',
      };
      if (value !== null) headers.Origin = value;
      await rejectsStatus(
        () =>
          clerkProductionIdentity(
            env(),
            new Request(origin + '/api/aircraft-sale/account', {
              method,
              headers,
            }),
            p.fetch,
          ),
        403,
      );
    }
  }
});

test('direct HTTP adapter requires exact signed claims and canonical session/user state on every call', async () => {
  const p = providerFixture();
  const identity = await clerkProductionIdentity(
    env(),
    request(p.jwt()),
    p.fetch,
  );
  assert.deepEqual(identity, {
    issuer: CLERK_PRODUCTION.issuer,
    subject: p.user.id,
    providerSessionId: p.session.id,
    providerSessionExpiresAt: p.session.expire_at,
    providerSessionCreatedAt: p.session.created_at,
    passwordLastUpdatedAt: 1000,
    email: 'owner@example.test',
    name: 'Fixture Owner',
  });
  assert.equal(p.calls.length, 3);
  assert.ok(p.calls.every(({ url }) => !url.includes('accounts.dev')));
  for (const claims of [
    { iss: 'https://wrong.example' },
    { aud: [CLERK_PRODUCTION.audience] },
    { aud: 'wrong' },
    { azp: 'https://rogerwilcoaviation.com' },
    { sid: undefined },
    { act: { sub: 'actor' } },
    { exp: 1 },
    { iat: Math.floor(Date.now() / 1000) - 301 },
    { iat: Math.floor(Date.now() / 1000) + 60 },
  ])
    await rejectsStatus(
      () => clerkProductionIdentity(env(), request(p.jwt(claims)), p.fetch),
      401,
    );
  p.session.status = 'revoked';
  await rejectsStatus(
    () => clerkProductionIdentity(env(), request(p.jwt()), p.fetch),
    401,
  );
  p.session.status = 'active';
  p.user.email_addresses[0].verification.status = 'unverified';
  await rejectsStatus(
    () => clerkProductionIdentity(env(), request(p.jwt()), p.fetch),
    403,
  );
  p.user.email_addresses[0].verification.status = 'verified';
  p.user.locked = undefined;
  await rejectsStatus(
    () => clerkProductionIdentity(env(), request(p.jwt()), p.fetch),
    403,
  );
  p.user.locked = false;
  p.user.banned = true;
  await assert.rejects(
    () => clerkProductionIdentity(env(), request(p.jwt()), p.fetch),
    (error) =>
      error.status === 403 &&
      error.providerIdentity?.blocked === true &&
      error.providerIdentity.subject === p.user.id,
  );
});

test('production core keeps trusted legacy sessions, rejects email migration, and persists reset fences', async () => {
  const p = providerFixture();
  const f = fixture();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = p.fetch;
  try {
    const legacy = await f.login();
    const state = f.state();
    const profile = Object.values(state.profiles)[0];
    const bytes = new TextEncoder().encode(
      CLERK_PRODUCTION.issuer + '|' + p.user.id,
    );
    const identityKey = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (value) => value.toString(16).padStart(2, '0'),
    ).join('');
    state.identities[identityKey] = {
      userId: profile.id,
      issuer: CLERK_PRODUCTION.issuer,
      subject: p.user.id,
      method: 'clerk-production',
      createdAt: Date.now(),
      credentialsChangedAt: 0,
    };
    f.durable.set('state', state);
    Object.assign(f.env, env(), {
      AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
    });
    assert.deepEqual(await (await f.call('/auth/methods', 'GET')).json(), {
      methods: ['clerk-production'],
      emailCode: false,
      publicListings: false,
    });
    assert.equal((await f.call('/auth/start', 'POST', {})).status, 404);
    const headers = {
      Origin: origin,
      'X-Clerk-Session-Token': p.jwt(),
    };
    const start = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers,
    );
    assert.equal(start.status, 200);
    const finish = await f.call(
      '/auth/clerk-production/finish',
      'POST',
      { nonce: (await start.json()).nonce },
      undefined,
      headers,
    );
    assert.equal(finish.status, 200);
    const clerk = await finish.json();
    assert.equal(Object.keys(f.state().sessions).length, 2);
    assert.equal(
      (await f.call('/account', 'GET', undefined, legacy)).status,
      200,
    );
    const account = await (
      await f.call('/account', 'GET', undefined, clerk.session, {
        'X-Clerk-Session-Token': p.jwt(),
        'Sec-Fetch-Site': 'same-origin',
        'X-RWAS-CSRF': clerk.csrf,
      })
    ).json();
    assert.equal(account.profile.email, 'owner@example.test');
    assert.equal(account.profile.role, undefined);
    p.user.password_last_updated_at = 2000;
    assert.equal(
      (
        await f.call('/account', 'GET', undefined, clerk.session, {
          ...headers,
          'X-RWAS-CSRF': clerk.csrf,
        })
      ).status,
      401,
    );
    assert.equal(Object.keys(f.state().sessions).length, 0);
    assert.ok(f.state().identitySecurity[identityKey].credentialsChangedAt > 0);
    assert.equal(
      f.state().identitySecurity[identityKey].providerResetHold,
      true,
    );
    f.restart();
    const held = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers,
    );
    assert.equal(held.status, 200);
    assert.equal(
      (
        await f.call(
          '/auth/clerk-production/finish',
          'POST',
          { nonce: (await held.json()).nonce },
          undefined,
          headers,
        )
      ).status,
      403,
    );
    const attempt = async () => {
      const proof = { Origin: origin, 'X-Clerk-Session-Token': p.jwt() };
      const started = await f.call(
        '/auth/clerk-production/start',
        'POST',
        {},
        undefined,
        proof,
      );
      assert.equal(started.status, 200);
      return f.call(
        '/auth/clerk-production/finish',
        'POST',
        { nonce: (await started.json()).nonce },
        undefined,
        proof,
      );
    };
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Different provider ID alone cannot recover; missing/old creation proof fails.
    p.session.id = 'sess_Fresh';
    delete p.session.created_at;
    assert.equal((await attempt()).status, 403);
    p.session.created_at = 2000;
    assert.equal((await attempt()).status, 403);
    p.session.created_at =
      f.state().identitySecurity[identityKey].credentialsChangedAt;
    assert.equal((await attempt()).status, 403);
    p.session.created_at = Date.now() + 60000;
    assert.equal((await attempt()).status, 403);
    p.session.created_at = Date.now();
    p.session.id = 'sess_Production';
    assert.equal((await attempt()).status, 403);
    p.session.id = 'sess_Fresh';
    // Authoritative password generation cannot regress.
    p.user.password_last_updated_at = 1000;
    assert.equal((await attempt()).status, 403);
    p.user.password_last_updated_at = 2000;
    // Genuine fresh login cannot clear any manual/source hold or provider ban hold.
    for (const flag of ['disabled', 'identityBlocked', 'adminSuspended']) {
      const heldState = f.state();
      heldState.profiles[profile.id][flag] = true;
      f.durable.set('state', heldState);
      assert.equal((await attempt()).status, 403);
      assert.equal(f.state().profiles[profile.id][flag], true);
      assert.equal(
        f.state().identitySecurity[identityKey].providerResetHold,
        true,
      );
      const restored = f.state();
      delete restored.profiles[profile.id][flag];
      f.durable.set('state', restored);
    }
    const blocked = f.state();
    blocked.identitySecurity[identityKey].blocked = true;
    f.durable.set('state', blocked);
    assert.equal((await attempt()).status, 403);
    assert.equal(f.state().identitySecurity[identityKey].blocked, true);
    const restored = f.state();
    delete restored.identitySecurity[identityKey].blocked;
    f.durable.set('state', restored);
    const recovered = await attempt();
    assert.equal(recovered.status, 200);
    const fresh = await recovered.json();
    assert.equal(
      f.state().identitySecurity[identityKey].providerResetHold,
      false,
    );
    f.restart();
    const proof = {
      'X-Clerk-Session-Token': p.jwt(),
      'X-RWAS-CSRF': fresh.csrf,
      'Sec-Fetch-Site': 'same-origin',
    };
    assert.equal(
      (await f.call('/account', 'GET', undefined, fresh.session, proof)).status,
      200,
    );
    assert.equal(
      (
        await f.call('/account', 'GET', undefined, clerk.session, {
          ...proof,
          'X-RWAS-CSRF': clerk.csrf,
        })
      ).status,
      401,
    );
    assert.equal(
      (await f.call('/account', 'GET', undefined, legacy)).status,
      401,
    );
    assert.equal(
      (
        await f.call('/account', 'GET', undefined, fresh.session, {
          ...proof,
          'X-RWAS-CSRF': 'wrong',
        })
      ).status,
      403,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('production core never migrates a new provider identity by matching email', async () => {
  const p = providerFixture();
  const f = fixture();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = p.fetch;
  try {
    await f.login();
    Object.assign(f.env, env(), {
      AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
    });
    const headers = {
      Origin: origin,
      'X-Clerk-Session-Token': p.jwt(),
    };
    const start = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers,
    );
    const response = await f.call(
      '/auth/clerk-production/finish',
      'POST',
      { nonce: (await start.json()).nonce },
      undefined,
      headers,
    );
    assert.equal(response.status, 409);
    assert.equal(Object.keys(f.state().profiles).length, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('canonical provider ban creates a sticky persisted local hold without trusting paid roles or MFA', async () => {
  const p = providerFixture();
  p.user.email_addresses[0].email_address = 'new-owner@example.test';
  const f = fixture();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = p.fetch;
  try {
    Object.assign(f.env, env(), {
      AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
    });
    const headers = {
      Origin: origin,
      'X-Clerk-Session-Token': p.jwt(),
    };
    const start = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers,
    );
    const finish = await f.call(
      '/auth/clerk-production/finish',
      'POST',
      { nonce: (await start.json()).nonce },
      undefined,
      headers,
    );
    const clerk = await finish.json();
    const account = await (
      await f.call('/account', 'GET', undefined, clerk.session, {
        ...headers,
        'X-RWAS-CSRF': clerk.csrf,
      })
    ).json();
    assert.equal(account.profile.role, undefined);
    p.user.banned = true;
    assert.equal(
      (
        await f.call('/account', 'GET', undefined, clerk.session, {
          ...headers,
          'X-RWAS-CSRF': clerk.csrf,
        })
      ).status,
      403,
    );
    const [identityKey] = Object.keys(f.state().identitySecurity);
    assert.equal(f.state().identitySecurity[identityKey].blocked, true);
    assert.equal(Object.keys(f.state().sessions).length, 0);
    p.user.banned = false;
    f.restart();
    const held = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers,
    );
    assert.equal(held.status, 200);
    assert.equal(
      (
        await f.call(
          '/auth/clerk-production/finish',
          'POST',
          { nonce: (await held.json()).nonce },
          undefined,
          headers,
        )
      ).status,
      403,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});
