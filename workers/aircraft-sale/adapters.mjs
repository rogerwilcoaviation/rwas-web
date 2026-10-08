// Existing mail credentials may be bound only after rollout approval. No defaults.
export async function deliverCode(env, payload) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL)
    return new Response(null, { status: 503 });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [payload.to],
      subject: 'Your RWAS seller verification code',
      text:
        'Your code is ' +
        payload.code +
        '. It expires in 15 minutes. If you did not request this, ignore this email.',
    }),
  });
  return new Response(null, { status: response.ok ? 200 : 503 });
}
// Staff identities are verified cryptographically; an email header is never trusted.
// Access application/audience/reviewer settings require separate owner approval.
async function authorizeAccess(request, env, operator = false) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.REVIEWER_EMAILS)
    return new Response(null, { status: 503 });
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return new Response(null, { status: 403 });
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return new Response(null, { status: 403 });
    const [h, p, s] = parts;
    const decode = (v) =>
      Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      );
    const header = JSON.parse(new TextDecoder().decode(decode(h))),
      claim = JSON.parse(new TextDecoder().decode(decode(p)));
    const issuer = 'https://' + env.ACCESS_TEAM_DOMAIN;
    const authenticatedAt = claim.auth_time * 1000;
    if (
      (operator === true &&
        (!Number.isFinite(claim.auth_time) ||
          !Number.isFinite(authenticatedAt) ||
          authenticatedAt < Date.now() - 600000 ||
          authenticatedAt > Date.now() + 30000)) ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN) ||
      header.alg !== 'RS256' ||
      claim.iss !== issuer ||
      !Array.isArray(claim.aud) ||
      !claim.aud.includes(env.ACCESS_AUD) ||
      !Number.isFinite(claim.exp) ||
      claim.exp * 1000 <= Date.now() ||
      (claim.nbf && claim.nbf * 1000 > Date.now()) ||
      !env.REVIEWER_EMAILS.split(',')
        .map((x) => x.trim().toLowerCase())
        .includes(String(claim.email).toLowerCase())
    )
      return new Response(null, { status: 403 });
    const response = await fetch(issuer + '/cdn-cgi/access/certs');
    if (!response.ok) return new Response(null, { status: 503 });
    const jwk = (await response.json()).keys.find((k) => k.kid === header.kid);
    if (!jwk) return new Response(null, { status: 403 });
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(s),
      new TextEncoder().encode(h + '.' + p),
    );
    let accountAuthenticatedAt = null;
    if (valid && operator === 'accounts') {
      // Access application-token iat is issuance time. The authenticated identity
      // endpoint documents its iat as the user's login time. Bind that response
      // to the signed subject/email before using it for management freshness.
      // A lookup failure leaves reads available and management disabled.
      try {
        const identityResponse = await fetch(
          issuer + '/cdn-cgi/access/get-identity',
          {
            headers: { Cookie: 'CF_Authorization=' + jwt },
            // workerd supports manual/follow only. Never follow a redirect with
            // the authorization cookie; non-success responses remain read-only.
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
          },
        );
        const identity = identityResponse.ok
          ? await identityResponse.json()
          : null;
        if (
          identity &&
          typeof claim.sub === 'string' &&
          claim.sub &&
          typeof claim.email === 'string' &&
          identity.user_uuid === claim.sub &&
          typeof identity.email === 'string' &&
          identity.email.toLowerCase() === String(claim.email).toLowerCase() &&
          // Normal user identities omit optional service-token fields. A signed,
          // nonempty user subject bound to the returned UUID/email identifies
          // the user; explicit or malformed service-token indicators fail closed.
          (identity.service_token_status === false ||
            !Object.hasOwn(identity, 'service_token_status')) &&
          [undefined, null, ''].includes(identity.service_token_id) &&
          [undefined, null, ''].includes(claim.common_name) &&
          Number.isSafeInteger(identity.iat) &&
          identity.iat > 0 &&
          identity.iat * 1000 <= Date.now() + 30000
        )
          accountAuthenticatedAt = identity.iat * 1000;
      } catch {}
    }
    return valid
      ? Response.json(
          operator === 'accounts'
            ? {
                actor: claim.email,
                scope: 'seller-accounts',
                authenticatedAt: accountAuthenticatedAt,
                expiresAt: claim.exp * 1000,
              }
            : operator
              ? {
                  actor: claim.email,
                  scope: 'seller-security',
                  authenticatedAt,
                }
              : { actor: claim.email },
        )
      : new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 403 });
  }
}

export const authorizeReviewer = (request, env) =>
  authorizeAccess(request, env);
// A separate account-administrator audience never inherits reviewer/operator authority.
export function authorizeAccountAdministrator(request, env) {
  if (
    !env.ACCOUNT_ADMIN_ACCESS_AUD ||
    env.ACCOUNT_ADMIN_ACCESS_AUD === env.ACCESS_AUD ||
    env.ACCOUNT_ADMIN_ACCESS_AUD === env.OPERATOR_ACCESS_AUD
  )
    return new Response(null, { status: 503 });
  return authorizeAccess(
    request,
    {
      ACCESS_TEAM_DOMAIN: env.ACCOUNT_ADMIN_ACCESS_TEAM_DOMAIN,
      ACCESS_AUD: env.ACCOUNT_ADMIN_ACCESS_AUD,
      REVIEWER_EMAILS: env.ACCOUNT_ADMIN_EMAILS,
    },
    'accounts',
  );
}
// A distinct Access audience/allowlist; ordinary listing reviewers get no recovery authority.
export async function authorizeOperator(request, env) {
  if (!env.OPERATOR_ACCESS_AUD || env.OPERATOR_ACCESS_AUD === env.ACCESS_AUD)
    return new Response(null, { status: 503 });
  return authorizeAccess(
    request,
    {
      ACCESS_TEAM_DOMAIN: env.OPERATOR_ACCESS_TEAM_DOMAIN,
      ACCESS_AUD: env.OPERATOR_ACCESS_AUD,
      REVIEWER_EMAILS: env.OPERATOR_EMAILS,
    },
    true,
  );
}
