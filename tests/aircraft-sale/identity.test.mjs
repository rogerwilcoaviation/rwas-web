import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create } from './fixture.mjs';
import {
  digest,
  randomProof,
  identityConfig,
} from '../../workers/aircraft-sale/identity.mjs';
import { identityFixture as setup } from './identity-fixture.mjs';
test('hosted password/Google/Apple methods fail closed and use PKCE/state/nonce without password submission', async () => {
  const { f, begin, finish, calls } = await setup();
  assert.deepEqual((await (await f.call('/auth/methods')).json()).methods, [
    'password',
    'google',
    'apple',
  ]);
  for (const method of ['password', 'google', 'apple']) {
    const start = await begin(method);
    assert.equal(start.response.status, 200);
    const authorization = new URL(start.authorizationUrl),
      tx = f.state().authTransactions[await digest(start.state)];
    assert.equal(authorization.pathname, '/authorize');
    assert.equal(
      authorization.searchParams.get('connection'),
      identityConfig(f.env).methods[method],
    );
    assert.equal(
      authorization.searchParams.get('code_challenge_method'),
      'S256',
    );
    assert.equal(authorization.searchParams.get('nonce'), tx.nonce);
    assert.equal(authorization.searchParams.get('prompt'), 'login');
    const challenge = Buffer.from(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(tx.verifier),
      ),
    ).toString('base64url');
    assert.equal(authorization.searchParams.get('code_challenge'), challenge);
    const response = await finish(start, {
      sub: method + '|synthetic',
      email: method + '@example.test',
    });
    assert.equal(response.status, 200);
    const session = (await response.json()).session;
    assert.equal(
      (await f.call('/account', 'GET', undefined, session)).status,
      200,
    );
    const out = await (
      await f.call('/logout', 'POST', undefined, session)
    ).json();
    assert.ok(
      out.logoutUrl.startsWith('https://identity.fixture.test/v2/logout?'),
    );
    assert.equal(
      (await f.call('/account', 'GET', undefined, session)).status,
      401,
    );
  }
  assert.ok(
    calls.every((x) => ['/oauth/token', '/.well-known/jwks.json'].includes(x)),
  );
  delete f.env.AUTH_EVENT_SECRET;
  assert.ok(
    !(await (await f.call('/auth/methods')).json()).methods.includes(
      'password',
    ),
  );
  delete f.env.AUTH_ISSUER;
  assert.deepEqual((await (await f.call('/auth/methods')).json()).methods, []);
  assert.equal((await begin()).response.status, 503);
});
test('identity rejects wrong origin, missing/wrong proof, expired state, replay, cancellation and failed pre-exchange save', async () => {
  const { f, begin, finish, calls } = await setup();
  assert.equal(
    (
      await f.call(
        '/auth/start',
        'POST',
        { method: 'google', proof: randomProof() },
        undefined,
        { Origin: 'https://evil.test' },
      )
    ).status,
    403,
  );
  const start = await begin();
  assert.equal(
    (
      await f.call('/auth/finish', 'POST', {
        state: start.state,
        proof: randomProof(),
        code: 'fake',
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
  f.storageFailure(true);
  assert.equal((await finish(start)).status, 503);
  assert.equal(calls.length, 0);
  f.storageFailure(false);
  assert.equal((await finish(start)).status, 200);
  assert.equal(
    (
      await f.call('/auth/finish', 'POST', {
        state: start.state,
        proof: start.proof,
        code: 'replay',
      })
    ).status,
    400,
  );
  const cancel = await begin();
  assert.equal(
    (
      await f.call('/auth/finish', 'POST', {
        state: cancel.state,
        proof: cancel.proof,
        error: 'access_denied',
      })
    ).status,
    400,
  );
  assert.ok(!f.state().authTransactions[await digest(cancel.state)]);
  const expired = await begin();
  f.state().authTransactions[await digest(expired.state)].createdAt =
    Date.now() - 600001;
  assert.equal(
    (
      await f.call('/auth/finish', 'POST', {
        state: expired.state,
        proof: expired.proof,
        code: 'fake',
      })
    ).status,
    400,
  );
});
test('identity requires signature, issuer, audience, nonce, verified email and fresh issued-at', async () => {
  const { begin, finish } = await setup();
  for (const change of [
    { iss: 'https://evil.test/' },
    { aud: 'another-client' },
    { nonce: 'wrong' },
    { email_verified: false },
    { exp: 1 },
    { iat: 1 },
    { iat: Math.floor(Date.now() / 1000) + 1000 },
    { sub: '' },
    { aud: ['synthetic-public-client', 'other'], azp: 'other' },
  ]) {
    assert.equal((await finish(await begin(), change)).status, 400);
  }
  assert.equal(
    (await finish(await begin(), {}, undefined, { tamper: true })).status,
    400,
  );
  assert.equal(
    (await finish(await begin(), {}, undefined, { header: { alg: 'HS256' } }))
      .status,
    400,
  );
});
test('matching email never transfers an existing account; explicit link requires current recent session and preserves listing owner', async () => {
  const { f, begin, finish } = await setup();
  const owner = await f.login('identity@example.test'),
    listing = await create(f, owner);
  assert.equal((await finish(await begin())).status, 409);
  assert.equal(Object.keys(f.state().profiles).length, 1);
  assert.equal((await finish(await begin('google', owner, true))).status, 200);
  assert.equal(
    f.state().listings[listing.id].ownerId,
    Object.values(f.state().profiles)[0].id,
  );
  assert.equal(Object.keys(f.state().profiles).length, 1);
  const google = await (await finish(await begin())).json();
  assert.equal(
    (await f.call('/my-listings', 'GET', undefined, google.session)).status,
    200,
  );
  const revoked = await begin('apple', owner, true);
  await f.call('/logout', 'POST', undefined, owner);
  assert.equal((await finish(revoked, { sub: 'apple|synthetic' })).status, 401);
  const other = await f.login('other@example.test');
  assert.equal((await finish(await begin('google', other, true))).status, 409);
  const apple = await finish(await begin('apple', google.session, true), {
    sub: 'apple|synthetic',
  });
  assert.equal(apple.status, 200);
  const account = await (
    await f.call('/account', 'GET', undefined, google.session)
  ).json();
  assert.deepEqual(account.loginMethods.sort(), ['apple', 'google']);
});
test('authenticated provider events revoke all app sessions, reject replay/stale/fake events and interrupt pre-reset login', async () => {
  const { f, begin, finish } = await setup();
  const first = await (
    await finish(await begin('password'), { sub: 'auth0|synthetic' })
  ).json();
  const pending = await begin('password');
  const event = {
    id: 'synthetic-reset-1',
    subject: 'auth0|synthetic',
    kind: 'password-reset',
    issuedAt: Date.now(),
  };
  assert.equal(
    (await f.call('/auth/events', 'POST', event, 'invalid')).status,
    403,
  );
  assert.equal(
    (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
      .status,
    200,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, first.session)).status,
    401,
  );
  assert.equal((await finish(pending, { sub: 'auth0|synthetic' })).status, 401);
  assert.equal(
    (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
      .status,
    200,
  );
  assert.equal(
    (
      await f.call(
        '/auth/events',
        'POST',
        { ...event, id: 'old', issuedAt: 1 },
        f.env.AUTH_EVENT_SECRET,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call(
        '/auth/events',
        'POST',
        {
          ...event,
          id: 'block',
          kind: 'account-blocked',
          issuedAt: Date.now(),
        },
        f.env.AUTH_EVENT_SECRET,
      )
    ).status,
    200,
  );
  assert.equal(
    (await finish(await begin('password'), { sub: 'auth0|synthetic' })).status,
    403,
  );
  const mailCount = f.mail.length;
  assert.equal(
    (await f.call('/send-code', 'POST', { email: 'identity@example.test' }))
      .status,
    403,
  );
  assert.equal(f.mail.length, mailCount);
});
test('identity HTTP provider failures consume transactions once and preserve an existing linked account', async () => {
  const { f, begin, finish } = await setup(),
    owner = await f.login('identity@example.test');
  const start = await begin('google', owner, true);
  let calls = 0;
  f.env.AUTH_PROVIDER.fetch = async () => {
    calls++;
    return new Response(null, { status: 503 });
  };
  assert.equal((await finish(start)).status, 503);
  assert.equal(calls, 1);
  assert.equal(
    (
      await f.call('/auth/finish', 'POST', {
        state: start.state,
        proof: start.proof,
        code: 'retry',
      })
    ).status,
    400,
  );
  assert.equal(calls, 1);
  assert.equal((await f.call('/account', 'GET', undefined, owner)).status, 200);
});

test('security events fence unknown subjects before first account creation or linking', async () => {
  for (const kind of ['password-reset', 'account-blocked']) {
    const { f, begin, finish } = await setup();
    const pending = await begin('password');
    const event = {
      id: 'unknown-' + kind,
      kind,
      subject: 'auth0|unknown',
      issuedAt: Date.now(),
    };
    assert.equal(
      (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
        .status,
      200,
    );
    assert.equal(
      (await finish(pending, { sub: event.subject })).status,
      kind === 'account-blocked' ? 403 : 401,
    );
    assert.equal(Object.keys(f.state().profiles).length, 0);
    assert.equal(Object.keys(f.state().identities).length, 0);
    if (kind === 'account-blocked') {
      const owner = await f.login('owner@example.test');
      assert.equal(
        (
          await finish(await begin('password', owner, true), {
            sub: event.subject,
          })
        ).status,
        403,
      );
      assert.equal(Object.keys(f.state().identities).length, 0);
    }
  }
});
test('password reset fences pending logins across every identity linked to the profile', async () => {
  const { f, begin, finish } = await setup();
  const first = await (
    await finish(await begin('password'), { sub: 'auth0|owner' })
  ).json();
  assert.equal(
    (
      await finish(await begin('google', first.session, true), {
        sub: 'google|owner',
      })
    ).status,
    200,
  );
  const pending = await begin('google');
  const event = {
    id: 'cross-provider-reset',
    kind: 'password-reset',
    subject: 'auth0|owner',
    issuedAt: Date.now(),
  };
  assert.equal(
    (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
      .status,
    200,
  );
  assert.equal((await finish(pending, { sub: 'google|owner' })).status, 401);
  assert.equal(Object.keys(f.state().sessions).length, 0);
});
