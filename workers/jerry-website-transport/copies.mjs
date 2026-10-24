import {
  jerryAssert,
  jerryHash,
  jerryJson,
  jerryKeys,
  jerryResult,
  jerryUuid,
} from '../aircraft-sale/jerry-protocol.mjs';
import {
  WEBSITE_PROTOCOL,
  validateEnvelope,
  validateScope,
  sameBinding,
} from './contract.mjs';
const LEASE = 90000;
export class WebsiteTransportCopies {
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
  async transaction(fn) {
    // New namespaces are SQLite-only: alarm registration joins the same
    // transaction as the content write. A scheduling failure rolls both back.
    return this.ctx.storage.transaction(async (tx) => {
      const result = await fn(tx);
      await this.schedule();
      return result;
    });
  }
  async schedule() {
    const rows = await this.ctx.storage.list({ prefix: 'op:' });
    const at = Math.min(
      ...[...rows.values()].map((r) =>
        Math.min(
          r.expiresAt,
          r.state === 'running' || r.state === 'reserved'
            ? r.deadline
            : Infinity,
        ),
      ),
    );
    if (Number.isFinite(at))
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, at));
    else await this.ctx.storage.deleteAlarm();
  }
  async sweep(tx) {
    for (const [key, row] of await tx.list({ prefix: 'op:' })) {
      if (row.expiresAt <= Date.now()) {
        await tx.delete(key);
        continue;
      }
      if (
        ['reserved', 'running'].includes(row.state) &&
        row.deadline <= Date.now()
      ) {
        row.state = row.state === 'running' ? 'uncertain' : 'retryable';
        delete row.lease;
        delete row.deadline;
        await tx.put(key, row);
      }
    }
  }
  async handle(request) {
    try {
      jerryAssert(
        new URL(request.url).origin === 'https://website-copies.internal' &&
          request.method === 'POST',
        404,
        'Not found.',
      );
      const body = await jerryJson(request, 190000),
        path = new URL(request.url).pathname;
      let result;
      if (path === '/reserve') {
        validateEnvelope(body);
        jerryAssert(
          body.scope.category === 'account',
          400,
          'Guest content cannot be retained.',
        );
        const fingerprint = await jerryHash({
          scope: Object.entries(body.scope).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
          kind: body.kind,
          payload: body.payload,
          issuedAt: body.issuedAt,
          expiresAt: body.expiresAt,
        });
        result = await this.transaction(async (tx) => {
          await this.bind(tx, body.scope);
          await this.sweep(tx);
          await this.live(tx);
          const key = 'op:' + body.kind + ':' + body.operationId,
            old = await tx.get(key);
          if (old) {
            jerryAssert(
              old.state !== 'cancelled',
              409,
              'This operation was cancelled before completion.',
              'JERRY_ATTEMPT_UNCERTAIN',
            );
            jerryAssert(
              old.fingerprint === fingerprint,
              409,
              'Website operation scope or input changed.',
              'JERRY_REPLAY_CONFLICT',
            );
            if (old.state === 'completed')
              return {
                cached: true,
                result: this.response(old, body.operationId),
              };
            jerryAssert(
              !['cancelled', 'uncertain'].includes(old.state),
              409,
              'The earlier response cannot safely be repeated.',
              'JERRY_ATTEMPT_UNCERTAIN',
            );
            jerryAssert(
              !['reserved', 'running'].includes(old.state),
              409,
              'Website response is pending.',
              'JERRY_ATTEMPT_PENDING',
            );
          }
          jerryAssert(
            old || (await tx.list({ prefix: 'op:' })).size < 500,
            429,
            'Website copy budget exhausted.',
          );
          const lease = crypto.randomUUID(),
            row = {
              scope: body.scope,
              kind: body.kind,
              fingerprint,
              issuedAt: body.issuedAt,
              expiresAt: body.expiresAt,
              payload: body.payload,
              state: 'reserved',
              lease,
              deadline: Date.now() + LEASE,
            };
          await tx.put(key, row);
          return { lease };
        });
      } else if (path === '/erase') {
        jerryKeys(body, ['protocol', 'scope', 'operationId', 'kind']);
        jerryAssert(
          body.protocol === WEBSITE_PROTOCOL,
          400,
          'Invalid protocol.',
        );
        validateScope(body.scope, { session: !!body.operationId });
        result = await this.transaction(async (tx) => {
          await this.bind(tx, body.scope);
          if (body.operationId) {
            jerryAssert(
              jerryUuid(body.operationId) &&
                ['respond', 'translate'].includes(body.kind),
              400,
              'Invalid operation cleanup.',
            );
            const key = 'op:' + body.kind + ':' + body.operationId,
              row = await tx.get(key);
            if (row) {
              jerryAssert(
                sameBinding(row.scope, body.scope),
                403,
                'Operation cleanup scope mismatch.',
              );
              await tx.put(key, {
                scope: row.scope,
                kind: row.kind,
                expiresAt: row.expiresAt,
                state: 'cancelled',
              });
            } else
              await tx.put(key, {
                scope: body.scope,
                kind: body.kind,
                state: 'cancelled',
                expiresAt: Date.now() + 90 * 86400000,
              });
          } else {
            for (const key of (await tx.list({ prefix: 'op:' })).keys())
              await tx.delete(key);
            await tx.put('deleted', { at: Date.now() });
          }
          return {
            protocol: WEBSITE_PROTOCOL,
            scope: body.scope,
            ...(body.operationId
              ? { operationId: body.operationId, kind: body.kind }
              : {}),
            erased: true,
            contentCopies: 0,
          };
        });
      } else if (path === '/status') {
        jerryKeys(body, ['protocol', 'scope', 'operationId', 'kind']);
        jerryAssert(
          body.protocol === WEBSITE_PROTOCOL,
          400,
          'Invalid protocol.',
        );
        validateScope(body.scope);
        jerryAssert(
          body.scope.sessionExpiresAt > Date.now(),
          401,
          'Website session expired.',
          'JERRY_SESSION_CHANGED',
        );
        result = await this.transaction(async (tx) => {
          await this.bind(tx, body.scope);
          await this.sweep(tx);
          if (await tx.get('deleted'))
            return {
              protocol: WEBSITE_PROTOCOL,
              state: 'erased',
              contentCopies: 0,
            };
          const row = await tx.get('op:' + body.kind + ':' + body.operationId);
          if (row)
            jerryAssert(
              sameBinding(row.scope, body.scope),
              403,
              'Website operation scope mismatch.',
            );
          return {
            protocol: WEBSITE_PROTOCOL,
            state: row?.state || 'missing',
            contentCopies: row?.payload || row?.reply ? 1 : 0,
          };
        });
      } else {
        jerryAssert(
          ['/start', '/finish', '/fail'].includes(path),
          404,
          'Unsupported capability.',
        );
        jerryKeys(body, ['scope', 'operationId', 'kind', 'lease', 'reply']);
        validateScope(body.scope);
        jerryAssert(
          jerryUuid(body.operationId) && jerryUuid(body.lease),
          400,
          'Invalid operation receipt.',
        );
        result = await this.transaction(async (tx) => {
          await this.bind(tx, body.scope);
          await this.live(tx);
          const key = 'op:' + body.kind + ':' + body.operationId,
            row = await tx.get(key);
          jerryAssert(
            row &&
              sameBinding(row.scope, body.scope) &&
              row.lease === body.lease &&
              row.deadline > Date.now() &&
              row.expiresAt > Date.now(),
            409,
            'Website operation lease changed.',
            'JERRY_ATTEMPT_UNCERTAIN',
          );
          if (path === '/fail') {
            row.state = row.state === 'running' ? 'uncertain' : 'retryable';
          } else {
            jerryAssert(
              body.scope.sessionExpiresAt > Date.now(),
              401,
              'Website session expired.',
              'JERRY_SESSION_CHANGED',
            );
            if (path === '/start') {
              jerryAssert(
                row.state === 'reserved',
                409,
                'Operation already started.',
              );
              row.state = 'running';
            } else {
              jerryAssert(
                row.state === 'running' &&
                  typeof body.reply === 'string' &&
                  body.reply.trim() &&
                  body.reply.length <= 14000,
                400,
                'Invalid website reply.',
              );
              row.state = 'completed';
              row.reply = body.reply;
            }
          }
          if (path !== '/start') {
            delete row.lease;
            delete row.deadline;
          }
          await tx.put(key, row);
          return path === '/finish'
            ? this.response(row, body.operationId)
            : { ok: true };
        });
      }
      return jerryResult(result);
    } catch (error) {
      return jerryResult(
        {
          error: error.status
            ? error.message
            : 'Website copy storage is unavailable.',
          code: error.code || 'JERRY_TRANSPORT_UNAVAILABLE',
        },
        error.status || 503,
      );
    }
  }
  async bind(tx, scope) {
    const binding = {
        category: scope.category,
        owner: scope.owner,
        surface: scope.surface,
        conversationId: scope.conversationId,
      },
      old = await tx.get('binding');
    jerryAssert(
      !old || sameBinding(old, binding),
      403,
      'Website content owner mismatch.',
    );
    if (!old) await tx.put('binding', binding);
    if (scope.generation !== undefined) {
      const generation = await tx.get('generation');
      jerryAssert(
        generation === undefined || generation === scope.generation,
        409,
        'Website conversation generation changed.',
        'JERRY_REPLAY_CONFLICT',
      );
      if (generation === undefined)
        await tx.put('generation', scope.generation);
    }
  }
  async live(tx) {
    jerryAssert(
      !(await tx.get('deleted')),
      410,
      'Website conversation was erased.',
      'JERRY_GONE',
    );
  }
  response(row, operationId) {
    return {
      protocol: WEBSITE_PROTOCOL,
      scope: row.scope,
      operationId,
      kind: row.kind,
      reply: row.reply,
      expiresAt: row.expiresAt,
    };
  }
  async alarm() {
    const task = this.queue.then(async () => {
      try {
        await this.transaction((tx) => this.sweep(tx));
      } catch (error) {
        await this.ctx.storage.setAlarm(Date.now() + 60000).catch(() => {});
        throw error;
      }
    });
    this.queue = task.catch(() => {});
    await task;
  }
}
