import {
  Context,
  InvalidBody,
  ORIGINS,
  boundedJson,
  configured,
  emailBody,
  hash,
  hmac,
  json,
  methodNotAllowed,
  unavailable,
  validate,
} from '../_intake/core';

export async function onRequestPost({ request, env }: Context) {
  if (!ORIGINS.has(request.headers.get('Origin') || ''))
    return json({ error: 'Origin not allowed.' }, 403);
  if (!configured(env, true)) return unavailable();
  const db = env.INTAKE_RECEIPTS!;
  try {
    const { payload, requestId, token } = validate(await boundedJson(request));
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || ip.length > 64) return unavailable();
    const now = Date.now();
    const ipHash = await hmac(
      env.INTAKE_DISPATCH_SECRET!,
      `intake-ip:v1:${ip}`,
    );
    const bucket = Math.floor(now / 3600000);
    // Guard even replay attempts before Turnstile/provider work; retain no raw IP.
    const guard = await db
      .prepare(
        `INSERT INTO intake_rate(ip_hash,bucket,hits) VALUES(?,?,1)
      ON CONFLICT(ip_hash,bucket) DO UPDATE SET hits=hits+1 WHERE hits<20 RETURNING hits`,
      )
      .bind(ipHash, bucket)
      .first();
    if (!guard)
      return json({ error: 'Please try again later.' }, 429, {
        'Retry-After': '3600',
      });
    const serialized = JSON.stringify(payload);
    const fingerprint = await hash(serialized);
    const receiptToken = await hmac(
      env.INTAKE_DISPATCH_SECRET!,
      `intake-receipt:v1:${requestId}:${fingerprint}`,
    );
    type Existing = { id: string; fingerprint: string; token_hash: string };
    const existing = await db
      .prepare(
        'SELECT id,fingerprint,token_hash FROM intake_receipts WHERE request_id=?',
      )
      .bind(requestId)
      .first<Existing>();
    const replay = async (row: Existing) => {
      if (row.fingerprint !== fingerprint)
        return json(
          { error: 'Request ID already used for different content.' },
          409,
        );
      // Secret rotation cannot silently return an unusable replacement token.
      if (row.token_hash !== (await hash(receiptToken))) return unavailable();
      return json({ receiptId: row.id, receiptToken, status: 'received' }, 200);
    };
    if (existing) return replay(existing);
    const verification = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY!,
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const verdict = (await verification.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (
      !verification.ok ||
      verdict.success !== true ||
      verdict.hostname !== new URL(request.headers.get('Origin')!).hostname ||
      verdict.action !== 'service_intake'
    ) {
      return json({ error: 'Verification failed. Please try again.' }, 403);
    }
    const id = crypto.randomUUID();
    const day = Math.floor(now / 86400000) * 86400000;
    // Both writes commit together. Admission predicates execute under D1's write transaction,
    // so concurrent different keys cannot exceed caps and duplicate keys consume no capacity.
    await db.batch([
      db
        .prepare(
          `INSERT INTO intake_receipts(id,request_id,fingerprint,token_hash,payload,ip_hash,created_at)
        SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM intake_receipts WHERE created_at>=?)<50
        AND (SELECT COUNT(*) FROM intake_receipts WHERE ip_hash=? AND created_at>=?)<5
        ON CONFLICT(request_id) DO NOTHING`,
        )
        .bind(
          id,
          requestId,
          fingerprint,
          await hash(receiptToken),
          serialized,
          ipHash,
          now,
          day,
          ipHash,
          now - 3600000,
        ),
      db
        .prepare(
          `INSERT INTO intake_outbox(receipt_id,email_json,next_attempt_at,updated_at)
        SELECT id,?,?,? FROM intake_receipts WHERE id=?`,
        )
        .bind(emailBody(env, payload, id), now, now, id),
    ]);
    const committed = await db
      .prepare(
        'SELECT id,fingerprint,token_hash FROM intake_receipts WHERE request_id=?',
      )
      .bind(requestId)
      .first<Existing>();
    if (!committed)
      return json({ error: 'Please try again later.' }, 429, {
        'Retry-After': '3600',
      });
    if (committed.id !== id) return replay(committed);
    return json({ receiptId: id, receiptToken, status: 'received' }, 202);
  } catch (error) {
    if (error instanceof InvalidBody)
      return json({ error: 'Invalid submission.' }, 400);
    return unavailable(); // Never expose SQL, provider details, secrets or customer data.
  }
}
export const onRequest = methodNotAllowed;
