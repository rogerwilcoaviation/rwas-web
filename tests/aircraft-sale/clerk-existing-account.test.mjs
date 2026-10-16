import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import { CLERK_PRODUCTION } from '../../workers/aircraft-sale/clerk-production.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { fixture, create } from './fixture.mjs';

globalThis.crypto ||= webcrypto;

const origin = CLERK_PRODUCTION.origin;
const proof = 'P'.repeat(43);
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'existing-account-fixture',
  alg: 'RS256',
  use: 'sig',
};

function provider() {
  const session = {
    id: 'sess_ExistingAccount',
    user_id: 'user_ExistingAccount',
    status: 'active',
    expire_at: Date.now() + 3600000,
    created_at: Date.now() - 10000,
  };
  const user = {
    id: session.user_id,
    banned: false,
    locked: false,
    password_last_updated_at: 1000,
    primary_email_address_id: 'email_primary',
    email_addresses: [
      {
        id: 'email_primary',
        email_address: 'owner@example.test',
        verification: { status: 'verified' },
      },
    ],
    first_name: 'New Clerk',
    last_name: 'Name',
  };
  const calls = [];
  const jwt = () => {
    const h = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: jwk.kid }),
    ).toString('base64url');
    const p = Buffer.from(
      JSON.stringify({
        iss: CLERK_PRODUCTION.issuer,
        aud: CLERK_PRODUCTION.audience,
        azp: origin,
        sub: user.id,
        sid: session.id,
        iat: Math.floor(Date.now() / 1000) - 1,
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString('base64url');
    const input = h + '.' + p;
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
      return Response.json({ keys: [jwk] });
    assert.equal(
      init.headers.Authorization,
      'Bearer sk_live_synthetic_link_fixture',
    );
    if (String(url).endsWith('/sessions/' + session.id))
      return Response.json(session);
    if (String(url).endsWith('/users/' + user.id)) return Response.json(user);
    throw new Error('Unexpected fixture request.');
  };
  return { session, user, calls, jwt, fetch };
}

async function withFixture(operation, address = 'owner@example.test') {
  const f = fixture();
  const ownerToken = await f.login(address);
  const created = await create(f, ownerToken);
  const listing = structuredClone(f.state().listings[created.id]);
  const ownerProfile = structuredClone(Object.values(f.state().profiles)[0]);
  const ownerSessionKey = await digest(ownerToken);
  const p = provider();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = p.fetch;
  Object.assign(f.env, {
    CLERK_PRODUCTION_ENABLED: 'true',
    CLERK_PRODUCTION_SECRET_KEY: 'sk_live_synthetic_link_fixture',
    PUBLIC_LISTINGS_ENABLED: 'false',
    AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
  });
  const headers = (csrf, changes = {}) => {
    const value = {
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'X-Clerk-Session-Token': p.jwt(),
      'X-RWAS-Link-Proof': proof,
      ...(csrf ? { 'X-RWAS-CSRF': csrf } : {}),
      ...changes,
    };
    for (const [key, entry] of Object.entries(value))
      if (entry === null) delete value[key];
    return value;
  };
  const start = (
    session = ownerToken,
    body = { proof, confirm: true },
    changes = {},
  ) =>
    f.call(
      '/auth/clerk-production/link/start',
      'POST',
      body,
      session,
      headers(null, changes),
    );
  const begin = async () => {
    const response = await start();
    assert.equal(
      response.status,
      200,
      JSON.stringify(await response.clone().json()),
    );
    return response.json();
  };
  const finish = (tx, session = ownerToken, body = {}, changes = {}) =>
    f.call(
      '/auth/clerk-production/link/finish',
      'POST',
      { nonce: tx.nonce, proof, confirm: true, ...body },
      session,
      headers(tx.csrf, changes),
    );
  try {
    await operation({
      f,
      p,
      ownerToken,
      ownerProfile,
      ownerSessionKey,
      listing,
      headers,
      start,
      begin,
      finish,
    });
  } finally {
    globalThis.fetch = oldFetch;
  }
}

test('email collision stays closed; explicit two-credential link preserves account and listing ownership', async () => {
  await withFixture(
    async ({
      f,
      p,
      ownerToken,
      ownerProfile,
      listing,
      headers,
      begin,
      finish,
    }) => {
      const regular = await f.call(
        '/auth/clerk-production/start',
        'POST',
        {},
        undefined,
        headers(),
      );
      const refused = await f.call(
        '/auth/clerk-production/finish',
        'POST',
        { nonce: (await regular.json()).nonce },
        undefined,
        headers(),
      );
      assert.equal(refused.status, 409);
      assert.deepEqual(f.state().identities, {});
      const existingIdentityKey = await digest(
        'https://legacy.example.test/|old-provider-subject',
      );
      const existingIdentity = {
        userId: ownerProfile.id,
        issuer: 'https://legacy.example.test/',
        subject: 'old-provider-subject',
        method: 'password',
        createdAt: 100,
        credentialsChangedAt: 0,
      };
      f.state().identities[existingIdentityKey] = existingIdentity;
      const tx = await begin();
      const sibling = await begin();
      assert.equal(Object.keys(f.state().profiles).length, 1);
      const response = await finish(tx);
      assert.equal(response.status, 200);
      const linked = await response.json();
      assert.ok(linked.session && linked.csrf);
      assert.deepEqual(f.state().profiles[ownerProfile.id], ownerProfile);
      assert.deepEqual(f.state().listings[listing.id], listing);
      assert.deepEqual(
        f.state().identities[existingIdentityKey],
        existingIdentity,
      );
      const identityKey = await digest(
        CLERK_PRODUCTION.issuer + '|' + p.user.id,
      );
      assert.equal(f.state().identities[identityKey].userId, ownerProfile.id);
      assert.equal(Object.keys(f.state().sessions).length, 1);
      assert.equal(
        (await f.call('/account', 'GET', undefined, ownerToken)).status,
        401,
      );
      const account = await f.call(
        '/account',
        'GET',
        undefined,
        linked.session,
        {
          'X-Clerk-Session-Token': p.jwt(),
          'X-RWAS-CSRF': linked.csrf,
          'Sec-Fetch-Site': 'same-origin',
        },
      );
      assert.equal(account.status, 200);
      assert.equal((await account.json()).profile.id, ownerProfile.id);
      assert.equal((await finish(tx)).status, 401);
      assert.equal((await finish(sibling)).status, 401);
      assert.equal(
        f.state().audit.filter((row) => row.action === 'identity-link').length,
        1,
      );
    },
  );
});

test('verified Clerk email never chooses or edits another existing profile', async () => {
  await withFixture(async ({ f, ownerProfile, begin, finish }) => {
    const other = {
      id: 'another-owner',
      email: 'owner@example.test',
      name: 'Another owner',
      createdAt: 100,
    };
    f.state().profiles[other.id] = structuredClone(other);
    const response = await finish(await begin());
    assert.equal(response.status, 200);
    assert.deepEqual(f.state().profiles[ownerProfile.id], ownerProfile);
    assert.deepEqual(f.state().profiles[other.id], other);
    assert.equal(
      Object.values(f.state().identities)[0].userId,
      ownerProfile.id,
    );
  }, 'independent-owner@example.test');
});

test('link initiation requires exact origin, explicit consent and browser proof before provider access', async () => {
  const cases = [
    { headers: { Origin: null } },
    { headers: { Origin: 'null' } },
    { headers: { Origin: 'https://evil.test' } },
    { headers: { Origin: 'https://rogerwilcoaviation.com' } },
    { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    { headers: { 'X-RWAS-Link-Proof': null } },
    { headers: { 'X-RWAS-Link-Proof': 'Q'.repeat(43) } },
    { body: { proof, confirm: false } },
    { body: { proof, confirm: true, userId: 'another-owner' } },
    { body: { proof: 'too-short', confirm: true } },
  ];
  for (const value of cases)
    await withFixture(async ({ f, p, start, ownerToken }) => {
      assert.equal(
        (await start(ownerToken, value.body, value.headers)).status,
        403,
      );
      assert.equal(p.calls.length, 0);
      assert.deepEqual(f.state().authTransactions, {});
      assert.deepEqual(f.state().identities, {});
    });
});

test('fresh independent local credential is required; legacy provider and Clerk sessions cannot authorize linking', async () => {
  const cases = [
    {
      change: (s) => {
        s.createdAt = Date.now() - 600001;
      },
      status: 401,
    },
    {
      change: (s) => {
        s.createdAt = Date.now() + 60000;
      },
      status: 401,
    },
    {
      change: (s) => {
        s.createdAt = null;
      },
      status: 401,
    },
    {
      change: (s) => {
        s.expiresAt = Date.now() - 1;
      },
      status: 401,
    },
    {
      change: (s) => {
        s.method = 'identity';
      },
      status: 403,
    },
    {
      change: (s) => {
        s.method = 'clerk-production';
      },
      status: 403,
    },
  ];
  for (const value of cases)
    await withFixture(async ({ f, p, ownerSessionKey, start }) => {
      value.change(f.state().sessions[ownerSessionKey]);
      assert.equal((await start()).status, value.status);
      assert.equal(p.calls.length, 0);
      assert.deepEqual(f.state().identities, {});
    });
  await withFixture(async ({ p, start }) => {
    assert.equal((await start('unknown-owner-session')).status, 401);
    assert.equal(p.calls.length, 0);
  });
});

test('held owners, deleted owners and revoked sessions cannot finish; valid nonce is consumed', async () => {
  const cases = [
    {
      change: ({ f, ownerProfile }) => {
        f.state().profiles[ownerProfile.id].disabled = true;
      },
      status: 403,
    },
    {
      change: ({ f, ownerProfile }) => {
        f.state().profiles[ownerProfile.id].identityBlocked = true;
      },
      status: 403,
    },
    {
      change: ({ f, ownerProfile }) => {
        f.state().profiles[ownerProfile.id].adminSuspended = true;
      },
      status: 403,
    },
    {
      change: ({ f, ownerProfile }) => {
        delete f.state().profiles[ownerProfile.id];
      },
      status: 401,
    },
    {
      change: ({ f, ownerSessionKey }) => {
        delete f.state().sessions[ownerSessionKey];
      },
      status: 401,
    },
    {
      change: ({ f, ownerProfile, ownerSessionKey }) => {
        f.state().profiles[ownerProfile.id].sessionRevokedAt =
          f.state().sessions[ownerSessionKey].createdAt;
      },
      status: 403,
    },
  ];
  for (const value of cases)
    await withFixture(async (context) => {
      const tx = await context.begin();
      value.change(context);
      assert.equal((await context.finish(tx)).status, value.status);
      assert.deepEqual(context.f.state().authTransactions, {});
      assert.deepEqual(context.f.state().identities, {});
      assert.equal((await context.finish(tx)).status, 401);
    });
});

test('owner bearer and browser CSRF proofs remain bound through one-use finish', async () => {
  const cases = [
    { session: 'unknown-owner-session', status: 401 },
    { body: { confirm: false }, status: 403 },
    {
      body: { proof: 'Q'.repeat(43) },
      headers: { 'X-RWAS-Link-Proof': 'Q'.repeat(43) },
      status: 403,
    },
    { headers: { 'X-RWAS-CSRF': 'wrong-csrf' }, status: 403 },
    { headers: { 'X-RWAS-CSRF': null }, status: 403 },
    { headers: { Origin: 'https://evil.test' }, status: 403 },
    { headers: { 'Sec-Fetch-Site': 'cross-site' }, status: 403 },
    { body: { userId: 'another-owner' }, status: 403 },
  ];
  for (const value of cases)
    await withFixture(async ({ f, ownerToken, begin, finish }) => {
      const tx = await begin();
      assert.equal(
        (
          await finish(
            tx,
            value.session || ownerToken,
            value.body,
            value.headers,
          )
        ).status,
        value.status,
      );
      assert.deepEqual(f.state().identities, {});
      assert.deepEqual(f.state().authTransactions, {});
      assert.equal((await finish(tx)).status, 401);
    });
  await withFixture(async ({ f, ownerSessionKey, begin, finish }) => {
    const tx = await begin();
    const alternate = 'synthetic-other-fresh-owner-session';
    f.state().sessions[await digest(alternate)] = {
      ...f.state().sessions[ownerSessionKey],
    };
    assert.equal((await finish(tx, alternate)).status, 403);
    assert.deepEqual(f.state().identities, {});
    assert.deepEqual(f.state().authTransactions, {});
  });
  await withFixture(async ({ f, ownerSessionKey, begin, finish }) => {
    const tx = await begin();
    f.state().sessions[ownerSessionKey].createdAt -= 1;
    assert.equal((await finish(tx)).status, 403);
    assert.deepEqual(f.state().identities, {});
    assert.deepEqual(f.state().authTransactions, {});
  });
});

test('expired link transactions are consumed and protocol nonces cannot be interchanged', async () => {
  await withFixture(async ({ f, begin, finish }) => {
    const tx = await begin();
    f.state().authTransactions[await digest(tx.nonce)].expiresAt =
      Date.now() - 1;
    assert.equal((await finish(tx)).status, 401);
    assert.deepEqual(f.state().authTransactions, {});
    assert.deepEqual(f.state().identities, {});
  });
  await withFixture(async ({ f, headers, finish }) => {
    const response = await f.call(
      '/auth/clerk-production/start',
      'POST',
      {},
      undefined,
      headers(),
    );
    const tx = await response.json();
    assert.equal(
      (await finish({ ...tx, csrf: 'not-a-link-csrf' })).status,
      401,
    );
    assert.equal(Object.keys(f.state().authTransactions).length, 1);
    assert.deepEqual(f.state().identities, {});
  });
});

test('Clerk subject, session, creation generation and password state cannot change during connection', async () => {
  const changes = [
    (p) => {
      p.user.id = p.session.user_id = 'user_ChangedSubject';
    },
    (p) => {
      p.session.id = 'sess_ChangedSession';
    },
    (p) => {
      p.session.created_at -= 100;
    },
    (p) => {
      p.user.password_last_updated_at = 2000;
    },
    (p) => {
      p.session.status = 'revoked';
    },
  ];
  for (const change of changes)
    await withFixture(async ({ f, p, begin, finish }) => {
      const tx = await begin();
      change(p);
      assert.equal((await finish(tx)).status, 401);
      assert.deepEqual(f.state().identities, {});
      assert.deepEqual(f.state().authTransactions, {});
      assert.equal((await finish(tx)).status, 401);
    });
});

test('colliding and already attached Clerk identities cannot replace any owner mapping', async () => {
  for (const afterStart of [false, true])
    await withFixture(async ({ f, p, ownerProfile, start, begin, finish }) => {
      const tx = afterStart ? await begin() : null;
      const identityKey = await digest(
        CLERK_PRODUCTION.issuer + '|' + p.user.id,
      );
      const collision = {
        userId: 'another-owner',
        issuer: CLERK_PRODUCTION.issuer,
        subject: p.user.id,
        method: 'clerk-production',
        createdAt: 100,
      };
      f.state().profiles['another-owner'] = {
        id: 'another-owner',
        email: 'another@example.test',
      };
      f.state().identities[identityKey] = structuredClone(collision);
      assert.equal((await (tx ? finish(tx) : start())).status, 409);
      assert.deepEqual(f.state().identities[identityKey], collision);
      assert.deepEqual(f.state().profiles[ownerProfile.id], ownerProfile);
      if (tx) assert.deepEqual(f.state().authTransactions, {});
    });
  await withFixture(async ({ f, ownerProfile, start }) => {
    const existingKey = await digest(
      CLERK_PRODUCTION.issuer + '|user_AlreadyAttached',
    );
    f.state().identities[existingKey] = {
      userId: ownerProfile.id,
      issuer: CLERK_PRODUCTION.issuer,
      subject: 'user_AlreadyAttached',
      method: 'clerk-production',
    };
    assert.equal((await start()).status, 409);
    assert.equal(Object.keys(f.state().identities).length, 1);
  });
});

test('blocked, reset-held and changed identity credentials fence both credentials throughout linking', async () => {
  for (const linkedOwnerIdentity of [false, true]) {
    for (const hold of [
      'blocked',
      'providerResetHold',
      'credentialsChangedAt',
    ]) {
      await withFixture(
        async ({ f, p, ownerProfile, ownerSessionKey, begin, finish }) => {
          const key = await digest(
            linkedOwnerIdentity
              ? 'https://legacy.example.test/|old-subject'
              : CLERK_PRODUCTION.issuer + '|' + p.user.id,
          );
          if (linkedOwnerIdentity)
            f.state().identities[key] = {
              userId: ownerProfile.id,
              issuer: 'https://legacy.example.test/',
              subject: 'old-subject',
              method: 'password',
            };
          const tx = await begin();
          f.state().identitySecurity[key] = {
            [hold]: hold === 'credentialsChangedAt' ? Date.now() + 1 : true,
          };
          assert.equal((await finish(tx)).status, 403);
          assert.equal(
            Object.keys(f.state().identities).length,
            linkedOwnerIdentity ? 1 : 0,
          );
          assert.deepEqual(f.state().authTransactions, {});
          assert.ok(f.state().sessions[ownerSessionKey]);
          assert.equal((await finish(tx)).status, 401);
        },
      );
    }
  }
});

test('provider failures consume connection once and never rewrite the established seller', async () => {
  await withFixture(async ({ f, ownerProfile, begin, finish }) => {
    const tx = await begin();
    globalThis.fetch = async () => {
      throw new Error('Synthetic provider unavailable');
    };
    assert.equal((await finish(tx)).status, 503);
    assert.deepEqual(f.state().profiles[ownerProfile.id], ownerProfile);
    assert.deepEqual(f.state().identities, {});
    assert.deepEqual(f.state().authTransactions, {});
    assert.equal((await finish(tx)).status, 401);
  });
});
