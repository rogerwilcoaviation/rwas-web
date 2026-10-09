'use client';

import type { Clerk } from '@clerk/clerk-js';
import { loadClerkProductionUi } from './clerk-production-ui';

export const CLERK_PRODUCTION_ORIGIN = 'https://www.rogerwilcoaviation.com';
export const CLERK_PRODUCTION_HOST = 'clerk.rogerwilcoaviation.com';
export const CLERK_PRODUCTION_PUBLISHABLE_KEY =
  'pk_live_Y2xlcmsucm9nZXJ3aWxjb2F2aWF0aW9uLmNvbSQ';

const SELLER_ROOT = '/api/aircraft-sale';
const START_PATH = SELLER_ROOT + '/auth/clerk-production/start';
const FINISH_PATH = SELLER_ROOT + '/auth/clerk-production/finish';
const SELLER_URL = CLERK_PRODUCTION_ORIGIN + '/aircraft-for-sale';
const SIGN_UP_URL = SELLER_URL + '?seller-auth=sign-up';

type ClerkConstructor = new (publishableKey: string) => Clerk;
type ClerkProductionOptions = {
  location?: Pick<Location, 'origin' | 'hostname' | 'protocol' | 'port'>;
  ClerkConstructor?: ClerkConstructor;
  fetch?: typeof fetch;
};
export type ClerkProductionSession = {
  provider: 'clerk-production';
  token: string;
  csrf: string;
  email: string;
  name: string;
};

function productionLocation() {
  if (typeof window === 'undefined')
    throw new Error('Clerk production authentication requires a browser.');
  return window.location;
}

export function assertClerkProductionBoundary(
  location: Pick<Location, 'origin' | 'hostname' | 'protocol' | 'port'>,
) {
  if (
    location.origin !== CLERK_PRODUCTION_ORIGIN ||
    location.protocol !== 'https:' ||
    location.hostname !== 'www.rogerwilcoaviation.com' ||
    location.port !== ''
  )
    throw new Error('Clerk production authentication is unavailable here.');
}

export function isClerkProductionMethodEnabled(
  methods: unknown,
  frontendEnabled = process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION === 'true',
) {
  if (!frontendEnabled || !methods || typeof methods !== 'object') return false;
  const value = methods as { methods?: unknown };
  return (
    Array.isArray(value.methods) && value.methods.includes('clerk-production')
  );
}

function safeString(value: unknown, maximum: number) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum
    ? value
    : '';
}

function tokenAuthorizedParty(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(
      atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4)),
    ) as { azp?: unknown };
    return typeof claims.azp === 'string' ? claims.azp : '';
  } catch {
    return '';
  }
}

export class ClerkProductionBrowser {
  private readonly clerk: Clerk;
  private readonly request: typeof fetch;
  private connecting: Promise<ClerkProductionSession> | null = null;

  constructor(clerk: Clerk, request: typeof fetch) {
    this.clerk = clerk;
    this.request = request.bind(globalThis);
  }

  hasSession() {
    return Boolean(this.clerk.session);
  }

  mountAuthentication(
    element: HTMLDivElement,
    search = window.location.search,
  ) {
    const signUp = new URLSearchParams(search).get('seller-auth') === 'sign-up';
    if (signUp) {
      this.clerk.mountSignUp(element, {
        routing: 'hash',
        forceRedirectUrl: SELLER_URL,
        fallbackRedirectUrl: SELLER_URL,
        signInUrl: SELLER_URL,
        signInForceRedirectUrl: SELLER_URL,
        signInFallbackRedirectUrl: SELLER_URL,
      });
      return () => this.clerk.unmountSignUp(element);
    }
    this.clerk.mountSignIn(element, {
      routing: 'hash',
      forceRedirectUrl: SELLER_URL,
      fallbackRedirectUrl: SELLER_URL,
      signUpUrl: SIGN_UP_URL,
      signUpForceRedirectUrl: SELLER_URL,
      signUpFallbackRedirectUrl: SELLER_URL,
    });
    return () => this.clerk.unmountSignIn(element);
  }

  addSessionListener(listener: () => void) {
    return this.clerk.addListener(({ session }) => {
      if (session) listener();
    });
  }

  async token() {
    const session = this.clerk.session;
    if (!session) throw new Error('Clerk sign-in is required.');
    let token = await session.getToken({ skipCache: true });
    if (token && tokenAuthorizedParty(token) !== CLERK_PRODUCTION_ORIGIN) {
      // A token carried back from Account Portal can still be scoped to the
      // hosted accounts origin. Discard it and ask Clerk for a new token from
      // this canonical browser context; never broaden the backend allowlist.
      session.clearCache();
      token = await session.getToken({ skipCache: true });
    }
    if (!token || tokenAuthorizedParty(token) !== CLERK_PRODUCTION_ORIGIN)
      throw new Error('Clerk sign-in is required.');
    return token;
  }

  async connect() {
    if (this.connecting) return this.connecting;
    this.connecting = this.connectOnce().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connectOnce(): Promise<ClerkProductionSession> {
    const start = await this.post(START_PATH, {});
    const nonce = safeString(start.nonce, 512);
    if (!nonce) throw new Error('RWAS sign-in could not be started.');
    const finish = await this.post(FINISH_PATH, { nonce });
    const session = safeString(finish.session, 512);
    const csrf = safeString(finish.csrf, 512);
    if (!session || !csrf)
      throw new Error('RWAS sign-in could not be completed.');
    const account = await this.account(session, csrf);
    const profile = account.profile as Record<string, unknown> | undefined;
    const email = safeString(profile?.email, 320);
    const name = safeString(profile?.name, 300);
    if (!email) throw new Error('RWAS sign-in could not be completed.');
    return { provider: 'clerk-production', token: session, csrf, email, name };
  }

  private async post(path: string, body: Record<string, unknown>) {
    assertClerkProductionBoundary(productionLocation());
    const response = await this.request(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'X-Clerk-Session-Token': await this.token(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !result)
      throw new Error('RWAS sign-in could not be completed.');
    return result;
  }

  private async account(session: string, csrf: string) {
    assertClerkProductionBoundary(productionLocation());
    const response = await this.request(SELLER_ROOT + '/account', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + session,
        'X-Clerk-Session-Token': await this.token(),
        'X-RWAS-CSRF': csrf,
      },
    });
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !result)
      throw new Error('RWAS sign-in could not be completed.');
    return result;
  }

  async signOut() {
    await this.clerk.signOut();
  }
}

let productionClient: Promise<ClerkProductionBrowser> | null = null;

export async function getClerkProductionBrowser(
  options: ClerkProductionOptions = {},
) {
  const location = options.location || productionLocation();
  assertClerkProductionBoundary(location);
  if (options.ClerkConstructor) {
    const clerk = new options.ClerkConstructor(
      CLERK_PRODUCTION_PUBLISHABLE_KEY,
    );
    await clerk.load();
    return new ClerkProductionBrowser(clerk, options.fetch || fetch);
  }
  if (!productionClient) {
    productionClient = import('@clerk/clerk-js').then(async ({ Clerk }) => {
      const clerk = new Clerk(CLERK_PRODUCTION_PUBLISHABLE_KEY);
      await clerk.load({ ui: await loadClerkProductionUi() });
      return new ClerkProductionBrowser(clerk, fetch);
    });
  }
  return productionClient;
}
