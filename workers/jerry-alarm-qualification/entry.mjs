// Isolated synthetic probe only. No public control surface or outbound fetch.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { JerryConversations } from '../aircraft-sale/jerry-conversations.mjs';
import { JerryAdmission } from '../jerry-response/admission.mjs';
import { PROBE, teardownPlan } from './plan.mjs';

const ids = {
  public: '00000000-0000-4000-8000-000000000001',
  exchange: '00000000-0000-4000-8000-000000000002',
};
const owner = 'a'.repeat(64);
function config(env) {
  const start = Number(env.PROBE_START_AT),
    stop = Number(env.PROBE_STOP_AT);
  if (
    env.PROBE_ARMED !== 'true' ||
    !['prepare-v1', 'rollback-v1', 'teardown-v1'].includes(env.PROBE_BUILD) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(stop) ||
    start <= 0 ||
    stop !== start + PROBE.activeMs ||
    env.JERRY_CONVERSATIONS_ENABLED !== 'false' ||
    Object.keys(env).some((key) =>
      /^(OPENAI_|JERRY_MODEL|JERRY_PROMPT_CACHE)/.test(key),
    )
  )
    throw Error(
      'Probe is unarmed or configuration is outside the isolated contract.',
    );
  return { start, stop, cleanup: start + PROBE.cleanupMs };
}
const ns = (env, binding, name) =>
  env[binding].get(env[binding].idFromName(name));
async function invoke(env, binding, name, path, body = {}, surface) {
  const response = await ns(env, binding, name).fetch(
    new Request(
      (binding === 'JERRY_ADMISSION'
        ? 'https://jerry-admission.internal'
        : 'https://probe.internal') + path,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(surface
            ? { 'X-Jerry-Owner': owner, 'X-Jerry-Surface': surface }
            : {}),
        },
        body: JSON.stringify(body),
      },
    ),
  );
  const value = await response.json();
  if (
    !response.ok &&
    path === '/teardown' &&
    value.preserveClassesAndBindings === true
  )
    return { ...value, status: response.status };
  if (!response.ok)
    throw Error(value.error || 'Synthetic probe operation failed.');
  return value;
}
const control = (env, path, body = {}) =>
  invoke(env, 'PROBE_CONTROL', 'seller-v2', path, body);
async function event(env, value) {
  return control(env, '/event', value);
}
function instrument(Base, kind) {
  return class extends Base {
    constructor(ctx, env) {
      super(ctx, env);
      this.boot = crypto.randomUUID();
    }
    async fetch(request) {
      try {
        const cfg = config(this.env),
          path = new URL(request.url).pathname;
        if (path.startsWith('/__probe/')) {
          await request.arrayBuffer();
          if (Date.now() > cfg.cleanup)
            return Response.json(
              { error: 'Cleanup window expired' },
              { status: 410 },
            );
          if (path === '/__probe/inspect')
            return Response.json(await this.snapshot());
          if (path === '/__probe/reset') {
            await event(this.env, {
              type: 'reset-intent',
              kind,
              boot: this.boot,
            });
            this.ctx.abort('Synthetic qualification reset');
          }
          if (path === '/__probe/expire' && kind === 'conversation') {
            if (
              this.env.PROBE_BUILD !== 'prepare-v1' ||
              Date.now() > cfg.start + 30000
            )
              throw Error('Setup closed');
            await this.tx(async (tx) => {
              for (const meta of await this.items(tx, 'c:')) {
                meta.expiresAt = cfg.start + 60000;
                await tx.put('c:' + meta.id, meta);
              }
            });
            await this.schedule();
            return Response.json({ ok: true });
          }
          if (path === '/__probe/drain') {
            const state = await this.snapshot();
            const pending =
              kind === 'conversation'
                ? state.live + state.imports + state.turns
                : state.ops.length + state.rates.length;
            if (pending || state.alarm)
              return Response.json(
                { error: 'Pending data or alarm; preserve capability' },
                { status: 409 },
              );
            await this.ctx.storage.deleteAll();
            return Response.json({ drained: true });
          }
          throw Error('Unknown private probe operation');
        }
        if (
          Date.now() < cfg.start ||
          Date.now() > cfg.stop ||
          this.env.PROBE_BUILD !== 'prepare-v1'
        )
          throw Error('New native requests are closed');
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 4096)
          throw Error('Synthetic request exceeds fixture limit');
        const value = JSON.parse(raw);
        const short = (item) => {
          if (typeof item === 'string') return item.length <= 256;
          if (Array.isArray(item)) return item.every(short);
          return (
            !item ||
            typeof item !== 'object' ||
            Object.values(item).every(short)
          );
        };
        if (!short(value))
          throw Error('Only short synthetic fixture values are allowed');
        request = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: raw,
        });
        const gate = await event(this.env, {
          type: 'native-request',
          kind,
          boot: this.boot,
        });
        if (!gate.allowed)
          return Response.json(
            { error: 'Probe budget exhausted' },
            { status: 429 },
          );
        try {
          return await super.fetch(request);
        } finally {
          await event(this.env, {
            type: 'native-complete',
            kind,
            boot: this.boot,
          });
        }
      } catch {
        return Response.json(
          { error: 'Probe request rejected' },
          { status: 503 },
        );
      }
    }
    async snapshot() {
      const alarm = await this.ctx.storage.getAlarm();
      if (kind === 'conversation') {
        const entries = await this.ctx.storage.list();
        const keys = [...entries.keys()];
        return {
          boot: this.boot,
          build: this.env.PROBE_BUILD,
          alarm,
          logicalRecords: entries.size,
          logicalBytes: new TextEncoder().encode(JSON.stringify([...entries]))
            .length,
          live: keys.filter((k) => k.startsWith('c:')).length,
          turns: keys.filter((k) => k.startsWith('t:')).length,
          imports: keys.filter((k) => k.startsWith('i:')).length,
          tombstones: keys.filter((k) => k.startsWith('d:')).length,
          metas: [...entries]
            .filter(([k]) => k.startsWith('c:'))
            .map(([, m]) => ({
              status: m.status,
              nextCleanupAt: m.nextCleanupAt,
              logs: Object.keys(m.logsToWrite || {}).length,
            })),
        };
      }
      this.init();
      const rows = this.sql.exec('SELECT * FROM admission_ops').toArray();
      const rates = this.sql.exec('SELECT * FROM admission_rates').toArray();
      return {
        boot: this.boot,
        build: this.env.PROBE_BUILD,
        alarm,
        logicalRecords: rows.length + rates.length,
        logicalBytes: new TextEncoder().encode(JSON.stringify({ rows, rates }))
          .length,
        ops: this.sql
          .exec('SELECT state,expires_at,deadline FROM admission_ops')
          .toArray(),
        rates: this.sql
          .exec('SELECT expires_at FROM admission_rates')
          .toArray(),
      };
    }
    async alarm(info) {
      let cfg;
      try {
        cfg = config(this.env);
      } catch {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const gate = await event(this.env, {
        type: 'alarm-enter',
        kind,
        boot: this.boot,
        origin:
          info?.localSimulation === true
            ? 'controlled-local'
            : info && Number.isInteger(info.retryCount)
              ? 'runtime-callback'
              : 'unverified-callback',
        retryCount: info?.retryCount || 0,
      });
      if (!gate.allowed || Date.now() > cfg.stop) {
        if (gate.reason === 'concurrency' && Date.now() < cfg.stop)
          await this.ctx.storage.setAlarm(Date.now() + 1000);
        else await this.ctx.storage.deleteAlarm();
        return;
      }
      // The only call to the native handler is inside this platform callback.
      try {
        await super.alarm(info);
      } finally {
        await event(this.env, {
          type: 'alarm-complete',
          kind,
          boot: this.boot,
        });
      }
    }
  };
}
export class JerryConversationsProbe extends instrument(
  JerryConversations,
  'conversation',
) {
  // Native alarm self-acknowledgments must remain permitted after entry rollback.
  async fetch(request) {
    if (
      ['/cleanup-complete', '/log-complete'].includes(
        new URL(request.url).pathname,
      )
    )
      return JerryConversations.prototype.fetch.call(this, request);
    return super.fetch(request);
  }
}
export class JerryAdmissionProbe extends instrument(
  JerryAdmission,
  'admission',
) {}

export class ProbeControl {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async update(fn) {
    return this.ctx.storage.transaction(async (tx) => {
      const state = await tx.get('run');
      if (!state) throw Error('Run not initialized');
      const result = await fn(state);
      if (
        new TextEncoder().encode(JSON.stringify(state)).length > PROBE.bytes ||
        state.events.length > PROBE.events ||
        Object.keys(state.copies).length > 2
      )
        throw Error('Probe storage limit');
      await tx.put('run', state);
      return result;
    });
  }
  async fetch(request) {
    try {
      const cfg = config(this.env),
        url = new URL(request.url),
        raw = await request.text();
      if (new TextEncoder().encode(raw).length > 4096)
        throw Error('Control input too large');
      const body = JSON.parse(raw);
      if (url.origin === 'https://seller-service.internal') {
        if (
          ![
            '/api/aircraft-sale/_jerry/erase',
            '/api/aircraft-sale/_jerry/log-committed',
          ].includes(url.pathname) ||
          body.owner !== owner ||
          ids[body.surface] !== body.id
        )
          throw Error('Foreign sink reference');
        const erased = url.pathname.endsWith('/erase');
        const failed =
          erased &&
          body.surface === 'exchange' &&
          Date.now() < cfg.start + 150000;
        const result = await this.update((s) => {
          if (s.events.length >= PROBE.events || Date.now() > cfg.cleanup)
            return { allowed: false };
          s.events.push({
            type: erased ? 'copy-cleanup' : 'log-reference',
            at: Date.now(),
            build: this.env.PROBE_BUILD,
            surface: body.surface,
            status: failed ? 503 : 200,
          });
          if (erased && !failed) delete s.copies[body.id];
          return { allowed: true };
        });
        return Response.json(
          { ok: !failed && result.allowed },
          { status: !result.allowed ? 429 : failed ? 503 : 200 },
        );
      }
      if (url.origin !== 'https://probe.internal')
        throw Error('Private probe capability required');
      if (url.pathname === '/start') {
        if (
          this.env.PROBE_BUILD !== 'prepare-v1' ||
          Date.now() < cfg.start ||
          Date.now() > cfg.start + 30000
        )
          throw Error('Bootstrap closed');
        const fresh = await this.ctx.storage.transaction(async (tx) => {
          if (await tx.get('run')) return false;
          await tx.put('run', {
            start: cfg.start,
            events: [],
            controls: 1,
            inFlight: 0,
            admissions: 0,
            copies: {},
            draft: {
              title: 'Independent synthetic tool draft',
              value: 'preserve',
            },
            phase: 'preparing',
          });
          return true;
        });
        if (!fresh) {
          const allowed = await this.update((s) => {
            if (s.controls >= PROBE.controls) return false;
            s.controls++;
            return true;
          });
          return Response.json(
            allowed
              ? { alreadyStarted: true }
              : { error: 'Control budget exhausted' },
            { status: allowed ? 200 : 429 },
          );
        }
        await this.prepare(cfg);
        return Response.json({ started: true });
      }
      if (url.pathname === '/event') {
        if (
          Object.keys(body).some(
            (k) =>
              !['type', 'kind', 'boot', 'origin', 'retryCount'].includes(k),
          ) ||
          ![
            'native-request',
            'native-complete',
            'reset-intent',
            'alarm-enter',
            'alarm-complete',
          ].includes(body.type) ||
          !['conversation', 'admission'].includes(body.kind) ||
          typeof body.boot !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(body.boot)
        )
          throw Error('Invalid metadata');
        const result = await this.update((s) => {
          if (Date.now() > cfg.stop || s.events.length >= PROBE.events)
            return { allowed: false };
          if (
            ['native-request', 'alarm-enter'].includes(body.type) &&
            s.inFlight >= 2
          ) {
            s.events.push({
              ...body,
              at: Date.now(),
              build: this.env.PROBE_BUILD,
              denied: 'concurrency',
            });
            return { allowed: false, reason: 'concurrency' };
          }
          if (body.type === 'native-request') {
            s.nativeCounts ??= { conversation: 0, admission: 0 };
            if (
              s.nativeCounts[body.kind] >=
              (body.kind === 'conversation' ? 8 : 60)
            )
              return { allowed: false };
            s.inFlight++;
            s.nativeCounts[body.kind]++;
          }
          if (body.type === 'alarm-enter') s.inFlight++;
          if (['native-complete', 'alarm-complete'].includes(body.type))
            s.inFlight = Math.max(0, s.inFlight - 1);
          s.events.push({
            ...body,
            at: Date.now(),
            build: this.env.PROBE_BUILD,
          });
          return { allowed: true };
        });
        return Response.json(result);
      }
      // Control requests are bounded independently of native callbacks.
      const allowed = await this.update((s) => {
        if (s.controls >= PROBE.controls || Date.now() > cfg.cleanup)
          return false;
        s.controls++;
        return true;
      });
      if (!allowed)
        return Response.json(
          { error: 'Control budget exhausted' },
          { status: 429 },
        );
      if (url.pathname === '/inspect')
        return Response.json(await this.ctx.storage.get('run'));
      if (url.pathname === '/reset') {
        for (const [binding, name] of [
          ['JERRY_CONVERSATIONS', 'synthetic:public'],
          ['JERRY_CONVERSATIONS', 'synthetic:exchange'],
          ['JERRY_ADMISSION', 'website-admission-v1'],
        ]) {
          // abort deliberately disconnects its caller; never automatically retry.
          await invoke(this.env, binding, name, '/__probe/reset').catch(
            () => {},
          );
        }
        return Response.json({ resetRequested: true });
      }
      if (url.pathname === '/checkpoint') {
        const snapshot = await this.inspectTargets();
        await this.update((s) => {
          s.checkpoints ??= [];
          if (s.checkpoints.length >= 4) throw Error('Checkpoint limit');
          s.checkpoints.push({ at: Date.now(), snapshot });
        });
        return Response.json(snapshot);
      }
      if (url.pathname === '/teardown') {
        const targets = await this.inspectTargets(),
          state = await this.ctx.storage.get('run');
        const plan = teardownPlan({
          pendingCopies: Object.keys(state.copies).length,
          outboxes: targets.conversations.reduce(
            (n, c) => n + c.live + c.imports + c.turns,
            0,
          ),
          unexpiredReceipts:
            targets.admission.ops.length + targets.admission.rates.length,
          alarms:
            targets.conversations.filter((c) => c.alarm).length +
            Number(!!targets.admission.alarm),
        });
        if (plan.pending) return Response.json(plan, { status: 409 });
        for (const surface of ['public', 'exchange'])
          await invoke(
            this.env,
            'JERRY_CONVERSATIONS',
            'synthetic:' + surface,
            '/__probe/drain',
          );
        await invoke(
          this.env,
          'JERRY_ADMISSION',
          'website-admission-v1',
          '/__probe/drain',
        );
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        return Response.json({ ...plan, drained: true });
      }
      throw Error('Unknown control');
    } catch {
      return Response.json(
        { error: 'Isolated probe control rejected' },
        { status: 503 },
      );
    }
  }
  async prepare(cfg) {
    for (const surface of ['public', 'exchange']) {
      const send = (path, body) =>
        invoke(
          this.env,
          'JERRY_CONVERSATIONS',
          'synthetic:' + surface,
          path,
          body,
          surface,
        );
      const id = ids[surface];
      await this.update((s) => {
        s.copies[id] = 'Synthetic receipt copy';
      });
      await send('/create', { id });
      await send('/import', {
        id,
        generation: 1,
        operationId: crypto.randomUUID(),
        consent: true,
        messages: [
          { role: 'user', content: 'Synthetic explicit guest import' },
        ],
      });
      const turnId = crypto.randomUUID();
      const reserved = await send('/reserve', {
        id,
        generation: 1,
        turnId,
        input: {
          message: 'Synthetic alarm question',
          page: surface === 'public' ? '/' : '/aircraft-for-sale',
          locale: 'en',
          mode: 'chat',
        },
      });
      await send('/finalize', {
        id,
        generation: 1,
        turnId,
        lease: reserved.turn.lease,
        result: { reply: 'Fixed synthetic reply' },
      });
      await send('/__probe/expire', {});
    }
    const call = (path, body) =>
      invoke(this.env, 'JERRY_ADMISSION', 'website-admission-v1', path, body);
    for (const state of ['reserved', 'running', 'completed']) {
      await this.update((s) => {
        if (++s.admissions > 20) throw Error('Admission operation cap');
      });
      const { lease } = await call('/reserve', {
        category: 'account',
        principal: (state === 'reserved'
          ? 'b'
          : state === 'running'
            ? 'c'
            : 'd'
        ).repeat(64),
        surface: 'public',
        kind: 'respond',
        operationId: crypto.randomUUID(),
        issuedAt: cfg.start - 86400000 + 180000,
        fingerprint: 'e'.repeat(64),
      });
      if (state !== 'reserved') await call('/start', { lease });
      if (state === 'completed')
        await call('/finish', { lease, outcome: 'completed' });
    }
    await this.update((s) => {
      s.phase = 'prepared';
    });
    await this.ctx.storage.setAlarm(cfg.start + 105000);
  }
  async inspectTargets() {
    const conversations = [];
    for (const surface of ['public', 'exchange'])
      conversations.push(
        await invoke(
          this.env,
          'JERRY_CONVERSATIONS',
          'synthetic:' + surface,
          '/__probe/inspect',
        ),
      );
    return {
      conversations,
      admission: await invoke(
        this.env,
        'JERRY_ADMISSION',
        'website-admission-v1',
        '/__probe/inspect',
      ),
    };
  }
  async alarm(info) {
    const cfg = config(this.env);
    if (Date.now() > cfg.stop) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.update((s) => {
      if (s.events.length >= PROBE.events) throw Error('Budget');
      s.events.push({
        type: 'coordinator-alarm',
        at: Date.now(),
        origin: info?.localSimulation ? 'controlled-local' : 'runtime-callback',
        build: this.env.PROBE_BUILD,
      });
    });
    const snapshot = await this.inspectTargets();
    await this.update((s) => {
      s.checkpoints ??= [];
      if (s.checkpoints.length >= 4) throw Error('Checkpoint limit');
      s.checkpoints.push({ at: Date.now(), snapshot });
    });
    const next = [105000, 215000, 325000]
      .map((n) => cfg.start + n)
      .find((at) => at > Date.now());
    if (next) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }
}
export default class ProbeOperator extends WorkerEntrypoint {
  fetch() {
    return new Response('Not found', { status: 404 });
  }
  async scheduled() {
    return this.prepare();
  }
  async prepare() {
    config(this.env);
    return control(this.env, '/start');
  }
  // Native service-binding capabilities only, never HTTP routes.
  async inspect() {
    return control(this.env, '/inspect');
  }
  async reset() {
    return control(this.env, '/reset');
  }
  async checkpoint() {
    return control(this.env, '/checkpoint');
  }
  async teardown() {
    return control(this.env, '/teardown');
  }
}
