import {
  jerryAssert,
  jerryKeys,
  jerryUuid,
  jerryPage,
  JERRY_LOCALES,
} from './jerry-protocol.mjs';
import { sendWebsiteResponse } from './jerry-website-client.mjs';

// Only these website operations cross the service binding. Browser input never
// selects a seller route, remote host, identity, role, or authorization policy.
const operations = [
  'context',
  'list',
  'create',
  'read',
  'delete',
  'import',
  'message',
];
const headersFor = (proof) => ({
  Cookie: proof.cookie || '',
  Origin: proof.origin || '',
  Authorization: proof.authorization || '',
  'X-RWAS-CSRF': proof.csrf || '',
  'Content-Type': 'application/json',
});
async function json(response) {
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(Error(body.error || 'Jerry request failed.'), {
      status: response.status,
      code: body.code,
    });
  return body;
}
async function seller(env, path, body, proof) {
  const stub = env.SELLER_STORE.get(env.SELLER_STORE.idFromName('seller-v2'));
  return json(
    await stub.fetch(
      new Request(
        'https://seller-service.internal/api/aircraft-sale/_jerry/' + path,
        {
          method: 'POST',
          headers: headersFor(proof),
          body: JSON.stringify(body || {}),
        },
      ),
    ),
  );
}
function conversationClient(env, identity, surface) {
  jerryAssert(
    env.JERRY_CONVERSATIONS,
    503,
    'Conversation storage is not configured.',
  );
  const stub = env.JERRY_CONVERSATIONS.get(
    env.JERRY_CONVERSATIONS.idFromName(identity.owner + ':' + surface),
  );
  return async (path, body) =>
    json(
      await stub.fetch(
        new Request('https://jerry.internal/' + path, {
          method: path === 'list' ? 'GET' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Jerry-Owner': identity.owner,
            'X-Jerry-Surface': surface,
          },
          ...(path === 'list' ? {} : { body: JSON.stringify(body) }),
        }),
      ),
    );
}
async function current(env, proof, expected) {
  const context = await seller(env, 'context', {}, proof);
  if (expected)
    jerryAssert(
      context.identity &&
        context.identity.owner === expected.owner &&
        context.identity.sessionRef === expected.sessionRef &&
        (expected.role === undefined ||
          context.identity.role === expected.role),
      401,
      'Your account session changed. Sign in again.',
      'JERRY_SESSION_CHANGED',
    );
  return context;
}
async function localized(env, result, locale, admissionContext) {
  if (locale === 'en') return result;
  try {
    const source = result.reply;
    const payload = { text: source, locale };
    const translated = await sendWebsiteResponse(env, {
      ...admissionContext,
      payload,
      kind: 'translate',
    });
    const reply = translated.reply;
    const tokens = (text) =>
      text.match(
        /https?:\/\/\S+|\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:[-.]?[A-Za-z0-9]+)*\b/g,
      ) || [];
    jerryAssert(
      typeof reply === 'string' &&
        reply.length > 0 &&
        reply.length <= 14000 &&
        JSON.stringify(tokens(source)) === JSON.stringify(tokens(reply)),
      503,
      'Translation could not be verified.',
    );
    return { ...result, reply };
  } catch {
    return {
      ...result,
      notice:
        locale === 'es'
          ? 'La traducción no está disponible. Se muestra la respuesta original.'
          : 'Tradução indisponível. A resposta original é apresentada.',
    };
  }
}
async function relay(
  env,
  history,
  input,
  reference,
  pageContext,
  admissionContext,
) {
  // No cookies, email addresses, private operational data or business credentials
  // are forwarded to the public website chat service. Its actions are discarded.
  const payload = {
    history,
    input,
    reference,
    pageContext: pageContext || '',
  };
  const body = await sendWebsiteResponse(env, {
    ...admissionContext,
    payload,
    kind: 'respond',
  });
  jerryAssert(
    typeof body.reply === 'string' &&
      body.reply.trim() &&
      body.reply.length <= 14000,
    503,
    'Jerry returned an incomplete response. Retry this message.',
  );
  return { reply: body.reply };
}
export async function jerryWebsite(env, request) {
  jerryAssert(
    env.JERRY_CONVERSATIONS_ENABLED === 'true',
    404,
    'Jerry conversations are not enabled.',
  );
  jerryKeys(request, [
    'operation',
    'proof',
    'expected',
    'surface',
    'page',
    'body',
    'pageContext',
  ]);
  jerryAssert(
    request.pageContext === undefined ||
      (typeof request.pageContext === 'string' &&
        request.pageContext.length <= 12000),
    400,
    'Invalid page context.',
  );
  jerryAssert(
    operations.includes(request.operation),
    400,
    'Unsupported website operation.',
  );
  const proof = request.proof || {},
    body = request.body || {};
  jerryKeys(proof, [
    'cookie',
    'origin',
    'authorization',
    'csrf',
    'admissionAddress',
  ]);
  const context = await current(env, proof, request.expected),
    identity = context.identity;
  if (request.operation === 'context')
    return { enabled: true, identity, draftStamp: context.draftStamp };
  jerryAssert(
    ['public', 'exchange'].includes(request.surface),
    400,
    'Invalid conversation surface.',
  );
  const page = jerryPage(request.page, request.surface, identity?.role);
  // Dynamic listings are resolved by the same store that enforces publication,
  // owner and hold status; a UUID in the browser is never evidence of access.
  const listing = /^\/aircraft-for-sale\/([a-f0-9-]{36})$/i.exec(page);
  const reference = listing
    ? await seller(
        env,
        'reference',
        { resource: { type: 'listing', id: listing[1] } },
        proof,
      )
    : null;
  if (!identity) {
    jerryAssert(
      request.operation === 'message' && !request.expected,
      401,
      'Sign in to access saved conversations.',
    );
    jerryKeys(body, ['input', 'history', 'operationId', 'issuedAt']);
    jerryAssert(
      jerryUuid(body.operationId) && Number.isSafeInteger(body.issuedAt),
      400,
      'A stable guest request ID and timestamp are required.',
    );
    jerryKeys(body.input, ['message', 'locale', 'mode']);
    jerryAssert(
      body.input.mode === 'chat' &&
        typeof body.input.message === 'string' &&
        body.input.message.trim() &&
        body.input.message.length <= 2000 &&
        JERRY_LOCALES.includes(body.input.locale),
      400,
      'Invalid guest message.',
    );
    jerryAssert(
      Array.isArray(body.history) &&
        body.history.length <= 6 &&
        body.history.every(
          (m) =>
            ['user', 'assistant'].includes(m.role) &&
            typeof m.content === 'string' &&
            m.content.length <= 4000 &&
            Object.keys(m).every((k) => ['role', 'content'].includes(k)),
        ),
      400,
      'Invalid guest history.',
    );
    const history = body.history.map((m) => ({
      role: m.role,
      content: '[Untrusted guest conversation data] ' + m.content,
    }));
    const result = await relay(
      env,
      history,
      { ...body.input, page },
      reference,
      request.pageContext,
      {
        identity: null,
        proof,
        surface: request.surface,
        operationId: body.operationId,
        issuedAt: body.issuedAt,
      },
    );
    jerryAssert(
      !(await current(env, proof)).identity,
      401,
      'Your account session changed.',
      'JERRY_SESSION_CHANGED',
    );
    return { result, guest: true };
  }
  jerryAssert(
    request.expected?.owner === identity.owner &&
      request.expected?.sessionRef === identity.sessionRef,
    401,
    'Refresh account context before continuing.',
    'JERRY_SESSION_CHANGED',
  );
  const call = conversationClient(env, identity, request.surface);
  const authenticated = {
    owner: identity.owner,
    sessionRef: identity.sessionRef,
    role: identity.role,
  };
  if (request.operation === 'list') return call('list');
  if (request.operation === 'create') {
    jerryKeys(body, ['id']);
    const result = await call('create', body);
    await seller(
      env,
      'register',
      {
        ...authenticated,
        id: body.id,
        surface: request.surface,
        generation: result.conversation.generation,
      },
      proof,
    );
    return result;
  }
  if (request.operation === 'read') {
    jerryKeys(body, ['id']);
    return call('read', body);
  }
  if (request.operation === 'import') return call('import', body);
  if (request.operation === 'delete') {
    jerryKeys(body, ['id', 'generation']);
    const result = await call('delete', body); // canonical fence commits FIRST
    try {
      await seller(
        env,
        'erase',
        { owner: identity.owner, surface: request.surface, id: body.id },
        proof,
      );
      await call('cleanup-complete', { id: body.id });
      return { ok: true, deleted: true };
    } catch {
      return { ...result, pending: true };
    } // alarm retries copy cleanup
  }
  jerryKeys(body, ['id', 'generation', 'turnId', 'input']);
  jerryAssert(
    jerryUuid(body.id) && jerryUuid(body.turnId),
    400,
    'Invalid message identity.',
  );
  jerryKeys(body.input, [
    'message',
    'locale',
    'page',
    'mode',
    'resume',
    'draftStamp',
  ]);
  jerryAssert(body.input.page === page, 400, 'Message page context changed.');
  if (body.input.mode !== 'chat')
    jerryAssert(
      request.surface === 'exchange',
      403,
      'Saved work tools are available in Aviation Exchange.',
    );
  const reservation = await call('reserve', body);
  if (reservation.cached) {
    await current(env, proof, authenticated);
    return { ...reservation, result: reservation.turn.result };
  }
  const tracked = [];
  const transportContext = {
    identity,
    proof,
    surface: request.surface,
    conversationId: body.id,
    generation: body.generation,
    operationId: body.turnId,
    issuedAt: reservation.turn.createdAt,
    tracked,
    mark: (operation) =>
      seller(
        env,
        'transport-used',
        {
          ...authenticated,
          id: body.id,
          surface: request.surface,
          ...operation,
        },
        proof,
      ),
  };
  try {
    let result;
    if (body.input.mode === 'status' || body.input.mode === 'resume') {
      const snapshot = await seller(env, 'snapshot', authenticated, proof);
      result = {
        reply:
          snapshot.role === 'seller'
            ? (snapshot.draft
                ? 'Your private listing draft is saved. Resume it to continue editing.'
                : 'You have no saved draft.') +
              '\n\nListings: ' +
              (snapshot.listings
                .slice(0, 10)
                .map(
                  (l) => l.title.slice(0, 200) + ' [' + l.id + ']: ' + l.status,
                )
                .join('\n') || 'None') +
              '\n\nSupport requests: ' +
              (snapshot.support
                .slice(0, 10)
                .map((t) => t.id + ': ' + t.status)
                .join('\n') || 'None') +
              (snapshot.listings.length > 10 || snapshot.support.length > 10
                ? '\nOpen your account workspace for the remaining records.'
                : '')
            : 'The moderation queue contains ' +
              snapshot.pendingListings +
              ' pending listing(s) and ' +
              snapshot.openSupport +
              ' open support request(s).',
        ...(snapshot.draft
          ? {
              action: { type: 'resume_saved_draft' },
              draftStamp: snapshot.draft.stamp,
            }
          : {}),
      };
    } else if (body.input.mode === 'listing') {
      jerryAssert(
        identity.role === 'seller' && identity.profileId,
        403,
        'A current seller account is required.',
      );
      const target = new URL('/api/aircraft-sale/intake', proof.origin);
      const response = await env.SELLER_STORE.get(
        env.SELLER_STORE.idFromName('seller-v2'),
      ).fetch(
        new Request(target, {
          method: 'POST',
          headers: headersFor(proof),
          body: JSON.stringify({
            messages: [{ role: 'user', content: body.input.message }],
            resume: body.input.resume === true,
            jerry: {
              operationId: body.turnId,
              conversationId: body.id,
              generation: body.generation,
              expectedDraft: body.input.draftStamp,
            },
          }),
        }),
      );
      result = await json(response);
    } else
      result = await relay(
        env,
        reservation.history,
        body.input,
        reference,
        request.pageContext,
        transportContext,
      );
    if (body.input.mode !== 'chat')
      result = await localized(
        env,
        result,
        body.input.locale,
        transportContext,
      );
    await current(env, proof, authenticated);
    const finalized = await call('finalize', {
      id: body.id,
      generation: body.generation,
      turnId: body.turnId,
      lease: reservation.turn.lease,
      result,
    });
    if (request.surface === 'exchange') {
      try {
        await seller(
          env,
          'log',
          { ...authenticated, id: body.id, turnId: body.turnId },
          proof,
        );
        await call('log-complete', { id: body.id, turnId: body.turnId });
      } catch {
        /* The durable metadata outbox retries without saving session credentials. */
      }
    }
    await current(env, proof, authenticated);
    for (const operation of tracked)
      await seller(
        env,
        'transport-committed',
        {
          ...authenticated,
          id: body.id,
          surface: request.surface,
          ...operation,
        },
        proof,
      ).catch(() => {});
    return { ...finalized, result };
  } catch (error) {
    if (
      error.status === 401 ||
      error.status === 410 ||
      [
        'JERRY_REPLAY_CONFLICT',
        'JERRY_ATTEMPT_UNCERTAIN',
        'JERRY_ATTEMPT_EXPIRED',
        'JERRY_ATTEMPT_COMPLETED',
        'JERRY_ATTEMPT_FAILED',
      ].includes(error.code)
    )
      for (const operation of tracked)
        await seller(
          env,
          'cancel-transport',
          {
            owner: identity.owner,
            surface: request.surface,
            id: body.id,
            key: operation.kind + ':' + operation.operationId,
          },
          proof,
        ).catch(() => {});
    await call('fail', {
      id: body.id,
      generation: body.generation,
      turnId: body.turnId,
      lease: reservation.turn.lease,
      failure: {
        status:
          Number.isInteger(error.status) &&
          error.status >= 400 &&
          error.status <= 599
            ? error.status
            : 503,
        code: /^JERRY_[A-Z_]{1,50}$/.test(error.code || '')
          ? error.code
          : 'JERRY_REQUEST_FAILED',
      },
    }).catch(() => {});
    throw error;
  }
}

// Admin lookup is tied to a verified activity event, never a browser-supplied
// owner or conversation. It runs outside SellerStore's queue (no callback cycle).
export async function jerryActivity(env, { proof, eventId, staff = false }) {
  const response = await env.SELLER_STORE.get(
    env.SELLER_STORE.idFromName('seller-v2'),
  ).fetch(
    new Request(
      new URL(
        '/api/aircraft-sale/' +
          (staff ? 'staff' : 'admin') +
          '/activity/' +
          eventId,
        proof.origin,
      ),
      { headers: headersFor(proof) },
    ),
  );
  const result = await json(response),
    ref = result.event?.details?.conversationRef;
  if (!ref) return result;
  jerryAssert(
    ref.surface === 'exchange' &&
      /^[a-f0-9]{64}$/.test(ref.owner) &&
      jerryUuid(ref.conversationId),
    403,
    'Invalid Exchange conversation reference.',
  );
  try {
    const canonical = await conversationClient(
      env,
      { owner: ref.owner },
      'exchange',
    )('read', { id: ref.conversationId });
    return {
      ...result,
      conversationExpiresAt: canonical.conversation.expiresAt,
      exchanges: canonical.turns.map((turn) => ({
        id: turn.id,
        at: turn.createdAt,
        source: 'server',
        mode: turn.input?.mode || 'guest-import',
        result: turn.status,
        ...(turn.failure
          ? {
              error:
                'Request failed (' +
                turn.failure.status +
                '; ' +
                turn.failure.code +
                ').',
            }
          : {}),
        messages:
          turn.status === 'imported'
            ? [turn.message]
            : [
                { role: 'user', content: turn.input.message },
                ...(turn.result?.reply
                  ? [{ role: 'assistant', content: turn.result.reply }]
                  : []),
              ],
      })),
    };
  } catch (error) {
    if (error.status === 410)
      return {
        ...result,
        exchanges: [],
        conversationUnavailable: 'Deleted or expired',
      };
    throw error;
  }
}
