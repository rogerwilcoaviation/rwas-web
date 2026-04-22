/*
 * Cloudflare Pages Function — /api/contact
 *
 * Single POST endpoint that accepts the RWAS Correspondence Desk payload,
 * verifies the Turnstile token, and relays the inquiry to
 * service@rwas.team via the Resend API.
 *
 * Why a CF Pages Function (vs. Next.js API route):
 *   rwas-web is built with @cloudflare/next-on-pages as a static export.
 *   Dynamic API routes live in /functions and run on the Worker runtime.
 *   This mirrors the pattern already established by functions/api/cart.ts.
 *
 * Env vars (Cloudflare Pages project → Settings → Environment Variables):
 *   RESEND_API_KEY         — secret. Resend API key for rwas.team sender.
 *   TURNSTILE_SECRET_KEY   — secret. Paired with NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 *   CONTACT_TO_EMAIL       — plain.  Defaults to "service@rwas.team".
 *   CONTACT_FROM_EMAIL     — plain.  Defaults to "RWAS Correspondence <noreply@rwas.team>".
 *                            MUST be on a Resend-verified domain.
 *
 * Response shape:
 *   200: { ticketId: string, to: string }
 *   400: { error: "validation message" }
 *   429: { error: "rate limited" }         (spam heuristic or Turnstile failure)
 *   502: { error: "mail provider error" }
 */

type Env = {
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
};

type Ctx = { request: Request; env: Env };

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  aircraftMakeModel?: string;
  nNumber?: string;
  preferredContact?: string;
  bestTimeToCall?: string;
  reason?: string;
  product?: string;
  sku?: string;
  message?: string;
  website?: string; // honeypot
  turnstileToken?: string;
};

const REASON_LABELS: Record<string, string> = {
  quote: 'Quote request',
  general: 'General inquiry',
  service: 'Service / maintenance',
  'papa-alpha': 'Papa-Alpha tool inquiry',
  'aircraft-sales': 'Aircraft for sale',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateTicketId(): string {
  // RWAS-YYMMDD-XXXX — human-readable, roughly unique per submission
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RWAS-${yy}${mm}${dd}-${rand}`;
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
): Promise<{ success: boolean; reason?: string }> {
  if (!token) return { success: false, reason: 'missing-token' };
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
    const data = (await res.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };
    if (!data.success) {
      return {
        success: false,
        reason: (data['error-codes'] || []).join(',') || 'rejected',
      };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'verify-failed',
    };
  }
}

function validate(payload: ContactPayload): string | null {
  if (!payload.name || payload.name.length < 2) return 'Name is required.';
  if (!payload.email) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Email looks invalid.';
  }
  if (!payload.message || payload.message.length < 10) {
    return 'Please include a short message so we can help.';
  }
  if (payload.message.length > 4000) {
    return 'Message is too long (max 4000 characters).';
  }
  if (payload.nNumber && !/^[A-Za-z0-9-]{1,10}$/i.test(payload.nNumber)) {
    return 'N-number has unexpected characters.';
  }
  // honeypot: if populated, silently accept then drop
  if (payload.website && payload.website.length > 0) {
    return '__HONEYPOT__';
  }
  return null;
}

function buildSubject(p: ContactPayload, ticketId: string): string {
  const reasonLabel = REASON_LABELS[p.reason || 'general'] || 'Inquiry';
  const who = p.name || 'someone';
  if (p.reason === 'quote' && p.product) {
    return `[${ticketId}] Quote: ${p.product} — from ${who}`;
  }
  return `[${ticketId}] ${reasonLabel} — from ${who}`;
}

function buildPlainTextBody(p: ContactPayload, ticketId: string): string {
  const lines: string[] = [];
  lines.push(`RWAS CORRESPONDENCE DESK — ${ticketId}`);
  lines.push('='.repeat(56));
  lines.push('');
  lines.push(`Reason:    ${REASON_LABELS[p.reason || 'general'] || 'General'}`);
  if (p.product) lines.push(`Product:   ${p.product}`);
  if (p.sku) lines.push(`SKU:       ${p.sku}`);
  lines.push('');
  lines.push('--- Contact ---');
  lines.push(`Name:      ${p.name || ''}`);
  lines.push(`Email:     ${p.email || ''}`);
  if (p.phone) lines.push(`Phone:     ${p.phone}`);
  lines.push(`Prefers:   ${p.preferredContact || 'either'}`);
  if (p.bestTimeToCall) lines.push(`Best time: ${p.bestTimeToCall}`);
  lines.push('');
  if (p.aircraftMakeModel || p.nNumber) {
    lines.push('--- Aircraft ---');
    if (p.aircraftMakeModel) lines.push(`Make/Model: ${p.aircraftMakeModel}`);
    if (p.nNumber) lines.push(`N-Number:   ${p.nNumber}`);
    lines.push('');
  }
  lines.push('--- Message ---');
  lines.push(p.message || '');
  lines.push('');
  lines.push('--');
  lines.push('Reply directly to this email — it routes back to the submitter.');
  return lines.join('\n');
}

function buildHtmlBody(p: ContactPayload, ticketId: string): string {
  const row = (label: string, value?: string) =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6a6f80;font:11px/1.4 ui-sans-serif,system-ui;letter-spacing:0.12em;text-transform:uppercase;vertical-align:top;white-space:nowrap">${escapeHtml(
          label,
        )}</td><td style="padding:4px 0;color:#111318;font:14px/1.5 Georgia,serif">${escapeHtml(
          value,
        )}</td></tr>`
      : '';
  const reasonLabel = REASON_LABELS[p.reason || 'general'] || 'General';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f2ecde;font-family:Georgia,serif;color:#111318">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ecde;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#faf7f1;border:1px solid #111318;border-radius:2px;box-shadow:4px 4px 0 0 #111318">
        <tr><td style="padding:28px 32px 0 32px">
          <div style="font:11px/1.4 ui-sans-serif,system-ui;letter-spacing:0.28em;text-transform:uppercase;color:#8a6315">RWAS Correspondence Desk</div>
          <div style="font:700 24px/1.2 'Playfair Display',Georgia,serif;margin-top:6px">${escapeHtml(reasonLabel)}</div>
          <div style="font:12px/1.4 ui-sans-serif,system-ui;color:#6a6f80;margin-top:4px">${escapeHtml(ticketId)}</div>
        </td></tr>
        ${
          p.product
            ? `<tr><td style="padding:16px 32px">
              <div style="border-left:3px solid #a87a1d;background:#f2ecde;padding:10px 14px;font:14px/1.5 Georgia,serif">
                <div style="font:10px/1.3 ui-sans-serif,system-ui;letter-spacing:0.18em;text-transform:uppercase;color:#6a6f80;margin-bottom:4px">Product context</div>
                <div>${escapeHtml(p.product)}${p.sku ? ` <span style="color:#6a6f80">· SKU ${escapeHtml(p.sku)}</span>` : ''}</div>
              </div>
            </td></tr>`
            : ''
        }
        <tr><td style="padding:8px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${row('Name', p.name)}
            ${row('Email', p.email)}
            ${row('Phone', p.phone)}
            ${row('Prefers', p.preferredContact)}
            ${row('Best time', p.bestTimeToCall)}
            ${row('Aircraft', p.aircraftMakeModel)}
            ${row('N-Number', p.nNumber)}
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px">
          <div style="border-top:2px solid #111318;padding-top:12px">
            <div style="font:10px/1.3 ui-sans-serif,system-ui;letter-spacing:0.22em;text-transform:uppercase;color:#6a6f80;margin-bottom:8px">Message</div>
            <div style="font:15px/1.6 Georgia,serif;white-space:pre-wrap">${escapeHtml(p.message || '')}</div>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 32px 32px">
          <div style="font:11px/1.4 ui-sans-serif,system-ui;color:#6a6f80;border-top:1px dashed rgba(28,32,44,0.3);padding-top:12px">
            Reply directly to this email — it routes back to ${escapeHtml(p.email || 'the submitter')}.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendViaResend(
  env: Env,
  p: ContactPayload,
  ticketId: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'mail provider not configured' };
  const to = env.CONTACT_TO_EMAIL || 'service@rwas.team';
  const from =
    env.CONTACT_FROM_EMAIL || 'RWAS Correspondence <noreply@rwas.team>';

  const body = {
    from,
    to: [to],
    reply_to: p.email,
    subject: buildSubject(p, ticketId),
    text: buildPlainTextBody(p, ticketId),
    html: buildHtmlBody(p, ticketId),
    tags: [
      { name: 'source', value: 'rwas-contact-form' },
      { name: 'reason', value: p.reason || 'general' },
    ],
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'send failed',
    };
  }
}

export const onRequestPost = async ({ request, env }: Ctx) => {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  // 1. Validate shape
  const validationError = validate(payload);
  if (validationError === '__HONEYPOT__') {
    // Silent success — bots shouldn't learn they were filtered
    return jsonResponse({ ticketId: generateTicketId(), to: 'service@rwas.team' });
  }
  if (validationError) return jsonResponse({ error: validationError }, 400);

  // 2. Verify Turnstile (skip if not configured — e.g. during local dev)
  if (env.TURNSTILE_SECRET_KEY) {
    const ip = request.headers.get('CF-Connecting-IP');
    const verification = await verifyTurnstile(
      payload.turnstileToken || '',
      env.TURNSTILE_SECRET_KEY,
      ip,
    );
    if (!verification.success) {
      return jsonResponse(
        {
          error:
            'Verification failed. Please refresh the page and try again, or email service@rwas.team directly.',
        },
        429,
      );
    }
  }

  // 3. Send
  const ticketId = generateTicketId();
  const send = await sendViaResend(env, payload, ticketId);
  if (!send.ok) {
    // Log to CF logs but don't leak internal errors to clients
    console.error('contact-form send failed', send.error);
    return jsonResponse(
      {
        error:
          'We could not deliver your message right now. Please email service@rwas.team directly.',
      },
      502,
    );
  }

  return jsonResponse({
    ticketId,
    to: env.CONTACT_TO_EMAIL || 'service@rwas.team',
  });
};

// Everything else → method not allowed
export const onRequest = async ({ request }: Ctx) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
        'Cache-Control': 'no-store',
      },
    });
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
};
