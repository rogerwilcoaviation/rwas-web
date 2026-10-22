import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { sellerMail } from '../../functions/_seller/mail.mjs';

const origin = 'https://www.rogerwilcoaviation.com';
const issuer = 'https://clerk.rogerwilcoaviation.com';
const api = '/api/aircraft-sale';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = publicKey.export({ format: 'jwk' });
Object.assign(jwk, { kid: 'contact-mail-fixture', alg: 'RS256', use: 'sig' });
const digest = (value) => createHash('sha256').update(value).digest('hex');

// Inspection and legacy seeding exist only in this disposable test bundle.
// Requests still use the real Pages handler, entrypoint RPC and SQLite DO.
const bundle = async (contents) =>
  (
    await build({
      stdin: { contents, resolveDir: process.cwd() },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      external: ['cloudflare:workers'],
    })
  ).outputFiles[0].text;
const scripts = Promise.all([
  bundle(`import {onRequest} from './functions/api/aircraft-sale/[[path]].ts';
    export default {fetch(request, env) {return onRequest({request,env});}};`),
  bundle(`import Entry, {SellerStore as Core} from './workers/aircraft-sale/entry.mjs';
    export default Entry;
    export class SellerStore extends Core {
      async fetch(request) {
        if (new URL(request.url).origin !== 'https://fixture-state.internal')
          return super.fetch(request);
        const state = await this.loadState();
        if (request.method === 'POST') {
          const b = await request.json();
          if (b.legacyKey) {
            state.profiles.legacy = {id:'legacy',email:'legacy@example.test',name:'Legacy',phone:'',location:''};
            state.sessions[b.legacyKey] = {userId:'legacy',method:'identity',createdAt:Date.now(),expiresAt:Date.now()+3600000};
          }
          if (b.ageKey) state.sessions[b.ageKey].createdAt -= 600001;
          if (b.seedBusiness) {
            const owner = Object.values(state.profiles).find(p=>p.id!=='legacy').id;
            state.listings['fixture-listing'] = {id:'fixture-listing',ownerId:owner,status:'draft',revision:1};
            state.files['fixture-file'] = {id:'fixture-file',listingId:'fixture-listing',ownerId:owner};
          }
          await this.saveState(state);
        }
        return Response.json(state);
      }
    }`),
]);

async function fixture(
  t,
  { clerkEnabled = true, qaOnly = false, emailCodeEnabled = false } = {},
) {
  const [pagesScript, sellerScript] = await scripts;
  const session = {
    id: 'sess_ContactMail',
    user_id: 'user_ContactMail',
    status: 'active',
    expire_at: Date.now() + 3600000,
    created_at: Date.now() - 1000,
  };
  const user = {
    id: session.user_id,
    banned: false,
    locked: false,
    primary_email_address_id: 'email_primary',
    password_last_updated_at: 1000,
    first_name: 'Contact',
    last_name: 'Fixture',
    email_addresses: [
      {
        id: 'email_primary',
        email_address: 'owner@example.test',
        verification: { status: 'verified' },
      },
    ],
  };
  const jwt = (claims = {}) => {
    const h = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: jwk.kid }),
    ).toString('base64url');
    const p = Buffer.from(
      JSON.stringify({
        iss: issuer,
        aud: 'rwas-aircraft-seller-production',
        azp: origin,
        sub: user.id,
        sid: session.id,
        iat: Math.floor(Date.now() / 1000) - 1,
        exp: Math.floor(Date.now() / 1000) + 300,
        ...claims,
      }),
    ).toString('base64url');
    const input = h + '.' + p;
    return (
      input +
      '.' +
      sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')
    );
  };
  const delivered = [],
    outbound = [];
  let onDelivery = async () => {},
    mailStatus = 200;
  const provider = async (request) => {
    const url = new URL(request.url);
    outbound.push(url.origin + url.pathname);
    if (url.href === issuer + '/.well-known/jwks.json')
      return Response.json({ keys: [jwk] });
    assert.equal(
      url.origin,
      'https://api.clerk.com',
      'no unmocked external requests',
    );
    if (url.pathname === '/v1/sessions/' + session.id)
      return Response.json(session);
    if (url.pathname === '/v1/users/' + user.id) return Response.json(user);
    return new Response(null, { status: 404 });
  };
  const mf = new Miniflare({
    workers: [
      {
        name: 'pages',
        modules: true,
        script: pagesScript,
        compatibilityDate: '2026-09-01',
        bindings: { SELLER_MAIL_VIA_PAGES: 'true' },
        serviceBindings: {
          SELLER_API: 'seller',
          SELLER_MAILER: async (request) => {
            delivered.push(await request.json());
            await onDelivery();
            return new Response(null, { status: mailStatus });
          },
        },
        outboundService: async () => {
          throw Error('Pages external fetch denied');
        },
      },
      {
        name: 'seller',
        modules: true,
        script: sellerScript,
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['global_fetch_strictly_public'],
        bindings: {
          MAIL_VIA_PAGES: 'true',
          EMAIL_CODE_LOGIN_ENABLED: emailCodeEnabled ? 'true' : 'false',
          PUBLIC_LISTINGS_ENABLED: 'false',
          CLERK_PRODUCTION_ENABLED: clerkEnabled ? 'true' : 'false',
          CLERK_ACCEPTANCE_ENABLED: qaOnly ? 'true' : 'false',
          CLERK_PRODUCTION_SECRET_KEY: 'sk_live_fixture_not_a_credential',
        },
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
        },
        r2Buckets: ['MEDIA'],
        outboundService: provider,
      },
    ],
  });
  t.after(() => mf.dispose());
  const namespace = await mf.getDurableObjectNamespace(
    'SELLER_STORE',
    'seller',
  );
  const stub = namespace.get(namespace.idFromName('seller-v2'));
  const state = async (body) =>
    (
      await stub.fetch('https://fixture-state.internal/read', {
        method: body ? 'POST' : 'GET',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    ).json();
  const call = (
    path,
    method = 'GET',
    body,
    headers = {},
    destination = origin,
  ) =>
    mf.dispatchFetch(destination + api + path, {
      method,
      headers: { Origin: origin, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async () => {
    const token = jwt(),
      proof = { 'X-Clerk-Session-Token': token };
    const start = await call('/auth/clerk-production/start', 'POST', {}, proof);
    assert.equal(start.status, 200);
    const finish = await call(
      '/auth/clerk-production/finish',
      'POST',
      await start.json(),
      proof,
    );
    assert.equal(finish.status, 200);
    const result = await finish.json();
    return {
      Authorization: 'Bearer ' + result.session,
      'X-RWAS-CSRF': result.csrf,
      ...proof,
    };
  };
  return {
    call,
    state,
    login,
    session,
    user,
    jwt,
    delivered,
    outbound,
    onDelivery: (fn) => {
      onDelivery = fn;
    },
    mailStatus: (status) => {
      mailStatus = status;
    },
  };
}

const codeKey = (address) => 'email-change:' + address;

test('production contact mail crosses real Pages/RPC/SQLite with paired Clerk proof and preserves owner data', async (t) => {
  const f = await fixture(t),
    other = await f.login(),
    headers = await f.login();
  const before = await f.state({ seedBusiness: true });
  const response = await f.call(
    '/account/email-code',
    'POST',
    { email: 'contact@example.test' },
    headers,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, sent: true });
  assert.equal(f.delivered.length, 1);
  const message = f.delivered[0];
  assert.equal(message.to, 'contact@example.test');
  assert.equal(message.purpose, 'email-change');
  const prepared = await f.state();
  const serialized = JSON.stringify(prepared);
  assert.equal(serialized.includes('"code":"' + message.code + '"'), false);
  assert.equal(serialized.includes(headers['X-Clerk-Session-Token']), false);
  assert.equal(serialized.includes(headers.Authorization), false);
  assert.equal(serialized.includes('"context"'), false);
  const updated = await f.call(
    '/account/email',
    'PUT',
    { email: message.to, code: message.code },
    headers,
  );
  assert.equal(updated.status, 200);
  const after = await f.state();
  assert.deepEqual(after.listings, before.listings);
  assert.deepEqual(after.files, before.files);
  assert.deepEqual(after.identities, before.identities);
  const owner = Object.values(after.profiles)[0];
  assert.equal(owner.id, Object.values(before.profiles)[0].id);
  assert.equal(owner.email, message.to);
  assert.equal(f.user.email_addresses[0].email_address, 'owner@example.test');
  assert.equal((await f.call('/account', 'GET', undefined, other)).status, 401);
  assert.equal(
    (await f.call('/account', 'GET', undefined, headers)).status,
    200,
  );
  assert.equal(after.codes[codeKey(message.to)], undefined);
});

test('missing/wrong Clerk proof, CSRF, exact origin and stale RWAS sessions fail before mail', async (t) => {
  const f = await fixture(t),
    headers = await f.login();
  const missing = (name) => {
    const h = { ...headers };
    delete h[name];
    return h;
  };
  const badSignature =
    headers['X-Clerk-Session-Token'].split('.').slice(0, 2).join('.') +
    '.aW52YWxpZA';
  const cases = [
    missing('X-RWAS-CSRF'),
    missing('X-Clerk-Session-Token'),
    missing('Authorization'),
    { ...headers, 'X-RWAS-CSRF': 'x'.repeat(40) },
    { ...headers, 'X-Clerk-Session-Token': badSignature },
    {
      ...headers,
      'X-Clerk-Session-Token': f.jwt({ sub: 'user_Donor', sid: 'sess_Donor' }),
    },
    { ...headers, Origin: 'https://evil.test' },
    { ...headers, Origin: '' },
  ];
  for (const proof of cases) {
    const response = await f.call(
      '/account/email-code',
      'POST',
      { email: 'denied@example.test' },
      proof,
    );
    assert.ok([401, 403].includes(response.status));
  }
  for (const destination of [
    'https://rogerwilcoaviation.com',
    'https://preview.rwas-web.pages.dev',
  ])
    assert.equal(
      (
        await f.call(
          '/account/email-code',
          'POST',
          { email: 'denied@example.test' },
          headers,
          destination,
        )
      ).status,
      403,
    );
  await f.state({ ageKey: digest(headers.Authorization.slice(7)) });
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'stale@example.test' },
        headers,
      )
    ).status,
    401,
  );
  assert.equal(f.delivered.length, 0);
  const state = await f.state();
  assert.equal(Object.keys(state.codes).length, 0);
  assert.equal(Object.keys(state.mailRequests || {}).length, 0);
});

test('explicit cross-site production request is rejected before provider verification or mail despite valid paired credentials', async (t) => {
  const f = await fixture(t),
    headers = await f.login(),
    providerReads = f.outbound.length;
  const response = await f.call(
    '/account/email-code',
    'POST',
    { email: 'cross-site@example.test' },
    { ...headers, 'Sec-Fetch-Site': 'cross-site' },
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: 'Request origin rejected.',
  });
  assert.equal(f.outbound.length, providerReads);
  assert.equal(f.delivered.length, 0);
  const state = await f.state();
  assert.equal(Object.keys(state.codes).length, 0);
  assert.equal(Object.keys(state.mailRequests || {}).length, 0);
});

test('legacy/Auth0 ownership plus fake unbound Clerk context cannot enter the production mail bridge', async (t) => {
  const f = await fixture(t),
    raw = 'l'.repeat(40);
  await f.state({ legacyKey: digest(raw) });
  const headers = {
    Authorization: 'Bearer ' + raw,
    'X-RWAS-CSRF': 'c'.repeat(40),
    'X-Clerk-Session-Token': 'ZmFrZQ.ZmFrZQ.ZmFrZQ',
  };
  assert.equal(
    (await f.call('/account', 'GET', undefined, headers)).status,
    200,
  );
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'legacy-change@example.test' },
        headers,
      )
    ).status,
    403,
  );
  assert.equal(f.delivered.length, 0);
  assert.equal(Object.keys((await f.state()).codes).length, 0);
});

test('disabled Clerk config and public mail routes cannot use reconstructed authentication context', async (t) => {
  const f = await fixture(t, { clerkEnabled: false }),
    raw = 'l'.repeat(40);
  await f.state({ legacyKey: digest(raw) });
  const headers = {
    Authorization: 'Bearer ' + raw,
    'X-RWAS-CSRF': 'c'.repeat(40),
    'X-Clerk-Session-Token': f.jwt(),
  };
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'off@example.test' },
        headers,
      )
    ).status,
    503,
  );
  for (const destination of [origin, 'https://seller-service.internal'])
    assert.equal(
      (
        await f.call(
          '/_mail/start',
          'POST',
          {
            email: 'attack@example.test',
            purpose: 'email-change',
            context: { schema: 1, origin },
          },
          headers,
          destination,
        )
      ).status,
      404,
    );
  assert.equal(f.delivered.length, 0);
});

test('provider reset/revocation and RWAS logout during delivery prevent code activation', async (t) => {
  for (const change of ['provider-revoked', 'password-reset', 'logout']) {
    await t.test(change, async (t) => {
      const f = await fixture(t),
        headers = await f.login();
      f.onDelivery(async () => {
        if (change === 'provider-revoked') f.session.status = 'revoked';
        if (change === 'password-reset') f.user.password_last_updated_at = 2000;
        if (change === 'logout')
          assert.equal(
            (await f.call('/logout', 'POST', {}, headers)).status,
            200,
          );
      });
      const response = await f.call(
        '/account/email-code',
        'POST',
        { email: 'interrupted@example.test' },
        headers,
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: 'We could not send a code. Please try again later.',
      });
      const state = await f.state();
      assert.equal(state.codes[codeKey('interrupted@example.test')], undefined);
      assert.equal(
        Object.values(state.mailRequests).at(-1).status,
        'cancelled',
      );
      assert.equal(
        Object.values(state.profiles)[0].email,
        'owner@example.test',
      );
    });
  }
});

test('failed delivery cancels the pending production code and cannot change the contact record', async (t) => {
  const f = await fixture(t),
    headers = await f.login();
  f.mailStatus(503);
  const response = await f.call(
    '/account/email-code',
    'POST',
    { email: 'failed@example.test' },
    headers,
  );
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes(f.delivered[0].code), false);
  assert.equal(
    (
      await f.call(
        '/account/email',
        'PUT',
        { email: 'failed@example.test', code: f.delivered[0].code },
        headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (await f.state()).codes[codeKey('failed@example.test')],
    undefined,
  );
});

test('production login codes stay disabled and production mail needs its explicit existing Pages flag', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.call('/send-code', 'POST', { email: 'login@example.test' }))
      .status,
    404,
  );
  const req = () =>
    new Request(origin + api + '/account/email-code', {
      method: 'POST',
      headers: { Origin: origin },
      body: '{}',
    });
  assert.equal(await sellerMail(req(), {}), null);
  for (const config of [
    { INTAKE_STAGING_MODE: 'TRUE' },
    { SELLER_STAGING_ORIGIN: 'https://preview.rwas-web.pages.dev' },
    { INTAKE_STAGING_MODE: 'true', SELLER_STAGING_ORIGIN: origin },
  ]) {
    assert.equal(
      (await sellerMail(req(), { SELLER_MAIL_VIA_PAGES: 'true', ...config }))
        .status,
      403,
    );
  }
  assert.equal(f.delivered.length, 0);
});

test('QA acceptance Pages mail preserves ordinary Auth0 email maintenance and baseline login without bypassing proof checks', async (t) => {
  const f = await fixture(t, { qaOnly: true, emailCodeEnabled: true });
  const raw = 'a'.repeat(40);
  await f.state({ legacyKey: digest(raw) });
  const before = await f.state();
  const send = (headers) => f.call('/account/email-code', 'POST', { email: 'ordinary-contact@example.test' }, headers);
  assert.equal((await send({})).status, 401);
  assert.equal((await send({ Authorization: 'Bearer ' + raw, 'X-RWAS-CSRF': 'c'.repeat(40) })).status, 403);
  assert.equal((await send({ Authorization: 'Bearer ' + raw, 'X-Clerk-Session-Token': 'ZmFrZQ.ZmFrZQ.ZmFrZQ' })).status, 403);
  assert.equal(f.delivered.length, 0);
  assert.deepEqual((await f.state()).profiles, before.profiles);
  assert.equal((await send({ Authorization: 'Bearer ' + raw })).status, 200);
  assert.equal(f.delivered.length, 1);
  assert.equal(f.delivered[0].purpose, 'email-change');
  assert.equal(f.delivered[0].to, 'ordinary-contact@example.test');
  assert.equal(f.outbound.length, 0, 'ordinary Auth0 maintenance must not invoke Clerk');
  const state = await f.state();
  assert.deepEqual(state.profiles, before.profiles, 'sending a contact code cannot change the account');
  assert.ok(state.codes[codeKey('ordinary-contact@example.test')]);
  const login = await f.call('/send-code', 'POST', { email: 'ordinary-login@example.test' });
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { ok: true, sent: true });
  assert.equal(f.delivered.length, 2);
  assert.equal(f.delivered[1].purpose, 'login');
  assert.equal((await f.call('/send-code', 'POST', { email: 'jerry+rwas-seller-qa-a-20261021-r1@rwas.team' })).status, 403);
  assert.equal(f.delivered.length, 2, 'QA aliases must use their bounded Clerk entry');
});

test('full Clerk production keeps login-code delivery disabled even if its baseline flag is enabled', async (t) => {
  const f = await fixture(t, { emailCodeEnabled: true });
  assert.equal((await f.call('/send-code', 'POST', { email: 'ordinary-login@example.test' })).status, 404);
  assert.equal(f.delivered.length, 0);
});
