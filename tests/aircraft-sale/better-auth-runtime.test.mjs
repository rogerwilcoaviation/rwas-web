import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { fields, png, pdf, mp4 } from './fixture.mjs';

// Real local workerd + Better Auth + D1 + SQLite DO + R2. Every outbound
// request is intercepted. These are disposable fixtures, not hosted evidence.
test('actual Pages-to-Worker/D1 identity crosses the seller API, media and moderation journey', async () => {
  const origin = 'http://localhost';
  const qaA = 'jerry+rwas-seller-qa-a-20261021-r1@rwas.team';
  const qaB = 'jerry+rwas-seller-qa-b-20261021-r1@rwas.team';
  const qaChanged = 'jerry+rwas-seller-qa-a-email-20261021-r1@rwas.team';
  const googleTester = 'jchalsted@gmail.com';
  const mail = [];
  const bundle = (
    await build({
      entryPoints: ['workers/aircraft-sale/entry.mjs'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      conditions: ['workerd', 'worker', 'browser'],
      mainFields: ['module', 'main'],
      external: ['cloudflare:workers', 'node:*'],
      logLevel: 'silent',
    })
  ).outputFiles[0].text;
  const pages = await mkdtemp(join(tmpdir(), 'rwas-better-auth-pages-'));
  await mkdir(join(pages, '_worker.js'));
  await writeFile(
    join(pages, '_worker.js/index.js'),
    'export default { fetch() { return new Response("local-page-fixture"); } };',
  );
  await writeFile(
    join(pages, '_routes.json'),
    JSON.stringify({ version: 1, include: ['/*'], exclude: [] }),
  );
  execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', pages], {
    stdio: 'pipe',
  });
  let mf;
  const options = {
    workers: [
      {
        name: 'pages',
        modules: true,
        scriptPath: join(pages, '_worker.js/index.js'),
        modulesRoot: join(pages, '_worker.js'),
        modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
        compatibilityDate: '2026-09-01',
        serviceBindings: { SELLER_API: 'identity' },
      },
      {
        name: 'identity',
        // Native D1 support also contains an unused dynamic node:sqlite probe.
        // Declare the real bundle explicitly; no SDK code is patched or mocked.
        modules: [
          { type: 'ESModule', path: 'identity-entry.mjs', contents: bundle },
        ],
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
        d1Databases: ['SELLER_AUTH_DB'],
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
        },
        r2Buckets: ['MEDIA'],
        bindings: {
          BETTER_AUTH_ENABLED: 'true',
          BETTER_AUTH_QA_ENABLED: 'true',
          BETTER_AUTH_QA_EMAILS: [qaA, qaB, qaChanged, googleTester].join(','),
          AUTH_ISSUER: 'https://identity.fixture.test/',
          AUTH_CLIENT_ID: 'synthetic-public-client',
          AUTH_EVENT_SECRET: 'synthetic-event-secret-not-a-real-credential',
          AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
          AUTH_CONNECTIONS: JSON.stringify({
            password: 'fixture-database',
            google: 'google-oauth2',
          }),
          BETTER_AUTH_LOCAL: 'true',
          BETTER_AUTH_URL: origin,
          BETTER_AUTH_SECRET:
            'rwas-local-fixture-only-not-a-production-credential',
          RESEND_API_KEY: 'fixture-not-a-real-key',
          FROM_EMAIL: 'fixture@example.test',
          PUBLIC_LISTINGS_ENABLED: 'true',
          EMAIL_CODE_LOGIN_ENABLED: 'false',
          CLERK_PRODUCTION_ENABLED: 'true',
        },
        serviceBindings: {
          ADMIN_AUTH: async (request) =>
            request.headers.get('Authorization') ===
            'Bearer local-reviewer-fixture'
              ? Response.json({ actor: 'local-reviewer' })
              : new Response(null, { status: 403 }),
        },
        outboundService: async (request) => {
          assert.equal(
            request.url,
            'https://api.resend.com/emails',
            'No provider network is allowed.',
          );
          const value = await request.json();
          mail.push({
            to: value.to[0],
            link: value.text.match(/https?:\/\/\S+/)?.[0],
          });
          return Response.json({ id: 'local-mail-fixture' });
        },
      },
    ],
  };
  const jar = () => new Map();
  function retainCookies(response, cookies) {
    const values = response.headers.getSetCookie();
    for (const value of values) {
      const pair = value.split(';')[0];
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  async function call(
    path,
    { method = 'GET', body, cookies, seller, extra = {} } = {},
  ) {
    const response = await mf.dispatchFetch(
      origin + '/api/aircraft-sale' + path,
      {
        method,
        redirect: 'manual',
        headers: {
          Origin: origin,
          'CF-Connecting-IP': '192.0.2.1',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookies
            ? {
                Cookie: [...cookies]
                  .map(([key, value]) => key + '=' + value)
                  .join('; '),
              }
            : {}),
          ...(seller
            ? {
                Authorization: 'Bearer ' + seller.session,
                'X-RWAS-CSRF': seller.csrf,
              }
            : {}),
          ...extra,
        },
        ...(body !== undefined
          ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) }
          : {}),
      },
    );
    if (cookies) retainCookies(response, cookies);
    return response;
  }
  async function register(email) {
    const cookies = jar();
    let response = await call('/identity/sign-up/email', {
      method: 'POST',
      cookies,
      body: {
        name: 'Local fixture',
        email,
        password: 'local-fixture-password-2026',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await call('/auth/better-auth', { method: 'POST', cookies, body: {} }))
        .status,
      401,
    );
    const link = mail.findLast((item) => item.to === email)?.link;
    assert.ok(
      link,
      'Verification was delivered only to the intercepted fixture transport.',
    );
    response = await mf.dispatchFetch(link, { redirect: 'manual' });
    assert.ok([200, 302].includes(response.status));
    response = await call('/identity/sign-in/email', {
      method: 'POST',
      cookies,
      body: { email, password: 'local-fixture-password-2026' },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (
        await call('/identity/delete-user', {
          method: 'POST',
          cookies,
          body: { password: 'wrong-fixture-password' },
        })
      ).status,
      400,
      'Invalid deletion must not reserve this still-unadopted identity.',
    );
    assert.equal(
      (
        await call('/identity/delete-user', {
          method: 'POST',
          cookies,
          body: { password: 123 },
        })
      ).status,
      400,
    );
    response = await call('/auth/better-auth', {
      method: 'POST',
      cookies,
      body: {},
    });
    assert.equal(response.status, 200);
    const seller = await response.json();
    assert.ok(seller.session && seller.csrf);
    return { cookies, seller };
  }
  try {
    mf = new Miniflare(options);
    const database = await mf.getD1Database('SELLER_AUTH_DB', 'identity');
    const schema = await readFile(
      new URL(
        '../../workers/aircraft-sale/migrations/0001_seller_auth.sql',
        import.meta.url,
      ),
      'utf8',
    );
    for (const sql of schema
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean))
      await database.prepare(sql).run();
    const ordinaryMethods = await (await call('/auth/methods')).json();
    assert.deepEqual(ordinaryMethods.methods, ['password', 'google']);
    assert.equal(ordinaryMethods.betterAuth, undefined);
    const methods = await (
      await call('/auth/methods', {
        extra: { 'X-RWAS-Seller-QA': 'better-auth' },
      })
    ).json();
    assert.deepEqual(methods.methods, ['better-auth']);
    const mailBeforeDeniedSignup = mail.length;
    const deniedSignup = await call('/identity/sign-up/email', {
      method: 'POST',
      body: {
        name: 'Outside synthetic fixture',
        email: 'outside@example.test',
        password: 'local-fixture-password-2026',
      },
      extra: { 'X-RWAS-Seller-QA': 'better-auth' },
    });
    assert.equal(deniedSignup.status, 403);
    assert.equal((await deniedSignup.json()).code, 'QA_ACCOUNT_REQUIRED');
    assert.equal(mail.length, mailBeforeDeniedSignup);
    assert.equal(
      (await call('/auth/clerk-production/start', { method: 'POST', body: {} }))
        .status,
      404,
    );
    const a = await register(qaA);
    const b = await register(qaB);
    const auth = { cookies: a.cookies, seller: a.seller };
    const other = { cookies: b.cookies, seller: b.seller };
    // Fault injection touches only this disposable native D1 fixture. A real
    // formerly valid cookie/session must fail after its current identity leaves
    // the cohort; the public opt-in header cannot restore that eligibility.
    const userA = await database
      .prepare('SELECT id FROM user WHERE email = ?')
      .bind(qaA)
      .first();
    assert.ok(userA?.id);
    await database
      .prepare('UPDATE user SET email = ? WHERE id = ?')
      .bind('outside@example.test', userA.id)
      .run();
    try {
      assert.equal(
        (
          await call('/identity/get-session', {
            cookies: a.cookies,
            extra: { 'X-RWAS-Seller-QA': 'better-auth' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call('/auth/better-auth', {
            method: 'POST',
            cookies: a.cookies,
            body: {},
            extra: { 'X-RWAS-Seller-QA': 'better-auth' },
          })
        ).status,
        403,
      );
      assert.equal((await call('/account', auth)).status, 403);
    } finally {
      await database
        .prepare('UPDATE user SET email = ? WHERE id = ?')
        .bind(qaA, userA.id)
        .run();
    }
    assert.equal((await call('/account', auth)).status, 200);
    assert.equal(
      (await call('/draft', { ...auth, method: 'PUT', body: fields })).status,
      200,
    );
    assert.equal((await (await call('/draft', other)).json()).draft, null);
    let response = await call('/listings', {
      ...auth,
      method: 'POST',
      body: fields,
      extra: { 'Idempotency-Key': 'local-create' },
    });
    assert.equal(response.status, 201);
    let listing = (await response.json()).listing;
    assert.ok(listing.id);
    assert.equal(
      (
        await call('/listings/' + listing.id, {
          ...other,
          method: 'PUT',
          body: { model: 'forbidden' },
        })
      ).status,
      404,
    );
    response = await call('/listings/' + listing.id, {
      ...auth,
      method: 'PUT',
      body: { description: 'Updated local synthetic aircraft' },
    });
    assert.equal(response.status, 200);
    for (const [category, filename, contentType, bytes] of [
      ['photos', 'fixture.png', 'image/png', png],
      ['videos', 'fixture.mp4', 'video/mp4', mp4],
      ['airframe', 'fixture.pdf', 'application/pdf', pdf],
    ]) {
      response = await call(
        '/upload?listingId=' +
          listing.id +
          '&category=' +
          category +
          '&filename=' +
          filename,
        {
          ...auth,
          method: 'POST',
          body: bytes,
          extra: {
            'Content-Type': contentType,
            'Idempotency-Key':
              'rwas-upload-v1.' + Date.now() + '.' + crypto.randomUUID(),
          },
        },
      );
      assert.equal(response.status, 200);
      const file = (await response.json()).file;
      const path = '/files/' + encodeURIComponent(file.key);
      assert.equal((await call(path, other)).status, 404);
      assert.equal((await call(path)).status, 401);
      assert.equal((await call(path, auth)).status, 200);
    }
    listing = (await (await call('/my-listings', auth)).json()).listings[0];
    response = await call('/listing/' + listing.id + '/status', {
      ...auth,
      method: 'POST',
      body: { status: 'pending' },
    });
    assert.equal(response.status, 200);
    response = await call('/admin/review', {
      method: 'POST',
      body: {
        listingId: listing.id,
        revision: listing.revision,
        decision: 'approve',
      },
      extra: { Authorization: 'Bearer local-reviewer-fixture' },
    });
    assert.equal(response.status, 200);
    assert.equal((await call('/listing/' + listing.id)).status, 200);
    assert.equal((await (await call('/browse')).json()).listings.length, 1);
    response = await call('/admin/review', {
      method: 'POST',
      body: {
        listingId: listing.id,
        revision: listing.revision,
        decision: 'unpublish',
      },
      extra: { Authorization: 'Bearer local-reviewer-fixture' },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await call('/listing/' + listing.id)).status,
      401,
      'An unpublished listing requires authentication and is absent from the public catalog.',
    );
    assert.equal(
      (
        await call('/listing/' + listing.id + '/status', {
          ...auth,
          method: 'POST',
          body: { status: 'archived' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/listing/' + listing.id + '/status', {
          ...auth,
          method: 'POST',
          body: { status: 'restore' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/listing/' + listing.id + '/status', {
          ...auth,
          method: 'POST',
          body: { status: 'deleted' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/listing/' + listing.id + '/status', {
          ...auth,
          method: 'POST',
          body: { status: 'restore' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/listing/' + listing.id + '/status', {
          ...auth,
          method: 'POST',
          body: { status: 'deleted' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/listings/' + listing.id, {
          ...auth,
          method: 'DELETE',
          body: { confirm: listing.id },
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await mf.getR2Bucket('MEDIA', 'identity')).list()).objects.length,
      0,
    );
    const beforeReset = new Map(a.cookies);
    response = await call('/identity/request-password-reset', {
      method: 'POST',
      body: {
        email: qaA,
        redirectTo: origin + '/aircraft-for-sale?seller-auth=reset',
      },
    });
    assert.equal(response.status, 200);
    const reset = mail.findLast((item) => item.to === qaA)?.link;
    assert.ok(reset);
    const token = new URL(reset).pathname.split('/').at(-1);
    response = await call('/identity/reset-password', {
      method: 'POST',
      body: { token, newPassword: 'changed-local-fixture-password' },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await call('/account', { cookies: beforeReset, seller: a.seller }))
        .status,
      401,
    );
    assert.equal(
      (
        await call('/auth/better-auth', {
          cookies: beforeReset,
          method: 'POST',
          body: {},
        })
      ).status,
      401,
    );
    response = await call('/identity/reset-password', {
      method: 'POST',
      body: { token, newPassword: 'another-local-fixture-password' },
    });
    assert.ok(
      response.status >= 400,
      'A consumed reset token cannot be replayed.',
    );
    assert.equal((await call('/account', other)).status, 200);
    assert.equal(
      (await call('/logout', { ...other, method: 'POST', body: {} })).status,
      200,
    );
    assert.equal(
      (
        await call('/auth/better-auth', {
          cookies: b.cookies,
          method: 'POST',
          body: {},
        })
      ).status,
      401,
      'Logout must fence rebridging from its surviving identity session.',
    );
    response = await call('/identity/sign-in/email', {
      method: 'POST',
      cookies: b.cookies,
      body: {
        email: qaB,
        password: 'local-fixture-password-2026',
      },
    });
    assert.equal(response.status, 200);
    response = await call('/auth/better-auth', {
      cookies: b.cookies,
      method: 'POST',
      body: {},
    });
    assert.equal(response.status, 200);
    b.seller = await response.json();
    const renewed = { cookies: b.cookies, seller: b.seller };
    assert.equal(
      (
        await call('/identity/delete-user', {
          method: 'POST',
          cookies: b.cookies,
          body: { password: 'local-fixture-password-2026' },
        })
      ).status,
      409,
      'Identity deletion cannot orphan a linked business profile.',
    );
    assert.equal(
      (
        await call('/account', {
          ...renewed,
          method: 'DELETE',
          body: { confirm: qaB },
        })
      ).status,
      200,
    );
    response = await call('/auth/better-auth', {
      cookies: b.cookies,
      method: 'POST',
      body: {},
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'ACCOUNT_DELETION_PENDING');
    assert.equal(
      (
        await call('/identity/delete-user', {
          method: 'POST',
          cookies: b.cookies,
          body: { password: 'local-fixture-password-2026' },
        })
      ).status,
      200,
    );
    assert.equal((await call('/account', renewed)).status, 401);
    assert.equal(
      (
        await database
          .prepare('SELECT id FROM user WHERE email = ?')
          .bind(qaB)
          .all()
      ).results.length,
      0,
    );
    assert.equal(
      (
        await call('/_identity-deletion-intent', {
          method: 'POST',
          body: { issuer: 'rwas-better-auth', subject: 'forged' },
        })
      ).status,
      404,
    );
  } finally {
    await mf?.dispose();
    await rm(pages, { recursive: true, force: true });
  }
});
