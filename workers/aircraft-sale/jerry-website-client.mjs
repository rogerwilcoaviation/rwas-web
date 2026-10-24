import { responseAdmission } from './jerry-admission-context.mjs';
import { JERRY_RETENTION_MS } from './jerry-protocol.mjs';
import {
  WEBSITE_PROTOCOL,
  websiteTransport,
  assertReply,
  validateEnvelope,
} from '../jerry-website-transport/contract.mjs';

export async function sendWebsiteResponse(
  env,
  {
    kind,
    payload,
    identity,
    proof,
    surface,
    conversationId,
    generation,
    operationId,
    issuedAt,
    mark,
    tracked,
  },
) {
  const transport = await websiteTransport(env);
  const admission = await responseAdmission(env, {
    identity,
    proof,
    surface,
    operationId,
    issuedAt,
    payload,
    kind,
  });
  const expiresAt = issuedAt + (identity ? JERRY_RETENTION_MS : 86400000);
  const scope = {
    category: identity ? 'account' : 'guest',
    owner: identity?.owner || admission.principal,
    surface,
    conversationId: conversationId || operationId,
    generation: generation || 1,
    sessionRef: identity?.sessionRef || admission.principal,
    sessionExpiresAt: identity?.expiresAt || expiresAt,
  };
  const envelope = {
    protocol: WEBSITE_PROTOCOL,
    scope,
    operationId,
    issuedAt,
    expiresAt,
    kind,
    payload,
    admission,
  };
  validateEnvelope(envelope);
  if (identity) {
    // Commit a content-free cancellation obligation before crossing the binding.
    await mark({ scope, operationId, kind });
    tracked?.push({ scope, operationId, kind });
  }
  const response = await transport[kind](envelope);
  if (response?.error)
    throw Object.assign(Error(response.error), {
      status: response.status || 503,
      code: response.code || 'JERRY_TRANSPORT_UNAVAILABLE',
      retryAfterMs: response.retryAfterMs,
    });
  return assertReply(response, envelope);
}
