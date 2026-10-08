// Auth0 Event Streams: documented user.updated CloudEvent, not a login error/log heuristic.
import { digest } from './identity.mjs';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function auth0EventConfig(env) {
  const secret = env.AUTH_STREAM_SECRET;
  if (
    typeof secret !== 'string' ||
    secret.length < 32 ||
    /[\r\n]/.test(secret) ||
    secret === env.AUTH_EVENT_SECRET ||
    typeof env.AUTH_EVENT_TENANT !== 'string' ||
    !/^[a-z0-9][-a-z0-9]{1,61}[a-z0-9]$/.test(env.AUTH_EVENT_TENANT) ||
    typeof env.AUTH_EVENT_SOURCE !== 'string' ||
    !/^urn:auth0:[A-Za-z0-9.:_-]{0,200}$/.test(env.AUTH_EVENT_SOURCE) ||
    typeof env.AUTH_EVENT_STREAM_ID !== 'string' ||
    !/^est_[A-Za-z0-9]{16,96}$/.test(env.AUTH_EVENT_STREAM_ID)
  )
    return null;
  return {
    secret,
    tenant: env.AUTH_EVENT_TENANT,
    source: env.AUTH_EVENT_SOURCE,
    stream: env.AUTH_EVENT_STREAM_ID,
  };
}
export async function auth0BlockNotification(body, config) {
  const user = body?.data?.object;
  const previous = body?.data?.previous_object;
  if (
    !body ||
    Array.isArray(body) ||
    body.specversion !== '1.0' ||
    body.type !== 'user.updated' ||
    body.source !== config.source ||
    body.a0tenant !== config.tenant ||
    body.a0stream !== config.stream ||
    typeof body.id !== 'string' ||
    !/^evt_[A-Za-z0-9]{16,96}$/.test(body.id) ||
    typeof body.time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      body.time,
    ) ||
    !user ||
    typeof user.user_id !== 'string' ||
    !user.user_id ||
    user.user_id.length > 500 ||
    (user.blocked !== undefined && typeof user.blocked !== 'boolean') ||
    typeof user.blockedPresent !== 'boolean' ||
    user.blockedPresent !== Object.hasOwn(user, 'blocked') ||
    (previous?.user_id !== undefined && previous.user_id !== user.user_id)
  )
    fail(400, 'Invalid provider stream event.');
  const issuedAt = Date.parse(body.time);
  if (!Number.isFinite(issuedAt)) fail(400, 'Invalid provider stream event.');
  return {
    id:
      'a0_' +
      (await digest(JSON.stringify([config.tenant, config.stream, body.id]))),
    kind: 'account-blocked',
    subject: user.user_id,
    issuedAt,
    blockedPresent: user.blockedPresent,
    blocked: user.blocked === true,
  };
}
