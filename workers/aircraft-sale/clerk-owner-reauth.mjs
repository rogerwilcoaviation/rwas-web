import { accountHeld } from './account-admin.mjs';
import { digest, identityConfig } from './identity.mjs';

export const CLERK_OWNER_PURPOSE = 'clerk-owner-reauth';
export const CLERK_OWNER_METHOD = 'clerk-owner-proof';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

export function clerkOwnerConfig(env, origin) {
  const config = identityConfig(env);
  return config && config.origin === origin && config.methods.password
    ? config
    : null;
}

export function clerkOwnerInput(request, body, finishing = false) {
  const allowed = finishing
    ? ['state', 'code', 'error', 'proof', 'confirm']
    : ['proof', 'confirm'];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    body.confirm !== true ||
    typeof body.proof !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(body.proof) ||
    request.headers.get('X-RWAS-Link-Proof') !== body.proof ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
    (finishing &&
      (typeof body.state !== 'string' ||
        !/^[A-Za-z0-9_-]{43,128}$/.test(body.state)))
  )
    fail(403, 'Explicit owner authentication proof required.');
}

export function clerkOwnerProviderBinding(external) {
  return {
    clerkIssuer: external.issuer,
    clerkSubject: external.subject,
    clerkSessionId: external.providerSessionId,
    clerkSessionCreatedAt: external.providerSessionCreatedAt,
    clerkPasswordLastUpdatedAt: external.passwordLastUpdatedAt,
  };
}

export function clerkOwnerProviderProof(binding, external) {
  const current = clerkOwnerProviderBinding(external);
  if (Object.keys(current).some((key) => binding[key] !== current[key]))
    fail(
      401,
      'Secure sign-in changed during owner authentication. Start again.',
    );
}

export async function clerkOwnerFinishProof(tx, request, body, config) {
  clerkOwnerInput(request, body, true);
  const csrf = request.headers.get('X-RWAS-CSRF');
  if (
    tx.origin !== config.origin ||
    tx.ownerIssuer !== config.issuer ||
    tx.ownerClientId !== config.clientId ||
    tx.ownerCallback !== config.callback ||
    tx.browserProof !== (await digest(body.proof)) ||
    !csrf ||
    csrf.length > 512 ||
    tx.csrfProof !== (await digest(csrf))
  )
    fail(403, 'Owner authentication proof rejected.');
}

export async function clerkOwnerAccount(state, external, tx, now = Date.now()) {
  const at = external.authenticatedAt;
  if (
    !Number.isSafeInteger(at) ||
    at <= 0 ||
    at > now ||
    at < Math.floor(tx.createdAt / 1000) * 1000 ||
    now - at >= 600000
  )
    fail(401, 'Fresh existing-owner authentication required.');
  const identityKey = await digest(external.issuer + '|' + external.subject);
  const identity = state.identities[identityKey];
  const profile = identity && state.profiles[identity.userId];
  if (
    !identity ||
    !profile ||
    profile.id !== identity.userId ||
    identity.issuer !== external.issuer ||
    identity.subject !== external.subject ||
    identity.method !== 'password'
  )
    fail(
      409,
      'No established seller account is connected to this owner login. Contact RWAS.',
    );
  if (accountHeld(profile) || at <= (profile.sessionRevokedAt || 0))
    fail(403, 'Account unavailable.');
  for (const [key, linked] of Object.entries(state.identities)) {
    if (linked.userId !== profile.id) continue;
    const security = state.identitySecurity[key];
    if (
      security?.blocked ||
      security?.providerResetHold ||
      at <=
        Math.max(
          linked.credentialsChangedAt || 0,
          security?.credentialsChangedAt || 0,
        ) ||
      tx.createdAt <= (security?.credentialsChangedAt || 0)
    )
      fail(403, 'Account unavailable.');
  }
  return { profile, identityKey, authenticatedAt: at };
}
