import { JerryConversations } from '../../workers/aircraft-sale/jerry-conversations.mjs';
import { jerryWebsite } from '../../workers/aircraft-sale/jerry-service.mjs';
import { digest } from '../../workers/aircraft-sale/identity.mjs';
import { fixture } from './fixture.mjs';

export function conversationFixture(env = {}, existing = new Map()) {
  let failed = false,
    alarm = null;
  const storage = {
    get: async (key) => structuredClone(existing.get(key)),
    put: async (key, value) => {
      if (failed) throw Error('Synthetic storage failure');
      existing.set(key, structuredClone(value));
    },
    delete: async (key) => {
      if (Array.isArray(key)) key.forEach((k) => existing.delete(k));
      else existing.delete(key);
    },
    list: async ({ prefix = '' } = {}) =>
      new Map(
        [...existing]
          .filter(([key]) => key.startsWith(prefix))
          .map(([k, v]) => [k, structuredClone(v)]),
      ),
    transaction: async (fn) => {
      const before = structuredClone(existing);
      try {
        return await fn(storage);
      } catch (error) {
        existing.clear();
        for (const [key, value] of before) existing.set(key, value);
        throw error;
      }
    },
    setAlarm: async (value) => {
      alarm = value;
    },
    deleteAlarm: async () => {
      alarm = null;
    },
  };
  let object = new JerryConversations({ storage }, env);
  const owner = 'a'.repeat(64),
    surface = 'exchange';
  const call = (path, body, headers = {}) =>
    object.fetch(
      new Request('https://jerry.internal/' + path, {
        method: path === 'list' ? 'GET' : 'POST',
        headers: {
          'X-Jerry-Owner': owner,
          'X-Jerry-Surface': surface,
          ...headers,
        },
        ...(path === 'list' ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return {
    existing,
    storage,
    call,
    object: () => object,
    restart: () => {
      object = new JerryConversations({ storage }, env);
    },
    fail: (v) => {
      failed = v;
    },
    alarm: () => alarm,
  };
}
export async function serviceFixture() {
  const f = fixture(),
    token = await f.login('synthetic-owner@example.test'),
    store = f.restart();
  const profile = Object.values(f.state().profiles)[0];
  const identity = {
    issuer: 'rwas-better-auth',
    subject: 'synthetic-user',
    providerSessionId: 'synthetic-session',
    email: profile.email,
    name: 'Synthetic Owner',
    emailVerified: true,
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 3600000,
    isAdministrator: false,
  };
  const owner = await digest(identity.issuer + '|' + identity.subject);
  const state = f.state();
  state.identities[owner] = {
    issuer: identity.issuer,
    subject: identity.subject,
    userId: profile.id,
  };
  f.durable.set('state', state);
  let signedIn = true,
    relayCalls = 0,
    relay = async () =>
      Response.json({ reply: 'Synthetic reply N123AB, 145.' });
  store.readBetterAuthIdentity = async (_, request) =>
    signedIn && request.headers.get('Cookie') ? identity : null;
  const objects = new Map();
  const env = f.env;
  env.JERRY_CONVERSATIONS_ENABLED = 'true';
  env.SELLER_STORE = {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => store.fetch(request) }),
  };
  env.JERRY_CONVERSATIONS = {
    idFromName: (name) => name,
    get: (name) => {
      if (!objects.has(name)) objects.set(name, conversationFixture(env));
      return { fetch: (request) => objects.get(name).object().fetch(request) };
    },
  };
  env.JERRY_RESPONSE = {
    respond: async (payload) => {
      relayCalls++;
      const response = await relay(payload);
      if (!response.ok)
        throw Object.assign(Error('Synthetic response service unavailable'), {
          status: 503,
        });
      return response.json();
    },
  };
  const proof = {
    origin: 'http://localhost',
    cookie: 'synthetic-cookie=1',
    authorization: 'Bearer ' + token,
  };
  const context = await jerryWebsite(env, { operation: 'context', proof });
  const base = {
    proof,
    expected: {
      owner: context.identity.owner,
      sessionRef: context.identity.sessionRef,
    },
    surface: 'exchange',
    page: '/aircraft-for-sale',
  };
  const call = (operation, body, overrides = {}) =>
    jerryWebsite(env, { ...base, operation, body, ...overrides });
  const create = async () =>
    (await call('create', { id: crypto.randomUUID() })).conversation;
  const message = (
    conversation,
    text = 'Synthetic question',
    mode = 'chat',
    extra = {},
  ) => ({
    id: conversation.id,
    generation: conversation.generation,
    turnId: crypto.randomUUID(),
    input: {
      message: text,
      locale: 'en',
      page: base.page,
      mode,
      ...(mode === 'listing' ? { draftStamp: context.draftStamp } : {}),
      ...extra,
    },
  });
  return {
    f,
    env,
    store,
    identity,
    owner,
    profile,
    proof,
    context,
    base,
    call,
    create,
    message,
    objects,
    relay: (value) => {
      relay = value;
    },
    relayCalls: () => relayCalls,
    signedIn: (value) => {
      signedIn = value;
    },
  };
}
