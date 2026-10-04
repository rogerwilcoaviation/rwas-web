// Hosted identity only: RWAS never receives or stores a user's password.
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const digest = async (value) => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
};
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export const randomProof = () =>
  encode(crypto.getRandomValues(new Uint8Array(32)));
export function identityConfig(env) {
  try {
    const issuer = new URL(env.AUTH_ISSUER),
      callback = new URL(env.AUTH_REDIRECT_URI);
    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.port ||
      issuer.search ||
      issuer.hash ||
      issuer.pathname !== '/' ||
      !env.AUTH_CLIENT_ID ||
      env.AUTH_CLIENT_ID.length > 200
    )
      return null;
    if (
      (callback.protocol !== 'https:' &&
        !(
          callback.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(callback.hostname)
        )) ||
      callback.username ||
      callback.password ||
      callback.search ||
      callback.hash ||
      callback.pathname !== '/aircraft-for-sale'
    )
      return null;
    const connections = JSON.parse(env.AUTH_CONNECTIONS || '{}');
    const methods = {};
    for (const method of ['password', 'google', 'apple'])
      if (
        typeof connections[method] === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(connections[method]) &&
        (method !== 'password' ||
          (typeof env.AUTH_EVENT_SECRET === 'string' &&
            env.AUTH_EVENT_SECRET.length >= 32))
      )
        methods[method] = connections[method];
    return {
      issuer: issuer.href,
      callback: callback.href,
      origin: callback.origin,
      clientId: env.AUTH_CLIENT_ID,
      methods,
    };
  } catch {
    return null;
  }
}
export async function authorizationUrl(config, transaction) {
  const challenge = encode(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(transaction.verifier),
      ),
    ),
  );
  const url = new URL('authorize', config.issuer);
  for (const [key, value] of Object.entries({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.callback,
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    connection: config.methods[transaction.method],
    prompt: 'login',
  }))
    url.searchParams.set(key, value);
  return url.href;
}
async function providerFetch(env, request) {
  try {
    const response = await (env.AUTH_PROVIDER
      ? env.AUTH_PROVIDER.fetch(request)
      : fetch(request));
    return response;
  } catch {
    fail(503, 'Sign-in provider is unavailable. Please try again.');
  }
}
export async function exchangeIdentity(env, config, transaction, code) {
  if (typeof code !== 'string' || !code || code.length > 2048)
    fail(400, 'Invalid sign-in response.');
  const response = await providerFetch(
    env,
    new Request(new URL('oauth/token', config.issuer), {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        code_verifier: transaction.verifier,
        redirect_uri: config.callback,
      }),
    }),
  );
  if (!response.ok)
    fail(
      response.status >= 500 ? 503 : 400,
      'Sign-in was not completed. Please try again.',
    );
  let raw;
  try {
    raw = (await response.json()).id_token;
  } catch {
    fail(400, 'Invalid sign-in response.');
  }
  if (
    typeof raw !== 'string' ||
    raw.length > 16384 ||
    raw.split('.').length !== 3
  )
    fail(400, 'Invalid identity token.');
  try {
    const [h, p, s] = raw.split('.');
    const decode = (value) =>
      Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (x) =>
        x.charCodeAt(0),
      );
    const header = JSON.parse(new TextDecoder().decode(decode(h))),
      claims = JSON.parse(new TextDecoder().decode(decode(p)));
    const now = Date.now() / 1000;
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      header.kid.length > 200 ||
      claims.iss !== config.issuer ||
      !(
        claims.aud === config.clientId ||
        (Array.isArray(claims.aud) &&
          claims.aud.includes(config.clientId) &&
          claims.azp === config.clientId)
      ) ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      !Number.isFinite(claims.iat) ||
      claims.iat > now + 60 ||
      claims.iat < transaction.createdAt / 1000 - 60 ||
      (claims.nbf !== undefined &&
        (!Number.isFinite(claims.nbf) || claims.nbf > now + 60)) ||
      claims.nonce !== transaction.nonce ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      claims.sub.length > 500 ||
      claims.email_verified !== true ||
      typeof claims.email !== 'string' ||
      !/^\S+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
      claims.email.length > 254
    )
      fail(400, 'Verify your email with the sign-in provider and try again.');
    const certs = await providerFetch(
      env,
      new Request(new URL('.well-known/jwks.json', config.issuer), {
        signal: AbortSignal.timeout(10000),
      }),
    );
    if (!certs.ok)
      fail(503, 'Sign-in provider is unavailable. Please try again.');
    const jwk = (await certs.json()).keys.find(
      (key) =>
        key.kid === header.kid &&
        key.kty === 'RSA' &&
        (!key.use || key.use === 'sig') &&
        (!key.alg || key.alg === 'RS256'),
    );
    if (!jwk) fail(400, 'Invalid identity token.');
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    if (
      !(await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        decode(s),
        new TextEncoder().encode(h + '.' + p),
      ))
    )
      fail(400, 'Invalid identity token.');
    return {
      subject: claims.sub,
      email: claims.email.trim().toLowerCase(),
      name: typeof claims.name === 'string' ? claims.name.slice(0, 300) : '',
      issuer: config.issuer,
    };
  } catch (error) {
    if (error.status) throw error;
    fail(400, 'Invalid identity token.');
  }
}
export function logoutUrl(config) {
  const url = new URL('v2/logout', config.issuer);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('returnTo', config.callback);
  return url.href;
}
