import { deliverCode } from '../../workers/aircraft-sale/adapters.mjs';

export const SELLER_STAGING_ORIGIN =
  'https://repair-aircraft-seller-workf.rwas-web.pages.dev';
export function sellerDestinationAllowed(request, env, intakeOrigin) {
  if (env.INTAKE_STAGING_MODE !== 'true') return !env.SELLER_STAGING_ORIGIN;
  // A dedicated seller origin never changes the intake handler's destination.
  const allowed =
    env.SELLER_STAGING_ORIGIN === SELLER_STAGING_ORIGIN
      ? SELLER_STAGING_ORIGIN
      : env.SELLER_STAGING_ORIGIN
        ? null
        : intakeOrigin;
  return new URL(request.url).origin === allowed;
}
const reply = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export async function sellerMail(request, env) {
  const path = new URL(request.url).pathname;
  if (
    env.SELLER_MAIL_VIA_PAGES !== 'true' ||
    request.method !== 'POST' ||
    ![
      '/api/aircraft-sale/send-code',
      '/api/aircraft-sale/account/email-code',
    ].includes(path)
  )
    return null;
  if (
    env.INTAKE_STAGING_MODE !== 'true' ||
    env.SELLER_STAGING_ORIGIN !== SELLER_STAGING_ORIGIN ||
    new URL(request.url).origin !== SELLER_STAGING_ORIGIN ||
    request.headers.get('Origin') !== SELLER_STAGING_ORIGIN
  )
    return reply({ error: 'Verification destination not allowed.' }, 403);
  if (
    !env.SELLER_API ||
    (!env.SELLER_MAILER && (!env.RESEND_API_KEY || !env.CONTACT_FROM_EMAIL))
  )
    return reply({ error: 'Email delivery is not configured.' }, 503);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Invalid JSON.' }, 400);
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64000) {
      await reader.cancel();
      return reply({ error: 'Request too large.' }, 413);
    }
    chunks.push(value);
  }
  let body;
  try {
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
  } catch {
    return reply({ error: 'Invalid JSON.' }, 400);
  }
  const authorization = request.headers.get('Authorization') || '';
  let ticket;
  try {
    const challenge = await env.SELLER_API.createVerification({
      email: body.email,
      purpose: path.endsWith('/account/email-code') ? 'email-change' : 'login',
      authorization,
      ip: request.headers.get('CF-Connecting-IP') || '',
    });
    if (challenge.status !== 200)
      return reply(
        { error: challenge.error || 'Verification unavailable.' },
        challenge.status,
      );
    ticket = challenge.ticket;
    const payload = {
      to: challenge.to,
      code: challenge.code,
      purpose: challenge.purpose,
      expiresMinutes: challenge.expiresMinutes,
    };
    const delivered = env.SELLER_MAILER
      ? await env.SELLER_MAILER.fetch(
          new Request('https://seller-mail.internal/send', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        )
      : await deliverCode(
          {
            RESEND_API_KEY: env.RESEND_API_KEY,
            FROM_EMAIL: env.CONTACT_FROM_EMAIL,
          },
          payload,
        );
    if (!delivered.ok) throw Error('Delivery failed');
    const confirmed = await env.SELLER_API.confirmVerification({
      ticket,
      authorization,
    });
    if (confirmed.status !== 200) throw Error('Activation failed');
    return reply({ ok: true, sent: true });
  } catch {
    if (ticket) {
      try {
        await env.SELLER_API.cancelVerification({ ticket });
      } catch {
        /* Pending codes never authenticate. */
      }
    }
    return reply(
      { error: 'We could not send a code. Please try again later.' },
      503,
    );
  }
}
