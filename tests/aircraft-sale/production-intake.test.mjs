import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, submit, approve } from './fixture.mjs';
import { identityFixture } from './identity-fixture.mjs';

test('production password-only mode disables email-code login and keeps submitted listings private', async () => {
  const { f, begin } = await identityFixture();
  f.env.PASSWORD_ONLY_LOGIN = 'true';
  f.env.EMAIL_CODE_LOGIN_ENABLED = 'false';
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';

  const methods = await (await f.call('/auth/methods')).json();
  assert.deepEqual(methods.methods, ['password']);
  assert.equal((await begin('google')).response.status, 503);
  assert.equal(methods.emailCode, false);
  assert.equal(methods.publicListings, false);
  assert.equal(
    (await f.call('/send-code', 'POST', { email: 'owner@example.test' }))
      .status,
    404,
  );
  assert.equal(
    (
      await f.call('/check-code', 'POST', {
        email: 'owner@example.test',
        code: '123456',
      })
    ).status,
    404,
  );

  f.env.EMAIL_CODE_LOGIN_ENABLED = 'true';
  const owner = await f.login();
  f.env.EMAIL_CODE_LOGIN_ENABLED = 'false';
  const listing = await create(f, owner);
  assert.equal((await submit(f, owner, listing)).status, 200);
  assert.equal((await approve(f, listing)).status, 409);
  assert.equal(f.state().listings[listing.id].status, 'pending');
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
});

test('password reset invalidates pre-reset sessions and email login codes', async () => {
  const { f, begin, finish } = await identityFixture();
  const signedIn = await (
    await finish(await begin('password'), { sub: 'auth0|reset-code' })
  ).json();
  await f.call('/send-code', 'POST', { email: 'identity@example.test' });
  const oldCode = f.mail.at(-1).code;
  const event = {
    id: 'reset-clears-old-code',
    kind: 'password-reset',
    subject: 'auth0|reset-code',
    issuedAt: Date.now(),
  };
  assert.equal(
    (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
      .status,
    200,
  );
  assert.equal(
    (await f.call('/account', 'GET', undefined, signedIn.session)).status,
    401,
  );
  assert.equal(
    (
      await f.call('/check-code', 'POST', {
        email: 'identity@example.test',
        code: oldCode,
      })
    ).status,
    400,
  );
});
