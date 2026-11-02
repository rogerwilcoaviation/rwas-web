// Website-only native capability. No OAuth/API credentials, tools or fallback.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { admittedResponse } from '../jerry-response/admission.mjs';
import { jerryAssert, jerryKeys } from '../aircraft-sale/jerry-protocol.mjs';
import {
  WEBSITE_PROTOCOL,
  SYNTHETIC_CAPABILITIES,
  WORKERS_AI_CAPABILITIES,
  validateEnvelope,
  validateScope,
  scopeKey,
} from './contract.mjs';
import { workersAiReply } from './workers-ai.mjs';
export { WebsiteTransportCopies } from './copies.mjs';
export { JerryAdmission } from '../jerry-response/admission.mjs';
export async function copiesCall(env, scope, path, body) {
  const stub = env.JERRY_TRANSPORT_COPIES.get(
    env.JERRY_TRANSPORT_COPIES.idFromName(scopeKey(scope)),
  );
  const response = await stub.fetch(
    new Request('https://website-copies.internal/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(Error(value.error), {
      status: response.status,
      code: value.code,
    });
  return value;
}
export async function transportStatus(env, request) {
  jerryKeys(request, ['protocol', 'scope', 'operationId', 'kind']);
  jerryAssert(
    request.protocol === WEBSITE_PROTOCOL,
    400,
    'Invalid website protocol.',
  );
  if (!request.scope) {
    if (
      env.JERRY_TRANSPORT_MODE === 'workers-ai' &&
      typeof env.AI?.run === 'function'
    )
      return { ...WORKERS_AI_CAPABILITIES };
    return {
      ...SYNTHETIC_CAPABILITIES,
      mode:
        env.JERRY_TRANSPORT_MODE === 'synthetic-fixture'
          ? 'synthetic-only'
          : 'disabled',
    };
  }
  validateScope(request.scope);
  if (request.scope.category === 'guest')
    return {
      protocol: WEBSITE_PROTOCOL,
      state: 'tab-local',
      contentCopies: 0,
    };
  return copiesCall(env, request.scope, 'status', request);
}
export async function syntheticReply(envelope) {
  return envelope.kind === 'translate'
    ? envelope.payload.text
    : 'Synthetic website-only reply. No external request was made.';
}
async function boundedResponse(envelope, complete) {
  let timer;
  try {
    return await Promise.race([
      complete(envelope),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(Error('Website response deadline reached.'), {
                status: 503,
                code: 'JERRY_ATTEMPT_UNCERTAIN',
              }),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function runWebsiteResponse(env, kind, envelope, complete) {
  jerryAssert(
    ['synthetic-fixture', 'workers-ai'].includes(env.JERRY_TRANSPORT_MODE) &&
      (env.JERRY_TRANSPORT_MODE !== 'workers-ai' ||
        typeof env.AI?.run === 'function') &&
      !Object.keys(env).some((k) =>
        /^(OPENAI_|OAUTH_|JERRY_MODEL|JERRY_RESPONSE|JERRY_RELAY)/.test(k),
      ),
    503,
    'No supported live website transport is selected.',
    'JERRY_TRANSPORT_UNAVAILABLE',
  );
  validateEnvelope(envelope);
  const invoke =
    complete ||
    (env.JERRY_TRANSPORT_MODE === 'workers-ai'
      ? (value) => workersAiReply(env, value)
      : syntheticReply);
  jerryAssert(envelope.kind === kind, 400, 'Website capability mismatch.');
  const { scope, operationId } = envelope;
  if (scope.category === 'guest')
    return admittedResponse(env, envelope.admission, async () => ({
      protocol: WEBSITE_PROTOCOL,
      scope,
      operationId,
      kind,
      reply: await boundedResponse(envelope, invoke),
      expiresAt: envelope.expiresAt,
    }));
  const reservation = await copiesCall(env, scope, 'reserve', envelope);
  if (reservation.cached) return { ...reservation.result, replayed: true };
  const receipt = { scope, operationId, kind, lease: reservation.lease };
  try {
    return await admittedResponse(env, envelope.admission, async () => {
      await copiesCall(env, scope, 'start', receipt);
      const reply = await boundedResponse(envelope, invoke);
      return copiesCall(env, scope, 'finish', { ...receipt, reply });
    });
  } catch (error) {
    await copiesCall(env, scope, 'fail', receipt).catch(() => {});
    throw error;
  }
}
export async function transportErase(env, request) {
  jerryKeys(request, ['protocol', 'scope', 'operationId', 'kind']);
  jerryAssert(
    request.protocol === WEBSITE_PROTOCOL,
    400,
    'Invalid cleanup protocol.',
  );
  validateScope(request.scope, { session: !!request.operationId });
  if (request.scope.category === 'guest')
    return {
      protocol: WEBSITE_PROTOCOL,
      scope: request.scope,
      ...(request.operationId
        ? { operationId: request.operationId, kind: request.kind }
        : {}),
      erased: true,
      contentCopies: 0,
    };
  return copiesCall(env, request.scope, 'erase', request);
}
export async function transportResult(operation) {
  try {
    return await operation();
  } catch (error) {
    return {
      error: error.status ? error.message : 'Website transport is unavailable.',
      status: error.status || 503,
      code: /^JERRY_[A-Z_]{1,50}$/.test(error.code || '')
        ? error.code
        : 'JERRY_TRANSPORT_UNAVAILABLE',
      ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
    };
  }
}
export default class WebsiteTransport extends WorkerEntrypoint {
  fetch() {
    return new Response('Not found', { status: 404 });
  }
  respond(envelope) {
    return transportResult(() =>
      runWebsiteResponse(this.env, 'respond', envelope),
    );
  }
  translate(envelope) {
    return transportResult(() =>
      runWebsiteResponse(this.env, 'translate', envelope),
    );
  }
  status(request) {
    return transportResult(() => transportStatus(this.env, request));
  }
  erase(request) {
    return transportResult(() => transportErase(this.env, request));
  }
}
