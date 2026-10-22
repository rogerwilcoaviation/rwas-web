import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { identityFixture } from './identity-fixture.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { accountHeld } from '../../workers/aircraft-sale/account-admin.mjs';
import {
  CLERK_PRODUCTION,
  CLERK_QA_COHORT,
} from '../../workers/aircraft-sale/clerk-production.mjs';

globalThis.crypto ||= webcrypto;
const A = 'jerry+rwas-seller-qa-a-20261021-r1@rwas.team';
const B = 'jerry+rwas-seller-qa-b-20261021-r1@rwas.team';
const origin = CLERK_PRODUCTION.origin;
const baselinePath = new URL(
  '../../../../seller-baseline-maintenance-20261020-ba3c9757-a655-40c7-a4f0-b3cfe3511ff0/entry.js',
  import.meta.url,
);

async function setup(run) {
  const i = await identityFixture(origin),
    f = i.f;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'qa-fixture',
    alg: 'RS256',
    use: 'sig',
  };
  const user = {
    id: 'user_QaA',
    primary_email_address_id: 'email_primary',
    banned: false,
    locked: false,
    password_last_updated_at: 1000,
    email_addresses: [
      {
        id: 'email_primary',
        email_address: A,
        verification: { status: 'verified' },
      },
    ],
  };
  const session = {
    id: 'sess_QaA',
    user_id: user.id,
    status: 'active',
    expire_at: Date.now() + 3600000,
    created_at: Date.now() - 10000,
  };
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url) === CLERK_PRODUCTION.issuer + '/.well-known/jwks.json')
      return Response.json({ keys: [jwk] });
    assert.equal(
      init.headers.Authorization,
      'Bearer sk_live_synthetic_qa_fixture',
    );
    if (String(url).endsWith('/sessions/' + session.id))
      return Response.json(session);
    if (String(url).endsWith('/users/' + user.id)) return Response.json(user);
    throw Error('Unexpected synthetic provider route');
  };
  const headers = (login) => {
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const input =
      encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' }) +
      '.' +
      encode({
        iss: CLERK_PRODUCTION.issuer,
        aud: CLERK_PRODUCTION.audience,
        azp: origin,
        sub: user.id,
        sid: session.id,
        iat: now - 1,
        exp: now + 300,
      });
    return {
      Origin: origin,
      'X-Clerk-Session-Token':
        input +
        '.' +
        sign('RSA-SHA256', Buffer.from(input), privateKey).toString(
          'base64url',
        ),
      ...(login ? { 'X-RWAS-CSRF': login.csrf } : {}),
    };
  };
  const json = async (response, status = 200) => {
    assert.equal(response.status, status, await response.clone().text());
    return response.json();
  };
  const begin = () =>
    f.call('/auth/clerk-production/start', 'POST', {}, undefined, headers());
  const finish = (nonce) =>
    f.call(
      '/auth/clerk-production/finish',
      'POST',
      { nonce },
      undefined,
      headers(),
    );
  const login = async () =>
    json(await finish((await json(await begin())).nonce));
  const enable = () =>
    Object.assign(f.env, {
      CLERK_PRODUCTION_ENABLED: 'true',
      CLERK_ACCEPTANCE_ENABLED: 'true',
      CLERK_PRODUCTION_SECRET_KEY: 'sk_live_synthetic_qa_fixture',
      PUBLIC_LISTINGS_ENABLED: 'false',
    });
  try {
    await run({
      ...i,
      beginIdentity: i.begin,
      finishIdentity: i.finish,
      user,
      session,
      calls,
      headers,
      json,
      begin,
      finish,
      login,
      enable,
    });
  } finally {
    globalThis.fetch = oldFetch;
  }
}

test('acceptance selector keeps ordinary Auth0 methods and callback/session/account behavior', async () =>
  setup(async (s) => {
    const before = await s.json(await s.f.call('/auth/methods'));
    s.enable();
    const methods = await s.json(await s.f.call('/auth/methods'));
    assert.deepEqual(methods.methods, before.methods);
    assert.equal(methods.emailCode, before.emailCode);
    assert.equal(methods.clerkQaOnly, true);
    assert.equal(methods.clerkQaEmail, undefined);
    for (const hint of [
      'customer@example.test',
      A.toUpperCase(),
      A + '.invalid',
      '',
    ]) {
      const out = await s.json(
        await s.f.call('/auth/methods', 'GET', undefined, undefined, {
          'X-RWAS-QA-Email': hint,
        }),
      );
      assert.deepEqual(out.methods, before.methods);
      assert.equal(out.clerkQaEmail, undefined);
    }
    const selected = await s.json(
      await s.f.call('/auth/methods', 'GET', undefined, undefined, {
        'X-RWAS-QA-Email': A,
      }),
    );
    assert.deepEqual(selected.methods, ['clerk-production']);
    assert.equal(selected.clerkQaEmail, A);
    assert.equal(selected.emailCode, false);
    assert.equal(selected.existingAccountLink, undefined);
    assert.equal(selected.existingAccountOwnerReauth, undefined);
    const start = await s.beginIdentity('google');
    const owner = await s.json(await s.finishIdentity(start));
    const account = await s.json(
      await s.f.call('/account', 'GET', undefined, owner.session),
    );
    assert.equal(account.profile.email, 'identity@example.test');
    await s.json(
      await s.f.call(
        '/account',
        'PATCH',
        { name: 'Ordinary owner' },
        owner.session,
      ),
    );
    assert.equal(
      (
        await s.json(
          await s.f.call('/account', 'GET', undefined, owner.session),
        )
      ).profile.name,
      'Ordinary owner',
    );
    await s.json(await s.f.call('/logout', 'POST', {}, owner.session));
    assert.equal(
      (await s.f.call('/account', 'GET', undefined, owner.session)).status,
      401,
    );
  }));

test('exact QA aliases alone can create new marked Clerk profiles, without needing the UI hint', async () =>
  setup(async (s) => {
    s.enable();
    for (const [email, suffix] of [
      [A, 'A'],
      [B, 'B'],
    ]) {
      s.user.email_addresses[0].email_address = email;
      s.user.id = 'user_Qa' + suffix;
      s.session.id = 'sess_Qa' + suffix;
      s.session.user_id = s.user.id;
      const login = await s.login();
      const account = await s.json(
        await s.f.call(
          '/account',
          'GET',
          undefined,
          login.session,
          s.headers(login),
        ),
      );
      assert.equal(account.profile.email, email);
      assert.equal(account.profile.clerkQaCohort, CLERK_QA_COHORT);
      await s.json(
        await s.f.call(
          '/account',
          'PATCH',
          { name: 'QA owner ' + suffix },
          login.session,
          s.headers(login),
        ),
      );
    }
    assert.equal(Object.keys(s.f.state().profiles).length, 2);
  }));

test('forged selector and verified non-QA provider email cannot write RWAS identity, profile, sessions or security holds', async () =>
  setup(async (s) => {
    const customer = await s.f.login('customer@example.test');
    s.enable();
    const before = structuredClone(s.f.state());
    s.user.email_addresses[0].email_address = 'customer@example.test';
    for (const banned of [false, true]) {
      s.user.banned = banned;
      const response = await s.f.call(
        '/auth/clerk-production/start',
        'POST',
        {},
        undefined,
        { ...s.headers(), 'X-RWAS-QA-Email': A },
      );
      assert.equal(response.status, 403);
      assert.equal(
        response.headers.get('X-RWAS-Clerk-Failure-Stage'),
        'qa-cohort',
      );
      assert.deepEqual(s.f.state(), before);
    }
    assert.equal(
      (await s.f.call('/account', 'GET', undefined, customer)).status,
      200,
    );
  }));

test('verified QA contact-email changes reuse the two aliases without changing Clerk identity or cleanup provenance', async () =>
  setup(async (s) => {
    s.enable();
    const login = await s.login();
    const account = async () =>
      s.json(
        await s.f.call(
          '/account',
          'GET',
          undefined,
          login.session,
          s.headers(login),
        ),
      );
    const before = await account();
    for (const target of [B, A]) {
      await s.json(
        await s.f.call(
          '/account/email-code',
          'POST',
          { email: target },
          login.session,
          s.headers(login),
        ),
      );
      await s.json(
        await s.f.call(
          '/account/email',
          'PUT',
          { email: target, code: s.f.mail.at(-1).code },
          login.session,
          s.headers(login),
        ),
      );
      const current = await account();
      assert.equal(current.profile.email, target);
      assert.equal(current.profile.id, before.profile.id);
      assert.equal(current.profile.clerkQaCohort, CLERK_QA_COHORT);
      assert.equal(s.user.email_addresses[0].email_address, A);
    }
  }));

test('provider ban still fences an adopted QA identity without revoking a protected customer', async () =>
  setup(async (s) => {
    const customer = await s.f.login('protected@example.test');
    s.enable();
    const login = await s.login();
    const profile = (
      await s.json(
        await s.f.call(
          '/account',
          'GET',
          undefined,
          login.session,
          s.headers(login),
        ),
      )
    ).profile;
    s.user.banned = true;
    assert.equal(
      (
        await s.f.call(
          '/account',
          'GET',
          undefined,
          login.session,
          s.headers(login),
        )
      ).status,
      403,
    );
    assert.equal(
      s.f.state().identitySecurity[
        await digest(CLERK_PRODUCTION.issuer + '|' + s.user.id)
      ].blocked,
      true,
    );
    assert.equal(
      Object.values(s.f.state().sessions).some(
        (record) => record.userId === profile.id,
      ),
      false,
    );
    assert.equal(
      (await s.f.call('/account', 'GET', undefined, customer)).status,
      200,
    );
  }));

test('pre-existing QA-address profile and linked identity collisions fail before starting adoption; all owner/link paths are closed', async () =>
  setup(async (s) => {
    const legacy = await s.f.login(A);
    s.enable();
    const before = structuredClone(s.f.state());
    assert.equal((await s.begin()).status, 409);
    assert.deepEqual(s.f.state(), before);
    const state = structuredClone(before),
      profile = Object.values(state.profiles)[0];
    state.identities[await digest(CLERK_PRODUCTION.issuer + '|' + s.user.id)] =
      {
        userId: profile.id,
        issuer: CLERK_PRODUCTION.issuer,
        subject: s.user.id,
        method: 'clerk-production',
      };
    s.f.durable.set('state', state);
    s.f.restart();
    assert.equal((await s.begin()).status, 403);
    assert.deepEqual(s.f.state(), state);
    for (const flag of ['banned', 'locked']) {
      s.user[flag] = true;
      assert.equal((await s.begin()).status, 403);
      assert.deepEqual(s.f.state(), state);
      s.user[flag] = false;
    }
    for (const path of [
      'link/start',
      'link/finish',
      'owner/start',
      'owner/finish',
    ]) {
      assert.equal(
        (
          await s.f.call(
            '/auth/clerk-production/' + path,
            'POST',
            { state: 'existing-transaction' },
            legacy,
            s.headers(),
          )
        ).status,
        403,
      );
      assert.deepEqual(s.f.state(), state);
    }
  }));

test('verified identity change rejects account mutations and a prestarted finish without new identity/profile/session writes', async () =>
  setup(async (s) => {
    s.enable();
    const login = await s.login(),
      start = await s.json(await s.begin());
    const before = structuredClone(s.f.state());
    s.user.email_addresses[0].email_address = 'customer@example.test';
    assert.equal(
      (
        await s.f.call(
          '/account',
          'PATCH',
          { name: 'Unauthorized' },
          login.session,
          s.headers(login),
        )
      ).status,
      403,
    );
    assert.deepEqual(s.f.state(), before);
    assert.equal((await s.finish(start.nonce)).status, 403);
    for (const bucket of [
      'profiles',
      'identities',
      'sessions',
      'identitySecurity',
    ])
      assert.deepEqual(s.f.state()[bucket], before[bucket]);
  }));

test('QA accounts cannot bypass provider checks through normal email-code or Auth0 issuance', async () =>
  setup(async (s) => {
    s.enable();
    const before = structuredClone((await s.f.call('/health'), s.f.state()));
    assert.equal(
      (await s.f.call('/send-code', 'POST', { email: A })).status,
      403,
    );
    assert.equal(
      (await s.f.call('/check-code', 'POST', { email: A, code: '123456' }))
        .status,
      403,
    );
    const start = await s.beginIdentity('password');
    assert.equal(
      (await s.finishIdentity(start, { email: A, sub: 'auth0|qa-foreign' }))
        .status,
      403,
    );
    assert.deepEqual(s.f.state().profiles, before.profiles);
    assert.deepEqual(s.f.state().identities, before.identities);
    assert.deepEqual(s.f.state().sessions, before.sessions);
    assert.equal(s.f.mail.length, 0);
  }));

test('misconfigured Clerk selected path fails closed while ordinary Auth0 remains available; full production rollout stays separate', async () =>
  setup(async (s) => {
    s.enable();
    delete s.f.env.CLERK_PRODUCTION_SECRET_KEY;
    assert.equal(
      (
        await s.f.call('/auth/methods', 'GET', undefined, undefined, {
          'X-RWAS-QA-Email': A,
        })
      ).status,
      503,
    );
    assert.equal((await s.begin()).status, 503);
    assert.equal((await s.f.call('/auth/methods')).status, 200);
    s.f.env.CLERK_PRODUCTION_SECRET_KEY = 'sk_live_synthetic_qa_fixture';
    s.f.env.CLERK_ACCEPTANCE_ENABLED = 'false';
    const methods = await s.json(await s.f.call('/auth/methods'));
    assert.deepEqual(methods.methods, ['clerk-production']);
    assert.equal(methods.clerkQaOnly, undefined);
    assert.equal((await s.f.call('/auth/start', 'POST', {})).status, 404);
  }));

test('existing administrator suspension revokes every QA opaque session, blocks racing finish, preserves customer state, and restored baseline rejects captured bearers', async () =>
  setup(async (s) => {
    const customerSession = await s.f.login('protected@example.test');
    const customerBefore = structuredClone(s.f.state());
    s.enable();
    const first = await s.login();
    const profile = (
      await s.json(
        await s.f.call(
          '/account',
          'GET',
          undefined,
          first.session,
          s.headers(first),
        ),
      )
    ).profile;
    for (const target of [B, A]) {
      await s.json(
        await s.f.call(
          '/account/email-code',
          'POST',
          { email: target },
          first.session,
          s.headers(first),
        ),
      );
      await s.json(
        await s.f.call(
          '/account/email',
          'PUT',
          { email: target, code: s.f.mail.at(-1).code },
          first.session,
          s.headers(first),
        ),
      );
      const current = (
        await s.json(
          await s.f.call(
            '/account',
            'GET',
            undefined,
            first.session,
            s.headers(first),
          ),
        )
      ).profile;
      assert.equal(current.id, profile.id);
      assert.equal(current.email, target);
      assert.equal(current.clerkQaCohort, CLERK_QA_COHORT);
      assert.equal(s.user.email_addresses[0].email_address, A);
      assert.equal(Object.keys(s.f.state().identities).length, 1);
    }
    const second = await s.login();
    const pending = await s.json(await s.begin());
    const selectB = () => {
      s.user.id = 'user_QaB';
      s.user.email_addresses[0].email_address = B;
      s.session.id = 'sess_QaB';
      s.session.user_id = s.user.id;
    };
    const selectA = () => {
      s.user.id = 'user_QaA';
      s.user.email_addresses[0].email_address = A;
      s.session.id = 'sess_QaA';
      s.session.user_id = s.user.id;
    };
    selectB();
    const firstB = await s.login(),
      secondB = await s.login();
    const profileB = (
      await s.json(
        await s.f.call(
          '/account',
          'GET',
          undefined,
          firstB.session,
          s.headers(firstB),
        ),
      )
    ).profile;
    assert.notEqual(profileB.id, profile.id);
    assert.equal(profileB.email, B);
    assert.equal(Object.keys(s.f.state().identities).length, 2);
    const pendingB = await s.json(await s.begin());
    selectA();
    const fixtureState = structuredClone(s.f.state());
    fixtureState.listings['protected-listing'] = {
      id: 'protected-listing',
      ownerId: Object.values(customerBefore.profiles)[0].id,
      status: 'draft',
      fields: { make: 'Protected' },
    };
    fixtureState.files['protected-file'] = {
      ownerId: Object.values(customerBefore.profiles)[0].id,
      listingId: 'protected-listing',
      key: 'protected-file',
    };
    s.f.durable.set('state', fixtureState);
    s.f.restart();
    s.f.env.ACCOUNT_ADMIN_SITE_ORIGIN = origin;
    s.f.env.ACCOUNT_ADMIN_AUTH = {
      fetch: async (r) =>
        r.headers.get('Authorization') === 'Bearer synthetic-account-admin'
          ? Response.json({
              actor: 'fixture-admin',
              scope: 'seller-accounts',
              authenticatedAt: Date.now(),
              expiresAt: Date.now() + 3600000,
            })
          : new Response(null, { status: 403 }),
    };
    const admin = (path, method = 'GET', body, accountId = profile.id) =>
      s.f.call(
        '/admin/accounts/' + accountId + path,
        method,
        body,
        'synthetic-account-admin',
        { Origin: origin },
      );
    const body = {
      id: crypto.randomUUID(),
      operation: 'suspend',
      reasonCode: 'maintenance',
    };
    const preview = await s.json(await admin('/preview', 'POST', body));
    assert.equal(preview.sessionsToRevoke, 2);
    const result = await s.json(
      await admin('/apply', 'POST', {
        ...body,
        confirmation: preview.confirmation,
      }),
    );
    assert.equal(result.revokedSessions, 2);
    assert.equal(result.suspended, true);
    assert.equal((await s.finish(pending.nonce)).status, 403);
    const readback = await s.json(await admin(''));
    assert.equal(readback.account.activeSessions, 0);
    assert.deepEqual(
      s.f.state().profiles[profileB.id],
      fixtureState.profiles[profileB.id],
    );
    selectB();
    assert.equal(
      (
        await s.f.call(
          '/account',
          'GET',
          undefined,
          firstB.session,
          s.headers(firstB),
        )
      ).status,
      200,
    );
    const bodyB = {
      id: crypto.randomUUID(),
      operation: 'suspend',
      reasonCode: 'maintenance',
    };
    const previewB = await s.json(
      await admin('/preview', 'POST', bodyB, profileB.id),
    );
    assert.equal(previewB.sessionsToRevoke, 2);
    const resultB = await s.json(
      await admin(
        '/apply',
        'POST',
        { ...bodyB, confirmation: previewB.confirmation },
        profileB.id,
      ),
    );
    assert.equal(resultB.revokedSessions, 2);
    assert.equal((await s.finish(pendingB.nonce)).status, 403);
    assert.equal(
      (await s.json(await admin('', 'GET', undefined, profileB.id))).account
        .activeSessions,
      0,
    );
    const after = s.f.state();
    assert.equal(
      Object.values(after.sessions).some((v) => v.userId === profile.id),
      false,
    );
    assert.equal(
      Object.values(after.sessions).some((v) => v.userId === profileB.id),
      false,
    );
    for (const [id, value] of Object.entries(customerBefore.profiles))
      assert.deepEqual(after.profiles[id], value);
    for (const [id, value] of Object.entries(customerBefore.sessions))
      assert.deepEqual(after.sessions[id], value);
    assert.deepEqual(after.listings, fixtureState.listings);
    assert.deepEqual(after.files, fixtureState.files);

    // Exercise the exact pinned deployed-baseline validator, not a rewritten
    // approximation. This local fixture is not the stricter live replay test.
    const baseline = readFileSync(baselinePath, 'utf8');
    assert.equal(
      createHash('sha256').update(baseline).digest('hex'),
      'fe256c736b9771aa41ec03d655e572e7e6bc5f3540c6113b715af9dea8e7fc3a',
    );
    const start = baseline.indexOf('  async user(req, recent = false) {');
    const end = baseline.indexOf('  async admin(req) {', start);
    assert.ok(start > 0 && end > start);
    const Baseline = new Function(
      'hash',
      'fail6',
      'accountHeld',
      'return class {' + baseline.slice(start, end) + '}',
    )(
      digest,
      (status, message) => {
        throw Object.assign(new Error(message), { status });
      },
      accountHeld,
    );
    const restored = new Baseline();
    restored.state = after;
    for (const bearer of [
      first.session,
      second.session,
      firstB.session,
      secondB.session,
    ])
      await assert.rejects(
        restored.user(
          new Request(origin, {
            headers: { Authorization: 'Bearer ' + bearer },
          }),
        ),
        { status: 401 },
      );
    assert.equal(
      (
        await restored.user(
          new Request(origin, {
            headers: { Authorization: 'Bearer ' + customerSession },
          }),
        )
      ).email,
      'protected@example.test',
    );
  }));
