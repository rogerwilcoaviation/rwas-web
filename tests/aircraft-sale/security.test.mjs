import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFixture } from './identity-fixture.mjs';
import { authorizeOperator } from '../../workers/aircraft-sale/adapters.mjs';
const wait = () => new Promise((resolve) => setTimeout(resolve, 2));
async function setup() {
  const identity = await identityFixture();
  let authenticatedAt = Date.now(),
    scope = 'seller-security';
  identity.f.env.OPERATOR_AUTH = {
    fetch: async (request) =>
      request.headers.get('Authorization') ===
      'Bearer fixture-security-operator'
        ? Response.json({
            actor: 'operator@example.test',
            scope,
            authenticatedAt,
          })
        : new Response(null, { status: 403 }),
  };
  const request = (path, body, token = 'fixture-security-operator', headers) =>
    identity.f.call('/ops/security/' + path, 'POST', body, token, headers);
  const input = (kind, subject = 'auth0|owner', occurredAt = Date.now()) => ({
    id: crypto.randomUUID(),
    kind,
    subject,
    occurredAt,
    reason: 'Synthetic recovery after provider event outage',
    evidenceRef: 'fixture://verified-provider-case/synthetic-1',
  });
  const preview = async (body) => (await request('preview', body)).json();
  const apply = async (body) =>
    request('apply', {
      ...body,
      confirmation: (await preview(body)).confirmation,
    });
  return {
    ...identity,
    request,
    input,
    preview,
    apply,
    freshness: (value) => (authenticatedAt = value),
    scope: (value) => (scope = value),
  };
}
test('security recovery fails closed without distinct fresh operator authority and rejects forged origins/claims', async () => {
  const s = await setup(),
    body = s.input('password-reset');
  const seller = await s.f.login();
  for (const token of [
    undefined,
    seller,
    'fixture-reviewer',
    s.f.env.AUTH_EVENT_SECRET,
  ])
    assert.equal(
      (await s.request('preview', body, token || 'anonymous')).status,
      403,
    );
  s.freshness(Date.now() - 600001);
  assert.equal((await s.request('preview', body)).status, 403);
  s.freshness(Date.now());
  s.scope('listing-review');
  assert.equal((await s.request('preview', body)).status, 403);
  s.scope('seller-security');
  assert.equal(
    (
      await s.request('preview', body, undefined, {
        Origin: 'https://evil.test',
      })
    ).status,
    403,
  );
  assert.equal(
    (await s.request('preview', { ...body, disabled: false })).status,
    400,
  );
  assert.equal(
    (await s.request('preview', { ...body, evidenceRef: '' })).status,
    400,
  );
  assert.equal(
    (await s.request('preview', { ...body, id: '__proto__' })).status,
    400,
  );
  assert.equal((await s.request('receipt', { id: 'toString' })).status, 404);
  delete s.f.env.OPERATOR_AUTH;
  assert.equal((await s.request('preview', body)).status, 503);
  assert.equal(Object.keys(s.f.state().securityOperations).length, 0);
});
test('missed old reset reconciliation is atomic, revokes linked sessions, fences pending login and retries only once after restart', async () => {
  const s = await setup();
  const owner = await (
    await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
  ).json();
  assert.equal(
    (
      await s.finish(await s.begin('google', owner.session, true), {
        sub: 'google|owner',
      })
    ).status,
    200,
  );
  const pending = await s.begin('google');
  const body = s.input('password-reset', 'auth0|owner', Date.now() - 86400000);
  assert.equal(
    (
      await s.f.call(
        '/auth/events',
        'POST',
        {
          id: 'late',
          kind: body.kind,
          subject: body.subject,
          issuedAt: body.occurredAt,
        },
        s.f.env.AUTH_EVENT_SECRET,
      )
    ).status,
    400,
  );
  const proposal = await s.preview(body);
  assert.equal(proposal.sessionsToRevoke, 2);
  assert.equal((await s.request('apply', body)).status, 409);
  s.f.storageFailure(true);
  assert.equal(
    (await s.request('apply', { ...body, confirmation: proposal.confirmation }))
      .status,
    503,
  );
  s.f.storageFailure(false);
  s.f.restart();
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, owner.session)).status,
    200,
  );
  assert.equal(Object.keys(s.f.state().securityOperations).length, 0);
  assert.equal(
    (await s.request('apply', { ...body, confirmation: proposal.confirmation }))
      .status,
    200,
  );
  assert.equal((await s.finish(pending, { sub: 'google|owner' })).status, 401);
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, owner.session)).status,
    401,
  );
  await wait();
  const fresh = await (
    await s.finish(await s.begin('google'), { sub: 'google|owner' })
  ).json();
  s.f.restart();
  const retry = await (
    await s.request('apply', { ...body, confirmation: proposal.confirmation })
  ).json();
  assert.equal(retry.replayed, true);
  const receipt = await (await s.request('receipt', { id: body.id })).json();
  assert.equal(receipt.actor, 'operator@example.test');
  assert.equal(receipt.audit.evidenceRef, body.evidenceRef);
  assert.equal(receipt.audit.reason, body.reason);
  assert.equal(receipt.result.operationId, body.id);
  assert.equal(
    (await s.request('receipt', { id: body.id }, 'fixture-reviewer')).status,
    403,
  );
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, fresh.session)).status,
    200,
  );
  assert.equal(
    s.f
      .state()
      .audit.filter((row) => row.action === 'operator-security-reconcile')
      .length,
    1,
  );
  assert.equal(s.f.state().audit.at(-2).actor, 'operator@example.test');
  assert.equal(
    (
      await s.request('apply', {
        ...body,
        reason: 'Changed operation cannot reuse the same ID',
        confirmation: proposal.confirmation,
      })
    ).status,
    409,
  );
});
test('unblock requires verified operator attestation and exact preview; other identity blocks remain effective', async () => {
  const s = await setup();
  const owner = await (
    await s.finish(await s.begin('password'), { sub: 'auth0|owner' })
  ).json();
  assert.equal(
    (
      await s.finish(await s.begin('google', owner.session, true), {
        sub: 'google|owner',
      })
    ).status,
    200,
  );
  assert.equal((await s.apply(s.input('account-blocked'))).status, 200);
  assert.equal(
    (await s.apply(s.input('account-blocked', 'google|owner'))).status,
    200,
  );
  const pending = await s.begin('google');
  const unblock = s.input('account-unblocked');
  const proposal = await s.preview(unblock);
  assert.equal(proposal.otherBlockedSubjects, 1);
  const result = await (
    await s.request('apply', {
      ...unblock,
      confirmation: proposal.confirmation,
    })
  ).json();
  assert.equal(result.subjectBlocked, false);
  assert.equal(result.profileBlocked, true);
  assert.equal((await s.finish(pending, { sub: 'google|owner' })).status, 403);
  const googleUnblock = s.input('account-unblocked', 'google|owner');
  assert.equal(
    (await (await s.apply(googleUnblock)).json()).profileBlocked,
    false,
  );
  await wait();
  assert.equal(
    (await s.finish(await s.begin('google'), { sub: 'google|owner' })).status,
    200,
  );
  const delayed = {
    id: 'late-prior-block',
    kind: 'account-blocked',
    subject: googleUnblock.subject,
    issuedAt: googleUnblock.occurredAt,
  };
  assert.equal(
    (
      await (
        await s.f.call(
          '/auth/events',
          'POST',
          delayed,
          s.f.env.AUTH_EVENT_SECRET,
        )
      ).json()
    ).reconciled,
    true,
  );
  const count = Object.keys(s.f.state().sessions).length;
  assert.equal(count, 1);
  assert.equal(
    s.f.state().audit.at(-1).action,
    'provider-event-already-reconciled',
  );
  await wait();
  assert.equal(
    (
      await s.f.call(
        '/auth/events',
        'POST',
        { ...delayed, id: 'new-block', issuedAt: Date.now() },
        s.f.env.AUTH_EVENT_SECRET,
      )
    ).status,
    200,
  );
  assert.equal(
    (await s.finish(await s.begin('google'), { sub: 'google|owner' })).status,
    403,
  );
});
test('unknown-subject recovery survives restart, rejects stale preview and preserves independent profile holds', async () => {
  const s = await setup(),
    subject = 'auth0|unknown';
  assert.equal(
    (await s.apply(s.input('account-blocked', subject))).status,
    200,
  );
  s.f.restart();
  assert.equal(
    (await s.finish(await s.begin('password'), { sub: subject })).status,
    403,
  );
  const unblock = s.input('account-unblocked', subject);
  const preview = await s.preview(unblock);
  assert.equal((await s.apply(s.input('password-reset', subject))).status, 200);
  assert.equal(
    (
      await s.request('apply', {
        ...unblock,
        confirmation: preview.confirmation,
      })
    ).status,
    409,
  );
  assert.equal((await s.apply(unblock)).status, 200);
  await wait();
  const owner = await (
    await s.finish(await s.begin('password'), { sub: subject })
  ).json();
  const profile = Object.values(s.f.state().profiles)[0];
  profile.disabled = true; // A separate legacy/manual account hold, never a browser input.
  assert.equal((await s.apply(s.input('password-reset', subject))).status, 200);
  assert.equal(s.f.state().profiles[profile.id].disabled, true);
  await wait();
  assert.equal(
    (await s.finish(await s.begin('password'), { sub: subject })).status,
    403,
  );
  assert.equal(
    (await s.f.call('/account', 'GET', undefined, owner.session)).status,
    401,
  );
  assert.equal(
    (await s.request('preview', s.input('account-unblocked', subject))).status,
    409,
  );
});
test('operator Access requires distinct audience, signature, allowlist and actual recent auth_time, never token iat alone', async () => {
  const keys = await crypto.subtle.generateKey(
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
  jwk.kid = 'ops-fixture';
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      'https://fixture.cloudflareaccess.com/cdn-cgi/access/certs',
    );
    return Response.json({ keys: [jwk] });
  };
  try {
    const env = {
      ACCESS_AUD: 'reviewer',
      OPERATOR_ACCESS_AUD: 'security',
      OPERATOR_ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com',
      OPERATOR_EMAILS: 'operator@example.test',
    };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: 'https://fixture.cloudflareaccess.com',
      aud: ['security'],
      email: 'operator@example.test',
      exp: now + 60,
      iat: now,
      auth_time: now,
    };
    async function request(changes = {}, tamper = false) {
      const value = { ...claims, ...changes };
      const encode = (data) =>
        Buffer.from(JSON.stringify(data)).toString('base64url');
      const text = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode(value);
      let signature = Buffer.from(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          keys.privateKey,
          new TextEncoder().encode(text),
        ),
      ).toString('base64url');
      if (tamper)
        signature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      return new Request('http://localhost', {
        headers: { 'Cf-Access-Jwt-Assertion': text + '.' + signature },
      });
    }
    assert.equal((await authorizeOperator(await request(), env)).status, 200);
    for (const change of [
      { auth_time: undefined },
      { auth_time: now - 601 },
      { auth_time: String(now) },
      { auth_time: now + 60 },
      { aud: ['reviewer'] },
      { email: 'reviewer@example.test' },
      { iss: 'https://evil.test' },
    ])
      assert.equal(
        (await authorizeOperator(await request(change), env)).status,
        403,
      );
    assert.equal(
      (await authorizeOperator(await request({}, true), env)).status,
      403,
    );
    assert.equal(
      (
        await authorizeOperator(await request(), {
          ...env,
          OPERATOR_ACCESS_AUD: 'reviewer',
        })
      ).status,
      503,
    );
  } finally {
    globalThis.fetch = original;
  }
});
