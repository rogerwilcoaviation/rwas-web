import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
export function fixture() {
  const durable = new Map(),
    objects = new Map(),
    mail = [];
  let storageFailure = false,
    deleteFailure = false;
  const env = {
    MAILER: {
      fetch: async (request) => {
        mail.push(await request.json());
        return Response.json({ ok: true });
      },
    },
    ADMIN_AUTH: {
      fetch: async (request) =>
        request.headers.get('Authorization') === 'Bearer fixture-reviewer'
          ? Response.json({ actor: 'fixture-admin' })
          : new Response(null, { status: 403 }),
    },
    MEDIA: {
      put: async (k, v, metadata) =>
        objects.set(k, { body: new Uint8Array(v), ...metadata }),
      get: async (k, options) => {
        const obj = objects.get(k);
        return obj && options?.range
          ? {
              ...obj,
              body: obj.body.slice(
                options.range.offset,
                options.range.offset + options.range.length,
              ),
            }
          : obj;
      },
      delete: async (k) => {
        if (deleteFailure) throw Error('R2 interrupted');
        objects.delete(k);
      },
      list: async ({ prefix }) => ({
        objects: [...objects.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      }),
    },
  };
  const ctx = {
    storage: {
      get: async (k) => structuredClone(durable.get(k)),
      put: async (k, v) => {
        if (storageFailure) throw Error('durable interrupted');
        durable.set(k, structuredClone(v));
      },
    },
  };
  let store = new SellerStore(ctx, env);
  const request = (path, method = 'GET', body, session, headers = {}) =>
    new Request(
      (env.AUTH_REDIRECT_URI
        ? new URL(env.AUTH_REDIRECT_URI).origin
        : 'http://localhost') +
        '/api/aircraft-sale' +
        path,
      {
        method,
        headers: {
          ...headers,
          ...(session ? { Authorization: 'Bearer ' + session } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined
          ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) }
          : {}),
      },
    );
  const call = (...args) => store.fetch(request(...args));
  async function login(address = 'owner@example.test') {
    await call('/send-code', 'POST', { email: address });
    const value = mail.at(-1).code;
    return (
      await (
        await call('/check-code', 'POST', { email: address, code: value })
      ).json()
    ).session;
  }
  return {
    env,
    ctx,
    durable,
    objects,
    mail,
    call,
    request,
    login,
    state: () => durable.get('state'),
    restart: () => (store = new SellerStore(ctx, env)),
    storageFailure: (v) => (storageFailure = v),
    deleteFailure: (v) => (deleteFailure = v),
  };
}
export const fields = {
  make: 'Synthetic',
  model: 'Fixture',
  year: 2000,
  price: 1,
  nNumber: 'N123AB',
};
export const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0,
]);
export const pdf = new TextEncoder().encode('%PDF-1.4 SYNTHETIC');
export const mp4 = new Uint8Array([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
  111, 109,
]);
export const create = async (f, t, body = fields, id = crypto.randomUUID()) =>
  (
    await (
      await f.call('/listings', 'POST', body, t, { 'Idempotency-Key': id })
    ).json()
  ).listing;
export const submit = async (f, t, l) =>
  f.call('/listing/' + l.id + '/status', 'POST', { status: 'pending' }, t);
export const approve = async (f, l) =>
  f.call(
    '/admin/review',
    'POST',
    { listingId: l.id, revision: l.revision, decision: 'approve' },
    'fixture-reviewer',
  );
