import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { getMigrations } from 'better-auth/db/migration';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import {
  createSellerAuth,
  readBetterAuthIdentity,
  sellerAuthConfig,
  SELLER_AUTH_PATH,
} from '../../workers/aircraft-sale/better-auth-service.mjs';

const fixturePassword = 'Local-only seller fixture password 20261022';
const replacementPassword = 'Local-only replacement fixture password 20261022';
const qaA = 'jerry+rwas-seller-qa-a-20261021-r1@rwas.team';
const qaB = 'jerry+rwas-seller-qa-b-20261021-r1@rwas.team';
const qaChanged = 'jerry+rwas-seller-qa-a-email-20261021-r1@rwas.team';

function responseTarget(response) {
  const target = {
    'X-RWAS-Identity-User': response.headers.get('X-RWAS-Identity-User'),
    'X-RWAS-Identity-Session': response.headers.get('X-RWAS-Identity-Session'),
  };
  assert.ok(target['X-RWAS-Identity-User']);
  assert.ok(target['X-RWAS-Identity-Session']);
  const challenge = response.headers.get('X-RWAS-Identity-Challenge');
  if (challenge) target['X-RWAS-Identity-Challenge'] = challenge;
  return target;
}

async function fixture() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("fixture"); } };',
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['SELLER_AUTH_DB'],
  });
  const db = await mf.getD1Database('SELLER_AUTH_DB');
  const sql = await readFile(
    new URL(
      '../../workers/aircraft-sale/migrations/0001_seller_auth.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.batch(
    sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => db.prepare(part)),
  );
  const env = {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: 'http://localhost',
    BETTER_AUTH_SECRET: 'rwas-local-fixture-only-never-production-20261022',
    SELLER_AUTH_DB: db,
  };
  const emails = [];
  const options = { mailer: async (payload) => emails.push(payload) };
  let auth = createSellerAuth(env, options);
  const jar = () => new Map();
  const headers = (cookies, extra = {}) => ({
    Origin: 'http://localhost',
    'CF-Connecting-IP': '192.0.2.10',
    ...(cookies?.size
      ? {
          Cookie: [...cookies]
            .map(([name, value]) => name + '=' + value)
            .join('; '),
        }
      : {}),
    ...extra,
  });
  const call = async (path, body, cookies = jar(), extra = {}) => {
    const response = await auth.handler(
      new Request(
        path.startsWith('http')
          ? path
          : 'http://localhost' + SELLER_AUTH_PATH + path,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: headers(cookies, {
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...extra,
          }),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      ),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';');
      const split = pair.indexOf('=');
      const name = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (
        attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute)) ||
        !value
      )
        cookies.delete(name);
      else cookies.set(name, value);
    }
    return response;
  };
  const identity = (cookies, options) =>
    readBetterAuthIdentity(
      env,
      new Request('http://localhost/api/aircraft-sale/account', {
        headers: headers(cookies),
      }),
      options,
    );
  const verifiedUser = async (email = 'seller-a@example.test') => {
    const cookies = jar();
    const signup = await call(
      '/sign-up/email',
      { name: 'Synthetic Seller', email, password: fixturePassword },
      cookies,
    );
    assert.equal(signup.status, 200);
    const user = (await signup.json()).user;
    const verification = emails.findLast(
      (item) => item.kind === 'verification' && item.to === email,
    );
    assert.ok(verification);
    const verified = await call(verification.url, undefined, cookies);
    assert.ok([200, 302].includes(verified.status));
    const login = await call(
      '/sign-in/email',
      { email, password: fixturePassword },
      cookies,
    );
    assert.equal(login.status, 200);
    return { cookies, user };
  };
  return {
    env,
    db,
    emails,
    call,
    identity,
    verifiedUser,
    jar,
    auth: () => auth,
    refresh: () => {
      auth = createSellerAuth(env, options);
    },
    close: () => mf.dispose(),
  };
}

test('configuration is fail-closed, provider opt-in explicit, sessions48h and schema matches actual1.7.12', async () => {
  const f = await fixture();
  try {
    assert.equal(sellerAuthConfig({}), null);
    assert.throws(
      () =>
        sellerAuthConfig({
          ...f.env,
          BETTER_AUTH_URL: 'https://attacker.example',
        }),
      { status: 503 },
    );
    assert.throws(
      () =>
        sellerAuthConfig({
          ...f.env,
          BETTER_AUTH_URL: 'https://www.rogerwilcoaviation.com',
        }),
      { status: 503 },
    );
    assert.throws(
      () => sellerAuthConfig({ ...f.env, BETTER_AUTH_GOOGLE_ENABLED: 'true' }),
      { status: 503 },
    );
    assert.deepEqual(sellerAuthConfig(f.env).methods, ['password']);
    assert.deepEqual(
      sellerAuthConfig({
        ...f.env,
        BETTER_AUTH_GOOGLE_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'local-client',
        GOOGLE_CLIENT_SECRET: 'local-not-a-real-secret',
      }).methods,
      ['password', 'google'],
    );
    const options = f.auth().options;
    assert.equal(options.session.expiresIn, 172800);
    assert.equal(options.session.cookieCache.enabled, false);
    assert.equal(options.emailAndPassword.revokeSessionsOnPasswordReset, true);
    assert.equal(options.account.accountLinking.enabled, false);
    assert.equal(options.account.encryptOAuthTokens, true);
    assert.equal(options.rateLimit.storage, 'database');
    f.env.BETTER_AUTH_GOOGLE_ENABLED = 'true';
    f.env.GOOGLE_CLIENT_ID = 'local-fixture-client';
    f.env.GOOGLE_CLIENT_SECRET = 'local-fixture-not-a-provider-secret';
    f.refresh();
    assert.equal(
      f.auth().options.socialProviders.google.includeGrantedScopes,
      false,
    );
    // URL assembly only: no browser grant, code exchange or provider request.
    const googleStart = await f.call('/sign-in/social', {
      provider: 'google',
      callbackURL: 'http://localhost/aircraft-for-sale',
      disableRedirect: true,
    });
    assert.equal(googleStart.status, 200);
    const googleUrl = new URL((await googleStart.json()).url);
    assert.equal(googleUrl.origin, 'https://accounts.google.com');
    assert.equal(googleUrl.searchParams.get('include_granted_scopes'), null);
    assert.deepEqual(googleUrl.searchParams.get('scope').split(' ').sort(), [
      'email',
      'openid',
      'profile',
    ]);
    const migration = await getMigrations(options);
    assert.equal(migration.toBeCreated.length, 0);
    assert.equal(migration.toBeAdded.length, 0);
    assert.equal(migration.schemaProblems.length, 0);
    for (const name of [
      'user',
      'session',
      'account',
      'verification',
      'twoFactor',
      'rateLimit',
    ])
      assert.ok(
        await f.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          )
          .bind(name)
          .first(),
      );
  } finally {
    await f.close();
  }
});

test('signup requires verified email, hashes passwords and does not reveal duplicate-account shape', async () => {
  const f = await fixture();
  try {
    const cookies = f.jar();
    const body = {
      name: 'Synthetic Seller',
      email: 'unverified@example.test',
      password: fixturePassword,
    };
    assert.equal(
      (
        await f.call(
          '/sign-up/email',
          { ...body, role: 'admin', twoFactorEnabled: true },
          cookies,
        )
      ).status,
      400,
    );
    const first = await f.call('/sign-up/email', body, cookies);
    assert.equal(first.status, 200);
    const initial = await first.json();
    assert.equal(initial.token, null);
    assert.equal(initial.user.emailVerified, false);
    assert.equal(initial.user.role, 'user');
    assert.equal(initial.user.twoFactorEnabled, false);
    assert.equal(await f.identity(cookies), null);
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: body.email, password: fixturePassword },
          cookies,
        )
      ).status,
      403,
    );
    const duplicate = await f.call('/sign-up/email', body, f.jar());
    assert.equal(duplicate.status, 200);
    const generic = await duplicate.json();
    assert.deepEqual(
      Object.keys(generic.user).sort(),
      Object.keys(initial.user).sort(),
    );
    assert.equal(generic.token, null);
    const account = await f.db.prepare('SELECT password FROM account').first();
    assert.notEqual(account.password, fixturePassword);
    assert.ok(account.password.length > 64);
    assert.equal(
      f.emails.every((item) => item.kind === 'verification'),
      true,
    );
  } finally {
    await f.close();
  }
});

test('password recovery revokes every old session, reset replay fails, cookie changes do not authorize', async () => {
  const f = await fixture();
  try {
    const { cookies: a } = await f.verifiedUser();
    const b = f.jar();
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-a@example.test', password: fixturePassword },
          b,
        )
      ).status,
      200,
    );
    const originalA = new Map(a);
    const originalB = new Map(b);
    assert.ok(await f.identity(a));
    assert.ok(await f.identity(b));
    assert.equal(
      (
        await f.call(
          '/request-password-reset',
          {
            email: 'seller-a@example.test',
            redirectTo: 'http://localhost/aircraft-for-sale?seller-auth=reset',
          },
          a,
        )
      ).status,
      200,
    );
    const reset = f.emails.findLast((item) => item.kind === 'password-reset');
    assert.ok(reset);
    const token = new URL(reset.url).pathname.split('/').at(-1);
    assert.equal(
      (
        await f.call(
          '/reset-password',
          { token, newPassword: replacementPassword },
          f.jar(),
        )
      ).status,
      200,
    );
    assert.equal(await f.identity(originalA), null);
    assert.equal(await f.identity(originalB), null);
    assert.notEqual(
      (
        await f.call(
          '/reset-password',
          { token, newPassword: fixturePassword },
          f.jar(),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-a@example.test', password: fixturePassword },
          f.jar(),
        )
      ).status,
      401,
    );
    const fresh = f.jar();
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-a@example.test', password: replacementPassword },
          fresh,
        )
      ).status,
      200,
    );
    assert.ok(await f.identity(fresh));
    const corrupt = new Map(
      [...fresh].map(([key, value]) => [key, value + 'x']),
    );
    assert.equal(await f.identity(corrupt), null);
  } finally {
    await f.close();
  }
});

test('password change enforces other-session revocation on the server even when the client omits it', async () => {
  const f = await fixture();
  try {
    const { cookies: a } = await f.verifiedUser();
    const b = f.jar();
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-a@example.test', password: fixturePassword },
          b,
        )
      ).status,
      200,
    );
    assert.ok(await f.identity(b));
    assert.equal(
      (
        await f.call(
          '/change-password',
          {
            currentPassword: fixturePassword,
            newPassword: replacementPassword,
            revokeOtherSessions: false,
          },
          a,
        )
      ).status,
      200,
    );
    assert.equal(await f.identity(b), null);
    assert.ok(await f.identity(a));
  } finally {
    await f.close();
  }
});

test('real TOTP and backup-code flows mark only verified sessions; unverified sessions cannot bypass MFA', async () => {
  const f = await fixture();
  try {
    const { cookies, user } = await f.verifiedUser();
    const enabled = await f.call(
      '/two-factor/enable',
      { password: fixturePassword, method: 'totp' },
      cookies,
    );
    assert.equal(enabled.status, 200);
    const enrollment = await enabled.json();
    assert.ok(enrollment.totpURI);
    assert.ok(enrollment.backupCodes.length);
    const secret = new TextDecoder().decode(
      base32.decode(new URL(enrollment.totpURI).searchParams.get('secret')),
    );
    const storedFactor = await f.db
      .prepare('SELECT secret, backupCodes FROM twoFactor')
      .first();
    assert.equal(storedFactor.secret.includes(secret), false);
    assert.equal(
      storedFactor.backupCodes.includes(enrollment.backupCodes[0]),
      false,
    );
    const verified = await f.call(
      '/two-factor/verify-totp',
      { code: await createOTP(secret).totp() },
      cookies,
    );
    assert.equal(verified.status, 200);
    const identity = await f.identity(cookies);
    assert.equal(identity.subject, user.id);
    const session = await f.db
      .prepare('SELECT id, mfaVerifiedAt FROM session WHERE id=?')
      .bind(identity.providerSessionId)
      .first();
    assert.ok(session.mfaVerifiedAt);
    // Emulate a provider-issued session lacking factor verification. This is
    // a synthetic fixture for universal gating, not a claimed live OAuth test.
    await f.db
      .prepare('UPDATE session SET mfaVerifiedAt=NULL WHERE id=?')
      .bind(session.id)
      .run();
    const pending = await (
      await f.call('/get-session', undefined, cookies)
    ).json();
    assert.equal(pending.session.requiresMfa, true);
    await assert.rejects(f.identity(cookies), {
      status: 403,
      code: 'TWO_FACTOR_REQUIRED',
    });
    assert.equal(
      (
        await f.call(
          '/change-password',
          {
            currentPassword: fixturePassword,
            newPassword: replacementPassword,
          },
          cookies,
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.call('/two-factor/verify-totp', { code: 'not-a-code' }, cookies))
        .status,
      401,
    );
    await assert.rejects(f.identity(cookies), { status: 403 });
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(secret).totp() },
          cookies,
        )
      ).status,
      200,
    );
    assert.ok(await f.identity(cookies));
    await f.call('/sign-out', {}, cookies);
    const signin = await f.call(
      '/sign-in/email',
      { email: 'seller-a@example.test', password: fixturePassword },
      cookies,
    );
    assert.equal(signin.status, 200);
    assert.equal((await signin.json()).twoFactorRedirect, true);
    assert.equal(await f.identity(cookies), null);
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-backup-code',
          { code: enrollment.backupCodes[0] },
          cookies,
        )
      ).status,
      200,
    );
    assert.ok(await f.identity(cookies));
    await f.call('/sign-out', {}, cookies);
    await f.call(
      '/sign-in/email',
      { email: 'seller-a@example.test', password: fixturePassword },
      cookies,
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-backup-code',
          { code: enrollment.backupCodes[0] },
          cookies,
        )
      ).status,
      401,
    );
    assert.equal(await f.identity(cookies), null);
  } finally {
    await f.close();
  }
});

test('admin identity is exact-ID bound and MFA required; role spoofing and dangerous admin routes are denied', async () => {
  const f = await fixture();
  try {
    const { cookies, user } = await f.verifiedUser();
    await f.db
      .prepare('UPDATE user SET role=? WHERE id=?')
      .bind('admin', user.id)
      .run();
    assert.equal(
      (await f.call('/admin/list-users', undefined, cookies)).status,
      403,
    );
    f.env.BETTER_AUTH_ADMIN_USER_IDS = user.id;
    f.refresh();
    const pending = await (
      await f.call('/get-session', undefined, cookies)
    ).json();
    assert.equal(pending.session.requiresMfa, true);
    assert.equal(
      (await f.call('/admin/list-users', undefined, cookies)).status,
      403,
    );
    const enrolled = await (
      await f.call(
        '/two-factor/enable',
        { password: fixturePassword, method: 'totp' },
        cookies,
      )
    ).json();
    const secret = new TextDecoder().decode(
      base32.decode(new URL(enrolled.totpURI).searchParams.get('secret')),
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(secret).totp() },
          cookies,
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.call('/admin/list-users', undefined, cookies)).status,
      200,
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/disable',
          { password: fixturePassword },
          cookies,
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.call('/admin/list-users', undefined, cookies)).status,
      403,
    );
    await assert.rejects(f.identity(cookies), {
      status: 403,
      code: 'TWO_FACTOR_REQUIRED',
    });
    const afterDisable = await (
      await f.call('/get-session', undefined, cookies)
    ).json();
    assert.equal(afterDisable.session.requiresMfa, true);
    assert.equal(afterDisable.session.mfaVerifiedAt, null);
    const reenrolled = await (
      await f.call(
        '/two-factor/enable',
        { password: fixturePassword, method: 'totp' },
        cookies,
      )
    ).json();
    const replacementSecret = new TextDecoder().decode(
      base32.decode(new URL(reenrolled.totpURI).searchParams.get('secret')),
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(replacementSecret).totp() },
          cookies,
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.call('/admin/list-users', undefined, cookies)).status,
      200,
    );
    const other = await f.verifiedUser('seller-b@example.test');
    const oldOther = new Map(other.cookies);
    assert.equal(
      (
        await f.call(
          '/admin/ban-user',
          { userId: other.user.id, banReason: 'Synthetic moderation fixture' },
          cookies,
        )
      ).status,
      200,
    );
    assert.equal(await f.identity(oldOther), null);
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-b@example.test', password: fixturePassword },
          f.jar(),
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.call('/admin/unban-user', { userId: other.user.id }, cookies))
        .status,
      200,
    );
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-b@example.test', password: fixturePassword },
          f.jar(),
        )
      ).status,
      200,
    );
    for (const path of [
      '/admin/create-user',
      '/admin/set-role',
      '/admin/set-user-password',
      '/admin/remove-user',
      '/admin/impersonate-user',
    ])
      assert.equal((await f.call(path, {}, cookies)).status, 404);
  } finally {
    await f.close();
  }
});

test('OAuth-style active-session MFA has an account-level shared failure budget across IPs and factors', async () => {
  const f = await fixture();
  try {
    const { cookies } = await f.verifiedUser();
    const enrollment = await (
      await f.call(
        '/two-factor/enable',
        { password: fixturePassword, method: 'totp' },
        cookies,
      )
    ).json();
    const secret = new TextDecoder().decode(
      base32.decode(new URL(enrollment.totpURI).searchParams.get('secret')),
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(secret).totp() },
          cookies,
        )
      ).status,
      200,
    );
    const identity = await f.identity(cookies);
    await f.db
      .prepare('UPDATE session SET mfaVerifiedAt=NULL WHERE id=?')
      .bind(identity.providerSessionId)
      .run();
    for (let i = 0; i < 10; i++) {
      const path =
        i % 2 ? '/two-factor/verify-backup-code' : '/two-factor/verify-totp';
      const response = await f.call(
        path,
        { code: 'invalid-fixture-code' },
        cookies,
        { 'CF-Connecting-IP': '192.0.2.' + (50 + i) },
      );
      assert.equal(response.status, 401);
    }
    const locked = await f.db
      .prepare('SELECT failedVerificationCount, lockedUntil FROM twoFactor')
      .first();
    assert.equal(locked.failedVerificationCount, 10);
    assert.ok(new Date(locked.lockedUntil).getTime() > Date.now());
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(secret).totp() },
          cookies,
          { 'CF-Connecting-IP': '192.0.2.99' },
        )
      ).status,
      429,
    );
    await assert.rejects(f.identity(cookies), { status: 403 });
    await f.db
      .prepare('UPDATE twoFactor SET lockedUntil=?')
      .bind(new Date(Date.now() - 1000).toISOString())
      .run();
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-totp',
          { code: await createOTP(secret).totp() },
          cookies,
          { 'CF-Connecting-IP': '192.0.2.100' },
        )
      ).status,
      200,
    );
    const reset = await f.db
      .prepare('SELECT failedVerificationCount, lockedUntil FROM twoFactor')
      .first();
    assert.equal(reset.failedVerificationCount, 0);
    assert.equal(reset.lockedUntil, null);
    assert.ok(await f.identity(cookies));
  } finally {
    await f.close();
  }
});

test('email change verifies current and new addresses before changing the existing identity', async () => {
  const f = await fixture();
  try {
    const { cookies, user } = await f.verifiedUser();
    assert.equal(
      (
        await f.call(
          '/change-email',
          {
            newEmail: 'changed@example.test',
            callbackURL:
              'http://localhost/aircraft-for-sale?seller-auth=identity',
          },
          cookies,
        )
      ).status,
      200,
    );
    assert.equal((await f.identity(cookies)).email, 'seller-a@example.test');
    const confirmation = f.emails.findLast(
      (item) => item.kind === 'email-change-confirmation',
    );
    assert.equal(confirmation.to, 'seller-a@example.test');
    assert.ok(
      [200, 302].includes(
        (await f.call(confirmation.url, undefined, cookies)).status,
      ),
    );
    assert.equal((await f.identity(cookies)).email, 'seller-a@example.test');
    const verification = f.emails.findLast(
      (item) =>
        item.kind === 'verification' && item.to === 'changed@example.test',
    );
    assert.ok(verification);
    assert.ok(
      [200, 302].includes(
        (await f.call(verification.url, undefined, cookies)).status,
      ),
    );
    const updated = await f.identity(cookies);
    assert.equal(updated.email, 'changed@example.test');
    assert.equal(updated.subject, user.id);
  } finally {
    await f.close();
  }
});

test('authoritative session reads enforce actual freshness and exact revocation without cookie-cache authorization', async () => {
  const f = await fixture();
  try {
    const startedAt = Date.now();
    const { cookies: a } = await f.verifiedUser();
    const finishedAt = Date.now();
    const b = f.jar();
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          { email: 'seller-a@example.test', password: fixturePassword },
          b,
        )
      ).status,
      200,
    );
    const identityA = await f.identity(a, { recent: true });
    const identityB = await f.identity(b);
    assert.ok(identityA);
    assert.ok(
      identityA.createdAt >= startedAt && identityA.createdAt <= finishedAt,
      'session creation occurred within the observed signup/login window',
    );
    assert.ok(
      identityA.expiresAt >= startedAt + 172800000 &&
        identityA.expiresAt <= finishedAt + 172800000,
      'session expiry is 48 hours from its actual creation operation',
    );
    const sessions = await (
      await f.call('/list-sessions', undefined, a)
    ).json();
    const otherSession = sessions.find(
      (item) => item.id === identityB.providerSessionId,
    );
    assert.ok(otherSession);
    assert.equal(
      (await f.call('/revoke-session', { token: otherSession.token }, a))
        .status,
      200,
    );
    assert.equal(await f.identity(b), null);
    assert.ok(await f.identity(a));
    await f.db
      .prepare('UPDATE session SET createdAt=? WHERE id=?')
      .bind(
        new Date(Date.now() - 601000).toISOString(),
        identityA.providerSessionId,
      )
      .run();
    assert.equal(await f.identity(a, { recent: true }), null);
    assert.ok(await f.identity(a));
    const oldA = new Map(a);
    assert.equal((await f.call('/sign-out', {}, a)).status, 200);
    assert.equal(await f.identity(oldA), null);
  } finally {
    await f.close();
  }
});

test('untrusted-origin writes, external callbacks and repeated failed logins are rejected', async () => {
  const f = await fixture();
  try {
    const { cookies } = await f.verifiedUser();
    assert.equal(
      (
        await f.call(
          '/change-password',
          {
            currentPassword: fixturePassword,
            newPassword: replacementPassword,
          },
          cookies,
          { Origin: 'https://attacker.example' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.call(
          '/sign-in/email',
          {
            email: 'seller-a@example.test',
            password: fixturePassword,
            callbackURL: 'https://attacker.example',
          },
          f.jar(),
        )
      ).status,
      403,
    );
    let last;
    for (let i = 0; i < 6; i++)
      last = await f.call(
        '/sign-in/email',
        { email: 'seller-a@example.test', password: 'wrong-local-password' },
        f.jar(),
        { 'CF-Connecting-IP': '192.0.2.42' },
      );
    assert.equal(last.status, 429);
    assert.ok(
      await f.db
        .prepare('SELECT count(*) AS count FROM rateLimit')
        .first('count'),
    );
  } finally {
    await f.close();
  }
});

test('identity deletion reserves business ownership only after valid credentials, and fails closed on denied/uncertain reservations', async () => {
  const f = await fixture();
  try {
    const { cookies, user } = await f.verifiedUser();
    let calls = 0;
    let status = 409;
    let allowed = false;
    f.env.SELLER_STORE = {
      idFromName: (name) => name,
      get: (name) => {
        assert.equal(name, 'seller-v2');
        return {
          fetch: async (request) => {
            calls++;
            assert.equal(
              new URL(request.url).pathname,
              '/api/aircraft-sale/_identity-deletion-intent',
            );
            assert.deepEqual(await request.json(), {
              issuer: 'rwas-better-auth',
              subject: user.id,
            });
            return Response.json({ allowed }, { status });
          },
        };
      },
    };
    assert.equal(
      (
        await f.call(
          '/delete-user',
          { password: 'wrong-local-password' },
          cookies,
        )
      ).status,
      400,
    );
    assert.equal(
      (await f.call('/delete-user', { password: 123 }, cookies)).status,
      400,
    );
    assert.equal(calls, 0);
    assert.equal(
      (await f.call('/delete-user', { password: fixturePassword }, cookies))
        .status,
      409,
    );
    assert.equal(calls, 1);
    assert.ok(await f.identity(cookies));
    status = 200;
    assert.equal(
      (await f.call('/delete-user', { password: fixturePassword }, cookies))
        .status,
      409,
    );
    assert.equal(calls, 2);
    assert.ok(await f.identity(cookies));
    status = 503;
    assert.equal(
      (await f.call('/delete-user', { password: fixturePassword }, cookies))
        .status,
      503,
    );
    assert.equal(calls, 3);
    assert.ok(await f.identity(cookies));
    status = 200;
    allowed = true;
    const old = new Map(cookies);
    assert.equal(
      (await f.call('/delete-user', { password: fixturePassword }, cookies))
        .status,
      200,
    );
    assert.equal(calls, 4);
    assert.equal(await f.identity(old), null);
    assert.equal(
      await f.db
        .prepare('SELECT id FROM user WHERE id=?')
        .bind(user.id)
        .first(),
      null,
    );
  } finally {
    await f.close();
  }
});

test('database failures expose only a sanitized numeric503 to business authorization', async () => {
  const f = await fixture();
  try {
    const { cookies } = await f.verifiedUser();
    await f.db.prepare('DROP TABLE session').run();
    await assert.rejects(
      f.identity(cookies),
      (error) =>
        error.status === 503 &&
        error.message === 'Seller authentication is not configured.',
    );
  } finally {
    await f.close();
  }
});

test('bound identity operations reject stale user or session before mutations and deletion reservations', async () => {
  const f = await fixture();
  try {
    const a = await f.verifiedUser('binding-a@example.test');
    const b = await f.verifiedUser('binding-b@example.test');
    const targetA = responseTarget(
      await f.call('/get-session', undefined, a.cookies),
    );
    const targetB = responseTarget(
      await f.call('/get-session', undefined, b.cookies),
    );
    let reservations = 0;
    f.env.SELLER_STORE = {
      idFromName: (name) => name,
      get: () => ({
        fetch: async () => {
          reservations++;
          return Response.json({ allowed: true });
        },
      }),
    };
    for (const [path, body] of [
      ['/update-user', { name: 'Wrong identity mutation' }],
      [
        '/change-password',
        { currentPassword: fixturePassword, newPassword: replacementPassword },
      ],
      ['/change-email', { newEmail: 'wrong-target@example.test' }],
      ['/two-factor/enable', { password: fixturePassword, method: 'totp' }],
      ['/revoke-sessions', {}],
      ['/delete-user', { password: fixturePassword }],
    ]) {
      const response = await f.call(path, body, b.cookies, targetA);
      assert.equal(response.status, 409, path);
      assert.equal((await response.json()).code, 'IDENTITY_CHANGED', path);
    }
    assert.equal(reservations, 0);
    assert.equal((await f.identity(b.cookies)).subject, b.user.id);
    assert.equal(
      (
        await f.db
          .prepare('SELECT name FROM user WHERE id=?')
          .bind(b.user.id)
          .first()
      ).name,
      'Synthetic Seller',
    );
    assert.equal(
      await f.db
        .prepare('SELECT count(*) AS count FROM twoFactor')
        .first('count'),
      0,
    );
    for (const partial of [
      { 'X-RWAS-Identity-User': b.user.id },
      { 'X-RWAS-Identity-Session': targetB['X-RWAS-Identity-Session'] },
      { 'X-RWAS-Identity-Challenge': 'not-a-challenge' },
    ]) {
      const response = await f.call(
        '/get-session',
        undefined,
        b.cookies,
        partial,
      );
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'IDENTITY_CHANGED');
    }
    const changed = await f.call(
      '/update-user',
      { name: 'Bound Seller' },
      b.cookies,
      targetB,
    );
    assert.equal(changed.status, 200);
    assert.deepEqual(responseTarget(changed), targetB);
    const secondLogin = await f.call(
      '/sign-in/email',
      { email: 'binding-b@example.test', password: fixturePassword },
      b.cookies,
    );
    assert.equal(secondLogin.status, 200);
    const freshTarget = responseTarget(secondLogin);
    assert.equal(freshTarget['X-RWAS-Identity-User'], b.user.id);
    assert.notEqual(
      freshTarget['X-RWAS-Identity-Session'],
      targetB['X-RWAS-Identity-Session'],
    );
    assert.equal(
      (await f.call('/list-sessions', undefined, b.cookies, targetB)).status,
      409,
    );
    assert.equal(
      (await f.call('/get-session', undefined, b.cookies, freshTarget)).status,
      200,
    );
    assert.equal(
      (
        await f.call(
          '/delete-user',
          { password: fixturePassword },
          b.cookies,
          freshTarget,
        )
      ).status,
      200,
    );
    assert.equal(reservations, 1);
  } finally {
    await f.close();
  }
});

test('pending MFA is pinned to the exact sign-in response and enrollment rotation returns the new session target', async () => {
  const f = await fixture();
  try {
    const a = await f.verifiedUser('pending-a@example.test');
    const b = await f.verifiedUser('pending-b@example.test');
    const enroll = async (account) => {
      const target = responseTarget(
        await f.call('/get-session', undefined, account.cookies),
      );
      const enabled = await f.call(
        '/two-factor/enable',
        { password: fixturePassword, method: 'totp' },
        account.cookies,
        target,
      );
      assert.equal(enabled.status, 200);
      const details = await enabled.json();
      const secret = new TextDecoder().decode(
        base32.decode(new URL(details.totpURI).searchParams.get('secret')),
      );
      const verified = await f.call(
        '/two-factor/verify-totp',
        { code: await createOTP(secret).totp() },
        account.cookies,
        target,
      );
      assert.equal(verified.status, 200);
      const rotated = responseTarget(verified);
      assert.equal(rotated['X-RWAS-Identity-User'], account.user.id);
      assert.notEqual(
        rotated['X-RWAS-Identity-Session'],
        target['X-RWAS-Identity-Session'],
      );
      assert.equal(
        (await f.call('/get-session', undefined, account.cookies, target))
          .status,
        409,
      );
      assert.equal(
        (await f.call('/get-session', undefined, account.cookies, rotated))
          .status,
        200,
      );
      return { details, secret, target: rotated };
    };
    const enrolledA = await enroll(a);
    const enrolledB = await enroll(b);
    const pendingLogin = async (account, email, ip) => {
      await f.call('/sign-out', {}, account.cookies);
      const response = await f.call(
        '/sign-in/email',
        { email, password: fixturePassword },
        account.cookies,
        { 'CF-Connecting-IP': ip },
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).twoFactorRedirect, true);
      const target = responseTarget(response);
      assert.equal(target['X-RWAS-Identity-User'], account.user.id);
      assert.equal(target['X-RWAS-Identity-Session'], 'pending-mfa');
      assert.ok(target['X-RWAS-Identity-Challenge']);
      assert.equal(await f.identity(account.cookies), null);
      return target;
    };
    const targetA = await pendingLogin(
      a,
      'pending-a@example.test',
      '192.0.2.41',
    );
    // The current B session must never verify or mutate on behalf of pending A.
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-backup-code',
          { code: enrolledA.details.backupCodes[0] },
          b.cookies,
          targetA,
        )
      ).status,
      409,
    );
    const targetB = await pendingLogin(
      b,
      'pending-b@example.test',
      '192.0.2.42',
    );
    assert.notEqual(
      targetB['X-RWAS-Identity-Challenge'],
      targetA['X-RWAS-Identity-Challenge'],
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-backup-code',
          { code: enrolledA.details.backupCodes[0] },
          b.cookies,
          targetA,
        )
      ).status,
      409,
    );
    const newerA = await pendingLogin(
      a,
      'pending-a@example.test',
      '192.0.2.43',
    );
    assert.notEqual(
      newerA['X-RWAS-Identity-Challenge'],
      targetA['X-RWAS-Identity-Challenge'],
    );
    assert.equal(
      (
        await f.call(
          '/two-factor/verify-backup-code',
          { code: enrolledA.details.backupCodes[0] },
          a.cookies,
          targetA,
        )
      ).status,
      409,
    );
    assert.equal(
      await f.db
        .prepare('SELECT sum(failedVerificationCount) AS count FROM twoFactor')
        .first('count'),
      0,
    );
    const verified = await f.call(
      '/two-factor/verify-backup-code',
      { code: enrolledA.details.backupCodes[0] },
      a.cookies,
      { ...newerA, 'CF-Connecting-IP': '192.0.2.44' },
    );
    assert.equal(verified.status, 200);
    const signedIn = responseTarget(verified);
    assert.equal(signedIn['X-RWAS-Identity-User'], a.user.id);
    assert.notEqual(signedIn['X-RWAS-Identity-Session'], 'pending-mfa');
    assert.equal(signedIn['X-RWAS-Identity-Challenge'], undefined);
    assert.equal((await f.identity(a.cookies)).subject, a.user.id);
    assert.equal(
      (await f.call('/get-session', undefined, a.cookies, signedIn)).status,
      200,
    );
    assert.ok(enrolledB.secret);
  } finally {
    await f.close();
  }
});

test('QA cohort gates password ingress, existing sessions, old recovery links and email changes before identity effects', async () => {
  const f = await fixture();
  try {
    const outside = await f.verifiedUser('ordinary@example.test');
    await f.call(
      '/request-password-reset',
      { email: outside.user.email },
      f.jar(),
    );
    const oldReset = f.emails.findLast(
      (item) => item.kind === 'password-reset',
    );
    const oldResetToken = new URL(oldReset.url).pathname.split('/').at(-1);
    const oldPasswordHash = await f.db
      .prepare('SELECT password FROM account WHERE userId=?')
      .bind(outside.user.id)
      .first('password');
    const oldVerify = f.emails.find(
      (item) => item.kind === 'verification' && item.to === outside.user.email,
    );
    f.env.BETTER_AUTH_QA_ENABLED = 'true';
    f.env.BETTER_AUTH_QA_EMAILS = ` ${qaA.toUpperCase()} , ${qaB}, ${qaChanged} `;
    f.refresh();
    assert.throws(
      () =>
        sellerAuthConfig({ ...f.env, BETTER_AUTH_QA_EMAILS: '*@rwas.team' }),
      { status: 503 },
    );
    const emailsBefore = f.emails.length;
    for (const [path, body] of [
      [
        '/sign-up/email',
        {
          name: 'Outside',
          email: 'not-allowed@example.test',
          password: fixturePassword,
        },
      ],
      [
        '/sign-in/email',
        { email: outside.user.email, password: fixturePassword },
      ],
      ['/request-password-reset', { email: outside.user.email }],
      ['/send-verification-email', { email: outside.user.email }],
      [
        '/reset-password',
        { token: oldResetToken, newPassword: replacementPassword },
      ],
    ]) {
      const response = await f.call(path, body, f.jar());
      assert.equal(response.status, 403, path);
      assert.equal((await response.json()).code, 'QA_ACCOUNT_REQUIRED', path);
    }
    assert.equal((await f.call(oldVerify.url, undefined, f.jar())).status, 403);
    assert.equal(
      (await f.call('/update-user', { name: 'Forbidden' }, outside.cookies))
        .status,
      403,
    );
    await assert.rejects(f.identity(outside.cookies), {
      status: 403,
      code: 'QA_ACCOUNT_REQUIRED',
    });
    assert.equal(f.emails.length, emailsBefore);
    assert.equal(
      await f.db
        .prepare('SELECT password FROM account WHERE userId=?')
        .bind(outside.user.id)
        .first('password'),
      oldPasswordHash,
    );
    assert.equal(
      await f.db.prepare('SELECT count(*) AS count FROM user').first('count'),
      1,
    );
    const qa = await f.verifiedUser(qaA);
    assert.equal((await f.identity(qa.cookies)).subject, qa.user.id);
    assert.equal(
      (
        await f.call(
          '/change-email',
          { newEmail: 'outside-change@example.test' },
          qa.cookies,
        )
      ).status,
      403,
    );
    const changed = await f.call(
      '/change-email',
      {
        newEmail: qaChanged,
        callbackURL: 'http://localhost/aircraft-for-sale?seller-auth=identity',
      },
      qa.cookies,
    );
    assert.equal(changed.status, 200);
    const confirmation = f.emails.findLast(
      (item) => item.kind === 'email-change-confirmation',
    );
    const callback = new URL(confirmation.url).searchParams.get('callbackURL');
    assert.equal(
      new URL(callback).searchParams.get('seller-auth-qa'),
      'better-auth',
    );
    assert.ok(
      [200, 302].includes(
        (await f.call(confirmation.url, undefined, qa.cookies)).status,
      ),
    );
    const verifyNew = f.emails.findLast(
      (item) => item.kind === 'verification' && item.to === qaChanged,
    );
    assert.ok(
      [200, 302].includes(
        (await f.call(verifyNew.url, undefined, qa.cookies)).status,
      ),
    );
    assert.equal((await f.identity(qa.cookies)).subject, qa.user.id);
    assert.equal((await f.identity(qa.cookies)).email, qaChanged);
  } finally {
    await f.close();
  }
});

test('QA cohort gates the actual OAuth identity-token handler and returning non-cohort identities without a provider request', async () => {
  const f = await fixture();
  try {
    const outside = await f.verifiedUser(
      'existing-social-outside@example.test',
    );
    // Pre-existing provider mapping before the QA release, without a live
    // OAuth exchange. The actual guarded handler must refuse its next login.
    await f.db
      .prepare(
        'INSERT INTO account (id, accountId, providerId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        'local-existing-oauth-account',
        'synthetic-returning-outside-subject',
        'google',
        outside.user.id,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    f.env.BETTER_AUTH_QA_ENABLED = 'true';
    f.env.BETTER_AUTH_QA_EMAILS = `${qaA},${qaB},${qaChanged}`;
    f.refresh();
    const context = await f.auth().$context;
    let profile = {
      sub: 'synthetic-outside-subject',
      email: 'new-social-outside@example.test',
      name: 'Synthetic OAuth',
      email_verified: true,
    };
    // Explicit in-memory test dependency after context construction. The
    // production factory exposes no provider-verification bypass or env flag.
    context.socialProviders.push({
      id: 'google',
      name: 'Synthetic local provider',
      options: {
        verifyIdToken: async (token) => token === 'synthetic-local-id-token',
      },
      accountSubject: ({ profile }) => profile.sub,
      getUserInfo: async () => ({
        user: { name: profile.name, email: profile.email, emailVerified: true },
        data: { ...profile },
      }),
    });
    const signIn = () =>
      f.call(
        '/sign-in/social',
        { provider: 'google', idToken: { token: 'synthetic-local-id-token' } },
        f.jar(),
      );
    assert.equal((await signIn()).status, 403);
    assert.equal(
      await f.db.prepare('SELECT count(*) AS count FROM user').first('count'),
      1,
    );
    assert.equal(
      await f.db
        .prepare(
          "SELECT count(*) AS count FROM account WHERE providerId='google'",
        )
        .first('count'),
      1,
    );
    profile = { ...profile, sub: 'synthetic-qa-subject', email: qaA };
    const allowed = await signIn();
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).user.email, qaA);
    assert.equal(
      await f.db
        .prepare(
          "SELECT count(*) AS count FROM account WHERE providerId='google'",
        )
        .first('count'),
      2,
    );
    const sessionsBefore = await f.db
      .prepare('SELECT count(*) AS count FROM session')
      .first('count');
    profile = {
      ...profile,
      sub: 'synthetic-returning-outside-subject',
      email: outside.user.email,
    };
    assert.equal((await signIn()).status, 403);
    assert.equal(
      await f.db
        .prepare('SELECT count(*) AS count FROM session')
        .first('count'),
      sessionsBefore,
    );
    assert.equal(
      await f.db
        .prepare(
          "SELECT count(*) AS count FROM account WHERE providerId='google'",
        )
        .first('count'),
      2,
    );
  } finally {
    await f.close();
  }
});
