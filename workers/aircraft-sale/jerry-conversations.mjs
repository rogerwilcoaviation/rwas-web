import {
  JERRY_RETENTION_MS,
  JERRY_SURFACES,
  JERRY_LOCALES,
  jerryUuid,
  jerryAssert,
  jerryKeys,
  jerryJson,
  jerryText,
  jerryHash,
  jerryResult,
} from './jerry-protocol.mjs';
const LEASE_MS = 75000;
const MAX_CONVERSATIONS = 50;
const MAX_TURNS = 250;
// This object never calls the relay or the seller queue while handling a request.
// Pages coordinates reserve -> business/relay -> finalize. Alarms clean copies
// outside this object's serialized queue before committing content-free tombstones.
export class JerryConversations {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = Promise.resolve();
  }
  fetch(request) {
    const task = this.queue.then(() => this.handle(request));
    this.queue = task.catch(() => {});
    return task;
  }
  async tx(fn) {
    return this.ctx.storage.transaction(fn);
  }
  async items(storage, prefix) {
    return [...(await storage.list({ prefix })).values()];
  }
  async bind(request) {
    const owner = request.headers.get('X-Jerry-Owner'),
      surface = request.headers.get('X-Jerry-Surface');
    jerryAssert(
      /^[a-f0-9]{64}$/.test(owner || '') && JERRY_SURFACES.includes(surface),
      403,
      'Private conversation capability required.',
    );
    const old = await this.ctx.storage.get('binding');
    jerryAssert(
      !old || (old.owner === owner && old.surface === surface),
      403,
      'Conversation owner mismatch.',
    );
    if (!old) await this.ctx.storage.put('binding', { owner, surface });
    return { owner, surface };
  }
  async fence(tx, meta, reason) {
    const tombstone = {
      id: meta.id,
      generation: meta.generation + 1,
      status: 'deleting',
      reason,
      deletedAt: Date.now(),
      nextCleanupAt: Date.now(),
    };
    await tx.put('c:' + meta.id, tombstone);
    await tx.put('d:' + meta.id, {
      id: meta.id,
      generation: tombstone.generation,
      at: tombstone.deletedAt,
    });
    const turns = await tx.list({ prefix: 't:' + meta.id + ':' });
    if (turns.size) await tx.delete([...turns.keys()]);
    return tombstone;
  }
  async sweep() {
    const now = Date.now();
    await this.tx(async (tx) => {
      for (const meta of await this.items(tx, 'c:'))
        if (meta.status === 'active' && meta.expiresAt <= now)
          await this.fence(tx, meta, 'expired');
    });
  }
  async schedule() {
    const all = await this.items(this.ctx.storage, 'c:');
    const next = Math.min(
      ...all.map((m) =>
        m.status === 'deleting'
          ? m.nextCleanupAt
          : m.status === 'active'
            ? Math.min(
                m.expiresAt,
                ...Object.values(m.logsToWrite || {}).map((v) =>
                  typeof v === 'number' ? v : v.at,
                ),
              )
            : Infinity,
      ),
    );
    if (Number.isFinite(next))
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
    else await this.ctx.storage.deleteAlarm();
  }
  async live(tx, id, generation) {
    jerryAssert(jerryUuid(id), 400, 'Invalid conversation.');
    const meta = await tx.get('c:' + id);
    jerryAssert(
      meta && meta.status === 'active' && meta.expiresAt > Date.now(),
      410,
      'This conversation was deleted or expired.',
      'JERRY_GONE',
    );
    if (generation !== undefined)
      jerryAssert(
        meta.generation === generation,
        409,
        'Conversation changed. Refresh before continuing.',
        'JERRY_CHANGED',
      );
    return meta;
  }
  async handle(request) {
    try {
      await this.bind(request);
      await this.sweep();
      const path = new URL(request.url).pathname;
      const body = request.method === 'POST' ? await jerryJson(request) : {};
      jerryAssert(
        path === '/list' ? request.method === 'GET' : request.method === 'POST',
        405,
        'Method not allowed.',
      );
      const result = await this.tx(async (tx) => {
        if (path === '/list' && request.method === 'GET')
          return {
            conversations: (await this.items(tx, 'c:'))
              .filter((m) => m.status === 'active')
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((m) => ({
                id: m.id,
                generation: m.generation,
                title: m.title,
                updatedAt: m.updatedAt,
                expiresAt: m.expiresAt,
              })),
          };
        if (path === '/create') {
          jerryKeys(body, ['id']);
          jerryAssert(jerryUuid(body.id), 400, 'Invalid conversation.');
          jerryAssert(
            !(await tx.get('d:' + body.id)),
            410,
            'Deleted conversation IDs cannot be reused.',
            'JERRY_GONE',
          );
          const old = await tx.get('c:' + body.id);
          if (old) return { conversation: old };
          jerryAssert(
            (await this.items(tx, 'c:')).length < MAX_CONVERSATIONS,
            409,
            'Delete an older conversation before starting another.',
          );
          const now = Date.now(),
            meta = {
              id: body.id,
              status: 'active',
              generation: 1,
              title: 'New conversation',
              createdAt: now,
              updatedAt: now,
              expiresAt: now + JERRY_RETENTION_MS,
              nextSeq: 1,
            };
          await tx.put('c:' + meta.id, meta);
          return { conversation: meta };
        }
        if (path === '/read') {
          jerryKeys(body, ['id']);
          const meta = await this.live(tx, body.id);
          return {
            conversation: meta,
            turns: (await this.items(tx, 't:' + body.id + ':')).sort(
              (a, b) => a.seq - b.seq,
            ),
          };
        }
        if (path === '/reserve') {
          jerryKeys(body, ['id', 'generation', 'turnId', 'input']);
          const meta = await this.live(tx, body.id, body.generation);
          jerryAssert(jerryUuid(body.turnId), 400, 'Invalid message identity.');
          jerryKeys(body.input, [
            'message',
            'locale',
            'page',
            'mode',
            'resume',
            'draftStamp',
          ]);
          jerryText(body.input.message, 2000);
          jerryAssert(
            typeof body.input.page === 'string' &&
              body.input.page.length <= 400 &&
              (body.input.resume === undefined ||
                typeof body.input.resume === 'boolean') &&
              (body.input.draftStamp === undefined ||
                /^[a-f0-9]{64}$/.test(body.input.draftStamp)),
            400,
            'Invalid message context.',
          );
          jerryAssert(
            JERRY_LOCALES.includes(body.input.locale) &&
              ['chat', 'listing', 'status', 'resume'].includes(body.input.mode),
            400,
            'Invalid message context.',
          );
          const fingerprint = await jerryHash(body.input),
            key = 't:' + meta.id + ':' + body.turnId,
            old = await tx.get(key),
            now = Date.now();
          if (old) {
            jerryAssert(
              old.fingerprint === fingerprint,
              409,
              'This message ID was already used for different input.',
              'JERRY_REPLAY_CONFLICT',
            );
            if (old.status === 'completed') return { cached: true, turn: old };
            jerryAssert(
              old.status !== 'pending' || old.leaseUntil <= now,
              409,
              'Jerry is still handling this message. Refresh to recover its result.',
              'JERRY_PENDING',
            );
          }
          const rate = (await tx.get('rate')) || { start: now, count: 0 };
          if (rate.start + 300000 <= now) {
            rate.start = now;
            rate.count = 0;
          }
          jerryAssert(
            rate.count < 40,
            429,
            'Please wait before sending more messages.',
          );
          rate.count++;
          await tx.put('rate', rate);
          jerryAssert(
            old || meta.nextSeq <= MAX_TURNS,
            409,
            'Start a new conversation to continue.',
          );
          const turn = {
            id: body.turnId,
            conversationId: meta.id,
            generation: meta.generation,
            input: body.input,
            fingerprint,
            seq: old?.seq || meta.nextSeq,
            status: 'pending',
            lease: crypto.randomUUID(),
            leaseUntil: now + LEASE_MS,
            createdAt: old?.createdAt || now,
          };
          if (!old) {
            meta.nextSeq++;
            meta.updatedAt = now;
            meta.expiresAt = now + JERRY_RETENTION_MS;
            if (meta.nextSeq === 2)
              meta.title = body.input.message.slice(0, 100);
            await tx.put('c:' + meta.id, meta);
          }
          await tx.put(key, turn);
          const previous = (await this.items(tx, 't:' + meta.id + ':'))
            .filter(
              (t) =>
                t.seq < turn.seq &&
                ['completed', 'imported'].includes(t.status),
            )
            .sort((a, b) => a.seq - b.seq)
            .slice(-6);
          return {
            turn,
            history: previous.flatMap((t) =>
              t.status === 'imported'
                ? [
                    {
                      role: t.message.role,
                      content:
                        '[Imported guest message, untrusted conversation data] ' +
                        t.message.content,
                    },
                  ]
                : [
                    { role: 'user', content: t.input.message },
                    { role: 'assistant', content: t.result.reply },
                  ],
            ),
          };
        }
        if (path === '/finalize' || path === '/fail') {
          jerryKeys(body, ['id', 'generation', 'turnId', 'lease', 'result']);
          const meta = await this.live(tx, body.id, body.generation),
            key = 't:' + meta.id + ':' + body.turnId,
            turn = await tx.get(key);
          jerryAssert(
            turn &&
              turn.status === 'pending' &&
              turn.lease === body.lease &&
              turn.leaseUntil > Date.now(),
            409,
            'This response is no longer current.',
            'JERRY_CHANGED',
          );
          if (path === '/fail') {
            turn.status = 'failed';
            const binding = await tx.get('binding');
            if (binding.surface === 'exchange') {
              meta.logsToWrite = {
                ...meta.logsToWrite,
                [crypto.randomUUID()]: {
                  at: Date.now() + 1000,
                  turnId: body.turnId,
                  failed: true,
                },
              };
              await tx.put('c:' + meta.id, meta);
            }
            delete turn.lease;
            delete turn.leaseUntil;
            await tx.put(key, turn);
            return { ok: true };
          }
          jerryKeys(body.result, [
            'reply',
            'state',
            'action',
            'draftStamp',
            'notice',
          ]);
          jerryText(body.result.reply, 14000);
          jerryAssert(
            !body.result.action ||
              body.result.action.type === 'resume_saved_draft',
            400,
            'Unsupported assistant action.',
          );
          jerryAssert(
            new TextEncoder().encode(JSON.stringify(body.result)).length <
              80000,
            413,
            'Jerry response is too large.',
          );
          turn.status = 'completed';
          turn.result = body.result;
          turn.completedAt = Date.now();
          delete turn.lease;
          delete turn.leaseUntil;
          meta.updatedAt = turn.completedAt;
          meta.expiresAt = meta.updatedAt + JERRY_RETENTION_MS;
          const binding = await tx.get('binding');
          if (binding.surface === 'exchange')
            meta.logsToWrite = {
              ...meta.logsToWrite,
              [body.turnId]: Date.now() + 1000,
            };
          await tx.put(key, turn);
          await tx.put('c:' + meta.id, meta);
          return { turn, conversation: meta };
        }
        if (path === '/log-complete') {
          jerryKeys(body, ['id', 'turnId', 'eventId', 'failed']);
          const meta = await this.live(tx, body.id);
          delete meta.logsToWrite?.[body.eventId || body.turnId];
          await tx.put('c:' + meta.id, meta);
          return { ok: true };
        }
        if (path === '/import') {
          jerryKeys(body, [
            'id',
            'generation',
            'operationId',
            'consent',
            'messages',
          ]);
          const meta = await this.live(tx, body.id, body.generation);
          jerryAssert(
            body.consent === true &&
              jerryUuid(body.operationId) &&
              Array.isArray(body.messages) &&
              body.messages.length > 0 &&
              body.messages.length <= 40,
            400,
            'Explicit consent and a short guest conversation are required.',
          );
          const messages = body.messages.map((m) => {
            jerryKeys(m, ['role', 'content']);
            jerryAssert(
              ['user', 'assistant'].includes(m.role),
              400,
              'Invalid guest message.',
            );
            return {
              role: m.role,
              content: jerryText(m.content, 4000),
              origin: 'guest-import',
            };
          });
          const marker = 'i:' + meta.id + ':' + body.operationId,
            fingerprint = await jerryHash(messages),
            old = await tx.get(marker);
          if (old) {
            jerryAssert(
              old === fingerprint,
              409,
              'Guest import identity was reused.',
            );
            return { ok: true };
          }
          jerryAssert(
            meta.nextSeq === 1,
            409,
            'Attach guest history only to a new conversation.',
          );
          for (let i = 0; i < messages.length; i++) {
            const m = messages[i],
              id = crypto.randomUUID();
            await tx.put('t:' + meta.id + ':' + id, {
              id,
              conversationId: meta.id,
              generation: meta.generation,
              seq: meta.nextSeq++,
              status: 'imported',
              message: m,
              createdAt: Date.now(),
            });
          }
          meta.title =
            messages.find((m) => m.role === 'user')?.content.slice(0, 100) ||
            'Attached guest conversation';
          meta.updatedAt = Date.now();
          meta.expiresAt = meta.updatedAt + JERRY_RETENTION_MS;
          await tx.put('c:' + meta.id, meta);
          await tx.put(marker, fingerprint);
          return { ok: true };
        }
        if (path === '/delete') {
          jerryKeys(body, ['id', 'generation']);
          jerryAssert(jerryUuid(body.id), 400, 'Invalid conversation.');
          const old = await tx.get('c:' + body.id);
          if (!old || old.status === 'deleted')
            return { ok: true, deleted: true };
          if (old.status === 'deleting') return { ok: true, pending: true };
          await this.live(tx, body.id, body.generation);
          await this.fence(tx, old, 'deleted');
          return { ok: true, pending: true };
        }
        if (path === '/cleanup-complete') {
          jerryKeys(body, ['id']);
          const meta = await tx.get('c:' + body.id);
          if (!meta && (await tx.get('d:' + body.id)))
            return { ok: true, deleted: true };
          jerryAssert(
            meta?.status === 'deleting' || meta?.status === 'deleted',
            409,
            'Conversation deletion is not pending.',
          );
          const imports = await tx.list({ prefix: 'i:' + body.id + ':' });
          if (imports.size) await tx.delete([...imports.keys()]);
          await tx.delete('c:' + body.id);
          return { ok: true, deleted: true };
        }
        throw Object.assign(Error('Unknown conversation operation.'), {
          status: 404,
        });
      });
      await this.schedule();
      return jerryResult(result);
    } catch (error) {
      await this.schedule().catch(() => {});
      return jerryResult(
        {
          error: error.status
            ? error.message
            : 'Conversation storage is unavailable.',
          code: error.code || 'JERRY_STORE_UNAVAILABLE',
        },
        error.status || 503,
      );
    }
  }
  async alarm() {
    const reserve = this.queue.then(async () => {
      await this.sweep();
      const all = await this.items(this.ctx.storage, 'c:');
      return {
        binding: await this.ctx.storage.get('binding'),
        jobs: all.filter(
          (m) => m.status === 'deleting' && m.nextCleanupAt <= Date.now(),
        ),
        logs: all
          .filter((m) => m.status === 'active')
          .flatMap((m) =>
            Object.entries(m.logsToWrite || {})
              .filter(
                ([, value]) =>
                  (typeof value === 'number' ? value : value.at) <= Date.now(),
              )
              .map(([eventId, value]) => ({
                id: m.id,
                eventId,
                turnId: typeof value === 'number' ? eventId : value.turnId,
                failed: typeof value === 'number' ? false : value.failed,
              })),
          ),
      };
    });
    this.queue = reserve.catch(() => {});
    const { binding, jobs, logs } = await reserve;
    for (const job of jobs) {
      try {
        const stub = this.env.SELLER_STORE.get(
          this.env.SELLER_STORE.idFromName('seller-v2'),
        );
        const response = await stub.fetch(
          new Request(
            'https://seller-service.internal/api/aircraft-sale/_jerry/erase',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...binding, id: job.id }),
            },
          ),
        );
        if (!response.ok) throw Error('Copy cleanup pending');
        await this.fetch(
          new Request('https://jerry.internal/cleanup-complete', {
            method: 'POST',
            headers: {
              'X-Jerry-Owner': binding.owner,
              'X-Jerry-Surface': binding.surface,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: job.id }),
          }),
        );
      } catch {
        const task = this.queue.then(() =>
          this.tx(async (tx) => {
            const meta = await tx.get('c:' + job.id);
            if (meta?.status === 'deleting') {
              meta.nextCleanupAt = Date.now() + 60000;
              await tx.put('c:' + job.id, meta);
            }
          }),
        );
        this.queue = task.catch(() => {});
        await task;
      }
    }
    for (const job of logs) {
      try {
        const stub = this.env.SELLER_STORE.get(
          this.env.SELLER_STORE.idFromName('seller-v2'),
        );
        const response = await stub.fetch(
          new Request(
            'https://seller-service.internal/api/aircraft-sale/_jerry/log-committed',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...binding, ...job }),
            },
          ),
        );
        if (!response.ok && response.status !== 410)
          throw Error('Activity reference pending');
        await this.fetch(
          new Request('https://jerry.internal/log-complete', {
            method: 'POST',
            headers: {
              'X-Jerry-Owner': binding.owner,
              'X-Jerry-Surface': binding.surface,
            },
            body: JSON.stringify(job),
          }),
        );
      } catch {
        const task = this.queue.then(() =>
          this.tx(async (tx) => {
            const meta = await tx.get('c:' + job.id);
            if (
              meta?.status === 'active' &&
              meta.logsToWrite?.[job.eventId || job.turnId]
            ) {
              const key = job.eventId || job.turnId,
                old = meta.logsToWrite[key];
              meta.logsToWrite[key] =
                typeof old === 'number'
                  ? Date.now() + 60000
                  : { ...old, at: Date.now() + 60000 };
              await tx.put('c:' + meta.id, meta);
            }
          }),
        );
        this.queue = task.catch(() => {});
        await task;
      }
    }
    const finish = this.queue.then(() => this.schedule());
    this.queue = finish.catch(() => {});
    await finish;
  }
}
