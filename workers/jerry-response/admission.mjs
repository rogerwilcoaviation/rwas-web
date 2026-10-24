import {
  jerryAssert,
  jerryJson,
  jerryKeys,
  jerryResult,
  jerryUuid,
} from '../aircraft-sale/jerry-protocol.mjs';

export const ADMISSION = Object.freeze({
  windowMs: 300000,
  receiptMs: 86400000,
  leaseMs: 90000,
  principalAttempts: 40,
  globalAttempts: 240,
  principalInFlight: { guest: 1, account: 2 },
  globalInFlight: 4,
  receipts: 8192,
});
const hex = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const denied = (status, code, error, retryAfterMs) => ({
  status,
  code,
  error,
  ...(retryAfterMs ? { retryAfterMs } : {}),
});

// A single response-service object coordinates all principals and both surfaces.
// Only pseudonymous admission metadata is stored, never a prompt, reply or token.
export class JerryAdmission {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
  }
  now() {
    return Date.now();
  }
  init() {
    if (this.ready) return;
    this.sql = this.ctx.storage.sql;
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS admission_ops (op_key TEXT PRIMARY KEY, principal TEXT NOT NULL, surface TEXT NOT NULL, kind TEXT NOT NULL, operation_id TEXT NOT NULL, fingerprint TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, state TEXT NOT NULL, nonce TEXT, deadline INTEGER)',
    );
    this.sql.exec(
      'CREATE INDEX IF NOT EXISTS admission_expiry ON admission_ops(expires_at)',
    );
    this.sql.exec(
      'CREATE INDEX IF NOT EXISTS admission_leases ON admission_ops(state, deadline)',
    );
    this.sql.exec(
      'CREATE INDEX IF NOT EXISTS admission_principal ON admission_ops(principal,state)',
    );
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS admission_rates (rate_key TEXT PRIMARY KEY, started_at INTEGER NOT NULL, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)',
    );
    this.ready = true;
  }
  one(query, ...args) {
    return this.sql.exec(query, ...args).toArray()[0];
  }
  sweep(now) {
    this.sql.exec(
      "UPDATE admission_ops SET state=CASE WHEN state='reserved' THEN 'retryable' WHEN state='cooldown' THEN 'failed' ELSE 'uncertain' END,nonce=NULL,deadline=NULL WHERE state IN ('reserved','running','cooldown') AND deadline<=?",
      now,
    );
    this.sql.exec('DELETE FROM admission_ops WHERE expires_at<=?', now);
    this.sql.exec('DELETE FROM admission_rates WHERE expires_at<=?', now);
  }
  async schedule() {
    const at = this.one(
      'SELECT MIN(at) AS at FROM (SELECT expires_at AS at FROM admission_ops UNION ALL SELECT deadline AS at FROM admission_ops WHERE deadline IS NOT NULL UNION ALL SELECT expires_at AS at FROM admission_rates)',
    )?.at;
    if (at == null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(this.now() + 1, at));
  }
  countAttempt(key, now, maximum) {
    const old = this.one('SELECT * FROM admission_rates WHERE rate_key=?', key);
    if (old && old.expires_at > now && old.count >= maximum)
      return old.expires_at - now;
    const started = old?.expires_at > now ? old.started_at : now;
    this.sql.exec(
      'INSERT INTO admission_rates(rate_key,started_at,count,expires_at) VALUES(?,?,?,?) ON CONFLICT(rate_key) DO UPDATE SET started_at=excluded.started_at,count=excluded.count,expires_at=excluded.expires_at',
      key,
      started,
      old?.expires_at > now ? old.count + 1 : 1,
      started + ADMISSION.windowMs,
    );
    return 0;
  }
  reserve(body, now) {
    jerryKeys(body, [
      'principal',
      'category',
      'surface',
      'kind',
      'operationId',
      'issuedAt',
      'fingerprint',
    ]);
    jerryAssert(
      hex(body.principal) &&
        hex(body.fingerprint) &&
        ['guest', 'account'].includes(body.category) &&
        ['public', 'exchange'].includes(body.surface) &&
        ['respond', 'translate'].includes(body.kind) &&
        jerryUuid(body.operationId) &&
        Number.isSafeInteger(body.issuedAt),
      400,
      'Invalid admission metadata.',
    );
    if (
      body.issuedAt > now + 30000 ||
      body.issuedAt + ADMISSION.receiptMs <= now
    )
      return denied(
        409,
        'JERRY_ATTEMPT_EXPIRED',
        'This request is too old to retry. Send it explicitly as a new request.',
      );
    // Return protocol errors instead of throwing after these writes: rejected
    // requests also consume the durable attempt budget, including replay spam.
    const globalWait = this.countAttempt(
      'global',
      now,
      ADMISSION.globalAttempts,
    );
    if (globalWait)
      return denied(
        429,
        'JERRY_ADMISSION_LIMIT',
        'Jerry is busy. Please wait before trying again.',
        globalWait,
      );
    const principal = body.category + ':' + body.principal;
    const wait = this.countAttempt(principal, now, ADMISSION.principalAttempts);
    if (wait)
      return denied(
        429,
        'JERRY_ADMISSION_LIMIT',
        'Please wait before sending more requests.',
        wait,
      );
    const key = [body.surface, body.kind, body.operationId].join(':');
    const old = this.one('SELECT * FROM admission_ops WHERE op_key=?', key);
    if (
      old &&
      (old.principal !== principal ||
        old.fingerprint !== body.fingerprint ||
        old.issued_at !== body.issuedAt)
    )
      return denied(
        409,
        'JERRY_REPLAY_CONFLICT',
        'This request ID was already used with different input.',
      );
    if (old && ['reserved', 'running'].includes(old.state))
      return denied(
        409,
        'JERRY_ATTEMPT_PENDING',
        'Jerry is still handling this request. Retry the same request later.',
        old.deadline - now,
      );
    const terminal = {
      completed: 'JERRY_ATTEMPT_COMPLETED',
      failed: 'JERRY_ATTEMPT_FAILED',
      cooldown: 'JERRY_ATTEMPT_FAILED',
      uncertain: 'JERRY_ATTEMPT_UNCERTAIN',
    }[old?.state];
    if (terminal)
      return denied(
        409,
        terminal,
        'This request was already attempted. No reply is retained by the response service. You may explicitly resend it as a new request.',
      );
    const active = this.one(
      "SELECT COUNT(*) AS count FROM admission_ops WHERE state IN ('reserved','running','cooldown')",
    ).count;
    const own = this.one(
      "SELECT COUNT(*) AS count FROM admission_ops WHERE principal=? AND state IN ('reserved','running','cooldown')",
      principal,
    ).count;
    if (
      active >= ADMISSION.globalInFlight ||
      own >= ADMISSION.principalInFlight[body.category]
    )
      return denied(
        429,
        'JERRY_CONCURRENCY_LIMIT',
        'Another request is still running. Please wait and retry this request.',
        ADMISSION.leaseMs,
      );
    if (
      !old &&
      this.one('SELECT COUNT(*) AS count FROM admission_ops').count >=
        ADMISSION.receipts
    )
      return denied(
        429,
        'JERRY_ADMISSION_CAPACITY',
        'Jerry admission storage is full. Try again later.',
        ADMISSION.windowMs,
      );
    const nonce = crypto.randomUUID(),
      deadline = Math.min(
        now + ADMISSION.leaseMs,
        body.issuedAt + ADMISSION.receiptMs,
      );
    this.sql.exec(
      "INSERT INTO admission_ops(op_key,principal,surface,kind,operation_id,fingerprint,issued_at,expires_at,state,nonce,deadline) VALUES(?,?,?,?,?,?,?,?,'reserved',?,?) ON CONFLICT(op_key) DO UPDATE SET state='reserved',nonce=excluded.nonce,deadline=excluded.deadline",
      key,
      principal,
      body.surface,
      body.kind,
      body.operationId,
      body.fingerprint,
      body.issuedAt,
      body.issuedAt + ADMISSION.receiptMs,
      nonce,
      deadline,
    );
    return { lease: { key, nonce, expiresAt: deadline } };
  }
  transition(path, body, now) {
    jerryKeys(body, path === '/start' ? ['lease'] : ['lease', 'outcome']);
    jerryKeys(body.lease, ['key', 'nonce', 'expiresAt']);
    jerryAssert(
      typeof body.lease.key === 'string' &&
        body.lease.key.length < 250 &&
        jerryUuid(body.lease.nonce) &&
        Number.isSafeInteger(body.lease.expiresAt),
      400,
      'Invalid admission lease.',
    );
    const old = this.one(
      'SELECT * FROM admission_ops WHERE op_key=?',
      body.lease.key,
    );
    jerryAssert(
      old &&
        old.nonce === body.lease.nonce &&
        old.deadline === body.lease.expiresAt &&
        old.deadline > now,
      409,
      'This admission lease is no longer current.',
      'JERRY_LEASE_EXPIRED',
    );
    if (path === '/start') {
      jerryAssert(
        old.state === 'reserved',
        409,
        'This request was already started.',
        'JERRY_ATTEMPT_PENDING',
      );
      this.sql.exec(
        "UPDATE admission_ops SET state='running' WHERE op_key=?",
        body.lease.key,
      );
    } else {
      jerryAssert(
        old.state === 'running' &&
          ['completed', 'failed'].includes(body.outcome),
        409,
        'This request is not running.',
      );
      this.sql.exec(
        'UPDATE admission_ops SET state=?,nonce=NULL,deadline=? WHERE op_key=?',
        body.outcome === 'failed' ? 'cooldown' : 'completed',
        body.outcome === 'failed' ? old.deadline : null,
        body.lease.key,
      );
    }
    return { ok: true };
  }
  fetch(request) {
    const task = this.queue.then(() => this.handle(request));
    this.queue = task.catch(() => {});
    return task;
  }
  async handle(request) {
    try {
      jerryAssert(
        new URL(request.url).origin === 'https://jerry-admission.internal' &&
          request.method === 'POST',
        404,
        'Not found.',
      );
      const path = new URL(request.url).pathname;
      jerryAssert(
        ['/reserve', '/start', '/finish'].includes(path),
        404,
        'Not found.',
      );
      const body = await jerryJson(request, 4096);
      this.init();
      const result = this.ctx.storage.transactionSync(() => {
        const now = this.now();
        this.sweep(now);
        return path === '/reserve'
          ? this.reserve(body, now)
          : this.transition(path, body, now);
      });
      await this.schedule();
      return jerryResult(result, result.status || 200);
    } catch (error) {
      await this.schedule().catch(() => {});
      return jerryResult(
        {
          error: error.status
            ? error.message
            : 'Jerry admission is unavailable.',
          code: error.code || 'JERRY_ADMISSION_UNAVAILABLE',
        },
        error.status || 503,
      );
    }
  }
  async alarm() {
    const task = this.queue.then(async () => {
      try {
        this.init();
        this.ctx.storage.transactionSync(() => this.sweep(this.now()));
        await this.schedule();
      } catch (error) {
        await this.ctx.storage.setAlarm(this.now() + 60000).catch(() => {});
        throw error;
      }
    });
    this.queue = task.catch(() => {});
    await task;
  }
}

export async function admittedResponse(env, admission, invoke) {
  jerryAssert(
    env.JERRY_ADMISSION,
    503,
    'Jerry admission is not configured.',
    'JERRY_ADMISSION_UNAVAILABLE',
  );
  const stub = env.JERRY_ADMISSION.get(
    env.JERRY_ADMISSION.idFromName('website-admission-v1'),
  );
  const call = async (path, body) => {
    const response = await stub.fetch(
      new Request('https://jerry-admission.internal/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(Error(result.error), {
        status: response.status,
        code: result.code,
        retryAfterMs: result.retryAfterMs,
      });
    return result;
  };
  const { lease } = await call('reserve', admission);
  await call('start', { lease });
  let result;
  try {
    result = await invoke();
  } catch (error) {
    await call('finish', { lease, outcome: 'failed' }).catch(() => {});
    throw error;
  }
  await call('finish', { lease, outcome: 'completed' });
  return result;
}
