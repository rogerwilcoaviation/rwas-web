// Paste this complete file into an Auth0 Post Change Password Action (Node 22).
// This is a bounded notification, not a durable delivery queue. See MANAGED-LOGIN.md.
const { createHash } = require('node:crypto');
const destinations = new Set([
  'https://repair-aircraft-seller-workf.rwas-web.pages.dev/api/aircraft-sale/auth/events',
  'https://www.rogerwilcoaviation.com/api/aircraft-sale/auth/events',
]);
const windowMs = 300000;
const failure = () =>
  new Error(
    'RWAS password-reset notification failed; operator reconciliation required.',
  );

// Dependencies are injectable only for offline tests; the installed Action uses natives.
function createHandler({
  fetch = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  return async function onExecutePostChangePassword(event) {
    const secrets = event?.secrets || {};
    const endpoint = secrets.RWAS_SECURITY_EVENT_URL;
    const secret = secrets.AUTH_EVENT_SECRET;
    const secondaryEndpoint = secrets.RWAS_SECONDARY_SECURITY_EVENT_URL;
    const secondarySecret = secrets.AUTH_SECONDARY_EVENT_SECRET;
    const secondaryConfigured =
      secondaryEndpoint !== undefined || secondarySecret !== undefined;
    const tenant = event?.tenant?.id;
    const subject = event?.user?.user_id;
    const timestamp = event?.user?.last_password_reset;
    if (
      !destinations.has(endpoint) ||
      typeof secret !== 'string' ||
      secret.length < 32 ||
      /[\r\n]/.test(secret) ||
      typeof tenant !== 'string' ||
      !tenant ||
      tenant !== secrets.RWAS_AUTH0_TENANT ||
      event?.connection?.strategy !== 'auth0' ||
      typeof subject !== 'string' ||
      !subject ||
      subject.length > 500 ||
      typeof timestamp !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        timestamp,
      ) ||
      (secondaryConfigured &&
        (!destinations.has(secondaryEndpoint) ||
          typeof secondarySecret !== 'string' ||
          secondarySecret.length < 32 ||
          /[\r\n]/.test(secondarySecret) ||
          secondaryEndpoint === endpoint ||
          secondarySecret === secret))
    )
      throw failure();
    const issuedAt = Date.parse(timestamp);
    if (!Number.isFinite(issuedAt) || Math.abs(now() - issuedAt) > windowMs)
      throw failure();
    // Provider correlation_id is user-supplied; derive our retry identity from the actual reset.
    const id =
      'pw_' +
      createHash('sha256')
        .update(JSON.stringify([tenant, subject, issuedAt]))
        .digest('hex');
    const body = JSON.stringify({
      id,
      kind: 'password-reset',
      subject,
      issuedAt,
    });
    const deliver = async ({ endpoint, secret }) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (Math.abs(now() - issuedAt) > windowMs) throw failure();
        let terminal = false;
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            redirect: 'error',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + secret,
            },
            body,
            signal: AbortSignal.timeout(3000),
          });
          if (response.ok) {
            if ((await response.json()).ok === true) return;
          } else {
            // Bad configuration/proof cannot be repaired by retries; retry only transient failures.
            terminal =
              response.status < 500 && ![408, 429].includes(response.status);
            await response.body?.cancel();
          }
        } catch {
          // Never include provider data, response bodies, subject IDs, or secrets in Action logs.
        }
        if (terminal || attempt === 2) throw failure();
        await sleep(250 * (attempt + 1));
      }
    };
    const targets = [{ endpoint, secret }];
    if (secondaryConfigured)
      targets.push({
        endpoint: secondaryEndpoint,
        secret: secondarySecret,
      });
    await Promise.all(targets.map(deliver));
  };
}
exports.onExecutePostChangePassword = createHandler();
exports.createHandler = createHandler;
