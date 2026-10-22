'use client';

import { CLERK_PRODUCTION_ORIGIN } from './clerk-production-browser';

export type SellerRequestSession = {
  purpose?: never;
  provider?: string;
  token: string;
  csrf?: string;
};
type Snapshot = { session: SellerRequestSession | null; generation: number };
type SellerRequestHeaders = (path: string) => Promise<Record<string, string>>;
declare global {
  interface Window {
    rwasSellerRequestHeaders?: SellerRequestHeaders;
    rwasSellerSessionRejected?: (token: string) => void;
  }
}

function denied(status: number) {
  return Object.assign(new Error('Please sign in to continue.'), { status });
}

export function createSellerRequestFacade({
  read,
  headers,
  reject,
  origin,
}: {
  read: () => Snapshot;
  headers: (session: SellerRequestSession) => Promise<Record<string, string>>;
  reject: () => void;
  origin: () => string;
}) {
  const requestHeaders: SellerRequestHeaders = async (path) => {
    if (
      !['/api/aircraft-sale/draft', '/api/aircraft-sale/intake'].includes(path)
    )
      throw denied(403);
    const captured = read();
    const session = captured.session;
    if (!session?.token || session.purpose !== undefined) throw denied(401);
    if (session.provider === 'better-auth' && !session.csrf) throw denied(403);
    if (session.provider === 'clerk-production') {
      if (origin() !== CLERK_PRODUCTION_ORIGIN || !session.csrf)
        throw denied(403);
    }
    let result: Record<string, string>;
    try {
      result = await headers(session);
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? error.status
          : undefined;
      if (status === 401 || status === 403 || status === 429 || status === 503)
        throw Object.assign(
          new Error(
            status === 401 || status === 403
              ? 'Please sign in to continue.'
              : 'Secure sign-in is temporarily unavailable. Please try again.',
          ),
          { status },
        );
      throw Object.assign(
        new Error(
          'Secure sign-in is temporarily unavailable. Please try again.',
        ),
        { status: 503 },
      );
    }
    const current = read();
    if (
      current.generation !== captured.generation ||
      current.session !== session
    )
      throw denied(401);
    if (
      session.provider === 'clerk-production' &&
      !result['X-Clerk-Session-Token']
    )
      throw denied(401);
    return result;
  };
  const sessionRejected = (token: string) => {
    if (token && read().session?.token === token) reject();
  };
  return { requestHeaders, sessionRejected };
}
