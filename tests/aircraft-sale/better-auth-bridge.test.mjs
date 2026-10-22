import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker, { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { fixture, fields, png } from './fixture.mjs';
import { identityFixture } from './identity-fixture.mjs';

globalThis.crypto ||= webcrypto;
const origin = 'http://localhost';
const csrfHeaders = (login, cookie = 'a') => ({
  Origin: origin,
  Cookie: cookie,
  'X-RWAS-CSRF': login.csrf,
});

function setup() {
  const f = fixture();
  Object.assign(f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: 'rwas-local-fixture-only-no-persistent-secret',
    SELLER_AUTH_DB: {
      prepare() {
        throw Error('Unit fixture never opens D1.');
      },
    },
    // These stale flags must not supersede the selected authentication backend.
    CLERK_PRODUCTION_ENABLED: 'true',
    CLERK_ACCEPTANCE_ENABLED: 'true',
    EMAIL_CODE_LOGIN_ENABLED: 'true',
  });
  const identities = new Map();
  let reads = 0,
    error = null;
  const fresh = (
    subject = 'identity-a',
    address = 'a@example.test',
    session = 'session-a',
  ) => ({
    issuer: 'rwas-better-auth',
    subject,
    providerSessionId: session,
    email: address,
    emailVerified: true,
    name: 'Fixture seller',
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 172800000,
  });
  identities.set('a', fresh());
  identities.set('b', fresh('identity-b', 'b@example.test', 'session-b'));
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async (_env, request) => {
      reads++;
      if (error) throw error;
      return identities.get(request.headers.get('Cookie')) || null;
    },
  });
  const call = (...args) => store.fetch(f.request(...args));
  const bridge = (cookie = 'a', headers = {}) =>
    call('/auth/better-auth', 'POST', {}, undefined, {
      Origin: origin,
      Cookie: cookie,
      ...headers,
    });
  const login = async (cookie = 'a') => {
    const response = await bridge(cookie);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  return {
    ...f,
    store,
    call,
    bridge,
    login,
    fresh,
    identities,
    reads: () => reads,
    error: (value) => {
      error = value;
    },
  };
}

async function json(response, expected = 200) {
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
}
const sessionKey = (session) => digest(session);

test('Better Auth takes precedence, advertises configured methods only, and leaves no legacy signup bypass', async () => {
  const f = setup();
  const methods = await json(await f.call('/auth/methods'));
  assert.deepEqual(methods.methods, ['better-auth']);
  assert.deepEqual(methods.betterAuth, {
    providers: ['password'],
    legacyLink: false,
  });
  assert.equal(methods.emailCode, false);
  assert.equal(methods.publicListings, true);
  for (const path of [
    '/send-code',
    '/check-code',
    '/auth/start',
    '/auth/finish',
    '/auth/clerk-production/start',
  ])
    assert.equal((await f.call(path, 'POST', {})).status, 404, path);
  f.env.BETTER_AUTH_GOOGLE_ENABLED = 'true';
  assert.equal(
    (await f.call('/auth/methods')).status,
    503,
    'Missing OAuth credentials fail closed.',
  );
  f.env.GOOGLE_CLIENT_ID = 'synthetic-client-id';
  f.env.GOOGLE_CLIENT_SECRET = 'synthetic-secret';
  const configured = await json(await f.call('/auth/methods'));
  assert.deepEqual(configured.betterAuth.providers, ['password', 'google']);
  assert.equal(JSON.stringify(configured).includes('synthetic'), false);
});

test('a verified identity creates a separate business profile and hashed opaque session bound to provider session', async () => {
  const f = setup();
  const login = await f.login();
  const state = f.state();
  assert.equal(login.provider, 'better-auth');
  assert.equal(login.identityUserId, f.identities.get('a').subject);
  assert.equal(
    login.identitySessionId,
    f.identities.get('a').providerSessionId,
  );
  assert.ok(login.csrf && login.session);
  assert.equal(state.sessions[login.session], undefined);
  const local = state.sessions[await sessionKey(login.session)];
  assert.equal(local.method, 'better-auth');
  assert.notEqual(local.userId, 'identity-a');
  assert.equal(local.providerSessionId, 'session-a');
  assert.equal(
    state.identities[await digest('rwas-better-auth|identity-a')].userId,
    local.userId,
  );
  assert.ok(local.expiresAt <= f.identities.get('a').expiresAt);
  const before = f.reads();
  const account = await json(
    await f.call(
      '/account',
      'GET',
      undefined,
      login.session,
      csrfHeaders(login),
    ),
  );
  assert.equal(account.profile.id, local.userId);
  assert.equal(
    f.reads(),
    before + 1,
    'Protected requests validate the persistent identity session again.',
  );
});

test('invalid identity, forged origin, CSRF absence, identity switch, expired and revoked sessions deny access', async () => {
  const f = setup();
  assert.equal((await f.bridge('missing')).status, 401);
  f.identities.set('unverified', { ...f.fresh(), emailVerified: false });
  assert.equal((await f.bridge('unverified')).status, 401);
  assert.equal(
    (await f.bridge('a', { Origin: 'https://attacker.example' })).status,
    403,
  );
  assert.equal(
    (await f.bridge('a', { 'Sec-Fetch-Site': 'cross-site' })).status,
    403,
  );
  const login = await f.login();
  assert.equal(
    (await f.call('/account', 'GET', undefined, login.session, { Cookie: 'a' }))
      .status,
    403,
  );
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        login.session,
        csrfHeaders(login, 'b'),
      )
    ).status,
    401,
  );
  f.identities.get('a').expiresAt = Date.now() - 1;
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        login.session,
        csrfHeaders(login),
      )
    ).status,
    401,
  );
  f.identities.delete('a');
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        login.session,
        csrfHeaders(login),
      )
    ).status,
    401,
  );
});

test('a provider read outage does not create identity state or grant access', async () => {
  const f = setup();
  const before = structuredClone(f.state());
  f.error(new Error('internal synthetic transport detail'));
  const response = await f.bridge();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('transport detail'), false);
  assert.deepEqual(f.state()?.profiles || {}, before?.profiles || {});
  assert.deepEqual(f.state()?.identities || {}, before?.identities || {});
  assert.deepEqual(f.state()?.sessions || {}, before?.sessions || {});
});

test('MFA requirement is reported as an allowlisted code without provider detail', async () => {
  const f = setup();
  f.error(
    Object.assign(
      new Error('Verify your authenticator or backup code before continuing.'),
      { status: 403, code: 'TWO_FACTOR_REQUIRED' },
    ),
  );
  assert.deepEqual(await json(await f.bridge(), 403), {
    error: 'Verify your authenticator or backup code before continuing.',
    code: 'TWO_FACTOR_REQUIRED',
  });
});

test('optional legacy Auth0 transition admits mapped owners but cannot create new accounts or identities', async () => {
  const i = await identityFixture();
  const initial = await json(await i.finish(await i.begin('password')));
  const ownerId =
    i.f.state().sessions[await sessionKey(initial.session)].userId;
  Object.assign(i.f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: 'rwas-local-fixture-only-no-persistent-secret',
    SELLER_AUTH_DB: { prepare() {} },
    BETTER_AUTH_LEGACY_LINK_ENABLED: 'true',
  });
  const repeat = await json(await i.finish(await i.begin('password')));
  assert.equal(
    i.f.state().sessions[await sessionKey(repeat.session)].userId,
    ownerId,
  );
  const before = structuredClone(i.f.state().profiles);
  await json(
    await i.finish(await i.begin('password'), {
      sub: 'password|unmapped',
      email: 'new@example.test',
    }),
    403,
  );
  assert.deepEqual(i.f.state().profiles, before);
  assert.equal(
    Object.values(i.f.state().identities).some(
      (identity) => identity.subject === 'password|unmapped',
    ),
    false,
  );
  const link = await i.begin('google', repeat.session, true);
  assert.equal(link.response.status, 403);
  i.f.env.BETTER_AUTH_LEGACY_LINK_ENABLED = 'false';
  assert.equal((await i.begin('password')).response.status, 404);
});

test('completed adoption rejects both captured legacy sessions and freshly verified legacy login', async () => {
  const i = await identityFixture();
  const initial = await json(await i.finish(await i.begin('password')));
  Object.assign(i.f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: 'rwas-local-fixture-only-no-persistent-secret',
    SELLER_AUTH_DB: { prepare() {} },
    BETTER_AUTH_LEGACY_LINK_ENABLED: 'true',
  });
  const now = Date.now();
  const current = {
    issuer: 'rwas-better-auth',
    subject: 'adopted-identity',
    providerSessionId: 'adopted-session',
    email: 'identity@example.test',
    emailVerified: true,
    name: 'Adopted fixture',
    createdAt: now - 1000,
    expiresAt: now + 172800000,
  };
  const store = new SellerStore(i.f.ctx, i.f.env, {
    readBetterAuthIdentity: async () => current,
  });
  const adopted = await json(
    await store.fetch(
      i.f.request('/auth/better-auth/link', 'POST', {}, initial.session, {
        Origin: origin,
        Cookie: 'new-provider-cookie',
      }),
    ),
  );
  assert.equal(
    (await i.f.call('/account', 'GET', undefined, initial.session)).status,
    401,
  );
  await json(await i.finish(await i.begin('password')), 403);
  assert.equal(
    Object.values(i.f.state().sessions).some(
      (session) => session.method === 'identity',
    ),
    false,
  );
  assert.equal(
    (
      await store.fetch(
        i.f.request(
          '/account',
          'GET',
          undefined,
          adopted.session,
          csrfHeaders(adopted, 'new-provider-cookie'),
        ),
      )
    ).status,
    200,
  );
});

async function seedLegacyOwner(f, address = 'a@example.test') {
  await f.call('/health');
  const state = f.state(),
    ownerId = crypto.randomUUID(),
    oldToken = 'synthetic-owner-' + crypto.randomUUID();
  state.profiles[ownerId] = {
    id: ownerId,
    email: address,
    name: 'Legacy fixture',
    phone: '',
    location: '',
    createdAt: Date.now() - 10000,
  };
  state.sessions[await sessionKey(oldToken)] = {
    userId: ownerId,
    method: 'identity',
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000,
  };
  state.identities[await digest('https://legacy.example|' + ownerId)] = {
    userId: ownerId,
    issuer: 'https://legacy.example',
    subject: ownerId,
    method: 'password',
  };
  return { ownerId, oldToken };
}

test('same-email identities never auto-adopt an existing account; recent owner linking preserves ID and retires legacy access', async () => {
  const f = setup(),
    { ownerId, oldToken } = await seedLegacyOwner(f);
  f.identities.set(
    'replacement',
    f.fresh('identity-replacement', 'a@example.test', 'session-replacement'),
  );
  const before = Object.keys(f.state().profiles).length;
  assert.equal((await f.bridge('replacement')).status, 409);
  assert.equal(Object.keys(f.state().profiles).length, before);
  f.env.BETTER_AUTH_LEGACY_LINK_ENABLED = 'true';
  const link = await json(
    await f.call('/auth/better-auth/link', 'POST', {}, oldToken, {
      Origin: origin,
      Cookie: 'replacement',
    }),
  );
  assert.equal(
    f.state().sessions[await sessionKey(link.session)].userId,
    ownerId,
  );
  assert.equal(
    f.state().identities[await digest('rwas-better-auth|identity-replacement')]
      .userId,
    ownerId,
  );
  assert.equal(Object.keys(f.state().profiles).length, before);
  assert.equal(f.state().sessions[await sessionKey(oldToken)], undefined);
  assert.equal(link.identityUserId, f.identities.get('replacement').subject);
  assert.equal(
    link.identitySessionId,
    f.identities.get('replacement').providerSessionId,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, oldToken)).status,
    401,
  );
});

test('link collision, stale owner and old provider login cannot connect an identity', async () => {
  const f = setup();
  f.env.BETTER_AUTH_LEGACY_LINK_ENABLED = 'true';
  const { oldToken: old } = await seedLegacyOwner(f),
    b = await f.login('b');
  assert.equal(
    (
      await f.call('/auth/better-auth/link', 'POST', {}, old, {
        Origin: origin,
        Cookie: 'b',
      })
    ).status,
    409,
  );
  f.identities.set('unlinked', {
    ...f.fresh('new', 'new@example.test', 'new-session'),
    createdAt: Date.now() - 600001,
  });
  assert.equal(
    (
      await f.call('/auth/better-auth/link', 'POST', {}, old, {
        Origin: origin,
        Cookie: 'unlinked',
      })
    ).status,
    401,
  );
  f.state().sessions[await sessionKey(old)].createdAt = Date.now() - 600001;
  assert.equal(
    (
      await f.call('/auth/better-auth/link', 'POST', {}, old, {
        Origin: origin,
        Cookie: 'a',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.call(
        '/auth/better-auth/link',
        'POST',
        {},
        b.session,
        csrfHeaders(b, 'b'),
      )
    ).status,
    403,
  );
});

test('listing ownership, private media and drafts remain isolated between two real business profiles', async () => {
  const f = setup();
  const a = await f.login('a'),
    b = await f.login('b');
  await json(await f.call('/draft', 'PUT', fields, a.session, csrfHeaders(a)));
  assert.equal(
    (
      await json(
        await f.call(
          '/draft',
          'GET',
          undefined,
          b.session,
          csrfHeaders(b, 'b'),
        ),
      )
    ).draft,
    null,
  );
  const listing = (
    await json(
      await f.call('/listings', 'POST', fields, a.session, {
        ...csrfHeaders(a),
        'Idempotency-Key': crypto.randomUUID(),
      }),
      201,
    )
  ).listing;
  assert.equal(
    (
      await f.call(
        '/listing/' + listing.id,
        'PUT',
        { price: 7 },
        b.session,
        csrfHeaders(b, 'b'),
      )
    ).status,
    404,
  );
  const upload = await json(
    await f.call(
      '/upload?listingId=' +
        listing.id +
        '&category=photos&filename=fixture.png',
      'POST',
      png,
      a.session,
      { ...csrfHeaders(a), 'Content-Type': 'image/png' },
    ),
  );
  const fileKey = upload.file?.key || upload.key;
  assert.ok(fileKey);
  assert.equal(
    (
      await f.call(
        '/files/' + fileKey,
        'GET',
        undefined,
        b.session,
        csrfHeaders(b, 'b'),
      )
    ).status,
    404,
  );
});

test('local logout and selected-session revocation prevent same-cookie opaque-session reminting', async () => {
  const f = setup();
  const login = await f.login();
  await json(
    await f.call('/logout', 'POST', {}, login.session, csrfHeaders(login)),
  );
  assert.equal((await f.bridge()).status, 401);
  f.identities.set(
    'new-session',
    f.fresh('identity-a', 'a@example.test', 'fresh-after-logout'),
  );
  const next = await f.login('new-session');
  await json(
    await f.call(
      '/account/sessions',
      'DELETE',
      { id: await sessionKey(next.session) },
      next.session,
      csrfHeaders(next, 'new-session'),
    ),
  );
  assert.equal((await f.bridge('new-session')).status, 401);
});

test('holds and session-revocation generation survive fresh opaque issuance; recent checks use provider creation', async () => {
  const f = setup();
  const login = await f.login();
  const state = f.state(),
    ownerId = state.sessions[await sessionKey(login.session)].userId;
  state.profiles[ownerId].sessionRevokedAt = Date.now();
  assert.equal((await f.bridge()).status, 401);
  f.state().profiles[ownerId].sessionRevokedAt = 0;
  f.state().profiles[ownerId].adminSuspended = true;
  assert.equal((await f.bridge()).status, 403);
  f.state().profiles[ownerId].adminSuspended = false;
  f.identities.get('a').createdAt = Date.now() - 600001;
  const old = await f.login();
  assert.equal(
    (
      await f.call(
        '/account',
        'DELETE',
        { confirm: 'a@example.test' },
        old.session,
        csrfHeaders(old),
      )
    ).status,
    401,
  );
});

test('account deletion tombstones the old identity even if its provider cookie survives; disabled backend rejects old opaque proof', async () => {
  const f = setup();
  const login = await f.login();
  await json(
    await f.call(
      '/account',
      'DELETE',
      { confirm: 'a@example.test' },
      login.session,
      csrfHeaders(login),
    ),
  );
  assert.equal(Object.keys(f.state().profiles).length, 0);
  assert.equal(
    (await json(await f.bridge(), 409)).code,
    'ACCOUNT_DELETION_PENDING',
  );
  const other = await f.login('b');
  f.env.BETTER_AUTH_ENABLED = 'false';
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        other.session,
        csrfHeaders(other, 'b'),
      )
    ).status,
    401,
  );
});

test('session directory and revoke-other operations group opaque tokens by actual provider session', async () => {
  const f = setup();
  const a1 = await f.login(),
    a2 = await f.login();
  f.identities.set(
    'remote',
    f.fresh('identity-a', 'a@example.test', 'remote-session'),
  );
  const remote = await f.login('remote');
  const account = await json(
    await f.call('/account', 'GET', undefined, a2.session, csrfHeaders(a2)),
  );
  assert.equal(account.sessions.length, 2);
  assert.equal(account.sessions.filter((session) => session.current).length, 1);
  await json(
    await f.call(
      '/account/sessions',
      'DELETE',
      { all: true },
      a2.session,
      csrfHeaders(a2),
    ),
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, a1.session, csrfHeaders(a1)))
      .status,
    200,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, a2.session, csrfHeaders(a2)))
      .status,
    200,
  );
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        remote.session,
        csrfHeaders(remote, 'remote'),
      )
    ).status,
    401,
  );
  assert.equal((await f.bridge('remote')).status, 401);
  await json(
    await f.call(
      '/account/sessions',
      'DELETE',
      { id: await sessionKey(a1.session) },
      a2.session,
      csrfHeaders(a2),
    ),
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, a2.session, csrfHeaders(a2)))
      .status,
    401,
  );
  assert.equal((await f.bridge()).status, 401);
});

test('verified contact change retains the current provider session group and revokes other devices', async () => {
  const f = setup();
  const a1 = await f.login(),
    a2 = await f.login();
  f.identities.set(
    'remote',
    f.fresh('identity-a', 'a@example.test', 'remote-session'),
  );
  const remote = await f.login('remote');
  await json(
    await f.call(
      '/account/email-code',
      'POST',
      { email: 'contact@example.test' },
      a2.session,
      csrfHeaders(a2),
    ),
  );
  await json(
    await f.call(
      '/account/email',
      'PUT',
      { email: 'contact@example.test', code: f.mail.at(-1).code },
      a2.session,
      csrfHeaders(a2),
    ),
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, a1.session, csrfHeaders(a1)))
      .status,
    200,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, a2.session, csrfHeaders(a2)))
      .status,
    200,
  );
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        remote.session,
        csrfHeaders(remote, 'remote'),
      )
    ).status,
    401,
  );
  assert.equal((await f.bridge('remote')).status, 401);
  assert.equal(
    f.identities.get('a').email,
    'a@example.test',
    'Contact changes do not alter credential identity.',
  );
});

test('protected writes require an exact Origin even with a bound cookie, CSRF and opaque token', async () => {
  const f = setup(),
    login = await f.login();
  assert.equal(
    (
      await f.call('/draft', 'PUT', fields, login.session, {
        Cookie: 'a',
        'X-RWAS-CSRF': login.csrf,
      })
    ).status,
    403,
  );
});

test('private identity-deletion check denies linked accounts, permits completed deletion, and is not public', async () => {
  const f = setup();
  const payload = { issuer: 'rwas-better-auth', subject: 'identity-a' };
  const internal = () =>
    new Request(
      'https://seller-service.internal/api/aircraft-sale/_identity-deletion-intent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async () => f.identities.get('a'),
  });
  const login = await f.login();
  assert.deepEqual(await json(await store.fetch(internal())), {
    allowed: false,
  });
  const exposed = await worker.fetch(internal(), {
    SELLER_STORE: {
      idFromName() {
        throw Error('Public route must not reach a stub.');
      },
    },
  });
  assert.equal(exposed.status, 404);
  assert.equal(
    (await f.call('/_identity-deletion-intent', 'POST', payload)).status,
    404,
  );
  await json(
    await f.call(
      '/account',
      'DELETE',
      { confirm: 'a@example.test' },
      login.session,
      csrfHeaders(login),
    ),
  );
  assert.deepEqual(await json(await store.fetch(internal())), {
    allowed: true,
  });
  const key = await digest('rwas-better-auth|identity-a');
  f.state().profiles[f.state().identitySecurity[key].deletedProfileId] = {
    id: f.state().identitySecurity[key].deletedProfileId,
  };
  assert.deepEqual(
    await json(await store.fetch(internal())),
    { allowed: false },
    'Residual profile fails closed.',
  );
});

test('identity deletion intent serializes against adoption and failed persistence never grants deletion', async () => {
  const intent = () =>
    new Request(
      'https://seller-service.internal/api/aircraft-sale/_identity-deletion-intent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuer: 'rwas-better-auth',
          subject: 'identity-a',
        }),
      },
    );
  const reserved = setup();
  const [reservation, blockedAdoption] = await Promise.all([
    reserved.store.fetch(intent()),
    reserved.bridge(),
  ]);
  assert.deepEqual(await json(reservation), { allowed: true });
  assert.equal(
    (await json(blockedAdoption, 409)).code,
    'ACCOUNT_DELETION_PENDING',
  );
  assert.equal(Object.keys(reserved.state().profiles).length, 0);
  assert.deepEqual(
    await json(await reserved.store.fetch(intent())),
    { allowed: true },
    'Retry preserves the exact prior reservation.',
  );
  const adopted = setup();
  const [adoption, blockedDeletion] = await Promise.all([
    adopted.bridge(),
    adopted.store.fetch(intent()),
  ]);
  await json(adoption);
  assert.deepEqual(await json(blockedDeletion), { allowed: false });
  assert.equal(Object.keys(adopted.state().profiles).length, 1);
  const failed = setup();
  failed.storageFailure(true);
  assert.equal((await failed.store.fetch(intent())).status, 503);
  assert.equal(failed.state(), undefined);
});

test('expected identity flow binding rejects a changed cookie before any profile or session adoption', async () => {
  const f = setup();
  const headers = { Origin: origin, Cookie: 'a' };
  for (const body of [
    { expectedUserId: 'identity-b', expectedSessionId: 'session-b' },
    { expectedUserId: 'identity-a', expectedSessionId: 'session-b' },
  ]) {
    assert.equal(
      (await f.call('/auth/better-auth', 'POST', body, undefined, headers))
        .status,
      401,
    );
    assert.equal(Object.keys(f.state().profiles).length, 0);
    assert.equal(Object.keys(f.state().sessions).length, 0);
  }
  assert.equal(
    (
      await f.call(
        '/auth/better-auth',
        'POST',
        { expectedUserId: 'identity-a' },
        undefined,
        headers,
      )
    ).status,
    400,
  );
  const login = await json(
    await f.call(
      '/auth/better-auth',
      'POST',
      { expectedUserId: 'identity-a', expectedSessionId: 'session-a' },
      undefined,
      headers,
    ),
  );
  assert.equal(login.provider, 'better-auth');
  assert.equal(login.identityUserId, 'identity-a');
  assert.equal(login.identitySessionId, 'session-a');
});

test('bridge binding IDs come from authoritative identity even when no expected IDs were supplied', async () => {
  const f = setup();
  f.identities.set(
    'a',
    f.fresh(
      'authoritative-user',
      'actual@example.test',
      'authoritative-session',
    ),
  );
  const login = await f.login('a');
  assert.equal(login.identityUserId, 'authoritative-user');
  assert.equal(login.identitySessionId, 'authoritative-session');
  const stored = f.state().sessions[await sessionKey(login.session)];
  assert.equal(login.identityUserId, stored.subject);
  assert.equal(login.identitySessionId, stored.providerSessionId);
  assert.equal(Object.hasOwn(login, 'cookie'), false);
  assert.equal(Object.hasOwn(login, 'providerToken'), false);
});
