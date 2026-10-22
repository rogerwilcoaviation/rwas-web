export const BETTER_AUTH_QA_COHORT = 'rwas-better-auth-qa-20261022';
export const betterAuthQaEnabled = (env) =>
  env.BETTER_AUTH_QA_ENABLED === 'true';
export const betterAuthQaRequested = (request) =>
  request.headers.get('X-RWAS-Seller-QA') === 'better-auth';

function normalizedEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const address = value.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(address)
    ? address
    : null;
}

export function betterAuthQaEmails(env) {
  if (!betterAuthQaEnabled(env)) return [];
  const raw = env.BETTER_AUTH_QA_EMAILS;
  const values =
    typeof raw === 'string' && raw.length <= 4096
      ? raw.split(',').map(normalizedEmail)
      : [];
  if (
    !values.length ||
    values.length > 16 ||
    values.some((value) => !value) ||
    new Set(values).size !== values.length
  )
    throw Object.assign(
      new Error('Seller QA authentication is not configured.'),
      { status: 503 },
    );
  return Object.freeze(values);
}

export function betterAuthQaEmailAllowed(env, value) {
  return (
    !betterAuthQaEnabled(env) ||
    betterAuthQaEmails(env).includes(normalizedEmail(value))
  );
}

export function assertBetterAuthQaEmail(env, value) {
  if (!betterAuthQaEmailAllowed(env, value))
    throw Object.assign(
      new Error('Use an approved seller test account for this QA release.'),
      {
        status: 403,
        code: 'QA_ACCOUNT_REQUIRED',
      },
    );
}
