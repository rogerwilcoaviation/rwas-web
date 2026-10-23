'use client';

import { createAuthClient } from 'better-auth/client';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { SELLER_API } from '@/lib/seller-api';
import { isBetterAuthQaEntry } from './better-auth-qa-entry';

export type BetterAuthSellerSession = {
  purpose?: never;
  provider: 'better-auth';
  token: string;
  csrf: string;
  email: string;
  name: string;
  identityUserId: string;
  identitySessionId: string;
};
export type BetterAuthProvider = 'password' | 'google' | 'apple';
export type BetterAuthLinkOwner = {
  token: string;
  csrf?: string;
};

export type SellerIdentityTarget = {
  userId: string;
  sessionId: string;
  challengeId?: string;
};
export function sellerIdentityTargetHeaders(target: SellerIdentityTarget) {
  if (
    !target.userId ||
    target.userId.length > 500 ||
    !target.sessionId ||
    target.sessionId.length > 500 ||
    (target.challengeId !== undefined &&
      (!target.challengeId || target.challengeId.length > 500)) ||
    (target.sessionId === 'pending-mfa' && !target.challengeId)
  )
    throw new Error('Your secure sign-in changed. Please sign in again.');
  return {
    'X-RWAS-Identity-User': target.userId,
    'X-RWAS-Identity-Session': target.sessionId,
    ...(target.challengeId
      ? { 'X-RWAS-Identity-Challenge': target.challengeId }
      : {}),
  };
}
export function createSellerIdentityClient(
  origin: string,
  target?: SellerIdentityTarget,
  onUpdated?: (target: SellerIdentityTarget) => void,
) {
  return createAuthClient({
    baseURL: origin,
    basePath: SELLER_API + '/identity',
    fetchOptions: {
      credentials: 'include',
      retry: 0,
      ...(target ? { headers: sellerIdentityTargetHeaders(target) } : {}),
      onSuccess: ({ response }) => {
        if (!target) return;
        const userId = response.headers.get('X-RWAS-Identity-User');
        const sessionId = response.headers.get('X-RWAS-Identity-Session');
        if (!userId && !sessionId) return;
        if (userId !== target.userId || !sessionId || sessionId.length > 500)
          throw new Error('Your secure sign-in changed. Please sign in again.');
        onUpdated?.({ userId, sessionId });
      },
    },
    plugins: [twoFactorClient(), adminClient()],
  });
}
let identityClient: ReturnType<typeof createSellerIdentityClient> | undefined;
export function getSellerIdentityClient() {
  return (identityClient ||= createSellerIdentityClient(
    window.location.origin,
  ));
}

export function getBoundSellerIdentityClient(
  target: SellerIdentityTarget,
  onUpdated?: (target: SellerIdentityTarget) => void,
) {
  return createSellerIdentityClient(
    window.location.origin,
    { ...target },
    onUpdated,
  );
}

export function sellerIdentityResponseTarget(
  response: Response,
): SellerIdentityTarget | null {
  const userId = response.headers.get('X-RWAS-Identity-User');
  const sessionId = response.headers.get('X-RWAS-Identity-Session');
  const challengeId = response.headers.get('X-RWAS-Identity-Challenge');
  return userId &&
    userId.length <= 500 &&
    sessionId &&
    sessionId.length <= 500 &&
    (sessionId !== 'pending-mfa' || (challengeId && challengeId.length <= 500))
    ? {
        userId,
        sessionId,
        ...(sessionId === 'pending-mfa' ? { challengeId: challengeId! } : {}),
      }
    : null;
}

export function sellerIdentityReturnUrl(route = 'identity') {
  const url = new URL('/aircraft-for-sale', window.location.origin);
  url.searchParams.set('seller-auth', route);
  const listingId = new URLSearchParams(window.location.search).get(
    'emailSeller',
  );
  if (listingId && /^[A-Za-z0-9_-]{1,128}$/.test(listingId))
    url.searchParams.set('emailSeller', listingId);
  if (isBetterAuthQaEntry(window.location.search))
    url.searchParams.set('seller-auth-qa', 'better-auth');
  return url.href;
}

export function sellerIdentityError(result: {
  error?: { message?: string } | null;
}) {
  if (result.error)
    throw new Error(
      result.error.message || 'The secure request could not be completed.',
    );
}

// The Better Auth cookie stays HttpOnly. Only the established RWAS opaque
// session and its CSRF value enter the existing seller request facade.
export async function connectBetterAuthSeller(
  owner?: BetterAuthLinkOwner,
  expected?: { userId: string; sessionId: string },
) {
  const response = await fetch(
    SELLER_API + '/auth/better-auth' + (owner ? '/link' : ''),
    {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(owner ? { Authorization: 'Bearer ' + owner.token } : {}),
        ...(owner?.csrf ? { 'X-RWAS-CSRF': owner.csrf } : {}),
      },
      body: JSON.stringify(
        expected
          ? {
              expectedUserId: expected.userId,
              expectedSessionId: expected.sessionId,
            }
          : {},
      ),
    },
  );
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(
      new Error(value?.error || 'Your seller sign-in could not be completed.'),
      {
        status: response.status,
        code: value?.code === 'ACCOUNT_DELETION_PENDING' ? value.code : '',
      },
    );
  if (
    typeof value?.session !== 'string' ||
    !value.session ||
    typeof value?.csrf !== 'string' ||
    !value.csrf ||
    typeof value?.email !== 'string' ||
    typeof value?.name !== 'string' ||
    typeof value?.identityUserId !== 'string' ||
    !value.identityUserId ||
    typeof value?.identitySessionId !== 'string' ||
    !value.identitySessionId
  )
    throw new Error('Your seller sign-in could not be completed.');
  return {
    provider: 'better-auth',
    token: value.session,
    csrf: value.csrf,
    email: value.email,
    name: value.name,
    identityUserId: value.identityUserId,
    identitySessionId: value.identitySessionId,
  } satisfies BetterAuthSellerSession;
}

export async function signOutBetterAuth(target: SellerIdentityTarget) {
  const result = await getBoundSellerIdentityClient(target).signOut();
  sellerIdentityError(result);
  document.dispatchEvent(new Event('rwas:better-auth-invalidated'));
}
