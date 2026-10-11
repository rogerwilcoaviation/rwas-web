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
const LINK_START_PATH = SELLER_ROOT + '/auth/clerk-production/link/start';
const LINK_FINISH_PATH = SELLER_ROOT + '/auth/clerk-production/link/finish';
const SELLER_URL = CLERK_PRODUCTION_ORIGIN + '/aircraft-for-sale';
const SIGN_UP_URL = SELLER_URL + '?seller-auth=sign-up';
const HANDOFF_URL = SELLER_URL + '?seller-auth=complete';

export type ClerkProductionHandoffStage =
  | 'provider-session-present'
  | 'clerk-token-request'
  | 'rwas-start-request'
  | 'rwas-start-accepted'
  | 'rwas-finish-request'
  | 'rwas-finish-accepted'
  | 'rwas-account-request'
  | 'complete';

type ClerkConstructor = new (publishableKey: string) => Clerk;
// Clerk's official modal interface supports getContainer. Derive the shared
// profile fields from the installed SDK without importing its internal package.
type ClerkUserProfileModalProps = NonNullable<
  Parameters<Clerk['openUserProfile']>[0]
> & { getContainer: () => HTMLElement | null };
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

export type ClerkProductionIdentityState = {
  sessionId: string;
  userId: string;
  userUpdatedAt: number | null;
};

export type ClerkProductionLinkOwner = {
  token: string;
  email: string;
  name: string;
};

export type ClerkProductionFailureTelemetry = {
  status: string;
  serverStage: string;
};

const SAFE_HTTP_STATUSES = new Set([
  400, 401, 403, 404, 405, 409, 413, 429, 500, 502, 503, 504,
]);
const SAFE_SERVER_STAGES = new Set([
  'runtime-config',
  'request-origin',
  'session-token',
  'jwt-format',
  'jwt-header',
  'jwt-jwks',
  'jwt-key',
  'jwt-signature',
  'jwt-claims',
  'provider-session',
  'provider-user',
  'provider-account',
  'provider-email',
  'provider-password-state',
]);

class ClerkProductionRequestError extends Error {
  readonly telemetry: ClerkProductionFailureTelemetry;

  constructor(status: string, serverStage = '') {
    super('RWAS sign-in could not be completed.');
    this.telemetry = {
      status,
      serverStage: SAFE_SERVER_STAGES.has(serverStage) ? serverStage : '',
    };
  }
}

export function clerkProductionFailureTelemetry(
  error: unknown,
): ClerkProductionFailureTelemetry {
  return error instanceof ClerkProductionRequestError
    ? error.telemetry
    : { status: '', serverStage: '' };
}

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
  private linking: Promise<ClerkProductionSession> | null = null;
  private linkingOwnerToken: string | null = null;

  constructor(clerk: Clerk, request: typeof fetch) {
    this.clerk = clerk;
    this.request = request.bind(globalThis);
  }

  hasSession() {
    return Boolean(this.clerk.session);
  }

  identityState(): ClerkProductionIdentityState {
    return {
      sessionId: this.clerk.session?.id || '',
      userId: this.clerk.user?.id || '',
      userUpdatedAt: this.clerk.user?.updatedAt?.getTime() ?? null,
    };
  }

  addIdentityListener(listener: (state: ClerkProductionIdentityState) => void) {
    return this.clerk.addListener(({ session, user }) => {
      listener({
        sessionId: session?.id || '',
        userId: user?.id || '',
        userUpdatedAt: user?.updatedAt?.getTime() ?? null,
      });
    });
  }

  openAccount(element: HTMLDivElement) {
    assertClerkProductionBoundary(productionLocation());
    if (!this.hasSession()) throw new Error('Clerk sign-in is required.');
    // The official modal API supplies this container to Clerk's portals, so
    // secondary settings dialogs stay inside the seller dialog's top layer.
    const props: ClerkUserProfileModalProps = { getContainer: () => element };
    this.clerk.openUserProfile(props);
    return () => this.clerk.closeUserProfile();
  }

  mountAuthentication(
    element: HTMLDivElement,
    search = window.location.search,
  ) {
    const signUp = new URLSearchParams(search).get('seller-auth') === 'sign-up';
    if (signUp) {
      this.clerk.mountSignUp(element, {
        routing: 'hash',
        forceRedirectUrl: HANDOFF_URL,
        fallbackRedirectUrl: HANDOFF_URL,
        signInUrl: HANDOFF_URL,
        signInForceRedirectUrl: HANDOFF_URL,
        signInFallbackRedirectUrl: HANDOFF_URL,
      });
      return () => this.clerk.unmountSignUp(element);
    }
    this.clerk.mountSignIn(element, {
      routing: 'hash',
      forceRedirectUrl: HANDOFF_URL,
      fallbackRedirectUrl: HANDOFF_URL,
      signUpUrl: SIGN_UP_URL,
      signUpForceRedirectUrl: HANDOFF_URL,
      signUpFallbackRedirectUrl: HANDOFF_URL,
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

  async connect(
    observe: (stage: ClerkProductionHandoffStage) => void = () => {},
  ) {
    if (this.connecting) return this.connecting;
    this.connecting = this.connectOnce(observe).finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connectOnce(
    observe: (stage: ClerkProductionHandoffStage) => void,
  ): Promise<ClerkProductionSession> {
    observe('provider-session-present');
    const start = await this.post(
      START_PATH,
      {},
      'rwas-start-request',
      'rwas-start-accepted',
      observe,
    );
    const nonce = safeString(start.nonce, 512);
    if (!nonce) throw new Error('RWAS sign-in could not be started.');
    const finish = await this.post(
      FINISH_PATH,
      { nonce },
      'rwas-finish-request',
      'rwas-finish-accepted',
      observe,
    );
    return this.acceptSession(finish, observe);
  }

  async link(
    owner: ClerkProductionLinkOwner,
    observe: (stage: ClerkProductionHandoffStage) => void = () => {},
  ) {
    if (this.linking) {
      if (owner.token !== this.linkingOwnerToken)
        throw new Error('Another RWAS account connection is in progress.');
      return this.linking;
    }
    this.linkingOwnerToken = owner.token;
    this.linking = this.linkOnce(owner, observe).finally(() => {
      this.linking = null;
      this.linkingOwnerToken = null;
    });
    return this.linking;
  }

  private async linkOnce(
    owner: ClerkProductionLinkOwner,
    observe: (stage: ClerkProductionHandoffStage) => void,
  ): Promise<ClerkProductionSession> {
    const ownerToken = safeString(owner.token, 512);
    if (!ownerToken) throw new Error('An existing RWAS sign-in is required.');
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const proof = btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
    const ownerHeaders = {
      Authorization: 'Bearer ' + ownerToken,
      'X-RWAS-Link-Proof': proof,
    };
    observe('provider-session-present');
    const start = await this.post(
      LINK_START_PATH,
      { proof, confirm: true },
      'rwas-start-request',
      'rwas-start-accepted',
      observe,
      ownerHeaders,
    );
    const nonce = safeString(start.nonce, 512);
    const csrf = safeString(start.csrf, 512);
    if (!nonce || !csrf)
      throw new Error('RWAS account connection could not be started.');
    const finish = await this.post(
      LINK_FINISH_PATH,
      { nonce, proof, confirm: true },
      'rwas-finish-request',
      'rwas-finish-accepted',
      observe,
      { ...ownerHeaders, 'X-RWAS-CSRF': csrf },
    );
    return this.acceptSession(finish, observe);
  }

  private async acceptSession(
    finish: Record<string, unknown>,
    observe: (stage: ClerkProductionHandoffStage) => void,
  ): Promise<ClerkProductionSession> {
    const session = safeString(finish.session, 512);
    const csrf = safeString(finish.csrf, 512);
    if (!session || !csrf)
      throw new Error('RWAS sign-in could not be completed.');
    const account = await this.account(session, csrf, observe);
    const profile = account.profile as Record<string, unknown> | undefined;
    const email = safeString(profile?.email, 320);
    const name = safeString(profile?.name, 300);
    if (!email) throw new Error('RWAS sign-in could not be completed.');
    observe('complete');
    return { provider: 'clerk-production', token: session, csrf, email, name };
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    requestStage: ClerkProductionHandoffStage,
    acceptedStage: ClerkProductionHandoffStage,
    observe: (stage: ClerkProductionHandoffStage) => void,
    extraHeaders: Record<string, string> = {},
  ) {
    assertClerkProductionBoundary(productionLocation());
    observe('clerk-token-request');
    const clerkToken = await this.token();
    observe(requestStage);
    let response: Response;
    try {
      response = await this.request(path, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          ...extraHeaders,
          'X-Clerk-Session-Token': clerkToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ClerkProductionRequestError('network');
    }
    const serverStage =
      response.headers.get('X-RWAS-Clerk-Failure-Stage') || '';
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok)
      throw new ClerkProductionRequestError(
        SAFE_HTTP_STATUSES.has(response.status)
          ? String(response.status)
          : 'other-http',
        serverStage,
      );
    if (!result) throw new ClerkProductionRequestError('non-json');
    observe(acceptedStage);
    return result;
  }

  private async account(
    session: string,
    csrf: string,
    observe: (stage: ClerkProductionHandoffStage) => void,
  ) {
    assertClerkProductionBoundary(productionLocation());
    observe('clerk-token-request');
    const clerkToken = await this.token();
    observe('rwas-account-request');
    let response: Response;
    try {
      response = await this.request(SELLER_ROOT + '/account', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer ' + session,
          'X-Clerk-Session-Token': clerkToken,
          'X-RWAS-CSRF': csrf,
        },
      });
    } catch {
      throw new ClerkProductionRequestError('network');
    }
    const serverStage =
      response.headers.get('X-RWAS-Clerk-Failure-Stage') || '';
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok)
      throw new ClerkProductionRequestError(
        SAFE_HTTP_STATUSES.has(response.status)
          ? String(response.status)
          : 'other-http',
        serverStage,
      );
    if (!result) throw new ClerkProductionRequestError('non-json');
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
