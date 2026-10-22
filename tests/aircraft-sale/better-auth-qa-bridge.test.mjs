import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import { digest, randomProof } from '../../workers/aircraft-sale/identity.mjs';
import { BETTER_AUTH_QA_COHORT } from '../../workers/aircraft-sale/better-auth-qa.mjs';
import { identityFixture } from './identity-fixture.mjs';
globalThis.crypto ||= webcrypto;
const origin = 'http://localhost';
async function setup() {
  const legacy = await identityFixture();
  const { f } = legacy;
  Object.assign(f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_QA_ENABLED: 'true',
    BETTER_AUTH_QA_EMAILS:
      'qa-a@example.test,qa-b@example.test,qa-email@example.test',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: 'rwas-local-fixture-only-no-persistent-secret',
    SELLER_AUTH_DB: {
      prepare() {
        throw Error('D1 not opened in business fixture');
      },
    },
    CLERK_PRODUCTION_ENABLED: 'false',
    CLERK_ACCEPTANCE_ENABLED: 'false',
  });
  const identities = new Map();
  const fresh = (subject, email) => ({
    issuer: 'rwas-better-auth',
    subject,
    email,
    name: 'QA fixture',
    emailVerified: true,
    providerSessionId: 'provider-' + subject,
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 600000,
  });
  identities.set('qa', fresh('qa-a', 'qa-a@example.test'));
  identities.set('ordinary', fresh('ordinary', 'ordinary@example.test'));
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async (_env, req) =>
      identities.get(req.headers.get('Cookie')) ?? null,
  });
  const call = (...args) => store.fetch(f.request(...args));
  const bridge = (cookie = 'qa') =>
    call('/auth/better-auth', 'POST', {}, undefined, {
      Origin: origin,
      Cookie: cookie,
    });
  return { ...f, ...legacy, identities, fresh, store, call, bridge };
}
async function json(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
const auth = (login) => ({
  Origin: origin,
  Cookie: 'qa',
  'X-RWAS-CSRF': login.csrf,
});

test('ordinary discovery/real Auth0 new signup retain baseline; only explicit QA opt-in advertises BetterAuth', async () => {
  const f = await setup();
  const ordinary = await json(await f.call('/auth/methods'));
  assert.deepEqual(ordinary.methods, ['password', 'google', 'apple']);
  assert.equal(ordinary.betterAuth, undefined);
  const qa = await json(
    await f.call('/auth/methods', 'GET', undefined, undefined, {
      'X-RWAS-Seller-QA': 'better-auth',
    }),
  );
  assert.deepEqual(qa.methods, ['better-auth']);
  assert.deepEqual(qa.betterAuth, {
    providers: ['password'],
    legacyLink: false,
  });
  const start = await f.begin('password');
  assert.equal(start.response.status, 200);
  const login = await json(
    await f.finish(start, {
      sub: 'auth0|ordinary',
      email: 'ordinary@example.test',
    }),
  );
  const account = await json(
    await f.call('/account', 'GET', undefined, login.session),
  );
  assert.equal(account.profile.email, 'ordinary@example.test');
  assert.equal(account.profile.betterAuthQaCohort, undefined);
  assert.equal(
    f.state().sessions[await digest(login.session)].method,
    'identity',
  );
  const next = await f.begin('password');
  assert.equal(
    (
      await f.finish(next, {
        sub: 'auth0|ordinary',
        email: 'ordinary@example.test',
      })
    ).status,
    200,
  );
});

test('QA header cannot authorize a noncohort verified identity or mint any business state', async () => {
  const f = await setup();
  await f.call('/auth/methods');
  const before = Object.keys(f.state().profiles).length;
  const response = await f.call('/auth/better-auth', 'POST', {}, undefined, {
    Origin: origin,
    Cookie: 'ordinary',
    'X-RWAS-Seller-QA': 'better-auth',
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'QA_ACCOUNT_REQUIRED');
  assert.equal(Object.keys(f.state().profiles).length, before);
  assert.equal(Object.keys(f.state().sessions).length, 0);
  const login = await json(await f.bridge());
  const account = await json(
    await f.call('/account', 'GET', undefined, login.session, auth(login)),
  );
  assert.equal(account.profile.betterAuthQaCohort, BETTER_AUTH_QA_COHORT);
  assert.equal(
    (
      await f.call(
        '/auth/start',
        'POST',
        { method: 'google', proof: randomProof(), link: true },
        login.session,
        auth(login),
      )
    ).status,
    403,
    'QA account cannot acquire a legacy identity through the older linking flow',
  );
});

test('QA never adopts existing same-email owner, never links, and cannot reuse an unmarked BetterAuth profile', async () => {
  const f = await setup();
  const start = await f.begin('password');
  const owner = await json(
    await f.finish(start, {
      sub: 'auth0|existing',
      email: 'qa-a@example.test',
    }),
  );
  const ownerId = (
    await json(await f.call('/account', 'GET', undefined, owner.session))
  ).profile.id;
  assert.equal((await f.bridge()).status, 409);
  f.env.BETTER_AUTH_LEGACY_LINK_ENABLED = 'true';
  assert.equal(
    (
      await f.call('/auth/better-auth/link', 'POST', {}, owner.session, {
        Origin: origin,
        Cookie: 'qa',
      })
    ).status,
    403,
  );
  const key = await digest('rwas-better-auth|qa-a');
  f.state().identities[key] = {
    issuer: 'rwas-better-auth',
    subject: 'qa-a',
    userId: ownerId,
    method: 'better-auth',
  };
  assert.equal((await f.bridge()).status, 403);
  assert.equal(f.state().profiles[ownerId].betterAuthQaCohort, undefined);
  assert.equal(
    (await f.call('/account', 'GET', undefined, owner.session)).status,
    401,
    'legacy cannot bypass linked identity MFA/revocation',
  );
  const newLegacy = await f.begin('password');
  assert.equal(
    (
      await f.finish(newLegacy, {
        sub: 'auth0|existing',
        email: 'qa-a@example.test',
      })
    ).status,
    403,
  );
});

test('existing BetterAuth sessions become fenced when QA is enabled or a cohort email is removed', async () => {
  const f = await setup();
  f.env.BETTER_AUTH_QA_ENABLED = 'false';
  const outside = await json(await f.bridge('ordinary'));
  f.env.BETTER_AUTH_QA_ENABLED = 'true';
  assert.equal(
    (
      await f.call('/account', 'GET', undefined, outside.session, {
        Origin: origin,
        Cookie: 'ordinary',
        'X-RWAS-CSRF': outside.csrf,
      })
    ).status,
    403,
  );
  const qa = await json(await f.bridge());
  f.env.BETTER_AUTH_QA_EMAILS = 'qa-b@example.test';
  assert.equal(
    (await f.call('/account', 'GET', undefined, qa.session, auth(qa))).status,
    403,
  );
});

test('ordinary legacy/email-code business login survives QA; QA contact email stays inside exact aliases', async () => {
  const f = await setup();
  const legacySession = await f.f.login('email-code@example.test');
  assert.equal(
    (await f.call('/account', 'GET', undefined, legacySession)).status,
    200,
  );
  const qa = await json(await f.bridge());
  const before = f.mail.length;
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'outside@example.test' },
        qa.session,
        auth(qa),
      )
    ).status,
    403,
  );
  assert.equal(f.mail.length, before);
  assert.equal(
    (
      await f.call(
        '/account/email',
        'PUT',
        { email: 'outside@example.test', code: 'synthetic' },
        qa.session,
        auth(qa),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'qa-email@example.test' },
        qa.session,
        auth(qa),
      )
    ).status,
    200,
  );
});
