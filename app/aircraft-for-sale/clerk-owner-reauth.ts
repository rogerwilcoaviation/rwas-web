'use client';

import type {
  ClerkProductionOwnerProof,
  ClerkProductionOwnerTransaction,
} from './clerk-production-browser';

export const CLERK_OWNER_FLOW_KEY = 'rwas_sale_clerk_owner_reauth';
export type ClerkOwnerFlow =
  | { purpose: 'clerk-owner'; phase: 'identity'; requestedAt: number }
  | (ClerkProductionOwnerTransaction & { phase: 'reauth' })
  | (ClerkProductionOwnerProof & {
      phase: 'confirmation';
      requestedAt: number;
    });

const opaque = (value: unknown, maximum = 512) =>
  typeof value === 'string' && value.length > 0 && value.length <= maximum;

export function readClerkOwnerFlow(
  storage: Pick<Storage, 'getItem'>,
  now = Date.now(),
): ClerkOwnerFlow | null {
  try {
    const value = JSON.parse(storage.getItem(CLERK_OWNER_FLOW_KEY) || 'null');
    if (
      value?.purpose !== 'clerk-owner' ||
      !Number.isSafeInteger(value.requestedAt) ||
      now < value.requestedAt ||
      now - value.requestedAt >= 300000
    )
      return null;
    if (value.phase === 'identity') return value;
    if (
      value.phase === 'reauth' &&
      opaque(value.state) &&
      typeof value.proof === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(value.proof) &&
      opaque(value.csrf)
    )
      return value;
    if (
      value.phase === 'confirmation' &&
      opaque(value.token) &&
      opaque(value.ownerCsrf) &&
      Number.isSafeInteger(value.expiresAt) &&
      value.expiresAt > now &&
      opaque(value.email, 320) &&
      typeof value.name === 'string' &&
      value.name.length <= 300
    )
      return value;
    return null;
  } catch {
    return null;
  }
}

export function storeClerkOwnerFlow(
  storage: Pick<Storage, 'setItem'>,
  flow: ClerkOwnerFlow,
) {
  storage.setItem(CLERK_OWNER_FLOW_KEY, JSON.stringify(flow));
}
