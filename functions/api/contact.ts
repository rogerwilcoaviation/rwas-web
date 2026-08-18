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
 *   TEAMS_RELAY_TOKEN      — secret. Bearer token for the authenticated Teams bridge.
 *   CONTACT_TEAMS_RELAY_URL — plain. Defaults to "https://teamsbot.rwas.team/post".
 *   CONTACT_TEAMS_TARGET   — plain. Defaults to "Shop Talk".
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
  TEAMS_RELAY_TOKEN?: string;
  CONTACT_TEAMS_RELAY_URL?: string;
  CONTACT_TEAMS_TARGET?: string;
};

type Ctx = { request: Request; env: Env };

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  aircraftYear?: string;
  aircraftMake?: string;
  aircraftModel?: string;
  aircraftSerialNumber?: string;
  nNumber?: string;
  aircraftStatus?:
    | 'registered'
    | 'under-construction'
    | 'identifiers-not-assigned';
  preferredContact?: string;
  bestTimeToCall?: string;
  reason?: string;
  product?: string;
  sku?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  message?: string;
  requestId?: string;
  plannerKind?: 'certified' | 'experimental';
  createdAt?: string;
  pricingReference?: string;
  advisories?: string[];
  components?: Array<{
    title?: string;
    sku?: string;
    quantity?: number;
    unitPrice?: number;
    extendedPrice?: number;
  }>;
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

function generateRequestId(): string {
  return `rwas_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function requestIdFor(payload: ContactPayload): string {
  return /^[A-Za-z0-9_-]{8,120}$/.test(payload.requestId || '')
    ? (payload.requestId as string)
    : generateRequestId();
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
  const reason = payload.reason || 'general';
  const isQuote = reason === 'quote';
  const isExperimentalProject = payload.plannerKind === 'experimental';
  if (
    payload.aircraftStatus &&
    !['registered', 'under-construction', 'identifiers-not-assigned'].includes(
      payload.aircraftStatus,
    )
  ) {
    return 'Please choose a valid aircraft status.';
  }
  if (isQuote && !payload.aircraftMake?.trim())
    return 'Aircraft make is required for quote requests.';
  if (isQuote && !payload.aircraftModel?.trim())
    return 'Aircraft model is required for quote requests.';
  if (isQuote && !payload.aircraftStatus)
    return 'Please choose the aircraft status for this quote request.';
  if (isQuote && payload.aircraftStatus === 'registered') {
    if (!/^\d{4}$/.test(payload.aircraftYear || ''))
      return 'A four-digit aircraft year is required for a registered-aircraft quote.';
    if (!payload.aircraftSerialNumber?.trim())
      return 'Aircraft serial number is required for a registered-aircraft quote.';
    if (!payload.nNumber?.trim())
      return 'Aircraft N-number is required for a registered-aircraft quote.';
  }
  if (
    isQuote &&
    isExperimentalProject &&
    payload.aircraftStatus === 'under-construction'
  ) {
    // Experimental projects may be quoted before identifiers are assigned.
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
  const srcSuffix = p.source ? ` [src:${p.source}]` : '';
  if (p.reason === 'quote' && p.product) {
    return `[${ticketId}] Quote: ${p.product} — from ${who}${srcSuffix}`;
  }
  return `[${ticketId}] ${reasonLabel} — from ${who}${srcSuffix}`;
}

function buildPlainTextBody(
  p: ContactPayload,
  ticketId: string,
  requestId: string,
): string {
  const lines: string[] = [];
  lines.push(`RWAS CORRESPONDENCE DESK — ${ticketId}`);
  lines.push(`Request/build ID: ${requestId}`);
  lines.push('='.repeat(56));
  lines.push('');
  lines.push(`Reason:    ${REASON_LABELS[p.reason || 'general'] || 'General'}`);
  if (p.product) lines.push(`Product:   ${p.product}`);
  if (p.sku) lines.push(`SKU:       ${p.sku}`);
  if (p.source) lines.push(`Source:    ${p.source}`);
  if (p.utm_source) lines.push(`UTM source:   ${p.utm_source}`);
  if (p.utm_medium) lines.push(`UTM medium:   ${p.utm_medium}`);
  if (p.utm_campaign) lines.push(`UTM campaign: ${p.utm_campaign}`);
  if (p.utm_content) lines.push(`UTM content:  ${p.utm_content}`);
  if (p.utm_term) lines.push(`UTM term:     ${p.utm_term}`);
  if (p.plannerKind) lines.push(`Planner:   AXIS ${p.plannerKind}`);
  if (p.pricingReference) lines.push(`Pricing:   ${p.pricingReference}`);
  if (p.aircraftStatus) lines.push(`Status:    ${p.aircraftStatus}`);
  lines.push('');
  lines.push('--- Contact ---');
  lines.push(`Name:      ${p.name || ''}`);
  lines.push(`Email:     ${p.email || ''}`);
  if (p.phone) lines.push(`Phone:     ${p.phone}`);
  lines.push(`Prefers:   ${p.preferredContact || 'either'}`);
  if (p.bestTimeToCall) lines.push(`Best time: ${p.bestTimeToCall}`);
  lines.push('');
  lines.push('--- Aircraft ---');
  lines.push(`Year:          ${p.aircraftYear || ''}`);
  lines.push(`Make:          ${p.aircraftMake || ''}`);
  lines.push(`Model:         ${p.aircraftModel || ''}`);
  lines.push(`Serial Number: ${p.aircraftSerialNumber || ''}`);
  if (p.nNumber) lines.push(`N-Number:      ${p.nNumber}`);
  lines.push('');
  lines.push('--- Message ---');
  lines.push(p.message || '');
  if (p.components?.length && !messageContainsAllComponents(p)) {
    lines.push('', '--- Selected equipment ---');
    p.components.forEach((item) =>
      lines.push(
        `${item.title || 'Component'} | SKU ${item.sku || ''} | Qty ${item.quantity || 0} | Unit ${item.unitPrice ?? 0} | Extended ${item.extendedPrice ?? 0}`,
      ),
    );
  }
  if (p.advisories?.length && !messageContainsAllAdvisories(p)) {
    lines.push('', '--- Planner advisories ---');
    p.advisories.forEach((advisory) => lines.push(`- ${advisory}`));
  }
  lines.push('');
  lines.push('--');
  lines.push('Reply directly to this email — it routes back to the submitter.');
  return lines.join('\n');
}

function messageContainsAllComponents(p: ContactPayload): boolean {
  if (!p.components?.length) return false;
  const message = (p.message || '').toLowerCase();
  return p.components.every((item) => {
    const sku = (item.sku || '').trim().toLowerCase();
    const title = (item.title || '').trim().toLowerCase();
    return Boolean((sku && message.includes(sku)) || (title && message.includes(title)));
  });
}

function messageContainsAllAdvisories(p: ContactPayload): boolean {
  if (!p.advisories?.length) return false;
  const message = (p.message || '').toLowerCase();
  return p.advisories.every((advisory) =>
    message.includes(advisory.trim().toLowerCase()),
  );
}

function buildHtmlBody(
  p: ContactPayload,
  ticketId: string,
  requestId: string,
): string {
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
          <div style="font:12px/1.4 ui-sans-serif,system-ui;color:#6a6f80;margin-top:4px">${escapeHtml(ticketId)} · ${escapeHtml(requestId)}</div>
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
            ${row('Aircraft year', p.aircraftYear)}
            ${row('Aircraft make', p.aircraftMake)}
            ${row('Aircraft model', p.aircraftModel)}
            ${row('Serial number', p.aircraftSerialNumber)}
            ${row('N-Number', p.nNumber)}
            ${row('Source', p.source)}
            ${row('UTM source', p.utm_source)}
            ${row('UTM medium', p.utm_medium)}
            ${row('UTM campaign', p.utm_campaign)}
            ${row('UTM content', p.utm_content)}
            ${row('UTM term', p.utm_term)}
            ${row('Aircraft status', p.aircraftStatus)}
            ${row('Planner', p.plannerKind ? `AXIS ${p.plannerKind}` : undefined)}
            ${row('Pricing reference', p.pricingReference)}
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
  requestId: string,
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
    text: buildPlainTextBody(p, ticketId, requestId),
    html: buildHtmlBody(p, ticketId, requestId),
    tags: [
      { name: 'source', value: 'rwas-contact-form' },
      { name: 'reason', value: p.reason || 'general' },
      ...(p.source
        ? [
            {
              name: 'lead_source',
              value: p.source.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
            },
          ]
        : []),
    ],
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': requestId,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      return {
        ok: false,
        error: `Resend ${res.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'send failed',
    };
  }
}

function buildTeamsBody(
  p: ContactPayload,
  ticketId: string,
  requestId: string,
): string {
  const reasonLabel = REASON_LABELS[p.reason || 'general'] || 'General inquiry';
  const lines = [
    `NEW WEBSITE INQUIRY — ${ticketId}`,
    `Request/build ID: ${requestId}`,
    `Reason: ${reasonLabel}`,
    p.product ? `Product: ${p.product}` : '',
    p.sku ? `SKU: ${p.sku}` : '',
    `Name: ${p.name || ''}`,
    `Email: ${p.email || ''}`,
    p.phone ? `Phone: ${p.phone}` : '',
    p.preferredContact ? `Prefers: ${p.preferredContact}` : '',
    p.bestTimeToCall ? `Best time: ${p.bestTimeToCall}` : '',
    `Aircraft: ${[p.aircraftYear, p.aircraftMake, p.aircraftModel].filter(Boolean).join(' ')}`,
    `Serial Number: ${p.aircraftSerialNumber || ''}`,
    p.nNumber ? `N-Number: ${p.nNumber}` : '',
    p.source ? `Source: ${p.source}` : '',
    p.utm_source ? `UTM source: ${p.utm_source}` : '',
    p.utm_medium ? `UTM medium: ${p.utm_medium}` : '',
    p.utm_campaign ? `UTM campaign: ${p.utm_campaign}` : '',
    p.utm_content ? `UTM content: ${p.utm_content}` : '',
    p.utm_term ? `UTM term: ${p.utm_term}` : '',
    p.aircraftStatus ? `Aircraft status: ${p.aircraftStatus}` : '',
    p.plannerKind ? `Planner: AXIS ${p.plannerKind}` : '',
    '',
    'Message:',
    p.message || '',
    p.components?.length && !messageContainsAllComponents(p)
      ? `\nSelected equipment:\n${p.components.map((item) => `- ${item.title || item.sku || 'Component'} (${item.sku || 'no SKU'}) × ${item.quantity || 0}: ${item.extendedPrice ?? 0}`).join('\n')}`
      : '',
    p.advisories?.length && !messageContainsAllAdvisories(p)
      ? `\nAdvisories:\n- ${p.advisories.join('\n- ')}`
      : '',
  ];
  return lines
    .filter((line, index) => line || index === lines.length - 3)
    .join('\n');
}

async function sendToTeams(
  env: Env,
  p: ContactPayload,
  ticketId: string,
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.TEAMS_RELAY_TOKEN) {
    return { ok: false, error: 'Teams relay not configured' };
  }
  const url = env.CONTACT_TEAMS_RELAY_URL || 'https://teamsbot.rwas.team/post';
  const target = env.CONTACT_TEAMS_TARGET || 'Shop Talk';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TEAMS_RELAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: target,
        text: buildTeamsBody(p, ticketId, requestId),
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return {
        ok: false,
        error: `Teams relay ${res.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Teams send failed',
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

  const requestId = requestIdFor(payload);

  // 1. Validate shape
  const validationError = validate(payload);
  if (validationError === '__HONEYPOT__') {
    // Silent success — bots shouldn't learn they were filtered
    return jsonResponse({
      ticketId: requestId,
      requestId,
      to: 'service@rwas.team',
    });
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

  // 3. Internal email is the customer-facing delivery gate. Teams is a
  // best-effort notification sent only after Resend accepts the email.
  // Keep the Resend payload deterministic for this idempotency key so retries
  // return the original provider result instead of conflicting.
  const ticketId = requestId;
  const emailSend = await sendViaResend(env, payload, ticketId, requestId);
  if (!emailSend.ok) {
    console.error('contact-form email send failed', {
      requestId,
      error: emailSend.error,
    });
    return jsonResponse(
      {
        error:
          'We could not deliver your message right now. Please email service@rwas.team directly.',
      },
      502,
    );
  }

  const teamsSend = await sendToTeams(env, payload, ticketId, requestId);
  if (!teamsSend.ok) {
    console.error('contact-form Teams send failed after email success', {
      requestId,
      error: teamsSend.error,
    });
  }

  return jsonResponse({
    ticketId,
    requestId,
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
