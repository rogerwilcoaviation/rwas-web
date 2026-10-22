import { accountHeld } from './account-admin.mjs';
import { digest } from './identity.mjs';
import {
  CLERK_OWNER_METHOD,
  clerkOwnerProviderProof,
} from './clerk-owner-reauth.mjs';

const RECENT_OWNER = 600000;
const LINK_LIFETIME = 300000;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

// Historical provider bearers cannot be upgraded from their timestamp alone.
// Dedicated owner proofs retain fresh signed authentication and exact mapping.
export function clerkLinkOwner(
  state,
  sessionKey,
  now = Date.now(),
  configuredIssuer,
) {
  const session = state.sessions[sessionKey];
  const profile = session && state.profiles[session.userId];
  if (
    !session ||
    !profile ||
    !Number.isSafeInteger(session.createdAt) ||
    session.createdAt <= 0 ||
    session.createdAt > now ||
    now - session.createdAt >= RECENT_OWNER ||
    !Number.isSafeInteger(session.expiresAt) ||
    session.expiresAt <= now
  )
    fail(401, 'A fresh existing RWAS owner sign-in is required.');
  if (!['email-code', CLERK_OWNER_METHOD].includes(session.method))
    fail(
      403,
      'This existing sign-in requires RWAS account review before connecting Clerk.',
    );
  let authenticatedAt = session.createdAt;
  if (session.method === CLERK_OWNER_METHOD) {
    const identity = state.identities[session.identityKey];
    authenticatedAt = session.authenticatedAt;
    if (
      session.scope !== 'clerk-link-only' ||
      !Number.isSafeInteger(authenticatedAt) ||
      authenticatedAt <= 0 ||
      authenticatedAt > now ||
      now - authenticatedAt >= RECENT_OWNER ||
      session.issuer !== configuredIssuer ||
      !identity ||
      identity.userId !== session.userId ||
      identity.issuer !== session.issuer ||
      identity.subject !== session.subject ||
      identity.method !== 'password'
    )
      fail(
        403,
        'Existing-owner authentication no longer matches this account.',
      );
  }
  if (
    accountHeld(profile) ||
    authenticatedAt <= (profile.sessionRevokedAt || 0)
  )
    fail(403, 'Account unavailable.');
  for (const [key, identity] of Object.entries(state.identities)) {
    if (identity.userId !== profile.id) continue;
    const security = state.identitySecurity[key];
    if (
      security?.blocked ||
      security?.providerResetHold ||
      authenticatedAt <=
        Math.max(
          identity.credentialsChangedAt || 0,
          security?.credentialsChangedAt || 0,
        )
    )
      fail(403, 'Account unavailable.');
  }
  return { profile, session, sessionKey };
}

export function clerkLinkOwnerProviderProof(owner, external, request) {
  if (owner.session.method !== CLERK_OWNER_METHOD) return;
  if (request.headers.get('X-RWAS-Owner-CSRF') !== owner.session.ownerCsrf)
    fail(403, 'Existing-owner CSRF proof rejected.');
  clerkOwnerProviderProof(owner.session, external);
}

export function clerkLinkInput(request, body, finishing = false) {
  const keys = finishing ? ['nonce', 'proof', 'confirm'] : ['proof', 'confirm'];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key)) ||
    body.confirm !== true ||
    typeof body.proof !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(body.proof) ||
    request.headers.get('X-RWAS-Link-Proof') !== body.proof ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
    (finishing &&
      (typeof body.nonce !== 'string' ||
        body.nonce.length < 43 ||
        body.nonce.length > 512))
  )
    fail(403, 'Explicit account connection proof required.');
}

export async function clerkLinkIdentity(
  state,
  owner,
  external,
  at = Date.now(),
) {
  const identityKey = await digest(external.issuer + '|' + external.subject);
  const security = state.identitySecurity[identityKey];
  if (
    security?.blocked ||
    security?.providerResetHold ||
    at <= (security?.credentialsChangedAt || 0)
  )
    fail(403, 'Account unavailable.');
  if (state.identities[identityKey])
    fail(409, 'That Clerk login is already connected to a RWAS account.');
  if (
    Object.values(state.identities).some(
      (identity) =>
        identity.userId === owner.profile.id &&
        identity.method === 'clerk-production',
    )
  )
    fail(409, 'This RWAS account already has a Clerk login.');
  return identityKey;
}

export async function clerkLinkTransaction(
  owner,
  external,
  origin,
  proof,
  csrf,
  now = Date.now(),
) {
  return {
    method: 'clerk-production-link',
    linkUserId: owner.profile.id,
    linkSessionKey: owner.sessionKey,
    linkSessionCreatedAt: owner.session.createdAt,
    browserProof: await digest(proof),
    csrfProof: await digest(csrf),
    origin,
    issuer: external.issuer,
    subject: external.subject,
    providerSessionId: external.providerSessionId,
    providerSessionCreatedAt: external.providerSessionCreatedAt,
    passwordLastUpdatedAt: external.passwordLastUpdatedAt,
    createdAt: now,
    expiresAt: now + LINK_LIFETIME,
  };
}

export async function clerkLinkFinishProof(tx, owner, request, body, origin) {
  clerkLinkInput(request, body, true);
  const csrf = request.headers.get('X-RWAS-CSRF');
  if (
    tx.origin !== origin ||
    tx.linkUserId !== owner.profile.id ||
    tx.linkSessionKey !== owner.sessionKey ||
    tx.linkSessionCreatedAt !== owner.session.createdAt ||
    tx.browserProof !== (await digest(body.proof)) ||
    !csrf ||
    csrf.length > 512 ||
    tx.csrfProof !== (await digest(csrf))
  )
    fail(403, 'Account connection proof rejected.');
}

export function clerkLinkProviderProof(tx, external) {
  if (
    tx.issuer !== external.issuer ||
    tx.subject !== external.subject ||
    tx.providerSessionId !== external.providerSessionId ||
    tx.providerSessionCreatedAt !== external.providerSessionCreatedAt ||
    tx.passwordLastUpdatedAt !== external.passwordLastUpdatedAt
  )
    fail(401, 'Account connection identity changed. Start again.');
}
