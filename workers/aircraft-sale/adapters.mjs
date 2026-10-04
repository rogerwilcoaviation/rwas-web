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
export async function authorizeReviewer(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.REVIEWER_EMAILS)
    return new Response(null, { status: 503 });
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return new Response(null, { status: 403 });
  try {
    const [h, p, s] = jwt.split('.');
    const decode = (v) =>
      Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      );
    const header = JSON.parse(new TextDecoder().decode(decode(h))),
      claim = JSON.parse(new TextDecoder().decode(decode(p)));
    const issuer = 'https://' + env.ACCESS_TEAM_DOMAIN;
    if (
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
    return valid
      ? Response.json({ actor: claim.email })
      : new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
