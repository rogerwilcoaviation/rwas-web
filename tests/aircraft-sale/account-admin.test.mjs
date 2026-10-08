import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, fields, png } from './fixture.mjs';
import { identityFixture } from './identity-fixture.mjs';
import { authorizeAccountAdministrator } from '../../workers/aircraft-sale/adapters.mjs';

function administrator(f, origin = 'http://localhost') {
  let authenticatedAt = Date.now(),
    actor = 'account-admin@example.test',
    scope = 'seller-accounts';
  f.env.ACCOUNT_ADMIN_SITE_ORIGIN = origin;
  f.env.ACCOUNT_ADMIN_AUTH = {
    fetch: async (r) =>
      r.headers.get('Authorization') === 'Bearer fixture-account-admin'
        ? Response.json({
            actor,
            scope,
            authenticatedAt,
            expiresAt: Date.now() + 3600000,
          })
        : new Response(null, { status: 403 }),
  };
  return {
    freshness: (v) => (authenticatedAt = v),
    actor: (v) => (actor = v),
    scope: (v) => (scope = v),
    call: (
      path = '',
      method = 'GET',
      body,
      token = 'fixture-account-admin',
      headers = {},
    ) =>
      f.call('/admin/accounts' + path, method, body, token, {
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...headers,
      }),
  };
}
async function setup() {
  const f = fixture(),
    admin = administrator(f),
    owner = await f.login(),
    other = await f.login('other@example.test');
  const profile = (
    await (await f.call('/account', 'GET', undefined, owner)).json()
  ).profile;
  const op = (operation, changes) => ({
    id: crypto.randomUUID(),
    operation,
    reasonCode: 'support-request',
    ...(changes ? { changes } : {}),
  });
  const preview = async (body) =>
    (await admin.call('/' + profile.id + '/preview', 'POST', body)).json();
  const apply = async (body) =>
    admin.call('/' + profile.id + '/apply', 'POST', {
      ...body,
      confirmation: (await preview(body)).confirmation,
    });
  return { f, admin, owner, other, profile, op, preview, apply };
}
test('account administrator authorization fails closed and is independent of seller, reviewer and security operator', async () => {
  const s = await setup();
  for (const token of [
    'anonymous',
    s.owner,
    'fixture-reviewer',
    'fixture-security-operator',
  ]) {
    assert.equal((await s.admin.call('', 'GET', undefined, token)).status, 403);
    assert.equal(
      (await s.admin.call('/' + s.profile.id, 'GET', undefined, token)).status,
      403,
    );
    assert.equal(
      (
        await s.admin.call(
          '/' + s.profile.id + '/apply',
          'POST',
          s.op('suspend'),
          token,
        )
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await s.f.call(
        '/admin/listings',
        'GET',
        undefined,
        'fixture-account-admin',
      )
    ).status,
    403,
  );
  s.admin.scope('listing-review');
  assert.equal((await s.admin.call()).status, 403);
  delete s.f.env.ACCOUNT_ADMIN_AUTH;
  assert.equal((await s.admin.call()).status, 503);
  assert.equal(
    s.f.state().audit.filter((a) => a.action === 'account-admin-operation')
      .length,
    0,
  );
});
test('directory paginates and searches only bounded profile fields; detail never returns credentials, subjects or arbitrary state', async () => {
  const s = await setup(),
    l = await create(s.f, s.owner);
  const state = s.f.state();
  state.identities.secret = {
    userId: s.profile.id,
    method: 'password',
    subject: 'auth0|PRIVATE-SUBJECT',
    issuer: 'https://private-issuer.test',
  };
  state.profiles[s.profile.id].privateCredential = 'PRIVATE-CREDENTIAL';
  state.audit.push({
    action: 'account-admin-operation',
    accountId: s.profile.id,
    operationId: 'old-receipt',
    actor: 'admin@example.test',
    operation: 'update-profile',
    reasonCode: 'maintenance',
    changedFields: ['name'],
    revokedSessions: 0,
    at: Date.now(),
    privateRawPayload: 'PRIVATE-AUDIT-PAYLOAD',
  });
  state.codes['login:' + s.profile.email] = {
    digest: 'PRIVATE-CODE-DIGEST',
    salt: 'PRIVATE-CODE-SALT',
  };
  s.f.durable.set('state', state);
  const first = await (await s.admin.call('?limit=1')).json();
  assert.equal(first.accounts.length, 1);
  assert.equal(first.total, 2);
  assert.ok(first.nextCursor);
  const next = await (
    await s.admin.call('?limit=1&cursor=' + first.nextCursor)
  ).json();
  assert.notEqual(next.accounts[0].id, first.accounts[0].id);
  assert.equal(next.nextCursor, null);
  const search = await (await s.admin.call('?q=OWNER%40EXAMPLE.TEST')).json();
  assert.equal(search.total, 1);
  assert.equal(search.accounts[0].id, s.profile.id);
  for (const query of [
    '?limit=51',
    '?limit=-1',
    '?status=secret',
    '?q=' + 'x'.repeat(101),
    '?cursor=__proto__',
    '?password=secret',
  ])
    assert.equal((await s.admin.call(query)).status, 400);
  assert.equal((await s.admin.call('/__proto__')).status, 404);
  const detail = await s.admin.call('/' + s.profile.id),
    text = await detail.text();
  assert.equal(detail.status, 200);
  for (const secret of [
    'PRIVATE-AUDIT-PAYLOAD',
    'PRIVATE-SUBJECT',
    'private-issuer',
    'PRIVATE-CREDENTIAL',
    'PRIVATE-CODE',
    s.owner,
  ])
    assert.ok(!text.includes(secret));
  const parsed = JSON.parse(text);
  assert.equal(parsed.account.listings[0].id, l.id);
  assert.deepEqual(parsed.account.loginMethods, ['email-code', 'password']);
  assert.deepEqual(Object.keys(parsed.account.sessions[0]).sort(), [
    'createdAt',
    'expiresAt',
    'method',
  ]);
  assert.equal(detail.headers.get('Cache-Control'), 'no-store');
});
test('writes require fresh explicit authentication and exact site Origin; readonly access cannot mutate', async () => {
  const s = await setup(),
    body = s.op('suspend');
  for (const age of [Date.now() - 600001, Date.now() + 60000, null]) {
    s.admin.freshness(age);
    assert.equal((await s.admin.call()).status, 200);
    assert.equal((await (await s.admin.call()).json()).canManage, false);
    assert.equal(
      (await s.admin.call('/' + s.profile.id + '/preview', 'POST', body))
        .status,
      403,
    );
  }
  s.admin.freshness(Date.now());
  for (const origin of ['', 'https://evil.test'])
    assert.equal(
      (
        await s.admin.call(
          '/' + s.profile.id + '/preview',
          'POST',
          body,
          undefined,
          { Origin: origin },
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await s.admin.call('', 'GET', undefined, undefined, {
        'Sec-Fetch-Site': 'cross-site',
      })
    ).status,
    403,
  );
  s.f.env.ACCOUNT_ADMIN_SITE_ORIGIN = 'https://other.test';
  assert.equal((await s.admin.call()).status, 403);
  delete s.f.env.ACCOUNT_ADMIN_SITE_ORIGIN;
  assert.equal((await s.admin.call()).status, 503);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.owner)).status,
    200,
  );
});
test('profile editing rejects ownership, identity, email, privilege and destructive changes; audit contains field names, not contact values', async () => {
  const s = await setup();
  for (const changes of [
    { email: 'stolen@example.test' },
    { disabled: false },
    { adminSuspended: false },
    { roles: ['owner'] },
    { userId: 'other' },
    { password: 'secret' },
    { name: 'x'.repeat(201) },
    { location: 'x\nsecret' },
  ])
    assert.equal(
      (
        await s.admin.call(
          '/' + s.profile.id + '/preview',
          'POST',
          s.op('update-profile', changes),
        )
      ).status,
      400,
    );
  for (const operation of ['delete', 'grant-admin', 'reset-password'])
    assert.equal(
      (
        await s.admin.call(
          '/' + s.profile.id + '/preview',
          'POST',
          s.op(operation),
        )
      ).status,
      400,
    );
  assert.equal((await s.admin.call('/' + s.profile.id, 'DELETE')).status, 405);
  const body = s.op('update-profile', {
    name: 'Private corrected contact',
    phone: '555-private',
    location: 'Private Hangar',
  });
  const response = await s.apply(body);
  assert.equal(response.status, 200);
  const account = (
    await (await s.f.call('/account', 'GET', undefined, s.owner)).json()
  ).profile;
  assert.equal(account.id, s.profile.id);
  assert.equal(account.email, s.profile.email);
  assert.equal(account.name, body.changes.name);
  const audit = s.f
    .state()
    .audit.filter((a) => a.action === 'account-admin-operation');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, 'account-admin@example.test');
  assert.deepEqual(audit[0].changedFields, ['name', 'phone', 'location']);
  const evidence = JSON.stringify({
    audit,
    receipt: s.f.state().accountAdminOperations[body.id],
  });
  for (const value of Object.values(body.changes))
    assert.ok(!evidence.includes(value));
  assert.ok(!evidence.includes(s.profile.email));
});
test('stale confirmations cannot overwrite seller edits, new sessions or security holds', async () => {
  const s = await setup(),
    body = s.op('update-profile', { name: 'Admin edit' }),
    p = await s.preview(body);
  await s.f.call('/account', 'PATCH', { name: 'Seller newer edit' }, s.owner);
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        confirmation: p.confirmation,
      })
    ).status,
    409,
  );
  assert.equal(s.f.state().profiles[s.profile.id].name, 'Seller newer edit');
  const revoke = s.op('revoke-sessions'),
    before = await s.preview(revoke);
  await s.f.login();
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...revoke,
        confirmation: before.confirmation,
      })
    ).status,
    409,
  );
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.owner)).status,
    200,
  );
  const suspension = s.op('suspend'),
    old = await s.preview(suspension),
    state = s.f.state();
  state.profiles[s.profile.id].identityBlocked = true;
  s.f.durable.set('state', state);
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...suspension,
        confirmation: old.confirmation,
      })
    ).status,
    409,
  );
});
test('suspension and reinstatement preserve listings/media/drafts, revoke only target sessions, and do not clear independent holds', async () => {
  const s = await setup(),
    l = await create(s.f, s.owner);
  await s.f.call('/draft', 'PUT', fields, s.owner);
  assert.equal(
    (
      await s.f.call(
        '/upload?listingId=' + l.id + '&category=photos&filename=fixture.png',
        'POST',
        png,
        s.owner,
      )
    ).status,
    200,
  );
  const listing = structuredClone(s.f.state().listings[l.id]),
    saved = structuredClone(s.f.state().drafts[s.profile.id]),
    objectKeys = [...s.f.objects.keys()];
  assert.equal((await s.apply(s.op('suspend'))).status, 200);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.owner)).status,
    401,
  );
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.other)).status,
    200,
  );
  const mailCount = s.f.mail.length;
  assert.equal(
    (await s.f.call('/send-code', 'POST', { email: s.profile.email })).status,
    403,
  );
  assert.equal(s.f.mail.length, mailCount);
  assert.equal(
    (
      await s.f.call('/check-code', 'POST', {
        email: s.profile.email,
        code: s.f.mail.at(-1).code,
      })
    ).status,
    400,
  );
  const state = s.f.state();
  state.profiles[s.profile.id].identityBlocked = true;
  s.f.durable.set('state', state);
  const result = await (await s.apply(s.op('reinstate'))).json();
  assert.equal(result.securityHoldRemains, true);
  assert.equal(s.f.state().profiles[s.profile.id].adminSuspended, false);
  assert.equal(s.f.state().profiles[s.profile.id].identityBlocked, true);
  assert.deepEqual(s.f.state().listings[l.id], listing);
  assert.deepEqual(s.f.state().drafts[s.profile.id], saved);
  assert.deepEqual([...s.f.objects.keys()], objectKeys);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.owner)).status,
    401,
  );
});
test('revoke-sessions fences pending identity login and invalidates pending codes across suspend/reinstate', async () => {
  const id = await identityFixture(),
    f = id.f,
    admin = administrator(f);
  const owner = await (
    await id.finish(await id.begin('password'), { sub: 'auth0|owner' })
  ).json();
  const profile = (
    await (await f.call('/account', 'GET', undefined, owner.session)).json()
  ).profile;
  const pending = await id.begin('password');
  await f.call('/send-code', 'POST', { email: profile.email });
  const oldCode = f.mail.at(-1).code;
  const body = {
    id: 'fence',
    operation: 'revoke-sessions',
    reasonCode: 'account-recovery',
  };
  const preview = await (
    await admin.call('/' + profile.id + '/preview', 'POST', body)
  ).json();
  assert.equal(
    (
      await admin.call('/' + profile.id + '/apply', 'POST', {
        ...body,
        confirmation: preview.confirmation,
      })
    ).status,
    200,
  );
  assert.equal((await id.finish(pending, { sub: 'auth0|owner' })).status, 401);
  assert.equal(
    (
      await f.call('/check-code', 'POST', {
        email: profile.email,
        code: oldCode,
      })
    ).status,
    400,
  );
});
test('account operations are atomic on persistence failure and replay safely across restart without revoking later sessions', async () => {
  const s = await setup(),
    body = s.op('revoke-sessions'),
    proposal = await s.preview(body);
  s.f.storageFailure(true);
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        confirmation: proposal.confirmation,
      })
    ).status,
    503,
  );
  s.f.storageFailure(false);
  s.f.restart();
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, s.owner)).status,
    200,
  );
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        confirmation: proposal.confirmation,
      })
    ).status,
    200,
  );
  const fresh = await s.f.login();
  s.f.restart();
  const retry = await (
    await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
      ...body,
      confirmation: proposal.confirmation,
    })
  ).json();
  assert.equal(retry.replayed, true);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, fresh)).status,
    200,
  );
  assert.equal(
    s.f.state().audit.filter((a) => a.action === 'account-admin-operation')
      .length,
    1,
  );
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        reasonCode: 'maintenance',
        confirmation: proposal.confirmation,
      })
    ).status,
    409,
  );
  s.admin.actor('other-admin@example.test');
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        confirmation: proposal.confirmation,
      })
    ).status,
    409,
  );
});
test('signed account-administrator JWT verifies distinct authority; fresh management uses bound Cloudflare login metadata rather than JWT issuance', async (t) => {
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
  jwk.kid = 'ephemeral-admin';
  const original = globalThis.fetch;
  let loginIdentity = {
    email: 'admin@example.test',
    user_uuid: 'fixture-user',
    service_token_status: false,
    iat: null,
  };
  let identityStatus = 200,
    identityLookups = 0;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://accounts.cloudflareaccess.com/cdn-cgi/access/certs')
      return Response.json({ keys: [jwk] });
    assert.equal(
      url,
      'https://accounts.cloudflareaccess.com/cdn-cgi/access/get-identity',
    );
    assert.ok(options.headers.Cookie.startsWith('CF_Authorization='));
    assert.equal(options.redirect, 'manual');
    identityLookups++;
    return Response.json(loginIdentity, { status: identityStatus });
  };
  const env = {
    ACCOUNT_ADMIN_ACCESS_TEAM_DOMAIN: 'accounts.cloudflareaccess.com',
    ACCOUNT_ADMIN_ACCESS_AUD: 'accounts-audience',
    ACCOUNT_ADMIN_EMAILS: 'admin@example.test',
    ACCESS_AUD: 'review-audience',
    OPERATOR_ACCESS_AUD: 'operator-audience',
  };
  const claims = {
    iss: 'https://accounts.cloudflareaccess.com',
    aud: ['accounts-audience'],
    email: 'admin@example.test',
    sub: 'fixture-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    auth_time: Math.floor(Date.now() / 1000),
  };
  const make = async (change = {}, tamper = false) => {
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const input =
      encode({ alg: 'RS256', kid: jwk.kid }) +
      '.' +
      encode({ ...claims, ...change });
    let signature = Buffer.from(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(input),
      ),
    ).toString('base64url');
    if (tamper)
      signature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    return new Request('https://internal.invalid', {
      headers: { 'Cf-Access-Jwt-Assertion': input + '.' + signature },
    });
  };
  try {
    const response = await authorizeAccountAdministrator(await make(), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).scope, 'seller-accounts');
    assert.equal(identityLookups, 1);
    for (const change of [
      { aud: ['review-audience'] },
      { aud: ['operator-audience'] },
      { email: 'seller@example.test' },
      { iss: 'https://evil.test' },
      { exp: 1 },
    ])
      assert.equal(
        (await authorizeAccountAdministrator(await make(change), env)).status,
        403,
      );
    assert.equal(
      (await authorizeAccountAdministrator(await make({}, true), env)).status,
      403,
    );
    const extra = await make();
    extra.headers.set(
      'Cf-Access-Jwt-Assertion',
      extra.headers.get('Cf-Access-Jwt-Assertion') + '.extra',
    );
    assert.equal((await authorizeAccountAdministrator(extra, env)).status, 403);
    assert.equal(
      (
        await authorizeAccountAdministrator(await make(), {
          ...env,
          ACCOUNT_ADMIN_ACCESS_AUD: 'review-audience',
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await authorizeAccountAdministrator(await make(), {
          ...env,
          ACCOUNT_ADMIN_ACCESS_AUD: 'operator-audience',
        })
      ).status,
      503,
    );
    const absent = await (
      await authorizeAccountAdministrator(await make({ auth_time: null }), env)
    ).json();
    assert.equal(absent.authenticatedAt, null);
    const fixtureStore = fixture();
    Object.assign(fixtureStore.env, env, {
      ACCOUNT_ADMIN_SITE_ORIGIN: 'http://localhost',
    });
    const session = await fixtureStore.login();
    const profile = (
      await (
        await fixtureStore.call('/account', 'GET', undefined, session)
      ).json()
    ).profile;
    const jwt = (await make({ auth_time: null })).headers.get(
      'Cf-Access-Jwt-Assertion',
    );
    const headers = {
      'Cf-Access-Jwt-Assertion': jwt,
      Origin: 'http://localhost',
    };
    const body = {
      id: 'native-metadata',
      operation: 'revoke-sessions',
      reasonCode: 'maintenance',
    };
    const preview = () =>
      fixtureStore.call(
        '/admin/accounts/' + profile.id + '/preview',
        'POST',
        body,
        undefined,
        headers,
      );
    const now = Math.floor(Date.now() / 1000);
    // Fresh application token, old actual login: no management authority.
    loginIdentity = { ...loginIdentity, iat: now - 700 };
    const old = await (
      await fixtureStore.call(
        '/admin/accounts',
        'GET',
        undefined,
        undefined,
        headers,
      )
    ).json();
    assert.equal(old.canManage, false);
    assert.equal((await preview()).status, 403);
    loginIdentity = { ...loginIdentity, iat: now };
    assert.equal((await preview()).status, 200);
    const bound = await (
      await authorizeAccountAdministrator(await make({ auth_time: null }), env)
    ).json();
    assert.equal(bound.authenticatedAt, now * 1000);
    await t.test(
      'observed normal-user identity with omitted service-token fields permits fresh management',
      async () => {
        const previous = loginIdentity;
        loginIdentity = {
          email: claims.email,
          user_uuid: claims.sub,
          iat: now,
          idp: { id: 'fixture-otp-provider' },
          amr: ['otp'],
          common_name: '',
          version: 1,
        };
        const identity = await (
          await authorizeAccountAdministrator(
            await make({ auth_time: null }),
            env,
          )
        ).json();
        assert.equal(identity.authenticatedAt, now * 1000);
        const directory = await (
          await fixtureStore.call(
            '/admin/accounts',
            'GET',
            undefined,
            undefined,
            headers,
          )
        ).json();
        assert.equal(directory.canManage, true);
        assert.equal(directory.manageUntil, now * 1000 + 600000);
        assert.equal((await preview()).status, 200);
        loginIdentity = previous;
      },
    );
    await t.test(
      'optional normal-user fields do not admit explicit or malformed service-token indicators',
      async () => {
        const previous = loginIdentity;
        const normal = { email: claims.email, user_uuid: claims.sub, iat: now };
        for (const changes of [
          { service_token_status: true },
          { service_token_status: null },
          { service_token_status: 'false' },
          { service_token_status: 0 },
          { service_token_status: {} },
          { service_token_id: 'fixture-service-token' },
          { service_token_id: false },
          { service_token_id: {} },
        ]) {
          loginIdentity = { ...normal, ...changes };
          const identity = await (
            await authorizeAccountAdministrator(await make(), env)
          ).json();
          assert.equal(identity.authenticatedAt, null, JSON.stringify(changes));
          assert.equal((await preview()).status, 403);
        }
        loginIdentity = {
          ...normal,
          service_token_status: false,
          service_token_id: null,
        };
        assert.equal((await preview()).status, 200);
        for (const changes of [
          { sub: '' },
          { sub: null },
          { sub: 'different-user' },
          { email: [claims.email] },
          { common_name: 'fixture-service-token.access' },
        ]) {
          const identity = await (
            await authorizeAccountAdministrator(await make(changes), env)
          ).json();
          assert.equal(identity.authenticatedAt, null, JSON.stringify(changes));
        }
        loginIdentity = previous;
      },
    );
    await t.test(
      'reissued tokens and fresh JWT auth_time do not refresh a stale or missing actual login',
      async () => {
        const previous = loginIdentity;
        const normal = { email: claims.email, user_uuid: claims.sub };
        for (const loginTime of [
          now - 700,
          undefined,
          null,
          String(now),
          now + 60,
        ]) {
          loginIdentity = {
            ...normal,
            ...(loginTime === undefined ? {} : { iat: loginTime }),
          };
          const reissued = await make({
            iat: now,
            auth_time: now,
            exp: now + 120,
          });
          const reissuedHeaders = {
            ...headers,
            'Cf-Access-Jwt-Assertion': reissued.headers.get(
              'Cf-Access-Jwt-Assertion',
            ),
          };
          const directory = await (
            await fixtureStore.call(
              '/admin/accounts',
              'GET',
              undefined,
              undefined,
              reissuedHeaders,
            )
          ).json();
          assert.equal(directory.canManage, false);
          assert.equal(directory.manageUntil, null);
          assert.equal(
            (
              await fixtureStore.call(
                '/admin/accounts/' + profile.id + '/preview',
                'POST',
                body,
                undefined,
                reissuedHeaders,
              )
            ).status,
            403,
          );
          const identity = await (
            await authorizeAccountAdministrator(reissued, env)
          ).json();
          assert.equal(
            identity.authenticatedAt,
            loginTime === now - 700 ? loginTime * 1000 : null,
          );
        }
        loginIdentity = previous;
      },
    );
    for (const changes of [
      { user_uuid: 'wrong-user' },
      { email: 'other@example.test' },
      { service_token_status: true },
      { iat: null },
      { iat: String(now) },
      { iat: now + 60 },
    ]) {
      const valid = loginIdentity;
      loginIdentity = { ...valid, ...changes };
      const unsafe = await (
        await authorizeAccountAdministrator(await make(), env)
      ).json();
      assert.equal(unsafe.authenticatedAt, null);
      assert.equal((await preview()).status, 403);
      loginIdentity = valid;
    }
    identityStatus = 503;
    const outage = await (
      await authorizeAccountAdministrator(await make(), env)
    ).json();
    assert.equal(outage.authenticatedAt, null);
    assert.equal((await preview()).status, 403);
    assert.equal(
      (await fixtureStore.call('/account', 'GET', undefined, session)).status,
      200,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('session revocation cancels in-flight mail tickets so a late broker acknowledgement cannot resurrect login', async () => {
  const s = await setup();
  s.f.env.MAIL_VIA_PAGES = 'true';
  const broker = (action, body, token) =>
    s.f.callRaw(
      new Request(
        'https://seller-service.internal/api/aircraft-sale/_mail/' + action,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(body),
        },
      ),
    );
  const login = await (
    await broker('start', { email: s.profile.email, purpose: 'login' })
  ).json();
  const emailChange = await (
    await broker(
      'start',
      { email: 'new@example.test', purpose: 'email-change' },
      s.owner,
    )
  ).json();
  const body = s.op('revoke-sessions'),
    old = await s.preview(body);
  const newer = await (
    await broker('start', { email: s.profile.email, purpose: 'login' })
  ).json();
  assert.equal(
    (
      await s.admin.call('/' + s.profile.id + '/apply', 'POST', {
        ...body,
        confirmation: old.confirmation,
      })
    ).status,
    409,
  );
  assert.equal((await s.apply(body)).status, 200);
  for (const ticket of [login.ticket, emailChange.ticket, newer.ticket]) {
    assert.equal(s.f.state().mailRequests[ticket].status, 'cancelled');
    assert.equal(s.f.state().mailRequests[ticket].pendingCode, undefined);
    assert.equal((await broker('confirm', { ticket }, s.owner)).status, 409);
  }
  assert.equal(
    (
      await s.f.call('/check-code', 'POST', {
        email: s.profile.email,
        code: newer.code,
      })
    ).status,
    400,
  );
});
