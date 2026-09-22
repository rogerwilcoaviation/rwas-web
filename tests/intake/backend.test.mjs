import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const source = `export {onRequestPost as intake} from './functions/api/service-intake.ts';
export {onRequestPost as dispatch} from './functions/api/intake-dispatch.ts';
export {onRequestGet as receipt} from './functions/api/service-receipt.ts';`;
const compiled = await build({
  stdin: { contents: source, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-09-01',
  d1Databases: ['INTAKE_RECEIPTS'],
});
const db = await mf.getD1Database('INTAKE_RECEIPTS');
const migration = await readFile('migrations/intake/0001_receipts.sql', 'utf8');
// Actual local workerd D1; no SQL mock, remote DB, or email provider.
for (const sql of migration
  .replace(/--[^\n]*/g, '')
  .split(';')
  .filter((s) => s.trim()))
  await db.prepare(sql).run();
const env = {
  INTAKE_RECEIPTS: db,
  INTAKE_DISPATCH_SECRET: 'offline-test-secret-'.repeat(4),
  RESEND_API_KEY: 'offline-only',
  CONTACT_FROM_EMAIL: 'Tests <sender@example.test>',
  CONTACT_TO_EMAIL: 'service@example.test',
  TURNSTILE_SECRET_KEY: 'offline-only',
};
const originalFetch = globalThis.fetch;
let emails = [],
  provider = () =>
    new Response(JSON.stringify({ id: crypto.randomUUID() }), { status: 200 });
globalThis.fetch = async (url, options) => {
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
    return Response.json({
      success: true,
      hostname: 'www.rogerwilcoaviation.com',
      action: 'service_intake',
    });
  assert.equal(url, 'https://api.resend.com/emails');
  emails.push(options);
  return provider(options);
};
const payload = () => ({
  name: 'Test Person',
  email: 'person@example.test',
  message: 'Please inspect my avionics.',
  consent: true,
  requestId: crypto.randomUUID(),
  turnstileToken: 'offline',
  website: '',
});
let ip = 0;
const submit = (body, customEnv = env, headers = {}) =>
  api.intake({
    env: customEnv,
    request: new Request(
      'https://www.rogerwilcoaviation.com/api/service-intake',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://www.rogerwilcoaviation.com',
          'CF-Connecting-IP': `192.0.2.${++ip}`,
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
    ),
  });
const dispatch = (customEnv = env, secret = env.INTAKE_DISPATCH_SECRET) =>
  api.dispatch({
    env: customEnv,
    request: new Request(
      'https://www.rogerwilcoaviation.com/api/intake-dispatch',
      { method: 'POST', headers: { Authorization: `Bearer ${secret}` } },
    ),
  });
const reset = async () => {
  await db.batch(
    [
      'DELETE FROM intake_attempts',
      'DELETE FROM intake_outbox',
      'DELETE FROM intake_receipts',
      'DELETE FROM intake_rate',
    ].map((s) => db.prepare(s)),
  );
  emails = [];
  provider = () => Response.json({ id: crypto.randomUUID() });
};

test('durable intake and outbox integration', async (t) => {
  try {
    await t.test(
      'validation, origin, configuration and byte limits fail closed',
      async () => {
        for (const body of [
          'null',
          '[]',
          '{',
          { ...payload(), name: 7 },
          { ...payload(), consent: false },
          { ...payload(), website: 'bot' },
          { ...payload(), message: '😀'.repeat(5000) },
        ])
          assert.equal((await submit(body)).status, 400);
        assert.equal(
          (await submit(payload(), env, { Origin: 'https://evil.test' }))
            .status,
          403,
        );
        assert.equal(
          (await submit(payload(), { ...env, CONTACT_TO_EMAIL: undefined }))
            .status,
          503,
        );
        assert.equal(emails.length, 0);
      },
    );
    await t.test(
      'atomic durable acknowledgement, replay token and conflict',
      async () => {
        const p = payload();
        const response = await submit(p);
        assert.equal(response.status, 202);
        const a = await response.json();
        assert.match(a.receiptToken, /^[a-f0-9]{64}$/);
        const b = await (await submit(p)).json();
        assert.equal(b.receiptToken, a.receiptToken);
        assert.equal(
          (await submit({ ...p, message: 'Different message content.' }))
            .status,
          409,
        );
        const stored = await db
          .prepare('SELECT * FROM intake_receipts')
          .first();
        assert.notEqual(stored.token_hash, a.receiptToken);
        assert.equal(
          (await db.prepare('SELECT COUNT(*) n FROM intake_outbox').first()).n,
          1,
        );
        const receipt = await api.receipt({
          env,
          request: new Request('https://example.test', {
            headers: { Authorization: `Bearer ${a.receiptToken}` },
          }),
        });
        const status = await receipt.json();
        assert.equal(status.status, 'queued');
        assert.equal(status.deliveryConfirmed, false);
        assert.equal(JSON.stringify(status).includes(p.email), false);
        assert.equal(
          (
            await api.receipt({
              env,
              request: new Request(
                `https://example.test?token=${a.receiptToken}`,
              ),
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      'database failure never acknowledges; batch failure rolls back receipt',
      async () => {
        await reset();
        await db
          .prepare(
            `CREATE TRIGGER reject_outbox BEFORE INSERT ON intake_outbox BEGIN SELECT RAISE(ABORT,'offline fault'); END`,
          )
          .run();
        assert.equal((await submit(payload())).status, 503);
        assert.equal(
          (await db.prepare('SELECT COUNT(*) n FROM intake_receipts').first())
            .n,
          0,
        );
        await db.prepare('DROP TRIGGER reject_outbox').run();
      },
    );
    await t.test(
      'dispatch authentication, accepted not delivered, immutable fixed plaintext mail',
      async () => {
        await reset();
        await submit({
          ...payload(),
          message: '<script>alert(1)</script> shell: rm -rf /',
        });
        assert.equal((await dispatch(env, 'wrong')).status, 401);
        assert.equal(emails.length, 0);
        assert.equal((await dispatch()).status, 200);
        assert.equal(emails.length, 1);
        const mail = JSON.parse(emails[0].body);
        assert.deepEqual(mail.to, ['service@example.test']);
        assert.equal(mail.html, undefined);
        assert.equal(
          (await db.prepare('SELECT status FROM intake_outbox').first()).status,
          'provider_accepted',
        );
        await dispatch();
        assert.equal(emails.length, 1);
      },
    );
    await t.test(
      'concurrent dispatch claims once and persists attempts before network',
      async () => {
        await reset();
        await submit(payload());
        provider = async () => {
          assert.equal(
            (await db.prepare('SELECT COUNT(*) n FROM intake_attempts').first())
              .n,
            1,
          );
          await new Promise((r) => setTimeout(r, 20));
          return Response.json({ id: 'provider-id' });
        };
        await Promise.all([dispatch(), dispatch(), dispatch()]);
        assert.equal(emails.length, 1);
      },
    );
    await t.test(
      'unknown network retries exact body/key, honors 429 and 23h boundary',
      async () => {
        await reset();
        await submit(payload());
        provider = () => {
          throw Error('offline timeout');
        };
        await dispatch();
        assert.equal(
          (await db.prepare('SELECT status FROM intake_outbox').first()).status,
          'retry',
        );
        await db.prepare('UPDATE intake_outbox SET next_attempt_at=0').run();
        provider = () =>
          new Response('', { status: 429, headers: { 'Retry-After': '7200' } });
        await dispatch();
        assert.equal(emails.length, 2);
        assert.equal(emails[0].body, emails[1].body);
        assert.equal(
          emails[0].headers['Idempotency-Key'],
          emails[1].headers['Idempotency-Key'],
        );
        assert.ok(
          (
            await db
              .prepare('SELECT next_attempt_at FROM intake_outbox')
              .first()
          ).next_attempt_at >
            Date.now() + 7100000,
        );
        await db
          .prepare(
            'UPDATE intake_outbox SET first_attempt_at=?,next_attempt_at=0',
          )
          .bind(Date.now() - 23 * 3600000 - 100)
          .run();
        await dispatch();
        assert.equal(emails.length, 2);
        assert.equal(
          (await db.prepare('SELECT status FROM intake_outbox').first()).status,
          'needs_review',
        );
      },
    );
    await t.test(
      'expired leases recover, stale fences cannot finalize, max attempts dead-letter',
      async () => {
        await reset();
        await submit(payload());
        await db
          .prepare(
            `UPDATE intake_outbox SET status='sending',lease_token='old',lease_until=0,attempts=5,first_attempt_at=?`,
          )
          .bind(Date.now())
          .run();
        provider = () => {
          throw Error('offline');
        };
        await dispatch();
        assert.equal(
          (
            await db
              .prepare('SELECT status,attempts FROM intake_outbox')
              .first()
          ).status,
          'dead_letter',
        );
        assert.equal(
          (await db.prepare('SELECT attempts FROM intake_outbox').first())
            .attempts,
          6,
        );
        await db
          .prepare(
            `UPDATE intake_outbox SET status='provider_accepted' WHERE lease_token='old'`,
          )
          .run();
        assert.equal(
          (await db.prepare('SELECT status FROM intake_outbox').first()).status,
          'dead_letter',
        );
      },
    );
    await t.test(
      'concurrent admission caps at 50, drain <=5, daily attempt cap <=50',
      async () => {
        await reset();
        const results = await Promise.all(
          Array.from({ length: 55 }, () => submit(payload())),
        );
        assert.equal(results.filter((r) => r.status === 202).length, 50);
        assert.equal(results.filter((r) => r.status === 429).length, 5);
        await dispatch();
        assert.equal(emails.length, 5);
        for (let i = 0; i < 10; i++) await dispatch();
        assert.equal(emails.length, 50);
        assert.equal(
          (await db.prepare('SELECT COUNT(*) n FROM intake_attempts').first())
            .n,
          50,
        );
        await db
          .prepare(
            `UPDATE intake_outbox SET status='retry',next_attempt_at=0 WHERE receipt_id=(SELECT receipt_id FROM intake_outbox LIMIT 1)`,
          )
          .run();
        await dispatch();
        assert.equal(emails.length, 50);
      },
    );
    await t.test('per-IP durable admission cap', async () => {
      await reset();
      const responses = [];
      for (let i = 0; i < 6; i++)
        responses.push(
          await submit(payload(), env, { 'CF-Connecting-IP': '192.0.2.240' }),
        );
      assert.deepEqual(
        responses.map((r) => r.status),
        [202, 202, 202, 202, 202, 429],
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    await mf.dispose();
  }
});
