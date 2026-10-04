import { digest } from './identity.mjs';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const accountHeld = (profile) =>
  !profile ||
  !!(profile.disabled || profile.identityBlocked || profile.adminSuspended);
export const reasonCodes = [
  'support-request',
  'contact-correction',
  'abuse-prevention',
  'account-recovery',
  'maintenance',
];
const operations = [
  'update-profile',
  'suspend',
  'reinstate',
  'revoke-sessions',
];
const safeId = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const own = (object, key) => Object.hasOwn(object, key);
export function accountSite(env) {
  try {
    const url = new URL(env.ACCOUNT_ADMIN_SITE_ORIGIN);
    if (
      url.href !== url.origin + '/' ||
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        ))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function assertAccountOrigin(request, env, write) {
  const site = accountSite(env),
    url = new URL(request.url),
    origin = request.headers.get('Origin');
  if (!site) fail(503, 'Account administration is not configured.');
  if (
    url.origin !== site ||
    (origin && origin !== site) ||
    (write && origin !== site) ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    fail(403, 'Account administration destination not allowed.');
}
function profileFor(state, id) {
  if (!safeId(id) || !own(state.profiles, id)) fail(404, 'Account not found.');
  return state.profiles[id];
}
const sessionsFor = (state, id) =>
  Object.entries(state.sessions).filter(([, s]) => s.userId === id);
const listingRows = (state, id) =>
  Object.values(state.listings).filter((l) => l.ownerId === id);
function summary(state, profile) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name || '',
    createdAt: profile.createdAt,
    status: profile.adminSuspended
      ? 'suspended'
      : accountHeld(profile)
        ? 'security-held'
        : 'active',
    adminSuspended: !!profile.adminSuspended,
    securityHeld: !!(profile.disabled || profile.identityBlocked),
    listingCount: listingRows(state, profile.id).length,
    activeSessions: sessionsFor(state, profile.id).filter(
      ([, s]) => s.expiresAt > Date.now(),
    ).length,
  };
}
export function accountDirectory(state, url) {
  if (
    [...url.searchParams.keys()].some(
      (k) => !['q', 'status', 'cursor', 'limit'].includes(k),
    )
  )
    fail(400, 'Invalid account search.');
  const q = (url.searchParams.get('q') || '').trim().toLowerCase(),
    status = url.searchParams.get('status') || 'all';
  const limit = Number(url.searchParams.get('limit') || 25),
    cursor = url.searchParams.get('cursor');
  if (
    q.length > 100 ||
    !['all', 'active', 'suspended', 'security-held'].includes(status) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor && !safeId(cursor))
  )
    fail(400, 'Invalid account search.');
  const rows = Object.values(state.profiles)
    .map((p) => summary(state, p))
    .filter(
      (p) =>
        (!q ||
          [p.name, p.email, p.id].some((v) =>
            String(v).toLowerCase().includes(q),
          )) &&
        (status === 'all' || p.status === status),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const start = cursor ? rows.findIndex((p) => p.id === cursor) + 1 : 0;
  if (cursor && start === 0) fail(400, 'Account search changed. Start again.');
  const accounts = rows.slice(start, start + limit);
  return {
    accounts,
    total: rows.length,
    nextCursor: start + limit < rows.length ? accounts.at(-1).id : null,
  };
}
export function accountDetail(state, id) {
  const p = profileFor(state, id),
    listings = listingRows(state, id);
  return {
    account: {
      ...summary(state, p),
      phone: p.phone || '',
      location: p.location || '',
      loginMethods: [
        'email-code',
        ...new Set(
          Object.values(state.identities)
            .filter((i) => i.userId === id)
            .map((i) => i.method),
        ),
      ],
      sessions: sessionsFor(state, id)
        .filter(([, s]) => s.expiresAt > Date.now())
        .map(([, s]) => ({
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          method: s.method,
        })),
      listings: listings.map((l) => ({
        id: l.id,
        status: l.status,
        revision: l.revision,
        title: [l.fields.year, l.fields.make, l.fields.model]
          .filter(Boolean)
          .join(' '),
      })),
      hasSavedDraft: own(state.drafts, id),
      mediaCount: Object.values(state.files).filter((f) =>
        listings.some((l) => l.id === f.listingId),
      ).length,
    },
    audit: state.audit
      .filter(
        (a) => a.action === 'account-admin-operation' && a.accountId === id,
      )
      .slice(-20)
      .reverse()
      .map(
        ({
          operationId,
          accountId,
          actor,
          operation,
          reasonCode,
          changedFields,
          revokedSessions,
          suspended,
          securityHoldRemains,
          at,
        }) => ({
          operationId,
          accountId,
          actor,
          operation,
          reasonCode,
          changedFields,
          revokedSessions,
          suspended,
          securityHoldRemains,
          at,
        }),
      ),
  };
}
export function accountOperation(body) {
  if (
    !body ||
    !safeId(body.id) ||
    !operations.includes(body.operation) ||
    !reasonCodes.includes(body.reasonCode) ||
    Object.keys(body).some(
      (k) =>
        !['id', 'operation', 'reasonCode', 'changes', 'confirmation'].includes(
          k,
        ),
    )
  )
    fail(400, 'Invalid account operation.');
  const result = {
    id: body.id,
    operation: body.operation,
    reasonCode: body.reasonCode,
  };
  if (body.operation === 'update-profile') {
    if (
      !body.changes ||
      typeof body.changes !== 'object' ||
      Array.isArray(body.changes) ||
      !Object.keys(body.changes).length ||
      Object.entries(body.changes).some(
        ([k, v]) =>
          !['name', 'phone', 'location'].includes(k) ||
          typeof v !== 'string' ||
          v.length > 200 ||
          /[\u0000-\u001f\u007f]/.test(v),
      )
    )
      fail(400, 'Only name, phone and location may be edited.');
    result.changes = Object.fromEntries(
      ['name', 'phone', 'location']
        .filter((k) => own(body.changes, k))
        .map((k) => [k, body.changes[k].trim()]),
    );
  } else if (body.changes !== undefined)
    fail(400, 'Unexpected profile changes.');
  return result;
}
function snapshot(state, p) {
  return {
    profile: {
      id: p.id,
      email: p.email,
      name: p.name || '',
      phone: p.phone || '',
      location: p.location || '',
      disabled: !!p.disabled,
      identityBlocked: !!p.identityBlocked,
      adminSuspended: !!p.adminSuspended,
      sessionRevokedAt: p.sessionRevokedAt || 0,
    },
    sessions: sessionsFor(state, p.id).sort(([a], [b]) => a.localeCompare(b)),
    links: Object.entries(state.identities)
      .filter(([, i]) => i.userId === p.id)
      .sort(([a], [b]) => a.localeCompare(b)),
    transactions: Object.entries(state.authTransactions)
      .filter(([, t]) => t.linkUserId === p.id)
      .sort(([a], [b]) => a.localeCompare(b)),
    codes: Object.entries(state.codes)
      .filter(([key, c]) => c.userId === p.id || key === 'login:' + p.email)
      .sort(([a], [b]) => a.localeCompare(b)),
    deliveries: Object.entries(state.mailRequests || {})
      .filter(
        ([, m]) =>
          m.status === 'pending' &&
          (m.key === 'login:' + p.email || m.pendingCode?.userId === p.id),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  };
}
export async function accountProposal(state, accountId, operation, actor) {
  const p = profileFor(state, accountId);
  const inputHash = await digest(
    JSON.stringify({ accountId, operation, actor }),
  );
  const previous = state.accountAdminOperations?.[operation.id];
  if (previous) {
    if (
      previous.inputHash !== inputHash ||
      previous.actor !== actor ||
      previous.accountId !== accountId
    )
      fail(409, 'Account operation identity changed.');
    return { previous, inputHash };
  }
  if (operation.operation === 'suspend' && p.adminSuspended)
    fail(409, 'Account is already suspended.');
  if (operation.operation === 'reinstate' && !p.adminSuspended)
    fail(409, 'Account is not suspended by an administrator.');
  const changedFields = operation.changes
    ? Object.keys(operation.changes).filter(
        (k) => operation.changes[k] !== (p[k] || ''),
      )
    : [];
  if (operation.operation === 'update-profile' && !changedFields.length)
    fail(400, 'No profile changes to apply.');
  return {
    inputHash,
    changedFields,
    public: {
      operationId: operation.id,
      accountId,
      operation: operation.operation,
      reasonCode: operation.reasonCode,
      changedFields,
      proposedChanges: operation.changes || null,
      sessionsToRevoke:
        operation.operation === 'update-profile'
          ? 0
          : sessionsFor(state, accountId).length,
      securityHoldRemains: !!(p.disabled || p.identityBlocked),
      confirmation: await digest(
        JSON.stringify({ inputHash, state: snapshot(state, p) }),
      ),
    },
  };
}
export function applyAccountOperation(
  state,
  accountId,
  operation,
  proposal,
  actor,
  audit,
) {
  const p = profileFor(state, accountId),
    at = Date.now();
  let revokedSessions = 0;
  if (operation.operation === 'update-profile')
    Object.assign(p, operation.changes);
  else {
    if (operation.operation === 'suspend') p.adminSuspended = true;
    if (operation.operation === 'reinstate') p.adminSuspended = false;
    p.sessionRevokedAt = Math.max(p.sessionRevokedAt || 0, at);
    for (const [key, s] of sessionsFor(state, accountId)) {
      delete state.sessions[key];
      revokedSessions++;
    }
    for (const [key, t] of Object.entries(state.authTransactions))
      if (t.linkUserId === accountId) delete state.authTransactions[key];
    for (const [key, c] of Object.entries(state.codes))
      if (c.userId === accountId || key === 'login:' + p.email)
        delete state.codes[key];
    for (const m of Object.values(state.mailRequests || {}))
      if (
        m.status === 'pending' &&
        (m.key === 'login:' + p.email || m.pendingCode?.userId === accountId)
      ) {
        m.status = 'cancelled';
        delete m.pendingCode;
      }
  }
  p.adminUpdatedAt = at;
  const result = {
    ok: true,
    operationId: operation.id,
    accountId,
    operation: operation.operation,
    revokedSessions,
    changedFields: proposal.changedFields,
    suspended: !!p.adminSuspended,
    securityHoldRemains: !!(p.disabled || p.identityBlocked),
    appliedAt: at,
  };
  audit('account-admin-operation', actor, {
    operationId: operation.id,
    accountId,
    operation: operation.operation,
    reasonCode: operation.reasonCode,
    changedFields: proposal.changedFields,
    revokedSessions,
    suspended: result.suspended,
    securityHoldRemains: result.securityHoldRemains,
  });
  state.accountAdminOperations ||= {};
  state.accountAdminOperations[operation.id] = {
    actor,
    accountId,
    inputHash: proposal.inputHash,
    result,
  };
  return result;
}
