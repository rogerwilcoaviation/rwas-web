import { digest } from './identity.mjs';
import {
  administratorIdentity,
  administratorRole,
  superAdministratorIds,
} from './administrator-roles.mjs';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const safeId = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
export function removalTarget(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !['accountId', 'identityId'].includes(Object.keys(value)[0]) ||
    !safeId(Object.values(value)[0])
  )
    fail(400, 'Choose a user account or identity first.');
  return { ...value };
}
export async function identityRevision(row) {
  return digest(JSON.stringify(row));
}
export function assertRemovableIdentity(env, row, actor) {
  if (!row) return;
  if (
    superAdministratorIds(env).includes(row.id) ||
    administratorRole(row.role) ||
    row.email?.toLowerCase() === actor.toLowerCase()
  )
    fail(
      403,
      'Administrator identities are protected. Remove delegated administrator access before deleting an account. The original super administrator cannot be deleted.',
    );
}
export async function accountRemovalPlan(
  state,
  env,
  target,
  actor,
  readIdentity = administratorIdentity,
) {
  removalTarget(target);
  const links = Object.entries(state.identities).filter(([, link]) =>
    target.accountId
      ? link.userId === target.accountId
      : link.issuer === 'rwas-better-auth' &&
        link.subject === target.identityId,
  );
  const ids = [...new Set(links.map(([, link]) => link.userId))];
  if (ids.length > 1)
    fail(
      409,
      'This identity has conflicting account links. Resolve them before deletion.',
    );
  const accountId = target.accountId || ids[0] || null,
    profile =
      accountId && Object.hasOwn(state.profiles, accountId)
        ? state.profiles[accountId]
        : null;
  if (target.accountId && !profile) fail(404, 'Account not found.');
  const accountLinks = profile
    ? Object.entries(state.identities).filter(
        ([, link]) => link.userId === accountId,
      )
    : links;
  const subjects = [
    ...new Set([
      ...(target.identityId ? [target.identityId] : []),
      ...accountLinks
        .filter(([, link]) => link.issuer === 'rwas-better-auth')
        .map(([, link]) => link.subject),
    ]),
  ];
  const identities = [];
  for (const id of subjects) {
    if (superAdministratorIds(env).includes(id))
      fail(403, 'The original super administrator account cannot be deleted.');
    const row = await readIdentity(env, id);
    if (row) {
      assertRemovableIdentity(env, row, actor);
      identities.push({ id, row, revision: await identityRevision(row) });
    }
  }
  if (!profile && !identities.length) fail(404, 'Identity account not found.');
  if (profile?.email.toLowerCase() === actor.toLowerCase())
    fail(403, 'You cannot permanently delete your own administrator account.');
  const listings = Object.values(state.listings).filter(
    (l) => l.ownerId === accountId,
  );
  const files = Object.values(state.files).filter(
    (f) => accountId && f.ownerId === accountId,
  );
  const receipts = Object.entries(state.idempotency).filter(
    ([, r]) => accountId && r?.kind === 'upload-v1' && r.ownerId === accountId,
  );
  const unfinished = receipts.filter(
    ([, r]) =>
      r.status !== 'complete' ||
      r.file?.ownerId !== accountId ||
      !r.file?.key ||
      !r.file?.listingId ||
      state.files[r.file.key] ||
      state.listings[r.file.listingId],
  );
  const blockers = [];
  if (profile && !profile.adminDeleted)
    blockers.push(
      'Move this user account to trash first. This revokes access and moves its listings to trash.',
    );
  if (listings.length)
    blockers.push(
      `Permanently delete the user’s ${listings.length} listing(s) in User listings first.`,
    );
  if (files.length || unfinished.length)
    blockers.push(
      'Pending media or upload cleanup must finish before deleting this account.',
    );
  const email = profile?.email || identities[0].row.email;
  const support = Object.values(state.supportTickets || {}).filter(
    (t) => accountId && t.ownerId === accountId,
  );
  const scoped = (bucket, test) =>
    Object.entries(bucket || {})
      .filter(([key, value]) => test(key, value))
      .sort(([a], [b]) => a.localeCompare(b));
  const snapshot = {
    profile,
    accountLinks,
    identities,
    listings,
    files,
    receipts,
    support,
    draft: state.drafts[accountId] || null,
    sessions: scoped(
      state.sessions,
      (_k, v) => accountId && v.userId === accountId,
    ),
    codes: scoped(
      state.codes,
      (k, v) => accountId && (v.userId === accountId || k === 'login:' + email),
    ),
    transactions: scoped(
      state.authTransactions,
      (_k, v) => accountId && v.linkUserId === accountId,
    ),
    mail: scoped(
      state.mailRequests,
      (_k, v) =>
        accountId &&
        v.status === 'pending' &&
        (v.key === 'login:' + email || v.pendingCode?.userId === accountId),
    ),
  };
  return {
    target,
    accountId,
    email,
    identities,
    accountLinks,
    receiptKeys: receipts.map(([key]) => key),
    supportIds: support.map((t) => t.id),
    public: {
      target,
      accountId,
      email,
      identityCount: identities.length,
      listingCount: listings.length,
      supportCount: support.length,
      ready: blockers.length === 0,
      blockers,
      confirmation: await digest(JSON.stringify({ actor, target, snapshot })),
    },
  };
}
// D1 atomically deletes the sign-in and its dependent sessions, credentials
// and MFA records explicitly, whether or not cascades are configured. Compare-and-swap protects a target
// whose email or administrator role changes after the deletion preview.
export async function removeManagedIdentity(env, target, actor) {
  const row = await administratorIdentity(env, target.id);
  if (!row) return;
  assertRemovableIdentity(env, row, actor);
  // The durable intent already fixes the immutable target ID. Re-read mutable
  // metadata on retries so a completed sign-in/contact update cannot strand
  // cleanup. Elevated roles are checked above and fenced by the CAS below.
  const guard =
    'id = ? AND role IS ? AND "updatedAt" IS ? AND email = ? AND "emailVerified" IS ? AND banned IS ? AND "twoFactorEnabled" IS ?';
  const values = [
    row.id,
    row.role,
    row.updatedAt,
    row.email,
    row.emailVerified,
    row.banned,
    row.twoFactorEnabled,
  ];
  await env.SELLER_AUTH_DB.batch([
    ...['session', 'account', 'twoFactor'].map((table) =>
      env.SELLER_AUTH_DB.prepare(
        'DELETE FROM "' +
          table +
          '" WHERE "userId" = ? AND EXISTS (SELECT 1 FROM "user" WHERE ' +
          guard +
          ')',
      ).bind(row.id, ...values),
    ),
    env.SELLER_AUTH_DB.prepare('DELETE FROM "user" WHERE ' + guard).bind(
      ...values,
    ),
    env.SELLER_AUTH_DB.prepare(
      'DELETE FROM "verification" WHERE value = ? AND NOT EXISTS (SELECT 1 FROM "user" WHERE id = ?)',
    ).bind(row.id, row.id),
  ]);
  // D1 includes dependent cascade deletions in changes; confirm the target
  // row is gone rather than treating that aggregate count as a row version.
  if (await administratorIdentity(env, row.id))
    fail(409, 'The identity changed during deletion. Reload before retrying.');
}
export function fenceAccountRemoval(state, intent) {
  const at = Date.now(),
    id = intent.accountId;
  if (id && state.profiles[id]) state.profiles[id].adminPurging = true;
  for (const [key] of intent.accountLinks)
    state.identitySecurity[key] = {
      ...state.identitySecurity[key],
      blocked: true,
      deletedAt: at,
      deletedProfileId: id,
    };
  for (const identity of intent.identities)
    state.identitySecurity[identity.key] = {
      ...state.identitySecurity[identity.key],
      blocked: true,
      deletedAt: at,
      ...(id ? { deletedProfileId: id } : {}),
    };
  for (const [key, value] of Object.entries(state.sessions))
    if (id && value.userId === id) delete state.sessions[key];
  for (const [key, value] of Object.entries(state.authTransactions))
    if (id && value.linkUserId === id) delete state.authTransactions[key];
  for (const [key, value] of Object.entries(state.codes))
    if (id && (value.userId === id || key === 'login:' + intent.email))
      delete state.codes[key];
  for (const value of Object.values(state.mailRequests || {}))
    if (
      id &&
      value.status === 'pending' &&
      (value.key === 'login:' + intent.email ||
        value.pendingCode?.userId === id)
    ) {
      value.status = 'cancelled';
      delete value.pendingCode;
    }
}
export function finishAccountRemoval(state, intent) {
  const id = intent.accountId;
  if (id) {
    if (
      Object.values(state.listings).some((l) => l.ownerId === id) ||
      Object.values(state.files).some((f) => f.ownerId === id)
    )
      fail(409, 'Account cleanup is incomplete. Retry deletion.');
    for (const [key, link] of Object.entries(state.identities))
      if (link.userId === id) delete state.identities[key];
    for (const key of intent.receiptKeys) delete state.idempotency[key];
    for (const key of intent.supportIds) delete state.supportTickets[key];
    delete state.drafts[id];
    delete state.profiles[id];
  }
}
