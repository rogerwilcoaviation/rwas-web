import { digest } from './identity.mjs';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function securityOperation(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) =>
        ![
          'id',
          'kind',
          'subject',
          'occurredAt',
          'reason',
          'evidenceRef',
          'confirmation',
        ].includes(key),
    )
  )
    fail(400, 'Invalid operator request.');
  if (
    typeof body.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(body.id) ||
    ['__proto__', 'constructor', 'prototype'].includes(body.id) ||
    !['password-reset', 'account-blocked', 'account-unblocked'].includes(
      body.kind,
    ) ||
    typeof body.subject !== 'string' ||
    !body.subject ||
    body.subject.length > 500 ||
    !Number.isSafeInteger(body.occurredAt) ||
    body.occurredAt <= 0 ||
    body.occurredAt > Date.now()
  )
    fail(400, 'Invalid security event.');
  for (const field of ['reason', 'evidenceRef'])
    if (
      typeof body[field] !== 'string' ||
      body[field].trim().length < 10 ||
      body[field].length > 1000 ||
      /[\u0000-\u001f]/.test(body[field])
    )
      fail(400, 'Provide a reason and verified provider evidence reference.');
  return Object.fromEntries(
    ['id', 'kind', 'subject', 'occurredAt', 'reason', 'evidenceRef'].map(
      (key) => [key, body[key]],
    ),
  );
}
export async function securityProposal(state, issuer, operation) {
  const identityKey = await digest(issuer + '|' + operation.subject);
  const identity = state.identities[identityKey];
  const security = state.identitySecurity[identityKey] || null;
  const profile = state.profiles[identity?.userId];
  if (
    operation.kind === 'account-unblocked' &&
    (!security?.blocked ||
      operation.occurredAt <
        (security.blockedAt || security.credentialsChangedAt || 0))
  )
    fail(409, 'No matching block or provider unblock predates the block.');
  if (
    operation.kind === 'account-blocked' &&
    operation.occurredAt <= (security?.unblockedThrough || 0)
  )
    fail(409, 'Block predates an already verified unblock.');
  const linked = Object.entries(state.identities)
    .filter(([, value]) => profile && value.userId === profile.id)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      identity: value,
      security: state.identitySecurity[key] || null,
    }));
  const sessions = Object.entries(state.sessions)
    .filter(([, value]) => profile && value.userId === profile.id)
    .sort(([a], [b]) => a.localeCompare(b));
  const snapshot = {
    identity: identity || null,
    security,
    profile: profile
      ? {
          id: profile.id,
          disabled: !!profile.disabled,
          identityBlocked: !!profile.identityBlocked,
          adminSuspended: !!profile.adminSuspended,
          sessionRevokedAt: profile.sessionRevokedAt || 0,
        }
      : null,
    linked,
    sessions,
  };
  return {
    identityKey,
    profileId: profile?.id,
    public: {
      operation,
      affectedProfileId: profile?.id || null,
      sessionsToRevoke: sessions.length,
      otherBlockedSubjects: linked.filter(
        (item) => item.key !== identityKey && item.security?.blocked,
      ).length,
      confirmation: await digest(
        JSON.stringify({ issuer, operation, snapshot }),
      ),
    },
  };
}
