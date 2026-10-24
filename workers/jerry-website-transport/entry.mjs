// Synthetic-only native capability. No provider transport, token, tool or fallback.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { admittedResponse } from '../jerry-response/admission.mjs';
import { jerryAssert, jerryKeys } from '../aircraft-sale/jerry-protocol.mjs';
import {
  WEBSITE_PROTOCOL,
  SYNTHETIC_CAPABILITIES,
  validateEnvelope,
  validateScope,
  scopeKey,
} from './contract.mjs';
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
  if (!request.scope)
    return {
      ...SYNTHETIC_CAPABILITIES,
      mode:
        env.JERRY_TRANSPORT_MODE === 'synthetic-fixture'
          ? 'synthetic-only'
          : 'disabled',
    };
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
async function boundedSynthetic(envelope, complete) {
  let timer;
  try {
    return await Promise.race([
      complete(envelope),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(Error('Synthetic response deadline reached.'), {
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
export async function runWebsiteResponse(
  env,
  kind,
  envelope,
  complete = syntheticReply,
) {
  jerryAssert(
    env.JERRY_TRANSPORT_MODE === 'synthetic-fixture' &&
      !Object.keys(env).some((k) =>
        /^(OPENAI_|OAUTH_|JERRY_MODEL|JERRY_RESPONSE|JERRY_RELAY)/.test(k),
      ),
    503,
    'No supported live website transport is selected.',
    'JERRY_TRANSPORT_UNAVAILABLE',
  );
  validateEnvelope(envelope);
  jerryAssert(envelope.kind === kind, 400, 'Website capability mismatch.');
  const { scope, operationId } = envelope;
  if (scope.category === 'guest')
    return admittedResponse(env, envelope.admission, async () => ({
      protocol: WEBSITE_PROTOCOL,
      scope,
      operationId,
      kind,
      reply: await boundedSynthetic(envelope, complete),
      expiresAt: envelope.expiresAt,
    }));
  const reservation = await copiesCall(env, scope, 'reserve', envelope);
  if (reservation.cached) return { ...reservation.result, replayed: true };
  const receipt = { scope, operationId, kind, lease: reservation.lease };
  try {
    return await admittedResponse(env, envelope.admission, async () => {
      await copiesCall(env, scope, 'start', receipt);
      const reply = await boundedSynthetic(envelope, complete);
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
export default class SyntheticWebsiteTransport extends WorkerEntrypoint {
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
