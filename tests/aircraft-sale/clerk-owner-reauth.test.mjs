import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import { CLERK_PRODUCTION } from '../../workers/aircraft-sale/clerk-production.mjs';
import { CLERK_OWNER_METHOD } from '../../workers/aircraft-sale/clerk-owner-reauth.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { identityFixture } from './identity-fixture.mjs';
import { create } from './fixture.mjs';

globalThis.crypto ||= webcrypto;
const origin = CLERK_PRODUCTION.origin;
const proof = 'O'.repeat(43);
const linkProof = 'L'.repeat(43);
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const clerkJwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'owner-reauth-clerk',
  alg: 'RS256',
  use: 'sig',
};

function clerkProvider() {
  const session = {
    id: 'sess_OwnerReauth',
    user_id: 'user_OwnerReauth',
    status: 'active',
    created_at: Date.now() - 10000,
    expire_at: Date.now() + 3600000,
  };
  const user = {
    id: session.user_id,
    banned: false,
    locked: false,
    password_last_updated_at: 1000,
    primary_email_address_id: 'email_clerk',
    email_addresses: [
      {
        id: 'email_clerk',
        email_address: 'owner@example.test',
        verification: { status: 'verified' },
      },
    ],
  };
  const calls = [];
  const jwt = () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: clerkJwk.kid }),
    ).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({
        iss: CLERK_PRODUCTION.issuer,
        aud: CLERK_PRODUCTION.audience,
        azp: origin,
        sub: user.id,
        sid: session.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString('base64url');
    const input = header + '.' + claims;
    return (
      input +
      '.' +
      sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')
    );
  };
  const fetch = async (url, init = {}) => {
    calls.push(String(url));
    assert.equal(init.redirect, 'manual');
    if (String(url) === CLERK_PRODUCTION.issuer + '/.well-known/jwks.json')
      return Response.json({ keys: [clerkJwk] });
    assert.equal(
      init.headers.Authorization,
      'Bearer sk_live_synthetic_owner_fixture',
    );
    if (String(url).endsWith('/sessions/' + session.id))
      return Response.json(session);
    if (String(url).endsWith('/users/' + user.id)) return Response.json(user);
    throw new Error('Unexpected external fixture request.');
  };
  return { session, user, jwt, fetch, calls };
}

async function withOwner(operation) {
  const identity = await identityFixture(origin);
  const { f } = identity;
  f.env.PASSWORD_ONLY_LOGIN = 'true';
  f.env.EMAIL_CODE_LOGIN_ENABLED = 'false';
  const signedIn = await identity.finish(await identity.begin('password'), {
    sub: 'auth0|existing-owner',
    email: 'owner@example.test',
    name: 'Established Seller',
  });
  assert.equal(signedIn.status, 200);
  const legacyBearer = (await signedIn.json()).session;
  const listed = await create(f, legacyBearer);
  const seller = structuredClone(Object.values(f.state().profiles)[0]);
  const listing = structuredClone(f.state().listings[listed.id]);
  const sourceIdentityKey = await digest(
    f.env.AUTH_ISSUER + '|auth0|existing-owner',
  );
  const sourceIdentity = structuredClone(
    f.state().identities[sourceIdentityKey],
  );
  const originalAuth0 = f.env.AUTH_PROVIDER.fetch;
  f.env.AUTH_PROVIDER.fetch = async (req) => {
    if (new URL(req.url).pathname !== '/.well-known/jwks.json')
      return originalAuth0(req);
    const response = await originalAuth0(req);
    const value = await response.json();
    return Response.json({
      keys: value.keys.map((key) => ({ ...key, alg: 'RS256', use: 'sig' })),
    });
  };
  const p = clerkProvider();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = p.fetch;
  Object.assign(f.env, {
    CLERK_PRODUCTION_ENABLED: 'true',
    CLERK_PRODUCTION_SECRET_KEY: 'sk_live_synthetic_owner_fixture',
    PUBLIC_LISTINGS_ENABLED: 'false',
  });
  const headers = (csrf, override = {}) => {
    const output = {
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'X-Clerk-Session-Token': p.jwt(),
      'X-RWAS-Link-Proof': proof,
      ...(csrf ? { 'X-RWAS-CSRF': csrf } : {}),
      ...override,
    };
    for (const [key, value] of Object.entries(output))
      if (value === null) delete output[key];
    return output;
  };
  const start = (body = { proof, confirm: true }, override = {}) =>
    f.call(
      '/auth/clerk-production/owner/start',
      'POST',
      body,
      undefined,
      headers(null, override),
    );
  const begin = async () => {
    const response = await start();
    assert.equal(
      response.status,
      200,
      JSON.stringify(await response.clone().json()),
    );
    return { ...(await response.json()), proof };
  };
  const finish = async (
    tx,
    claimChanges = {},
    override = {},
    bodyChanges = {},
    options = {},
  ) => {
    const code = await identity.issueCode(
      tx,
      {
        sub: 'auth0|existing-owner',
        email: 'owner@example.test',
        auth_time: Math.floor(Date.now() / 1000),
        ...claimChanges,
      },
      options,
    );
    return f.call(
      '/auth/clerk-production/owner/finish',
      'POST',
      { state: tx.state, code, proof, confirm: true, ...bodyChanges },
      undefined,
      headers(tx.csrf, override),
    );
  };
  const issue = async () => {
    const response = await finish(await begin());
    assert.equal(
      response.status,
      200,
      JSON.stringify(await response.clone().json()),
    );
    return response.json();
  };
  const linkHeaders = (owner, csrf, override = {}) =>
    headers(csrf, {
      'X-RWAS-Link-Proof': linkProof,
      'X-RWAS-Owner-CSRF': owner.ownerCsrf,
      ...override,
    });
  const linkStart = (owner, override = {}) =>
    f.call(
      '/auth/clerk-production/link/start',
      'POST',
      { proof: linkProof, confirm: true },
      owner.ownerProof,
      linkHeaders(owner, null, override),
    );
  const linkBegin = async (owner) => {
    const response = await linkStart(owner);
    assert.equal(
      response.status,
      200,
      JSON.stringify(await response.clone().json()),
    );
    return response.json();
  };
  const linkFinish = (owner, tx, override = {}) =>
    f.call(
      '/auth/clerk-production/link/finish',
      'POST',
      { nonce: tx.nonce, proof: linkProof, confirm: true },
      owner.ownerProof,
      linkHeaders(owner, tx.csrf, override),
    );
  try {
    await operation({
      f,
      p,
      identity,
      seller,
      listing,
      legacyBearer,
      sourceIdentityKey,
      sourceIdentity,
      headers,
      start,
      begin,
      finish,
      issue,
      linkStart,
      linkBegin,
      linkFinish,
    });
  } finally {
    globalThis.fetch = oldFetch;
  }
}

test('established Auth0 mapping can prove owner and explicitly connect Clerk without ownership or profile edits', async () => {
  await withOwner(
    async ({
      f,
      p,
      seller,
      listing,
      legacyBearer,
      sourceIdentityKey,
      sourceIdentity,
      begin,
      finish,
      linkBegin,
      linkFinish,
    }) => {
      const methods = await (await f.call('/auth/methods')).json();
      assert.equal(methods.existingAccountOwnerReauth, 'auth0-password');
      assert.deepEqual(methods.methods, ['clerk-production']);
      assert.equal((await f.call('/auth/start', 'POST', {})).status, 404);
      assert.equal(
        (await f.call('/send-code', 'POST', { email: seller.email })).status,
        404,
      );
      const tx = await begin();
      const url = new URL(tx.authorizationUrl);
      assert.equal(url.origin, 'https://identity.fixture.test');
      assert.equal(url.searchParams.get('connection'), 'fixture-database');
      assert.equal(url.searchParams.get('max_age'), '0');
      assert.equal(url.searchParams.get('prompt'), 'login');
      assert.equal(
        url.searchParams.get('redirect_uri'),
        origin + '/aircraft-for-sale',
      );
      assert.equal(url.searchParams.get('state'), tx.state);
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      const response = await finish(tx, {
        email: 'different-verified@example.test',
        name: 'Different Provider Name',
      });
      assert.equal(response.status, 200);
      const owner = await response.json();
      assert.ok(owner.ownerProof && owner.ownerCsrf);
      assert.ok(owner.expiresAt <= Date.now() + 300000);
      assert.equal(owner.email, seller.email);
      assert.deepEqual(f.state().profiles[seller.id], seller);
      assert.deepEqual(f.state().identities[sourceIdentityKey], sourceIdentity);
      assert.equal(
        f.state().sessions[await digest(owner.ownerProof)].method,
        CLERK_OWNER_METHOD,
      );
      const linked = await linkFinish(owner, await linkBegin(owner));
      assert.equal(linked.status, 200);
      const result = await linked.json();
      assert.deepEqual(f.state().profiles[seller.id], seller);
      assert.deepEqual(f.state().listings[listing.id], listing);
      assert.deepEqual(f.state().identities[sourceIdentityKey], sourceIdentity);
      assert.equal(
        f.state().identities[
          await digest(CLERK_PRODUCTION.issuer + '|' + p.user.id)
        ].userId,
        seller.id,
      );
      assert.equal(Object.keys(f.state().profiles).length, 1);
      assert.equal(Object.keys(f.state().sessions).length, 1);
      assert.equal(
        (await f.call('/my-listings', 'GET', undefined, legacyBearer)).status,
        401,
      );
      assert.equal(
        (
          await f.call('/my-listings', 'GET', undefined, result.session, {
            'X-Clerk-Session-Token': p.jwt(),
            'X-RWAS-CSRF': result.csrf,
          })
        ).status,
        200,
      );
    },
  );
});

test('purpose owner bearer cannot read seller data, change profiles, listings, mail, or ordinary sessions', async () => {
  await withOwner(async ({ f, seller, listing, issue }) => {
    const owner = await issue();
    const before = structuredClone({
      profile: f.state().profiles[seller.id],
      listing: f.state().listings[listing.id],
      drafts: f.state().drafts,
      identities: f.state().identities,
    });
    for (const [path, method, body] of [
      ['/account', 'GET'],
      ['/my-listings', 'GET'],
      ['/draft', 'GET'],
      ['/draft', 'PUT', { make: 'Changed' }],
      ['/account', 'PATCH', { name: 'Changed' }],
      ['/listings', 'POST', {}],
      ['/listings/' + listing.id, 'DELETE'],
      ['/logout', 'POST', {}],
      ['/account/sessions', 'DELETE', { all: true }],
      ['/account/email-code', 'POST', { email: 'changed@example.test' }],
    ])
      assert.equal(
        (await f.call(path, method, body, owner.ownerProof, { Origin: origin }))
          .status,
        401,
        path,
      );
    assert.deepEqual(
      {
        profile: f.state().profiles[seller.id],
        listing: f.state().listings[listing.id],
        drafts: f.state().drafts,
        identities: f.state().identities,
      },
      before,
    );
  });
});

test('owner callback cannot become ordinary Auth0 login after a mode change', async () => {
  await withOwner(async ({ f, identity, begin, headers }) => {
    const tx = await begin();
    const code = await identity.issueCode(tx, {
      sub: 'auth0|existing-owner',
      auth_time: Math.floor(Date.now() / 1000),
    });
    const before = structuredClone({
      sessions: f.state().sessions,
      profiles: f.state().profiles,
      identities: f.state().identities,
      listings: f.state().listings,
    });
    f.env.CLERK_PRODUCTION_ENABLED = 'false';
    const calls = identity.calls.length;
    const response = await f.call(
      '/auth/finish',
      'POST',
      { state: tx.state, proof, code },
      undefined,
      headers(tx.csrf),
    );
    assert.equal(response.status, 400);
    assert.equal(identity.calls.length, calls);
    assert.deepEqual(f.state().authTransactions, {});
    assert.deepEqual(
      {
        sessions: f.state().sessions,
        profiles: f.state().profiles,
        identities: f.state().identities,
        listings: f.state().listings,
      },
      before,
    );
    f.env.CLERK_PRODUCTION_ENABLED = 'true';
    assert.equal(
      (
        await f.call(
          '/auth/clerk-production/owner/finish',
          'POST',
          { state: tx.state, proof, code, confirm: true },
          undefined,
          headers(tx.csrf),
        )
      ).status,
      401,
    );
    assert.equal(identity.calls.length, calls);
  });
});

test('owner endpoint availability requires Clerk mode and configured password reauthentication', async () => {
  for (const change of [
    (f) => {
      f.env.AUTH_CONNECTIONS = '{}';
    },
    (f) => {
      f.env.AUTH_EVENT_SECRET = '';
    },
    (f) => {
      f.env.AUTH_REDIRECT_URI =
        'https://different.example.test/aircraft-for-sale';
    },
  ])
    await withOwner(async ({ f, start, identity, p }) => {
      change(f);
      const calls = identity.calls.length;
      const methods = await (await f.call('/auth/methods')).json();
      assert.equal(methods.existingAccountOwnerReauth, undefined);
      assert.equal((await start()).status, 503);
      assert.equal(identity.calls.length, calls);
      assert.equal(p.calls.length, 0);
      assert.deepEqual(f.state().authTransactions, {});
      assert.equal(Object.keys(f.state().profiles).length, 1);
    });
  await withOwner(async ({ f, start, p }) => {
    f.env.CLERK_PRODUCTION_ENABLED = 'false';
    assert.equal((await start()).status, 404);
    assert.equal(p.calls.length, 0);
    assert.deepEqual(f.state().authTransactions, {});
  });
});

test('owner start requires exact Origin, explicit consent and browser-bound current Clerk proof', async () => {
  const cases = [
    [{ proof, confirm: true }, { Origin: null }],
    [{ proof, confirm: true }, { Origin: 'null' }],
    [{ proof, confirm: true }, { Origin: 'https://evil.test' }],
    [{ proof, confirm: false }, {}],
    [{ proof, confirm: true, userId: 'chosen-owner' }, {}],
    [{ proof, confirm: true }, { 'X-RWAS-Link-Proof': 'different' }],
    [{ proof, confirm: true }, { 'Sec-Fetch-Site': 'cross-site' }],
    [{ proof, confirm: true }, { 'X-Clerk-Session-Token': null }, 401],
  ];
  for (const [body, headers, status = 403] of cases)
    await withOwner(async ({ f, start, identity, p }) => {
      const calls = identity.calls.length;
      assert.equal((await start(body, headers)).status, status);
      assert.equal(identity.calls.length, calls);
      assert.equal(p.calls.length, 0);
      assert.deepEqual(f.state().authTransactions, {});
      assert.equal(Object.keys(f.state().profiles).length, 1);
      assert.equal(Object.keys(f.state().identities).length, 1);
    });
});

test('expired, cancelled and reconfigured owner callbacks are consumed without provider exchange', async () => {
  const cases = [
    {
      change: async ({ f }, tx) => {
        f.state().authTransactions[await digest(tx.state)].expiresAt =
          Date.now() - 1;
      },
      status: 401,
    },
    { body: { error: 'access_denied' }, status: 400 },
    { body: { confirm: false }, status: 403 },
    { headers: { Origin: null }, status: 403 },
    {
      change: ({ f }) => {
        f.env.AUTH_ISSUER = 'https://changed.example.test/';
      },
      status: 403,
    },
    {
      change: ({ f }) => {
        f.env.AUTH_CLIENT_ID = 'changed-client';
      },
      status: 403,
    },
    {
      change: ({ f }) => {
        f.env.AUTH_EVENT_SECRET = '';
      },
      status: 503,
    },
  ];
  for (const entry of cases)
    await withOwner(async (c) => {
      const tx = await c.begin();
      await entry.change?.(c, tx);
      const calls = c.identity.calls.length;
      const response = await c.finish(tx, {}, entry.headers, entry.body);
      assert.equal(response.status, entry.status);
      assert.equal(c.identity.calls.length, calls);
      assert.deepEqual(c.f.state().authTransactions, {});
      assert.equal(
        Object.values(c.f.state().sessions).some(
          (s) => s.method === CLERK_OWNER_METHOD,
        ),
        false,
      );
      assert.equal(
        (
          await c.f.call(
            '/auth/clerk-production/owner/finish',
            'POST',
            { state: tx.state, proof, confirm: true },
            undefined,
            c.headers(tx.csrf),
          )
        ).status,
        401,
      );
    });
});

test('owner proof issuance rejects destination collisions and latest established-owner holds', async () => {
  await withOwner(async ({ f, p, start, seller, identity }) => {
    f.state().identities[
      await digest(CLERK_PRODUCTION.issuer + '|' + p.user.id)
    ] = {
      userId: seller.id,
      issuer: CLERK_PRODUCTION.issuer,
      subject: p.user.id,
      method: 'clerk-production',
      createdAt: Date.now(),
    };
    const before = structuredClone(f.state().identities);
    const calls = identity.calls.length;
    assert.equal((await start()).status, 409);
    assert.equal(identity.calls.length, calls);
    assert.deepEqual(f.state().identities, before);
    assert.deepEqual(f.state().authTransactions, {});
  });
  for (const [change, status] of [
    [
      async ({ f, p }) => {
        f.state().identities[
          await digest(CLERK_PRODUCTION.issuer + '|' + p.user.id)
        ] = {
          userId: 'another-owner',
          issuer: CLERK_PRODUCTION.issuer,
          subject: p.user.id,
          method: 'clerk-production',
          createdAt: Date.now(),
        };
      },
      409,
    ],
    [
      async ({ f, seller }) => {
        const subject = 'user_AlreadyConnected';
        f.state().identities[
          await digest(CLERK_PRODUCTION.issuer + '|' + subject)
        ] = {
          userId: seller.id,
          issuer: CLERK_PRODUCTION.issuer,
          subject,
          method: 'clerk-production',
          createdAt: Date.now(),
        };
      },
      409,
    ],
    [
      ({ f, seller }) => {
        f.state().profiles[seller.id].adminSuspended = true;
      },
      403,
    ],
    [
      ({ f, sourceIdentityKey }) => {
        f.state().identitySecurity[sourceIdentityKey] = { blocked: true };
      },
      403,
    ],
  ])
    await withOwner(async (c) => {
      const tx = await c.begin();
      await change(c);
      const before = structuredClone({
        profiles: c.f.state().profiles,
        identities: c.f.state().identities,
      });
      assert.equal((await c.finish(tx)).status, status);
      assert.deepEqual(
        { profiles: c.f.state().profiles, identities: c.f.state().identities },
        before,
      );
      assert.deepEqual(c.f.state().authTransactions, {});
      assert.equal(
        Object.values(c.f.state().sessions).some(
          (s) => s.method === CLERK_OWNER_METHOD,
        ),
        false,
      );
    });
});

test('same email and valid unknown provider subject never create, select or transfer an owner', async () => {
  for (const mutate of [
    ({ f, sourceIdentityKey }) => {
      f.state().identities[sourceIdentityKey].issuer =
        'https://wrong.example.test/';
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identities[sourceIdentityKey].subject = 'auth0|different';
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identities[sourceIdentityKey].method = 'google';
    },
  ])
    await withOwner(async (c) => {
      const tx = await c.begin();
      mutate(c);
      const snapshot = structuredClone(c.f.state().profiles);
      const response = await c.finish(tx);
      assert.equal(response.status, 409);
      assert.deepEqual(c.f.state().profiles, snapshot);
    });
  await withOwner(async ({ f, seller, begin, finish }) => {
    const tx = await begin();
    const response = await finish(tx, {
      sub: 'auth0|unknown-subject',
      email: seller.email,
    });
    assert.equal(response.status, 409);
    assert.equal(Object.keys(f.state().profiles).length, 1);
    assert.equal(Object.keys(f.state().identities).length, 1);
    assert.deepEqual(f.state().authTransactions, {});
    assert.equal(
      Object.values(f.state().sessions).some(
        (s) => s.method === CLERK_OWNER_METHOD,
      ),
      false,
    );
  });
});

test('signed authentication freshness, nonce, issuer, audience and signature remain mandatory', async () => {
  const cases = [
    { auth_time: undefined },
    { auth_time: Math.floor(Date.now() / 1000) - 601 },
    { auth_time: Math.floor(Date.now() / 1000) + 60 },
    { auth_time: 'recent' },
    { auth_time: 1.5 },
    { nonce: 'wrong' },
    { iss: 'https://wrong.example.test/' },
    { aud: 'different-client' },
    { act: { sub: 'actor' } },
  ];
  for (const claims of cases)
    await withOwner(async ({ f, begin, finish }) => {
      const tx = await begin();
      const response = await finish(tx, claims);
      assert.ok([400, 401].includes(response.status));
      assert.deepEqual(f.state().authTransactions, {});
      assert.equal(
        Object.values(f.state().sessions).some(
          (s) => s.method === CLERK_OWNER_METHOD,
        ),
        false,
      );
    });
  await withOwner(async ({ f, begin, finish }) => {
    const tx = await begin();
    assert.equal((await finish(tx, {}, {}, {}, { tamper: true })).status, 400);
    assert.deepEqual(f.state().authTransactions, {});
  });
});

test('owner transactions reject CSRF, Origin, switched Clerk sessions and replay before Auth0 exchange', async () => {
  for (const changes of [
    { Origin: 'https://evil.test' },
    { 'X-RWAS-CSRF': 'wrong' },
    { 'X-RWAS-Link-Proof': null },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])
    await withOwner(async ({ f, identity, begin, finish }) => {
      const tx = await begin();
      const calls = identity.calls.length;
      assert.equal((await finish(tx, {}, changes)).status, 403);
      assert.equal(identity.calls.length, calls);
      assert.deepEqual(f.state().authTransactions, {});
      const replay = await f.call(
        '/auth/clerk-production/owner/finish',
        'POST',
        { state: tx.state, proof, confirm: true },
        undefined,
        { Origin: origin },
      );
      assert.equal(replay.status, 401);
    });
  for (const change of [
    (p) => {
      p.session.id = 'sess_Changed';
    },
    (p) => {
      p.user.id = p.session.user_id = 'user_Changed';
    },
    (p) => {
      p.user.password_last_updated_at = 2000;
    },
    (p) => {
      p.session.created_at -= 100;
    },
  ])
    await withOwner(async ({ f, p, identity, begin, finish }) => {
      const tx = await begin();
      change(p);
      const calls = identity.calls.length;
      assert.equal((await finish(tx)).status, 401);
      assert.equal(identity.calls.length, calls);
      assert.deepEqual(f.state().authTransactions, {});
    });
});

test('provider reset and block callbacks remain authenticated and revoke owner proof in Clerk mode', async () => {
  await withOwner(async ({ f, seller, issue, linkStart }) => {
    const owner = await issue();
    const event = {
      id: 'owner-reset-fixture',
      kind: 'password-reset',
      subject: 'auth0|existing-owner',
      issuedAt: Date.now(),
    };
    assert.equal(
      (await f.call('/auth/events', 'POST', event, 'wrong-secret')).status,
      403,
    );
    assert.equal(
      (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
        .status,
      200,
    );
    assert.equal((await linkStart(owner)).status, 401);
    assert.ok(f.state().profiles[seller.id].sessionRevokedAt);
    assert.equal(
      Object.values(f.state().identities).some(
        (i) => i.method === 'clerk-production',
      ),
      false,
    );
  });
  await withOwner(async ({ f, issue, linkBegin, linkFinish }) => {
    const owner = await issue();
    const pending = await linkBegin(owner);
    const event = {
      id: 'pending-owner-reset-fixture',
      kind: 'password-reset',
      subject: 'auth0|existing-owner',
      issuedAt: Date.now(),
    };
    assert.equal(
      (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
        .status,
      200,
    );
    assert.equal((await linkFinish(owner, pending)).status, 401);
    assert.deepEqual(f.state().authTransactions, {});
    assert.equal((await linkFinish(owner, pending)).status, 401);
  });
  await withOwner(async ({ f, seller, issue, linkStart }) => {
    const owner = await issue();
    Object.assign(f.env, {
      AUTH_STREAM_SECRET: 'distinct-synthetic-stream-proof-not-a-credential',
      AUTH_EVENT_TENANT: 'fixture-tenant',
      AUTH_EVENT_SOURCE: 'urn:auth0:fixture-tenant',
      AUTH_EVENT_STREAM_ID: 'est_SyntheticStream0001',
    });
    const event = {
      specversion: '1.0',
      type: 'user.updated',
      id: 'evt_SyntheticBlocked001',
      source: f.env.AUTH_EVENT_SOURCE,
      a0tenant: f.env.AUTH_EVENT_TENANT,
      a0stream: f.env.AUTH_EVENT_STREAM_ID,
      time: new Date().toISOString(),
      data: {
        object: {
          user_id: 'auth0|existing-owner',
          blocked: true,
          blockedPresent: true,
        },
      },
    };
    assert.equal(
      (await f.call('/auth/auth0-events', 'POST', event, 'wrong-secret'))
        .status,
      403,
    );
    assert.equal(
      (
        await f.call(
          '/auth/auth0-events',
          'POST',
          event,
          f.env.AUTH_STREAM_SECRET,
        )
      ).status,
      200,
    );
    assert.equal((await linkStart(owner)).status, 401);
    assert.equal(f.state().profiles[seller.id].identityBlocked, true);
  });
});

test('latest owner holds, mapping changes, reset fences and expiry interrupt explicit linking', async () => {
  const changes = [
    ({ f, seller }) => {
      f.state().profiles[seller.id].adminSuspended = true;
    },
    ({ f, seller }) => {
      f.state().profiles[seller.id].sessionRevokedAt = Date.now();
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identities[sourceIdentityKey].userId = 'another-owner';
    },
    ({ f, sourceIdentityKey }) => {
      delete f.state().identities[sourceIdentityKey];
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identitySecurity[sourceIdentityKey] = { blocked: true };
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identitySecurity[sourceIdentityKey] = {
        providerResetHold: true,
      };
    },
    ({ f, sourceIdentityKey }) => {
      f.state().identitySecurity[sourceIdentityKey] = {
        credentialsChangedAt: Date.now(),
      };
    },
  ];
  for (const change of changes)
    await withOwner(async (c) => {
      const owner = await c.issue();
      const tx = await c.linkBegin(owner);
      change(c);
      assert.equal((await c.linkFinish(owner, tx)).status, 403);
      assert.deepEqual(c.f.state().authTransactions, {});
      assert.equal(
        Object.values(c.f.state().identities).some(
          (i) => i.method === 'clerk-production',
        ),
        false,
      );
    });
  await withOwner(async ({ f, issue, linkStart }) => {
    const owner = await issue();
    f.state().sessions[await digest(owner.ownerProof)].expiresAt =
      Date.now() - 1;
    assert.equal((await linkStart(owner)).status, 401);
  });
  await withOwner(async ({ issue, linkStart, linkBegin, linkFinish }) => {
    const owner = await issue();
    assert.equal(
      (await linkStart(owner, { 'X-RWAS-Owner-CSRF': 'wrong' })).status,
      403,
    );
    const tx = await linkBegin(owner);
    assert.equal(
      (await linkFinish(owner, tx, { 'X-RWAS-Owner-CSRF': 'wrong' })).status,
      403,
    );
    assert.equal((await linkFinish(owner, tx)).status, 401);
  });
});

test('Clerk binding cannot change after Auth0 proof issuance and historical Auth0 sessions stay ineligible', async () => {
  await withOwner(async ({ f, p, legacyBearer, headers, issue, linkStart }) => {
    assert.equal(
      (
        await f.call(
          '/auth/clerk-production/link/start',
          'POST',
          { proof, confirm: true },
          legacyBearer,
          headers(),
        )
      ).status,
      403,
    );
    const owner = await issue();
    p.user.id = p.session.user_id = 'user_ChangedAfterProof';
    assert.equal((await linkStart(owner)).status, 401);
  });
});
