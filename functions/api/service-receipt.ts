import {
  Context,
  hash,
  json,
  methodNotAllowed,
  unavailable,
} from '../_intake/core';
export async function onRequestGet({ request, env }: Context) {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return json({ error: 'Receipt not found.' }, 404);
  if (!env.INTAKE_RECEIPTS) return unavailable();
  try {
    const row = await env.INTAKE_RECEIPTS.prepare(
      `SELECT r.id, r.created_at, o.status FROM intake_receipts r
      JOIN intake_outbox o ON o.receipt_id=r.id WHERE r.token_hash=?`,
    )
      .bind(await hash(token))
      .first<{ id: string; created_at: number; status: string }>();
    if (!row) return json({ error: 'Receipt not found.' }, 404);
    const states: Record<string, string> = { queued: 'notification_pending', sending: 'notification_pending', retry: 'retry_pending', provider_accepted: 'provider_accepted', dead_letter: 'failed', needs_review: 'needs_review' };
    return json({ status: states[row.status] || 'needs_review' });
  } catch {
    return unavailable();
  }
}
export const onRequest = methodNotAllowed;
