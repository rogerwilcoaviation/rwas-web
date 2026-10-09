const ISSUER = 'https://clerk.rogerwilcoaviation.com';
const AUDIENCE = 'rwas-aircraft-seller-production';
const ORIGIN = 'https://www.rogerwilcoaviation.com';
const API = 'https://api.clerk.com/v1';

const reject = (status, message, authStage, extra = {}) =>
  Object.assign(new Error(message), { status, authStage, ...extra });

const decode = (value) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(
      atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4)),
      (character) => character.charCodeAt(0),
    );
  } catch {
    throw reject(401, 'Invalid Clerk session.', 'jwt-format');
  }
};

const decodeJson = (value) => {
  try {
    return JSON.parse(new TextDecoder().decode(decode(value)));
  } catch {
    throw reject(401, 'Invalid Clerk session.', 'jwt-format');
  }
};

async function readJson(
  response,
  unavailable = false,
  authStage = 'provider-response',
) {
  if (!response.ok)
    throw reject(
      unavailable || response.status >= 500 ? 503 : 401,
      unavailable || response.status >= 500
        ? 'Clerk is temporarily unavailable.'
        : 'Clerk session is no longer active.',
      authStage,
    );
  try {
    return await response.json();
  } catch {
    throw reject(503, 'Clerk returned an invalid response.', authStage);
  }
}

export function clerkProductionConfig(env, req) {
  if (env.CLERK_PRODUCTION_ENABLED !== 'true') return null;
  if (
    !env.CLERK_PRODUCTION_SECRET_KEY ||
    typeof env.CLERK_PRODUCTION_SECRET_KEY !== 'string' ||
    !env.CLERK_PRODUCTION_SECRET_KEY.startsWith('sk_live_') ||
    env.PUBLIC_LISTINGS_ENABLED !== 'false' ||
    new URL(req.url).origin !== ORIGIN
  )
    throw reject(
      503,
      'Production Clerk authentication is unavailable.',
      'runtime-config',
    );
  return { issuer: ISSUER, audience: AUDIENCE, origin: ORIGIN };
}

async function providerGet(env, path, fetchImpl, authStage) {
  let response;
  try {
    response = await fetchImpl(API + path, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + env.CLERK_PRODUCTION_SECRET_KEY,
      },
    });
  } catch {
    throw reject(503, 'Clerk is temporarily unavailable.', authStage);
  }
  return readJson(response, false, authStage);
}

async function verifyJwt(token, fetchImpl) {
  const parts = token.split('.');
  if (parts.length !== 3)
    throw reject(401, 'Invalid Clerk session.', 'jwt-format');
  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]);
  if (
    header.alg !== 'RS256' ||
    typeof header.kid !== 'string' ||
    !header.kid ||
    header.kid.length > 256
  )
    throw reject(401, 'Invalid Clerk session.', 'jwt-header');
  let jwksResponse;
  try {
    jwksResponse = await fetchImpl(ISSUER + '/.well-known/jwks.json', {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw reject(503, 'Clerk is temporarily unavailable.', 'jwt-jwks');
  }
  const jwks = await readJson(jwksResponse, true, 'jwt-jwks');
  const candidates = Array.isArray(jwks.keys)
    ? jwks.keys.filter(
        (key) =>
          key?.kid === header.kid &&
          key.kty === 'RSA' &&
          key.alg === 'RS256' &&
          (!key.use || key.use === 'sig'),
      )
    : [];
  if (candidates.length !== 1)
    throw reject(401, 'Invalid Clerk session.', 'jwt-key');
  let key;
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      candidates[0],
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    throw reject(503, 'Clerk returned an invalid signing key.', 'jwt-key');
  }
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decode(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );
  if (!valid) throw reject(401, 'Invalid Clerk session.', 'jwt-signature');
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== ISSUER ||
    claims.aud !== AUDIENCE ||
    claims.azp !== ORIGIN ||
    !/^user_[A-Za-z0-9]+$/.test(claims.sub || '') ||
    !/^sess_[A-Za-z0-9]+$/.test(claims.sid || '') ||
    claims.act !== undefined ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    claims.iat > now + 30 ||
    claims.iat < now - 300 ||
    claims.exp <= now ||
    claims.exp > now + 8 * 86400 ||
    (claims.nbf !== undefined &&
      (!Number.isInteger(claims.nbf) || claims.nbf > now + 30))
  )
    throw reject(401, 'Invalid Clerk session.', 'jwt-claims');
  return claims;
}

export async function clerkProductionIdentity(env, req, fetchImpl = fetch) {
  if (!clerkProductionConfig(env, req))
    throw reject(
      404,
      'Production Clerk authentication disabled.',
      'runtime-config',
    );
  const origin = req.headers.get('Origin');
  const read = req.method === 'GET' || req.method === 'HEAD';
  if (
    (origin !== null && origin !== ORIGIN) ||
    (!read && origin !== ORIGIN) ||
    req.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    throw reject(403, 'Request origin rejected.', 'request-origin');
  const token = req.headers.get('X-Clerk-Session-Token');
  if (!token || token.length > 16384)
    throw reject(401, 'Clerk session required.', 'session-token');
  const claims = await verifyJwt(token, fetchImpl);
  const [session, user] = await Promise.all([
    providerGet(
      env,
      '/sessions/' + encodeURIComponent(claims.sid),
      fetchImpl,
      'provider-session',
    ),
    providerGet(
      env,
      '/users/' + encodeURIComponent(claims.sub),
      fetchImpl,
      'provider-user',
    ),
  ]);
  if (
    session.id !== claims.sid ||
    session.user_id !== claims.sub ||
    session.status !== 'active' ||
    !Number.isFinite(session.expire_at) ||
    session.expire_at <= Date.now()
  )
    throw reject(401, 'Clerk session is no longer active.', 'provider-session');
  const providerIdentity = { issuer: ISSUER, subject: claims.sub };
  if (user.id !== claims.sub)
    throw reject(503, 'Clerk returned an invalid user.', 'provider-user');
  if (user.banned === true || user.locked === true)
    throw reject(403, 'Account unavailable.', 'provider-account', {
      providerIdentity: { ...providerIdentity, blocked: true },
    });
  if (user.banned !== false || user.locked !== false)
    throw reject(403, 'Account unavailable.', 'provider-account');
  const primary = Array.isArray(user.email_addresses)
    ? user.email_addresses.filter(
        (entry) => entry?.id === user.primary_email_address_id,
      )
    : [];
  if (
    primary.length !== 1 ||
    primary[0].verification?.status !== 'verified' ||
    typeof primary[0].email_address !== 'string' ||
    !/^\S+@[^\s@]+\.[^\s@]+$/.test(primary[0].email_address)
  )
    throw reject(
      403,
      'A verified primary email is required.',
      'provider-email',
    );
  const passwordLastUpdatedAt = user.password_last_updated_at ?? null;
  if (
    passwordLastUpdatedAt !== null &&
    (!Number.isFinite(passwordLastUpdatedAt) || passwordLastUpdatedAt < 0)
  )
    throw reject(
      403,
      'Account password state is unavailable.',
      'provider-password-state',
    );
  return {
    ...providerIdentity,
    providerSessionId: claims.sid,
    providerSessionExpiresAt: session.expire_at,
    // Only the authenticated Backend API creation time can prove a fresh login.
    // JWT iat changes during token refresh and is not a session-generation proof.
    providerSessionCreatedAt:
      Number.isSafeInteger(session.created_at) &&
      session.created_at > 0 &&
      session.created_at <= Date.now()
        ? session.created_at
        : null,
    passwordLastUpdatedAt,
    email: primary[0].email_address.trim().toLowerCase(),
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
  };
}

export const CLERK_PRODUCTION = Object.freeze({
  issuer: ISSUER,
  audience: AUDIENCE,
  origin: ORIGIN,
});
