import { betterAuth } from 'better-auth';
import { admin, twoFactor } from 'better-auth/plugins';
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getSessionFromCtx,
  isAPIError,
} from 'better-auth/api';
import { parseSetCookieHeader } from 'better-auth/cookies';
import { verifyJWT } from 'better-auth/crypto';
import {
  betterAuthQaEnabled,
  betterAuthQaEmails,
  betterAuthQaEmailAllowed,
} from './better-auth-qa.mjs';

export const SELLER_AUTH_PATH = '/api/aircraft-sale/identity';
export const SELLER_AUTH_ISSUER = 'rwas-better-auth';
const PRODUCTION_ORIGIN = 'https://www.rogerwilcoaviation.com';
const TWO_DAYS = 48 * 60 * 60;
const FRESH_SECONDS = 10 * 60;
const MFA_FAILURE_LIMIT = 10;
const MFA_LOCK_MS = 15 * 60 * 1000;
const instances = new WeakMap();
const TARGET_USER = 'X-RWAS-Identity-User';
const TARGET_SESSION = 'X-RWAS-Identity-Session';
const TARGET_CHALLENGE = 'X-RWAS-Identity-Challenge';
const PENDING_MFA = 'pending-mfa';
const MFA_VERIFY_PATHS = [
  '/two-factor/verify-totp',
  '/two-factor/verify-backup-code',
];

function assertAuthQaEmail(env, email) {
  if (!betterAuthQaEmailAllowed(env, email))
    throw new APIError('FORBIDDEN', {
      code: 'QA_ACCOUNT_REQUIRED',
      message: 'Use an approved seller test account for this QA release.',
    });
}

async function qaRequestPolicy(env, config, ctx) {
  if (!betterAuthQaEnabled(env)) return null;
  const current = await readCurrentSession(ctx);
  if (current) assertAuthQaEmail(env, current.user.email);
  for (const field of ['email', 'newEmail'])
    if (ctx.body?.[field] !== undefined)
      assertAuthQaEmail(env, ctx.body[field]);
  if (MFA_VERIFY_PATHS.includes(ctx.path) && !current) {
    const pending = await pendingMfaRecord(ctx);
    if (pending) {
      const user = await ctx.context.internalAdapter.findUserById(
        pending.value,
      );
      assertAuthQaEmail(env, user?.email);
    }
  }
  if (ctx.path === '/reset-password') {
    const token = ctx.body?.token || ctx.query?.token;
    const record =
      typeof token === 'string'
        ? await ctx.context.internalAdapter.findVerificationValue(
            `reset-password:${token}`,
          )
        : null;
    if (record) {
      const user = await ctx.context.internalAdapter.findUserById(record.value);
      assertAuthQaEmail(env, user?.email);
    }
  }
  if (ctx.path === '/verify-email' && typeof ctx.query?.token === 'string') {
    // A pre-QA verification/change-email link must not mutate an unrelated
    // identity. Official JWT verification only narrows eligibility here; the
    // normal endpoint still performs its complete token validation.
    const claims = await verifyJWT(ctx.query.token, ctx.context.secret);
    if (claims) {
      assertAuthQaEmail(env, claims.email);
      if (claims.updateTo !== undefined)
        assertAuthQaEmail(env, claims.updateTo);
    }
  }
  if (!ctx.body || typeof ctx.body !== 'object') return null;
  const body = { ...ctx.body };
  let changed = false;
  for (const field of [
    'callbackURL',
    'newUserCallbackURL',
    'errorCallbackURL',
    'redirectTo',
  ]) {
    if (typeof body[field] !== 'string') continue;
    let url;
    try {
      url = new URL(body[field], config.origin);
    } catch {
      continue;
    }
    if (url.origin === config.origin && url.pathname === '/aircraft-for-sale') {
      url.searchParams.set('seller-auth-qa', 'better-auth');
      body[field] = url.href;
      changed = true;
    }
  }
  return changed ? body : null;
}

function identityChanged() {
  return new APIError('CONFLICT', {
    code: 'IDENTITY_CHANGED',
    message:
      'Your sign-in changed. Reopen the account panel before continuing.',
  });
}

async function readCurrentSession(ctx) {
  ctx.context.session = null;
  return getSessionFromCtx(ctx, {
    disableCookieCache: true,
    disableRefresh: true,
  });
}

async function pendingMfaRecord(ctx) {
  const cookie = ctx.context.createAuthCookie('two_factor');
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!identifier || !identifier.startsWith('2fa-')) return null;
  const record =
    await ctx.context.internalAdapter.findVerificationValue(identifier);
  return record && new Date(record.expiresAt).getTime() > Date.now()
    ? record
    : null;
}

/** Target IDs are assertions, never authorization. Check them before effects. */
async function validateIdentityTarget(ctx) {
  const user = ctx.getHeader(TARGET_USER);
  const session = ctx.getHeader(TARGET_SESSION);
  const challenge = ctx.getHeader(TARGET_CHALLENGE);
  if (user === null && session === null && challenge === null) return null;
  if (!user || !session || user.length > 256 || session.length > 256)
    throw identityChanged();
  const current = await readCurrentSession(ctx);
  if (session === PENDING_MFA) {
    if (
      current ||
      !challenge ||
      challenge.length > 256 ||
      !MFA_VERIFY_PATHS.includes(ctx.path)
    )
      throw identityChanged();
    const pending = await pendingMfaRecord(ctx);
    if (!pending || pending.id !== challenge || pending.value !== user)
      throw identityChanged();
    return { pending: true, userId: user, challengeId: challenge };
  }
  if (
    challenge !== null ||
    !current ||
    current.user.id !== user ||
    current.session.id !== session
  )
    throw identityChanged();
  return { active: current, userId: user };
}

/** Runs after the official 2FA hook, so deleted pre-challenge sessions never leak. */
const identityTargetResponsePlugin = {
  id: 'rwas-identity-target',
  hooks: {
    after: [
      {
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          const result = ctx.context.returned;
          if (
            !result ||
            isAPIError(result) ||
            ['/delete-user', '/sign-out'].includes(ctx.path)
          )
            return;
          if (result.twoFactorRedirect === true) {
            // This cookie was generated by the immediately preceding official
            // plugin. Its bearer identifier stays server-only; expose row ID only.
            const cookieName = ctx.context.createAuthCookie('two_factor').name;
            const cookie = parseSetCookieHeader(
              ctx.context.responseHeaders?.get('set-cookie') || '',
            ).get(cookieName);
            const signed = cookie?.value;
            const identifier =
              typeof signed === 'string'
                ? signed.slice(0, signed.lastIndexOf('.'))
                : null;
            const pending = identifier?.startsWith('2fa-')
              ? await ctx.context.internalAdapter.findVerificationValue(
                  identifier,
                )
              : null;
            if (!pending || new Date(pending.expiresAt).getTime() <= Date.now())
              throw identityChanged();
            ctx.setHeader(TARGET_USER, pending.value);
            ctx.setHeader(TARGET_SESSION, PENDING_MFA);
            ctx.setHeader(TARGET_CHALLENGE, pending.id);
            return;
          }
          const issued = ctx.context.newSession;
          const current = issued?.session?.token
            ? await ctx.context.internalAdapter.findSession(
                issued.session.token,
              )
            : await readCurrentSession(ctx);
          if (!current) return;
          if (
            ctx.rwasIdentityTarget?.userId &&
            current.user.id !== ctx.rwasIdentityTarget.userId
          )
            throw identityChanged();
          ctx.setHeader(TARGET_USER, current.user.id);
          ctx.setHeader(TARGET_SESSION, current.session.id);
        }),
      },
    ],
  },
};

async function activeMfaAttempt(ctx) {
  const current = await getAuthoritativeSessionFromCtx(ctx);
  // The official plugin enforces its own account/challenge lockout when no
  // session exists. OAuth challenges instead start with an unverified session.
  if (!current) return null;
  const factor = await ctx.context.adapter.findOne({
    model: 'twoFactor',
    where: [{ field: 'userId', value: current.user.id }],
  });
  if (!factor) return null;
  if (factor.lockedUntil) {
    if (new Date(factor.lockedUntil).getTime() > Date.now())
      throw new APIError('TOO_MANY_REQUESTS', {
        code: 'ACCOUNT_TEMPORARILY_LOCKED',
        message:
          'Too many failed verification attempts. Please try again later.',
      });
    await ctx.context.adapter.incrementOne({
      model: 'twoFactor',
      where: [
        { field: 'id', value: factor.id },
        { field: 'lockedUntil', operator: 'lte', value: new Date() },
      ],
      increment: {},
      set: { failedVerificationCount: 0, lockedUntil: null },
    });
  }
  return { factorId: factor.id, userId: current.user.id };
}

async function finishActiveMfaAttempt(ctx, result) {
  // A before-hook's returned `context` merges into the endpoint context, not
  // the nested shared authentication context (Better Auth dispatch contract).
  const attempt = ctx.rwasActiveMfaAttempt;
  if (!attempt) return;
  if (isAPIError(result)) {
    if (!['INVALID_CODE', 'INVALID_BACKUP_CODE'].includes(result.body?.code))
      return;
    const updated = await ctx.context.adapter.incrementOne({
      model: 'twoFactor',
      where: [{ field: 'id', value: attempt.factorId }],
      increment: { failedVerificationCount: 1 },
    });
    if (updated && updated.failedVerificationCount >= MFA_FAILURE_LIMIT)
      await ctx.context.adapter.incrementOne({
        model: 'twoFactor',
        where: [
          { field: 'id', value: attempt.factorId },
          {
            field: 'failedVerificationCount',
            operator: 'gte',
            value: MFA_FAILURE_LIMIT,
          },
        ],
        increment: {},
        set: { lockedUntil: new Date(Date.now() + MFA_LOCK_MS) },
      });
    return;
  }
  if (typeof result?.token === 'string' && result.user?.id === attempt.userId)
    await ctx.context.adapter.update({
      model: 'twoFactor',
      where: [{ field: 'id', value: attempt.factorId }],
      update: { failedVerificationCount: 0, lockedUntil: null },
    });
}

function requiresMfa(user, adminUserIds) {
  return (
    user.twoFactorEnabled === true ||
    String(user.role || '')
      .split(',')
      .includes('admin') ||
    adminUserIds.includes(user.id)
  );
}

function verifiedMfa(session) {
  const at = new Date(session.mfaVerifiedAt || '').getTime();
  const issuedAt = new Date(session.createdAt).getTime();
  return Number.isFinite(at) && at >= issuedAt && at <= Date.now() + 30000;
}

function completeMfa(user, session) {
  return user.twoFactorEnabled === true && verifiedMfa(session);
}

function configurationError() {
  return Object.assign(new Error('Seller authentication is not configured.'), {
    status: 503,
  });
}

/** Public configuration only: never return credentials or provider secrets. */
export function sellerAuthConfig(env) {
  if (env.BETTER_AUTH_ENABLED !== 'true') return null;
  betterAuthQaEmails(env); // A malformed enabled cohort fails closed.
  let url;
  try {
    url = new URL(env.BETTER_AUTH_URL);
  } catch {
    throw configurationError();
  }
  const local =
    env.BETTER_AUTH_LOCAL === 'true' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (!local && url.origin !== PRODUCTION_ORIGIN) ||
    url.username ||
    url.password ||
    !['', '/'].includes(url.pathname) ||
    url.search ||
    url.hash ||
    typeof env.BETTER_AUTH_SECRET !== 'string' ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    (!local && env.BETTER_AUTH_SECRET.startsWith('rwas-local-fixture')) ||
    (!local &&
      (!env.RESEND_API_KEY ||
        !env.FROM_EMAIL ||
        /[\r\n]/.test(env.FROM_EMAIL))) ||
    !env.SELLER_AUTH_DB ||
    typeof env.SELLER_AUTH_DB.prepare !== 'function'
  )
    throw configurationError();
  const methods = ['password'];
  for (const [method, flag, id, secret] of [
    [
      'google',
      'BETTER_AUTH_GOOGLE_ENABLED',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
    ],
    [
      'apple',
      'BETTER_AUTH_APPLE_ENABLED',
      'APPLE_CLIENT_ID',
      'APPLE_CLIENT_SECRET',
    ],
  ]) {
    if (env[flag] !== 'true') continue;
    if (!env[id] || !env[secret]) throw configurationError();
    methods.push(method);
  }
  return Object.freeze({
    origin: url.origin,
    basePath: SELLER_AUTH_PATH,
    methods: Object.freeze(methods),
    sessionSeconds: TWO_DAYS,
    local,
  });
}

/** Verification/reset links go only to the configured issuing mail service. */
async function deliverAuthEmail(env, config, { kind, to, url }) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || /[\r\n]/.test(env.FROM_EMAIL))
    throw configurationError();
  const link = new URL(url);
  if (
    link.origin !== config.origin ||
    !link.pathname.startsWith(SELLER_AUTH_PATH + '/')
  )
    throw configurationError();
  const reset = kind === 'password-reset';
  const change = kind === 'email-change-confirmation';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject: reset
        ? 'Reset your RWAS seller password'
        : change
          ? 'Confirm your RWAS seller email change'
          : 'Verify your RWAS seller email',
      text: `${reset ? 'Reset your password' : change ? 'Confirm the request to change your email address' : 'Verify your email address'} using this link:\n\n${link.href}\n\nIf you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok)
    throw new Error('Seller authentication email could not be delivered.');
}

async function reserveIdentityDeletion(env, user) {
  if (!env.SELLER_STORE || typeof user?.id !== 'string' || !user.id)
    throw new APIError('SERVICE_UNAVAILABLE', {
      message: 'Account deletion is unavailable. Please try again later.',
    });
  let response;
  let denied = false;
  try {
    const stub = env.SELLER_STORE.get(env.SELLER_STORE.idFromName('seller-v2'));
    response = await stub.fetch(
      new Request(
        'https://seller-service.internal/api/aircraft-sale/_identity-deletion-intent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issuer: SELLER_AUTH_ISSUER,
            subject: user.id,
          }),
        },
      ),
    );
    if (response.ok) {
      const result = await response.json();
      if (result.allowed === true) return;
      denied = result.allowed === false;
    }
  } catch {}
  if (denied || response?.status === 409 || response?.status === 403)
    throw new APIError('CONFLICT', {
      message:
        'Delete your seller account and its listings before removing this sign-in.',
    });
  throw new APIError('SERVICE_UNAVAILABLE', {
    message: 'Account deletion is unavailable. Please try again later.',
  });
}

/**
 * The optional mailer is a local fixture transport, never an environment flag
 * that can bypass verification. Production uses the existing Resend binding.
 */
export function createSellerAuth(env, options = {}) {
  const config = sellerAuthConfig(env);
  if (!config) throw configurationError();
  if ((options.mailer || options.beforeDelete) && !config.local)
    throw configurationError();
  const signature = [
    'SELLER_AUTH_DB',
    'SELLER_STORE',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'BETTER_AUTH_LOCAL',
    'BETTER_AUTH_QA_ENABLED',
    'BETTER_AUTH_QA_EMAILS',
    'BETTER_AUTH_ADMIN_USER_IDS',
    'BETTER_AUTH_GOOGLE_ENABLED',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'BETTER_AUTH_APPLE_ENABLED',
    'APPLE_CLIENT_ID',
    'APPLE_CLIENT_SECRET',
    'RESEND_API_KEY',
    'FROM_EMAIL',
  ].map((key) => env[key]);
  const retained =
    !options.mailer && !options.beforeDelete && instances.get(env);
  if (
    retained &&
    retained.signature.every((value, index) => value === signature[index])
  )
    return retained.auth;
  const delivery =
    options.mailer || ((payload) => deliverAuthEmail(env, config, payload));
  const mailer = async (payload) => {
    assertAuthQaEmail(env, payload.to);
    return delivery(payload);
  };
  const socialProviders = {};
  if (config.methods.includes('google'))
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      includeGrantedScopes: false,
    };
  if (config.methods.includes('apple'))
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
    };
  const adminUserIds = String(env.BETTER_AUTH_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const auth = betterAuth({
    appName: 'RWAS Seller',
    baseURL: config.origin,
    basePath: SELLER_AUTH_PATH,
    secret: env.BETTER_AUTH_SECRET,
    database: env.SELLER_AUTH_DB,
    trustedOrigins: [
      config.origin,
      ...(config.methods.includes('apple')
        ? ['https://appleid.apple.com']
        : []),
    ],
    logger: { disabled: true },
    telemetry: { enabled: false },
    disabledPaths: [
      '/admin/create-user',
      '/admin/set-role',
      '/admin/set-user-password',
      '/admin/update-user',
      '/admin/remove-user',
      '/admin/impersonate-user',
      '/admin/stop-impersonating',
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 15 * 60,
      sendResetPassword: async ({ user, url }) =>
        mailer({ kind: 'password-reset', to: user.email, url }),
      customSyntheticUser: ({ coreFields, id }) => ({
        ...coreFields,
        twoFactorEnabled: false,
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null,
        id,
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 15 * 60,
      sendVerificationEmail: async ({ user, url }) =>
        mailer({ kind: 'verification', to: user.email, url }),
    },
    session: {
      expiresIn: TWO_DAYS,
      updateAge: 24 * 60 * 60,
      freshAge: FRESH_SECONDS,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerifiedAt: { type: 'date', required: false, input: false },
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    verification: { storeIdentifier: 'hashed' },
    user: {
      validateUserInfo: ({ user }) => {
        if (!betterAuthQaEmailAllowed(env, user.email))
          return {
            error: 'qa_account_required',
            errorDescription:
              'Use an approved seller test account for this QA release.',
          };
      },
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
        sendChangeEmailConfirmation: async ({ user, url }) =>
          mailer({ kind: 'email-change-confirmation', to: user.email, url }),
      },
      deleteUser: {
        enabled: true,
        // Library validation precedes this hook; invalid credentials never
        // reserve or fence an identity in the business store.
        beforeDelete:
          options.beforeDelete ||
          ((user) => reserveIdentityDeletion(env, user)),
      },
    },
    socialProviders,
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 3600, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: !config.local,
      cookiePrefix: 'rwas-seller',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            assertAuthQaEmail(env, user.email);
            return { data: user };
          },
        },
        update: {
          before: async (user) => {
            if (user.email !== undefined) assertAuthQaEmail(env, user.email);
            return { data: user };
          },
        },
      },
      account: {
        create: {
          before: async (account, ctx) => {
            if (betterAuthQaEnabled(env)) {
              const user = await ctx.context.internalAdapter.findUserById(
                account.userId,
              );
              assertAuthQaEmail(env, user?.email);
            }
            return { data: account };
          },
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            if (betterAuthQaEnabled(env)) {
              const user = await ctx.context.internalAdapter.findUserById(
                session.userId,
              );
              assertAuthQaEmail(env, user?.email);
            }
            return { data: { ...session, mfaVerifiedAt: null } };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const qaBody = await qaRequestPolicy(env, config, ctx);
        const target = await validateIdentityTarget(ctx);
        const policy = await (async () => {
          const path = ctx.path || '';
          if (
            [
              '/two-factor/verify-totp',
              '/two-factor/verify-backup-code',
            ].includes(path)
          ) {
            const attempt = await activeMfaAttempt(ctx);
            return attempt
              ? { context: { rwasActiveMfaAttempt: attempt } }
              : undefined;
          }
          const passwordChangePolicy =
            path === '/change-password'
              ? {
                  context: { body: { ...ctx.body, revokeOtherSessions: true } },
                }
              : undefined;
          if (
            [
              '/get-session',
              '/sign-out',
              '/request-password-reset',
              '/reset-password',
              '/verify-email',
              '/send-verification-email',
            ].includes(path) ||
            path.startsWith('/sign-in/') ||
            path.startsWith('/sign-up/') ||
            path.startsWith('/callback/')
          )
            return;
          const current = await getAuthoritativeSessionFromCtx(ctx);
          if (
            path.startsWith('/admin/') &&
            (!current || !adminUserIds.includes(current.user.id))
          )
            throw new APIError('FORBIDDEN', {
              message:
                'Identity administration is unavailable for this account.',
            });
          if (
            !current ||
            !requiresMfa(current.user, adminUserIds) ||
            completeMfa(current.user, current.session)
          )
            return passwordChangePolicy;
          // An administrator or OAuth-only user must be able to enroll an
          // authenticator before receiving any business or administration access.
          if (
            !current.user.twoFactorEnabled &&
            ['/two-factor/enable', '/two-factor/get-totp-uri'].includes(path)
          )
            return;
          throw new APIError('FORBIDDEN', {
            code: 'TWO_FACTOR_REQUIRED',
            message:
              'Verify your authenticator or backup code before continuing.',
          });
        })();
        return {
          context: {
            ...(target ? { rwasIdentityTarget: target } : {}),
            ...policy?.context,
            ...(qaBody
              ? { body: { ...qaBody, ...policy?.context?.body } }
              : {}),
          },
        };
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/get-session') {
          const current = ctx.context.returned;
          if (current?.session && current.user && !isAPIError(current))
            return ctx.json({
              ...current,
              session: {
                ...current.session,
                requiresMfa: requiresMfa(current.user, adminUserIds),
                ...(!current.user.twoFactorEnabled &&
                requiresMfa(current.user, adminUserIds)
                  ? { mfaVerifiedAt: null }
                  : {}),
              },
            });
          return;
        }
        if (
          ![
            '/two-factor/verify-totp',
            '/two-factor/verify-backup-code',
          ].includes(ctx.path)
        )
          return;
        const result = ctx.context.returned;
        await finishActiveMfaAttempt(ctx, result);
        if (
          !result ||
          isAPIError(result) ||
          typeof result.token !== 'string' ||
          !result.user?.id
        )
          return;
        // During enrollment the official plugin rotates the session. Prefer
        // exactly that new session; otherwise bind to the verified response.
        const issued = ctx.context.newSession;
        const token = issued?.session?.token || result.token;
        const current = await ctx.context.internalAdapter.findSession(token);
        if (!current || current.user.id !== result.user.id)
          throw new APIError('UNAUTHORIZED', {
            message: 'Authenticator session changed.',
          });
        await ctx.context.internalAdapter.updateSession(token, {
          mfaVerifiedAt: new Date(),
        });
      }),
    },
    plugins: [
      twoFactor({
        issuer: 'RWAS Seller',
        allowPasswordless: true,
        skipVerificationOnEnable: false,
      }),
      admin({ adminUserIds, defaultRole: 'user' }),
      identityTargetResponsePlugin,
    ],
  });
  if (!options.mailer && !options.beforeDelete)
    instances.set(env, { auth, signature });
  return auth;
}

/** Resolve a genuine DB-backed session on every protected seller request. */
export async function readBetterAuthIdentity(
  env,
  request,
  { recent = false } = {},
) {
  const config = sellerAuthConfig(env);
  if (!config) return null;
  const auth = createSellerAuth(env);
  let result;
  try {
    result = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
  } catch (error) {
    if (error?.body?.code === 'QA_ACCOUNT_REQUIRED')
      throw Object.assign(
        new Error('Use an approved seller test account for this QA release.'),
        {
          status: 403,
          code: 'QA_ACCOUNT_REQUIRED',
        },
      );
    // Library/API errors may carry string status names and arbitrary diagnostic
    // data. Business routes accept only our numeric, sanitized failure shape.
    throw configurationError();
  }
  if (
    !result?.session ||
    !result.user ||
    result.user.emailVerified !== true ||
    result.user.banned === true
  )
    return null;
  const adminUserIds = String(env.BETTER_AUTH_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (
    requiresMfa(result.user, adminUserIds) &&
    !completeMfa(result.user, result.session)
  )
    throw Object.assign(
      new Error('Verify your authenticator or backup code before continuing.'),
      { status: 403, code: 'TWO_FACTOR_REQUIRED' },
    );
  const createdAt = new Date(result.session.createdAt).getTime();
  const expiresAt = new Date(result.session.expiresAt).getTime();
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt > Date.now() + 30000 ||
    expiresAt <= Date.now() ||
    (recent && Date.now() - createdAt > FRESH_SECONDS * 1000)
  )
    return null;
  return {
    issuer: SELLER_AUTH_ISSUER,
    subject: result.user.id,
    providerSessionId: result.session.id,
    email: result.user.email,
    emailVerified: true,
    name: result.user.name || '',
    createdAt,
    expiresAt,
  };
}
