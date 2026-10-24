import { readBetterAuthIdentity } from './better-auth-service.mjs';
import { validateBetterAuthIdentity } from './better-auth-bridge.mjs';
import { accountHeld } from './account-admin.mjs';
import { digest } from './identity.mjs';
import { jerryAssert, jerryHash } from './jerry-protocol.mjs';

// This is authorization, not best-effort activity attribution. The provider is
// read without cookie-cache/refresh, then existing business holds and revocation
// fences are enforced before a stable owner key or role is returned.
export async function jerryAuthority(store, request) {
  if (!request.headers.get('Cookie')) return null;
  const raw = await store.readBetterAuthIdentity(store.env, request);
  if (!raw) return null;
  const identity = validateBetterAuthIdentity(raw),
    key = await digest(identity.issuer + '|' + identity.subject);
  const link = store.state.identities[key],
    profile = store.state.profiles[link?.userId],
    security = store.state.identitySecurity[key];
  jerryAssert(
    !security?.blocked &&
      !accountHeld(profile || {}) &&
      !security?.revokedProviderSessions?.[
        await digest(identity.providerSessionId)
      ] &&
      identity.createdAt >
        Math.max(
          security?.credentialsChangedAt || 0,
          profile?.sessionRevokedAt || 0,
        ),
    401,
    'Your account session is no longer available.',
    'JERRY_SESSION_CHANGED',
  );
  const roots = String(store.env.BETTER_AUTH_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const role = roots.includes(identity.subject)
    ? 'super-admin'
    : identity.isAdministrator === true
      ? 'admin'
      : identity.email?.toLowerCase() === 'admin@rwas.team'
        ? 'restricted'
        : 'seller';
  return {
    owner: key,
    accountRef: key,
    sessionRef: await jerryHash(identity.providerSessionId),
    profileId: profile?.id || null,
    role,
    displayName: String(profile?.name || identity.name || '').slice(0, 100),
    expiresAt: identity.expiresAt,
  };
}

export async function jerryDraftStamp(draft) {
  return jerryHash(draft || null);
}

export async function jerrySnapshot(store, identity, resource) {
  const state = store.state;
  if (resource) {
    jerryAssert(
      resource.type === 'listing' &&
        typeof resource.id === 'string' &&
        /^[A-Za-z0-9_-]{1,128}$/.test(resource.id),
      400,
      'Invalid listing reference.',
    );
    const listing = state.listings[resource.id];
    const staff = ['admin', 'super-admin'].includes(identity?.role);
    const publicView = listing ? store.jerryPublicListing(listing) : null;
    const publicVisible = !!publicView;
    jerryAssert(
      listing &&
        (publicVisible || identity?.profileId === listing.ownerId || staff),
      404,
      'This listing is unavailable.',
    );
    const fields = publicView || listing.fields || {};
    return {
      listing: {
        id: listing.id,
        status: listing.status,
        revision: listing.revision,
        title:
          fields.title ||
          [fields.year, fields.make, fields.model].filter(Boolean).join(' '),
        nNumber: fields.nNumber || '',
      },
    };
  }
  jerryAssert(identity, 401, 'Sign in to read your saved work.');
  if (['admin', 'super-admin'].includes(identity.role))
    return {
      role: identity.role,
      pendingListings: Object.values(state.listings).filter(
        (l) => l.status === 'pending',
      ).length,
      openSupport: Object.values(state.supportTickets || {}).filter(
        (t) => t.status === 'open',
      ).length,
    };
  jerryAssert(
    identity.role === 'seller' && identity.profileId,
    403,
    'A current seller account is required.',
  );
  const draft = state.drafts[identity.profileId];
  return {
    role: identity.role,
    draft: draft
      ? {
          saved: true,
          step: Number.isInteger(draft.step) ? draft.step : null,
          updatedAt: draft.updatedAt || null,
          stamp: await jerryDraftStamp(draft),
          listingId: draft.listingId || null,
        }
      : null,
    listings: Object.values(state.listings)
      .filter((l) => l.ownerId === identity.profileId)
      .map((l) => ({
        id: l.id,
        status: l.status,
        revision: l.revision,
        title: [l.fields?.year, l.fields?.make, l.fields?.model]
          .filter(Boolean)
          .join(' '),
      }))
      .slice(0, 50),
    support: Object.values(state.supportTickets || {})
      .filter((t) => t.ownerId === identity.profileId)
      .map((t) => ({ id: t.id, status: t.status }))
      .slice(0, 50),
  };
}

export function jerryLogReference(owner, surface, id, turnId) {
  jerryAssert(
    surface === 'exchange',
    403,
    'Only Exchange conversations belong in the Exchange activity log.',
  );
  return { version: 1, owner, surface, conversationId: id, turnId };
}
