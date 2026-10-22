// These checks protect the business-store boundary in addition to Better Auth's
// own signed-cookie, origin, verification and persistent-session validation.
export const betterAuthEnabled = (env) => env.BETTER_AUTH_ENABLED === 'true';
export const betterAuthLegacyLinkEnabled = (env) =>
  betterAuthEnabled(env) && env.BETTER_AUTH_LEGACY_LINK_ENABLED === 'true';

export function completedBetterAuthBusinessDeletion(state, identityKey) {
  const history = state.identitySecurity[identityKey];
  if (
    !state.identities[identityKey] &&
    history?.blocked === true &&
    Number.isSafeInteger(history.deletedAt) &&
    history.deletedAt > 0 &&
    history.deletedAt <= Date.now() &&
    history.identityDeletionIntent === true &&
    history.deletedProfileId === null
  )
    return true;
  return Boolean(
    !state.identities[identityKey] &&
      history?.blocked === true &&
      Number.isSafeInteger(history.deletedAt) &&
      history.deletedAt > 0 &&
      history.deletedAt <= Date.now() &&
      typeof history.deletedProfileId === 'string' &&
      history.deletedProfileId.length > 0 &&
      !state.profiles[history.deletedProfileId] &&
      !Object.values(state.identities).some(
        (identity) => identity.userId === history.deletedProfileId,
      ),
  );
}

const reject = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

export function assertBetterAuthOrigin(request, config) {
  if (
    !config ||
    new URL(request.url).origin !== config.origin ||
    request.headers.get('Origin') !== config.origin ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    reject(403, 'Seller authentication destination not allowed.');
}

export function validateBetterAuthIdentity(identity, recent = false) {
  const now = Date.now();
  if (
    !identity ||
    identity.issuer !== 'rwas-better-auth' ||
    ![identity.subject, identity.providerSessionId].every(
      (value) =>
        typeof value === 'string' && value.length > 0 && value.length <= 500,
    ) ||
    identity.emailVerified !== true ||
    typeof identity.email !== 'string' ||
    identity.email.length > 254 ||
    !/^\S+@[^\s@]+\.[^\s@]+$/.test(identity.email) ||
    typeof identity.name !== 'string' ||
    identity.name.length > 200 ||
    !Number.isSafeInteger(identity.createdAt) ||
    identity.createdAt <= 0 ||
    identity.createdAt > now ||
    !Number.isSafeInteger(identity.expiresAt) ||
    identity.expiresAt <= now ||
    identity.expiresAt <= identity.createdAt ||
    (recent && now - identity.createdAt > 600000)
  )
    reject(401, 'A verified, current seller sign-in is required.');
  return { ...identity, email: identity.email.trim().toLowerCase() };
}
