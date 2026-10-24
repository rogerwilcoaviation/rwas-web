// Website-only protocol, independent of any model, subscription or credential.
import {
  jerryAssert,
  jerryKeys,
  jerryUuid,
  jerryPage,
  jerryText,
  JERRY_LOCALES,
  JERRY_RETENTION_MS,
} from '../aircraft-sale/jerry-protocol.mjs';
export const WEBSITE_PROTOCOL = 'jerry-website-transport-v1';
export const SYNTHETIC_CAPABILITIES = Object.freeze({
  protocol: WEBSITE_PROTOCOL,
  mode: 'synthetic-only',
  tools: false,
  operations: false,
  inheritedContext: false,
  externalTransport: false,
});
export function sameBinding(a, b) {
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) ||
    Array.isArray(b)
  )
    return false;
  const keys = Object.keys(a).sort(),
    other = Object.keys(b).sort();
  return (
    JSON.stringify(keys) === JSON.stringify(other) &&
    keys.every((key) => a[key] === b[key])
  );
}
const hex = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function scopeKey(scope) {
  return [
    scope.category,
    scope.owner,
    scope.surface,
    scope.conversationId,
  ].join(':');
}
export function validateScope(scope, { session = true } = {}) {
  jerryKeys(
    scope,
    session
      ? [
          'category',
          'owner',
          'surface',
          'conversationId',
          'generation',
          'sessionRef',
          'sessionExpiresAt',
        ]
      : ['category', 'owner', 'surface', 'conversationId'],
  );
  jerryAssert(
    ['account', 'guest'].includes(scope.category) &&
      hex(scope.owner) &&
      ['public', 'exchange'].includes(scope.surface) &&
      jerryUuid(scope.conversationId),
    400,
    'Invalid website transport scope.',
  );
  if (session)
    jerryAssert(
      Number.isSafeInteger(scope.generation) &&
        scope.generation > 0 &&
        hex(scope.sessionRef) &&
        Number.isSafeInteger(scope.sessionExpiresAt),
      400,
      'Invalid website session fence.',
    );
  return scope;
}
export function validatePayload(kind, payload, scope) {
  jerryAssert(
    ['respond', 'translate'].includes(kind),
    400,
    'Unsupported website response kind.',
  );
  if (kind === 'translate') {
    jerryKeys(payload, ['text', 'locale']);
    jerryText(payload.text, 14000);
    jerryAssert(
      JERRY_LOCALES.includes(payload.locale),
      400,
      'Invalid language.',
    );
  } else {
    jerryKeys(payload, ['input', 'history', 'reference', 'pageContext']);
    jerryKeys(payload.input, [
      'message',
      'mode',
      'locale',
      'page',
      'resume',
      'draftStamp',
    ]);
    jerryText(payload.input.message, 2000);
    jerryAssert(
      (payload.input.resume === undefined ||
        typeof payload.input.resume === 'boolean') &&
        (payload.input.draftStamp === undefined ||
          hex(payload.input.draftStamp)),
      400,
      'Invalid website-only input.',
    );
    jerryPage(payload.input.page, scope.surface, 'super-admin'); // Shape only; seller service enforces actual role.
    jerryAssert(
      JERRY_LOCALES.includes(payload.input.locale) &&
        (!payload.input.mode || payload.input.mode === 'chat'),
      400,
      'Transport cannot run listing actions.',
    );
    jerryAssert(
      Array.isArray(payload.history) && payload.history.length <= 12,
      400,
      'Invalid history.',
    );
    for (const row of payload.history) {
      jerryKeys(row, ['role', 'content']);
      jerryAssert(
        ['user', 'assistant'].includes(row.role),
        400,
        'Invalid history role.',
      );
      jerryText(row.content, 14000);
    }
    jerryAssert(
      typeof payload.pageContext === 'string' &&
        payload.pageContext.length <= 12000,
      400,
      'Invalid public reference.',
    );
    if (payload.reference) {
      jerryKeys(payload.reference, ['listing']);
      jerryKeys(payload.reference.listing, [
        'id',
        'status',
        'revision',
        'title',
        'nNumber',
      ]);
      const l = payload.reference.listing;
      jerryAssert(
        typeof l.id === 'string' &&
          /^[A-Za-z0-9_-]{1,128}$/.test(l.id) &&
          [
            'draft',
            'pending',
            'active',
            'sold',
            'paused',
            'rejected',
            'deleted',
          ].includes(l.status) &&
          Number.isSafeInteger(l.revision) &&
          l.revision > 0 &&
          typeof l.title === 'string' &&
          l.title.length <= 512 &&
          typeof l.nNumber === 'string' &&
          l.nNumber.length <= 50,
        400,
        'Invalid listing reference.',
      );
    }
  }
  jerryAssert(
    new TextEncoder().encode(JSON.stringify(payload)).length <= 180000,
    413,
    'Website context exceeds the response budget.',
  );
}
export function validateEnvelope(value) {
  jerryKeys(value, [
    'protocol',
    'scope',
    'operationId',
    'issuedAt',
    'expiresAt',
    'kind',
    'payload',
    'admission',
  ]);
  jerryAssert(
    value.protocol === WEBSITE_PROTOCOL &&
      jerryUuid(value.operationId) &&
      Number.isSafeInteger(value.issuedAt) &&
      Number.isSafeInteger(value.expiresAt) &&
      value.issuedAt <= Date.now() + 30000 &&
      value.expiresAt > Date.now() &&
      value.expiresAt <= value.issuedAt + JERRY_RETENTION_MS,
    400,
    'Invalid website response envelope.',
  );
  validateScope(value.scope);
  jerryAssert(
    value.admission?.category === value.scope.category &&
      value.admission.surface === value.scope.surface &&
      value.admission.operationId === value.operationId &&
      value.admission.issuedAt === value.issuedAt &&
      value.admission.kind === value.kind,
    400,
    'Admission is bound to another website request.',
  );
  validatePayload(value.kind, value.payload, value.scope);
  jerryAssert(
    value.scope.sessionExpiresAt > Date.now(),
    401,
    'Website session expired.',
    'JERRY_SESSION_CHANGED',
  );
  return value;
}
export function assertReply(reply, envelope) {
  jerryKeys(reply, [
    'protocol',
    'scope',
    'operationId',
    'kind',
    'reply',
    'expiresAt',
    'replayed',
  ]);
  jerryAssert(
    reply.protocol === WEBSITE_PROTOCOL &&
      sameBinding(reply.scope, envelope.scope) &&
      reply.operationId === envelope.operationId &&
      reply.kind === envelope.kind &&
      reply.expiresAt === envelope.expiresAt &&
      envelope.scope.sessionExpiresAt > Date.now() &&
      envelope.expiresAt > Date.now(),
    409,
    'Website response binding changed.',
    'JERRY_REPLAY_CONFLICT',
  );
  jerryText(reply.reply, 14000);
  return { reply: reply.reply };
}
export async function websiteTransport(env) {
  const transport = env.JERRY_WEBSITE_TRANSPORT;
  jerryAssert(
    transport &&
      ['respond', 'translate', 'status', 'erase'].every(
        (name) => typeof transport[name] === 'function',
      ),
    503,
    'The website transport is not configured. Your message remains saved.',
    'JERRY_TRANSPORT_UNAVAILABLE',
  );
  const caps = await transport.status({ protocol: WEBSITE_PROTOCOL });
  jerryAssert(
    sameBinding(caps, SYNTHETIC_CAPABILITIES),
    503,
    'No supported website-only transport is configured.',
    'JERRY_TRANSPORT_UNAVAILABLE',
  );
  return transport;
}
export async function eraseWebsiteCopies(env, request) {
  jerryAssert(
    typeof env.JERRY_WEBSITE_TRANSPORT?.erase === 'function',
    503,
    'Website content cleanup is pending.',
    'JERRY_CLEANUP_PENDING',
  );
  const result = await env.JERRY_WEBSITE_TRANSPORT.erase({
    protocol: WEBSITE_PROTOCOL,
    ...request,
  });
  jerryAssert(
    result &&
      sameBinding(result.scope, request.scope) &&
      result.operationId === request.operationId &&
      result.kind === request.kind,
    503,
    'Website cleanup acknowledgment belongs to another request.',
    'JERRY_CLEANUP_PENDING',
  );
  jerryAssert(
    result?.protocol === WEBSITE_PROTOCOL &&
      result.erased === true &&
      result.contentCopies === 0,
    503,
    'Website content cleanup is pending.',
    'JERRY_CLEANUP_PENDING',
  );
  return result;
}
