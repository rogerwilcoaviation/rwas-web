import { Database, Env, WINDOW } from './core';
type Job = {
  receipt_id: string;
  email_json: string;
  attempts: number;
  first_attempt_at: number;
  lease_token: string;
};
export function retryDelay(
  attempt: number,
  retryAfter: string | null,
  now: number,
): number {
  const exponential = Math.min(3600000, 60000 * 2 ** (attempt - 1));
  if (!retryAfter) return exponential;
  const seconds = /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1000
    : Date.parse(retryAfter) - now;
  // Long Retry-After values are honored by moving to needs_review at the window boundary.
  return Number.isFinite(seconds)
    ? Math.max(exponential, Math.max(0, seconds))
    : exponential;
}
async function finish(
  db: Database,
  job: Job,
  status: string,
  code: string,
  next: number,
  provider: string | null = null,
) {
  return db
    .prepare(
      `UPDATE intake_outbox SET status=?,last_code=?,next_attempt_at=?,provider_id=?,
    lease_token=NULL,lease_until=NULL,updated_at=? WHERE receipt_id=? AND status='sending' AND lease_token=? AND lease_until>?`,
    )
    .bind(
      status,
      code,
      next,
      provider,
      Date.now(),
      job.receipt_id,
      job.lease_token,
      Date.now(),
    )
    .run();
}
export async function drain(env: Env): Promise<number> {
  const db = env.INTAKE_RECEIPTS!;
  let processed = 0;
  const maintenanceTime = Date.now();
  // Expired ambiguous attempts are never retried outside the provider's deduplication window.
  // This maintenance is scoped to at most five rows per tick as well.
  await db
    .prepare(
      `UPDATE intake_outbox SET status=CASE WHEN attempts>=6 THEN 'dead_letter' ELSE 'needs_review' END,
      last_code='retry_boundary',lease_token=NULL,lease_until=NULL,updated_at=? WHERE receipt_id IN
      (SELECT receipt_id FROM intake_outbox WHERE status IN ('queued','retry','sending')
       AND (lease_until IS NULL OR lease_until<=?) AND (attempts>=6 OR first_attempt_at<=?) LIMIT 5)`,
    )
    .bind(maintenanceTime, maintenanceTime, maintenanceTime - WINDOW)
    .run();
  for (let i = 0; i < 5; i++) {
    const now = Date.now();
    const day = Math.floor(now / 86400000) * 86400000;
    const lease = crypto.randomUUID();
    // Claim + attempt ledger are a transaction. The ledger is written BEFORE network I/O.
    // Every attempt reserves daily capacity, including ambiguous failures/retries.
    const result = (await db.batch([
      db
        .prepare(
          `UPDATE intake_outbox SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1,
        first_attempt_at=COALESCE(first_attempt_at,?),updated_at=? WHERE receipt_id=(
        SELECT receipt_id FROM intake_outbox WHERE status IN ('queued','retry','sending') AND next_attempt_at<=?
        AND (lease_until IS NULL OR lease_until<=?) AND attempts<6 AND (first_attempt_at IS NULL OR first_attempt_at>?)
        AND (SELECT COUNT(*) FROM intake_attempts WHERE started_at>=?)<50
        ORDER BY next_attempt_at,receipt_id LIMIT 1) RETURNING *`,
        )
        .bind(lease, now + 120000, now, now, now, now, now - WINDOW, day),
      db
        .prepare(
          `INSERT INTO intake_attempts(receipt_id,attempt,started_at)
        SELECT receipt_id,attempts,? FROM intake_outbox WHERE lease_token=? AND status='sending'`,
        )
        .bind(now, lease),
    ])) as [{ results: Job[] }, unknown];
    const job = result[0].results[0];
    if (!job) break;
    processed++;
    // An isolate paused after claiming must not send after its lease/window expires.
    if (
      Date.now() >= now + 100000 ||
      Date.now() >= job.first_attempt_at + WINDOW
    )
      continue;
    let status = 'retry';
    let code = 'network_unknown';
    let provider: string | null = null;
    let next = Date.now() + retryDelay(job.attempts, null, Date.now());
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY!}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `rwas-service-v1/${job.receipt_id}`,
        },
        body: job.email_json,
        signal: AbortSignal.timeout(15000),
      });
      code = `http_${response.status}`;
      if (response.ok) {
        const body = (await response.json()) as { id?: unknown };
        if (
          typeof body.id === 'string' &&
          /^[a-zA-Z0-9_-]{1,128}$/.test(body.id)
        ) {
          status = 'provider_accepted';
          provider = body.id;
        } else code = 'provider_result_unknown';
      } else if (response.status === 409) {
        // Concurrent-idempotency or payload conflict: operator review is safer than guessing.
        status = 'needs_review';
      } else if (
        response.status === 429 ||
        response.status >= 500 ||
        response.status === 408
      ) {
        next =
          Date.now() +
          retryDelay(
            job.attempts,
            response.headers.get('Retry-After'),
            Date.now(),
          );
      } else status = 'dead_letter';
      await response.body?.cancel().catch(() => undefined);
    } catch {
      /* Outcome unknown; reuse the exact persisted body/key only inside 23h. */
    }
    if (status === 'retry' && job.attempts >= 6) status = 'dead_letter';
    if (status === 'retry' && next >= job.first_attempt_at + WINDOW)
      status = 'needs_review';
    await finish(db, job, status, code, next, provider);
  }
  return processed;
}
