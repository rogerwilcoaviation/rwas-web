import { digest } from './identity.mjs';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const superAdministratorIds = (env) =>
  String(env.BETTER_AUTH_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
export const administratorRole = (role) =>
  String(role || '')
    .split(',')
    .includes('admin');
const columns =
  'id, email, name, "emailVerified", "twoFactorEnabled", role, banned, "updatedAt"';
export async function administratorIdentity(env, id) {
  return env.SELLER_AUTH_DB.prepare(
    `SELECT ${columns} FROM "user" WHERE id = ?`,
  )
    .bind(id)
    .first();
}
async function summary(env, row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: superAdministratorIds(env).includes(row.id)
      ? 'super-admin'
      : administratorRole(row.role)
        ? 'admin'
        : 'user',
    verified: !!row.emailVerified,
    suspended: !!row.banned,
    mfaEnabled: !!row.twoFactorEnabled,
    revision: await digest(JSON.stringify(row)),
  };
}
export async function administratorDirectory(env, query = '') {
  const ids = superAdministratorIds(env);
  const placeholders = ids.map(() => '?').join(',') || 'NULL';
  const rows = await env.SELLER_AUTH_DB.prepare(
    `SELECT ${columns} FROM "user" WHERE role = 'admin' OR id IN (${placeholders}) ORDER BY email LIMIT 200`,
  )
    .bind(...ids)
    .all();
  let candidate = null;
  if (query) {
    if (query.length > 254 || !/^\S+@[^\s@]+\.[^\s@]+$/.test(query))
      fail(400, 'Enter the complete account email address.');
    const row = await env.SELLER_AUTH_DB.prepare(
      `SELECT ${columns} FROM "user" WHERE lower(email) = ?`,
    )
      .bind(query.trim().toLowerCase())
      .first();
    if (row) candidate = await summary(env, row);
  }
  return {
    administrators: await Promise.all(
      rows.results.map((row) => summary(env, row)),
    ),
    candidate,
  };
}
// Private service function. No role-management identity-provider endpoint is enabled.
// The DO checks current super-admin authority, CSRF, origin and recent MFA sign-in.
export async function changeAdministratorRole(env, actorId, input) {
  if (!superAdministratorIds(env).includes(actorId))
    fail(403, 'Super administrator access required.');
  if (
    !input ||
    !['grant', 'revoke'].includes(input.action) ||
    typeof input.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.id) ||
    typeof input.revision !== 'string' ||
    input.confirmEmail === undefined ||
    Object.keys(input).some(
      (k) => !['id', 'action', 'revision', 'confirmEmail'].includes(k),
    )
  )
    fail(400, 'Review and confirm the administrator change.');
  if (superAdministratorIds(env).includes(input.id))
    fail(
      403,
      'The original super administrator is protected and cannot be demoted.',
    );
  const row = await administratorIdentity(env, input.id);
  if (!row) fail(404, 'Registered account not found.');
  const current = await summary(env, row);
  if (input.revision !== current.revision)
    fail(409, 'Account changed. Reload administrators and review again.');
  if (input.confirmEmail !== row.email)
    fail(400, 'Confirm the exact account email address.');
  if (input.action === 'grant' && (!row.emailVerified || row.banned))
    fail(
      409,
      'The account must verify its email and have active sign-in before promotion.',
    );
  if ((input.action === 'grant') === administratorRole(row.role))
    fail(
      409,
      'Administrator access already changed. Reload to check its current status.',
    );
  // Compare-and-swap also fences concurrent provider suspension/contact changes.
  const changed = await env.SELLER_AUTH_DB.prepare(
    'UPDATE "user" SET role = ?, "updatedAt" = ? WHERE id = ? AND role IS ? AND "updatedAt" IS ? AND email = ? AND "emailVerified" IS ? AND banned IS ? AND "twoFactorEnabled" IS ?',
  )
    .bind(
      input.action === 'grant' ? 'admin' : 'user',
      new Date(
        Math.max(
          Date.now(),
          (Number(row.updatedAt) || new Date(row.updatedAt).getTime() || 0) + 1,
        ),
      ).toISOString(),
      row.id,
      row.role,
      row.updatedAt,
      row.email,
      row.emailVerified,
      row.banned,
      row.twoFactorEnabled,
    )
    .run();
  if (changed.meta.changes !== 1)
    fail(409, 'Account changed. Reload administrators and review again.');
  return summary(env, await administratorIdentity(env, row.id));
}
