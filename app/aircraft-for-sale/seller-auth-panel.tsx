/* eslint-disable @next/next/no-img-element -- Authenticated blob previews cannot use the public image optimizer. */
'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { SELLER_API } from '@/lib/seller-api';
import {
  AccountSection,
  AccountWorkspace,
} from '@/components/shared/AccountWorkspace';
import BetterAuthPanel, {
  BetterAuthAccountPanel,
  BetterAuthDeleteAccount,
} from './better-auth-panel';
import {
  connectBetterAuthSeller,
  getSellerIdentityClient,
  signOutBetterAuth,
  type BetterAuthSellerSession,
  type BetterAuthProvider,
  type BetterAuthLinkOwner,
  type SellerIdentityTarget,
} from './better-auth-client';
import ClerkProductionPanel, {
  ClerkProductionAccountPanel,
  ClerkOwnerIdentityPanel,
} from './clerk-production-panel';
import {
  configureClerkProductionQaCohort,
  getClerkProductionBrowser,
  isClerkProductionMethodEnabled,
  type ClerkProductionLinkOwner,
  type ClerkProductionOwnerProof,
  type ClerkProductionSession,
} from './clerk-production-browser';
import { clerkQaMethodsHeaders } from './clerk-qa-cohort';
import { betterAuthQaMethodsHeaders } from './better-auth-qa-entry';
import {
  CLERK_OWNER_FLOW_KEY,
  readClerkOwnerFlow,
  storeClerkOwnerFlow,
} from './clerk-owner-reauth';
import { createSellerRequestFacade } from './seller-request-facade';
import { ListingDraftWorkflow } from './listing-draft-workflow';
import { mediaLimits, validateUpload } from './listing-draft-fields';

type Auth0Session = {
  purpose?: never;
  provider?: 'auth0';
  token: string;
  email: string;
  name: string;
};
type Session = Auth0Session | ClerkProductionSession | BetterAuthSellerSession;
type Media = {
  key: string;
  name: string;
  category: string;
  type: string;
  size: number;
};
type Listing = {
  id: string;
  status: string;
  revision: number;
  photos: Media[];
  videos: Media[];
  logbooks: Record<string, Media[]>;
  reviewNote?: string;
  [key: string]: unknown;
};
type IdentityMethod = 'password' | 'google' | 'apple';
const methodLabels: Record<IdentityMethod, string> = {
  password: 'Email and password',
  google: 'Google',
  apple: 'Apple',
};
type Account = {
  loginMethods?: IdentityMethod[];
  profile: { email: string; name: string; phone: string; location: string };
  sessions: {
    id: string;
    current: boolean;
    createdAt: number;
    expiresAt: number;
  }[];
};
const key = 'rwas_sale_v2';
const identityKey = 'rwas_sale_identity';
const clerkLinkKey = 'rwas_sale_clerk_link_intent';
const betterLinkKey = 'rwas_sale_better_link_intent';

async function clerkLinkFingerprint(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function clearSellerAuthRoute() {
  const current = new URL(window.location.href);
  if (!current.searchParams.has('seller-auth')) return;
  current.searchParams.delete('seller-auth');
  history.replaceState(
    null,
    '',
    current.pathname + current.search + current.hash,
  );
}
const inputs: [string, string, string?][] = [
  ['make', 'Make'],
  ['model', 'Model'],
  ['year', 'Year', 'number'],
  ['price', 'Asking price (USD)', 'number'],
  ['nNumber', 'N-number'],
  ['serialNumber', 'Serial number'],
  ['totalTime', 'Airframe total time'],
  ['engineTime', 'Engine time'],
  ['engineModel', 'Engine model'],
  ['propTime', 'Propeller time'],
  ['propModel', 'Propeller model'],
  ['sellerName', 'Seller name'],
  ['sellerPhone', 'Seller phone'],
  ['sellerLocation', 'Location'],
  ['annualDue', 'Annual due'],
  ['usefulLoad', 'Useful load'],
  ['fuelCapacity', 'Fuel capacity'],
  ['cruiseSpeed', 'Cruise speed'],
  ['range', 'Range'],
];
const longInputs: [string, string][] = [
  ['description', 'Description'],
  ['avionics', 'Avionics'],
  ['equipmentList', 'Equipment list'],
  ['damageHistory', 'Damage history'],
];
const categories: [string, string][] = [
  ['photos', 'Photos'],
  ['videos', 'Videos'],
  ['airframe', 'Airframe logbooks'],
  ['powerplant', 'Powerplant logbooks'],
  ['propeller', 'Propeller logbooks'],
  ['adSbCompliance', 'AD / SB compliance'],
  ['misc', 'Other records'],
];

async function sellerSessionHeaders(
  session: Session,
): Promise<Record<string, string>> {
  if (session.purpose !== undefined)
    throw new Error('Seller sign-in is required.');
  if (session.provider === 'clerk-production') {
    const client = await getClerkProductionBrowser();
    return {
      Authorization: 'Bearer ' + session.token,
      'X-Clerk-Session-Token': await client.token(),
      'X-RWAS-CSRF': session.csrf,
    };
  }
  if (session.provider === 'better-auth')
    return {
      Authorization: 'Bearer ' + session.token,
      'X-RWAS-CSRF': session.csrf,
    };
  return { Authorization: 'Bearer ' + session.token };
}

export default function SellerAuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [identityMethods, setIdentityMethods] = useState<IdentityMethod[]>([]);
  const [betterAuthEnabled, setBetterAuthEnabled] = useState(false);
  const [betterProviders, setBetterProviders] = useState<BetterAuthProvider[]>(
    [],
  );
  const [betterLegacyLink, setBetterLegacyLink] = useState(false);
  const [betterLinkOwner, setBetterLinkOwner] = useState<
    BetterAuthLinkOwner | undefined
  >();
  const [betterSignOutPending, setBetterSignOutPending] = useState(false);
  const betterSignOutTarget = useRef<SellerIdentityTarget | null>(null);
  const [clerkProduction, setClerkProduction] = useState(false);
  const [clerkExistingAccountLink, setClerkExistingAccountLink] =
    useState(false);
  const [clerkOwnerReauthEnabled, setClerkOwnerReauthEnabled] = useState(false);
  const [ownerProof, setOwnerProof] =
    useState<ClerkProductionOwnerProof | null>(null);
  const [ownerStage, setOwnerStage] = useState<
    'identity' | 'starting' | 'confirmation' | 'error'
  >('identity');
  const ownerGeneration = useRef(0);
  const [clerkSignOutPending, setClerkSignOutPending] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState('');
  const secureSignOutFlight = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  const [clerkLinkOwner, setClerkLinkOwner] =
    useState<ClerkProductionLinkOwner | null>(null);
  const [emailCodeLogin, setEmailCodeLogin] = useState(false);
  const [authEntry, setAuthEntry] = useState<'login' | 'signup'>('login');
  const [clerkRouteStage, setClerkRouteStage] = useState('');
  const [view, setView] = useState<
    | 'login'
    | 'better-auth'
    | 'clerk'
    | 'clerk-owner'
    | 'listings'
    | 'create'
    | 'edit'
    | 'account'
    | null
  >(null);
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false);
  const [savedDraft, setSavedDraft] = useState<Record<string, unknown> | null>(
    null,
  );
  const [items, setItems] = useState<Listing[]>([]),
    [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState<Record<string, string>>({}),
    [account, setAccount] = useState<Account | null>(null);
  const [accountSection, setAccountSection] = useState('profile');
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState(''),
    [emailCode, setEmailCode] = useState(''),
    [emailSent, setEmailSent] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    submission = useRef(crypto.randomUUID());
  const currentAuth = useRef<Session | null>(null);
  const editorGeneration = useRef(0);
  const manualListingAction = useRef<() => Promise<void>>(async () => {});
  const authGeneration = useRef(0);
  const requestFacade = useRef<ReturnType<
    typeof createSellerRequestFacade
  > | null>(null);
  const setAuth = (s: Session | null) => {
    if (s?.purpose !== undefined)
      throw new Error('Seller sign-in is required.');
    authGeneration.current += 1;
    currentAuth.current = s;
    if (s && requestFacade.current) {
      window.rwasSellerRequestHeaders = requestFacade.current.requestHeaders;
      window.rwasSellerSessionRejected = requestFacade.current.sessionRejected;
    } else {
      delete window.rwasSellerRequestHeaders;
      delete window.rwasSellerSessionRejected;
    }
    setSession(s);
    if (s) {
      setSignOutNotice('');
      setClerkSignOutPending(false);
      setBetterSignOutPending(false);
    }
    if (s) sessionStorage.setItem(key, JSON.stringify(s));
    else sessionStorage.removeItem(key);
    if (!s || s.provider === 'clerk-production') {
      sessionStorage.removeItem(clerkLinkKey);
      setClerkLinkOwner(null);
    }
    // Compatibility envelope shared with the listing widget; no token logging.
    (window as unknown as { rwasSaleSession: Session | null }).rwasSaleSession =
      s;
    document.dispatchEvent(
      new CustomEvent('rwas:session-changed', { detail: s }),
    );
  };
  const clerkSessionToken =
    session?.provider === 'clerk-production' ? session.token : null;
  useEffect(() => {
    const facade = createSellerRequestFacade({
      read: () => ({
        session: currentAuth.current,
        generation: authGeneration.current,
      }),
      headers: async (captured) => {
        const current = currentAuth.current;
        if (!current || captured !== current)
          throw new Error('Seller sign-in is required.');
        return sellerSessionHeaders(current);
      },
      origin: () => window.location.origin,
      reject: () => {
        setAuth(null);
        setAccount(null);
        setError('Your session ended. Please sign in again.');
        setView('login');
      },
    });
    requestFacade.current = facade;
    return () => {
      authGeneration.current += 1;
      requestFacade.current = null;
      if (window.rwasSellerRequestHeaders === facade.requestHeaders)
        delete window.rwasSellerRequestHeaders;
      if (window.rwasSellerSessionRejected === facade.sessionRejected)
        delete window.rwasSellerSessionRejected;
    };
    // Both callbacks read the current session ref rather than a rendered envelope.
  }, []);
  useEffect(() => {
    if (!clerkSessionToken || session?.provider !== 'clerk-production') return;
    const current = session;
    let active = true;
    let ended = false;
    let unsubscribe = () => {};
    const isCurrent = () =>
      active && !ended && currentAuth.current?.token === current.token;
    const endSession = () => {
      if (!isCurrent()) return;
      ended = true;
      setAuth(null);
      setAccount(null);
      setMessage('');
      setError('Your secure session ended. Please sign in again.');
      setView('login');
    };
    void getClerkProductionBrowser()
      .then((client) => {
        if (!isCurrent()) return;
        const original = client.identityState();
        if (!original.sessionId || !original.userId) {
          endSession();
          return;
        }
        let userUpdatedAt = original.userUpdatedAt;
        let validating = false;
        let validationQueued = false;
        const validate = async () => {
          if (!isCurrent()) return;
          if (validating) {
            validationQueued = true;
            return;
          }
          validating = true;
          try {
            do {
              validationQueued = false;
              const clerkToken = await client.token();
              if (!isCurrent()) return;
              const response = await fetch(SELLER_API + '/account', {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: {
                  Authorization: 'Bearer ' + current.token,
                  'X-Clerk-Session-Token': clerkToken,
                  'X-RWAS-CSRF': current.csrf,
                },
              });
              // UserProfile changes must pass the same server-side identity and
              // password-generation fences as every other seller request.
              if (response.status === 401 || response.status === 403)
                endSession();
            } while (isCurrent() && validationQueued);
          } catch {
            // Transient failures do not create a replacement seller session.
          } finally {
            validating = false;
          }
        };
        unsubscribe = client.addIdentityListener((next) => {
          if (!isCurrent()) return;
          if (
            next.sessionId !== original.sessionId ||
            next.userId !== original.userId
          ) {
            endSession();
            return;
          }
          if (next.userUpdatedAt !== userUpdatedAt) {
            userUpdatedAt = next.userUpdatedAt;
            void validate();
          }
        });
        void validate();
      })
      .catch(endSession);
    return () => {
      active = false;
      unsubscribe();
    };
    // The listener belongs to this RWAS session, not to profile form rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkSessionToken]);
  useEffect(() => {
    if (session?.provider !== 'better-auth') return;
    const captured = session;
    let active = true;
    const reject = () => {
      if (active && currentAuth.current === captured) {
        setAuth(null);
        setAccount(null);
        setView('login');
        setError('Your sign-in session ended. Please sign in again.');
      }
    };
    const check = () => {
      void getSellerIdentityClient()
        .getSession({ query: { disableCookieCache: true } })
        .then((result) => {
          if (
            (!result.error &&
              (!result.data ||
                result.data.user.id !== captured.identityUserId ||
                result.data.session.id !== captured.identitySessionId)) ||
            result.error?.status === 401 ||
            result.error?.status === 403
          )
            reject();
        })
        .catch(() => {
          /* A network outage is not proof of sign-out. Protected APIs still validate every request. */
        });
    };
    const focused = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('rwas:better-auth-invalidated', reject);
    document.addEventListener('visibilitychange', focused);
    window.addEventListener('focus', check);
    const timer = setInterval(check, 60000);
    check();
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('rwas:better-auth-invalidated', reject);
      document.removeEventListener('visibilitychange', focused);
      window.removeEventListener('focus', check);
    };
    // The token identifies one specific RWAS session; stale checks cannot clear its successor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.provider === 'better-auth' ? session.token : null]);
  useEffect(() => {
    let active = true;
    localStorage.removeItem('rwas_sale_session'); // Legacy sessions are not accepted by v2.
    let storedSession: Session | null = null;
    try {
      storedSession = JSON.parse(
        sessionStorage.getItem(key) || 'null',
      ) as Session | null;
      if (storedSession?.purpose !== undefined) {
        storedSession = null;
        sessionStorage.removeItem(key);
      }
      if (
        storedSession?.email &&
        storedSession.token &&
        storedSession.provider !== 'clerk-production' &&
        storedSession.provider !== 'better-auth'
      )
        setAuth(storedSession);
    } catch {
      sessionStorage.removeItem(key);
    }
    const requestedClerkRoute = new URL(window.location.href).searchParams.get(
      'seller-auth',
    );
    const initialUrl = new URL(window.location.href);
    const ownerCallback =
      Boolean(sessionStorage.getItem(CLERK_OWNER_FLOW_KEY)) &&
      ['state', 'code', 'error'].some((name) =>
        initialUrl.searchParams.has(name),
      );
    if (requestedClerkRoute !== null) setClerkRouteStage('methods-loading');
    let ownerReauthenticationPermitted = false;
    const methodsReady = fetch(SELLER_API + '/auth/methods', {
      cache: 'no-store',
      headers: {
        ...clerkQaMethodsHeaders(window.location.search),
        ...betterAuthQaMethodsHeaders(window.location.search),
      },
    })
      .then(async (response) => {
        if (
          !response.ok ||
          response.redirected ||
          new URL(response.url).origin !== window.location.origin
        )
          throw new Error('methods unavailable');
        const data = await response.json();
        if (!active) return;
        // Same-origin discovery decides public versus QA mode. QA discovery
        // remains unavailable without the exact opt-in header sent above.
        const betterEnabled =
          Array.isArray(data.methods) && data.methods.includes('better-auth');
        setBetterAuthEnabled(betterEnabled);
        if (betterEnabled) {
          setClerkProduction(false);
          setClerkExistingAccountLink(false);
          setClerkOwnerReauthEnabled(false);
          setBetterProviders(
            (data.betterAuth?.providers || []).filter((value: string) =>
              ['password', 'google', 'apple'].includes(value),
            ),
          );
          setBetterLegacyLink(data.betterAuth?.legacyLink === true);
          setIdentityMethods(
            (data.betterAuth?.legacyLink === true
              ? data.legacyMethods || []
              : []
            ).filter((value: string) =>
              ['password', 'google', 'apple'].includes(value),
            ),
          );
          setEmailCodeLogin(false);
          sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
          sessionStorage.removeItem(clerkLinkKey);
          if (storedSession?.provider === 'clerk-production')
            sessionStorage.removeItem(key);
          if (storedSession?.provider === 'better-auth') {
            const identity = await getSellerIdentityClient().getSession({
              query: { disableCookieCache: true },
            });
            if (!active) return;
            if (
              identity.data &&
              storedSession.csrf &&
              identity.data.user.id === storedSession.identityUserId &&
              identity.data.session.id === storedSession.identitySessionId
            )
              setAuth(storedSession);
            else sessionStorage.removeItem(key);
          }
          if (requestedClerkRoute === 'identity') {
            let intent: { fingerprint?: string; requestedAt?: number } | null =
              null;
            try {
              intent = JSON.parse(
                sessionStorage.getItem(betterLinkKey) || 'null',
              );
            } catch {
              /* Invalid local intent. */
            }
            const age = Date.now() - (intent?.requestedAt || 0);
            if (
              data.betterAuth?.legacyLink === true &&
              storedSession &&
              storedSession.provider !== 'better-auth' &&
              storedSession.provider !== 'clerk-production' &&
              age >= 0 &&
              age <= 600000 &&
              intent?.fingerprint ===
                (await clerkLinkFingerprint(storedSession.token))
            ) {
              if (!active) return;
              setBetterLinkOwner({
                token: storedSession.token,
                ...('csrf' in storedSession
                  ? { csrf: storedSession.csrf as string }
                  : {}),
              });
            } else sessionStorage.removeItem(betterLinkKey);
          }
          if (
            ['identity', 'reset', 'forgot'].includes(requestedClerkRoute || '')
          )
            setView('better-auth');
          return;
        }
        if (storedSession?.provider === 'better-auth')
          sessionStorage.removeItem(key);
        setIdentityMethods(
          (data.methods || []).filter((value: string) =>
            ['password', 'google', 'apple'].includes(value),
          ),
        );
        setEmailCodeLogin(data.emailCode === true);
        const qaCohort = configureClerkProductionQaCohort(
          data,
          window.location.search,
        );
        const clerkEnabled =
          isClerkProductionMethodEnabled(data) &&
          (!qaCohort.qaOnly || qaCohort.email !== null);
        setClerkProduction(clerkEnabled);
        const linkingEnabled =
          clerkEnabled &&
          !qaCohort.qaOnly &&
          data.existingAccountLink === 'fresh-email-code-session';
        setClerkExistingAccountLink(linkingEnabled);
        const ownerEnabled =
          clerkEnabled &&
          !qaCohort.qaOnly &&
          data.existingAccountOwnerReauth === 'auth0-password';
        ownerReauthenticationPermitted = ownerEnabled;
        setClerkOwnerReauthEnabled(ownerEnabled);
        const rawOwnerFlow = sessionStorage.getItem(CLERK_OWNER_FLOW_KEY);
        const ownerFlow = readClerkOwnerFlow(sessionStorage);
        if (rawOwnerFlow && !ownerCallback) {
          // Preserve the SDK's sign-up route until its identity-only view mounts.
          if (ownerFlow?.phase !== 'identity') clearSellerAuthRoute();
          if (!ownerEnabled || !ownerFlow) {
            sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
            setOwnerStage('error');
            setError(
              'Account connection expired or is unavailable. Please start again.',
            );
          } else if (ownerFlow.phase === 'confirmation') {
            setOwnerProof(ownerFlow);
            setOwnerStage('confirmation');
          } else if (ownerFlow.phase === 'identity') {
            setOwnerStage('identity');
          } else {
            setOwnerStage('error');
            setError(
              'Password verification was interrupted. Please start account connection again.',
            );
          }
          setView('clerk-owner');
        }
        const clerkRoute = new URL(window.location.href).searchParams.get(
          'seller-auth',
        );
        let linkIntentInvalid = false;
        const rawLinkIntent = sessionStorage.getItem(clerkLinkKey);
        if (
          rawLinkIntent &&
          !rawOwnerFlow &&
          !ownerCallback &&
          ['sign-up', 'complete'].includes(clerkRoute || '')
        ) {
          let intent: { fingerprint?: string; requestedAt?: number } | null =
            null;
          try {
            intent = JSON.parse(rawLinkIntent);
          } catch {
            /* Invalid local connection intent. */
          }
          const age = Date.now() - (intent?.requestedAt ?? 0);
          const matchingOwner =
            storedSession?.token &&
            intent?.fingerprint ===
              (await clerkLinkFingerprint(storedSession.token));
          if (!active) return;
          if (sessionStorage.getItem(clerkLinkKey) !== rawLinkIntent) return;
          if (
            linkingEnabled &&
            storedSession?.token &&
            storedSession.provider !== 'clerk-production' &&
            age >= 0 &&
            age <= 600000 &&
            matchingOwner
          ) {
            setClerkLinkOwner(storedSession);
          } else {
            linkIntentInvalid = true;
            sessionStorage.removeItem(clerkLinkKey);
            clearSellerAuthRoute();
            setError(
              'Account connection expired. Open Account and start again after a fresh email-code sign-in.',
            );
            setView('login');
          }
        }
        if (
          ['sign-up', 'complete'].includes(clerkRoute || '') &&
          clerkEnabled &&
          !linkIntentInvalid &&
          !rawOwnerFlow &&
          !ownerCallback
        ) {
          setClerkRouteStage('panel-requested');
          setView('clerk');
        } else if (
          clerkRoute !== null &&
          !linkIntentInvalid &&
          !rawOwnerFlow &&
          !ownerCallback
        ) {
          setClerkRouteStage(
            clerkEnabled ? 'route-invalid' : 'method-unavailable',
          );
          clearSellerAuthRoute();
        }
        if (storedSession?.provider === 'clerk-production') {
          if (
            clerkEnabled &&
            storedSession.email &&
            storedSession.token &&
            (!qaCohort.qaOnly || storedSession.email === qaCohort.email)
          )
            setAuth(storedSession);
          else sessionStorage.removeItem(key);
        }
      })
      .catch(() => {
        if (!active) return;
        if (requestedClerkRoute !== null) {
          setClerkRouteStage('methods-failed');
          clearSellerAuthRoute();
        }
      });
    const callback = new URL(window.location.href);
    if (ownerCallback) {
      const generation = ownerGeneration.current;
      const state = callback.searchParams.get('state');
      const authorizationCode = callback.searchParams.get('code');
      const providerError = callback.searchParams.get('error');
      const pending = readClerkOwnerFlow(sessionStorage);
      for (const name of ['state', 'code', 'error', 'error_description'])
        callback.searchParams.delete(name);
      history.replaceState(
        null,
        '',
        callback.pathname + callback.search + callback.hash,
      );
      setView('clerk-owner');
      setOwnerStage('starting');
      if (
        !pending ||
        pending.phase !== 'reauth' ||
        pending.state !== state ||
        (!authorizationCode && !providerError)
      ) {
        sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
        setOwnerStage('error');
        setError(
          'Account connection was started in another tab or expired. Please start again.',
        );
      } else {
        void methodsReady
          .then(() => {
            if (!ownerReauthenticationPermitted)
              throw new Error('Account connection is unavailable.');
            return getClerkProductionBrowser();
          })
          .then((client) => {
            if (!active || generation !== ownerGeneration.current)
              throw new Error('Account connection closed.');
            return client.finishOwnerReauthentication(
              pending,
              authorizationCode,
              providerError,
            );
          })
          .then((proof) => {
            if (!active || generation !== ownerGeneration.current) return;
            storeClerkOwnerFlow(sessionStorage, {
              ...proof,
              phase: 'confirmation',
              requestedAt: Date.now(),
            });
            setOwnerProof(proof);
            setOwnerStage('confirmation');
            setError('');
          })
          .catch(() => {
            if (!active || generation !== ownerGeneration.current) return;
            sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
            setOwnerProof(null);
            setOwnerStage('error');
            setError(
              'The existing seller account could not be verified. Start again or contact RWAS for help.',
            );
          });
      }
    } else if (
      callback.searchParams.has('state') &&
      (callback.searchParams.has('code') || callback.searchParams.has('error'))
    ) {
      const state = callback.searchParams.get('state'),
        authorizationCode = callback.searchParams.get('code'),
        providerError = callback.searchParams.get('error');
      for (const name of ['state', 'code', 'error', 'error_description'])
        callback.searchParams.delete(name);
      history.replaceState(
        null,
        '',
        callback.pathname + callback.search + callback.hash,
      );
      let pending: { state: string; proof: string; link: boolean } | null =
        null;
      try {
        pending = JSON.parse(sessionStorage.getItem(identityKey) || 'null');
      } catch {
        /* Invalid local transaction. */
      }
      sessionStorage.removeItem(identityKey);
      if (!pending || pending.state !== state) {
        setError(
          'Sign-in was started in another tab or expired. Please try again.',
        );
        setView('login');
      } else {
        setBusy(true);
        void fetch(SELLER_API + '/auth/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            code: authorizationCode,
            error: providerError,
            proof: pending.proof,
          }),
        })
          .then(async (response) => {
            const data = await response.json();
            if (!active) return;
            if (!response.ok)
              throw Error(data.error || 'Sign-in could not be completed.');
            setAuth({
              token: data.session,
              email: data.email,
              name: data.name,
            });
            setMessage(
              pending?.link ? 'Login method connected.' : 'Signed in.',
            );
            setView(null);
          })
          .catch((error) => {
            if (!active) return;
            setError(
              error instanceof Error
                ? error.message
                : 'Sign-in could not be completed.',
            );
            setView('login');
          })
          .finally(() => {
            if (active) setBusy(false);
          });
      }
    }
    const login = () => {
      setView('login');
      setSent(false);
      setError('');
    };
    const draft = (event: Event) => {
      const current = (window as unknown as { rwasSaleSession?: Session })
        .rwasSaleSession;
      if (!current) {
        login();
        return;
      }
      const details = (event as CustomEvent).detail || {};
      editorGeneration.current += 1;
      setEditing(null);
      submission.current = crypto.randomUUID();
      setForm(
        Object.fromEntries(
          [...inputs, ...longInputs].map(([k]) => [
            k,
            String(details[k] ?? ''),
          ]),
        ),
      );
      setView('edit');
      setMessage(
        'Review these details from Jerry. Save a private draft, then submit it for review.',
      );
    };
    document.addEventListener('rwas:seller-draft', draft);
    const manual = () => void manualListingAction.current();
    document.addEventListener('rwas:open-manual-form', manual);
    document.addEventListener('rwas:open-seller-login', login);
    return () => {
      active = false;
      ownerGeneration.current += 1;
      document.removeEventListener('rwas:open-seller-login', login);
      document.removeEventListener('rwas:seller-draft', draft);
      document.removeEventListener('rwas:open-manual-form', manual);
    };
  }, []);
  const closeSellerPanel = () => {
    editorGeneration.current += 1;
    ownerGeneration.current += 1;
    sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
    setOwnerProof(null);
    clearSellerAuthRoute();
    sessionStorage.removeItem(clerkLinkKey);
    setClerkLinkOwner(null);
    setBetterLinkOwner(undefined);
    sessionStorage.removeItem(betterLinkKey);
    setView(null);
  };
  useEffect(() => {
    if (view && !dialog.current?.open) dialog.current?.showModal();
    else if (!view && dialog.current?.open) dialog.current.close();
  }, [view]);
  async function api(
    path: string,
    method = 'GET',
    body?: unknown,
    extra?: Record<string, string>,
    signal?: AbortSignal,
  ) {
    const captured = currentAuth.current;
    const generation = authGeneration.current;
    const stillCurrent = () =>
      generation === authGeneration.current && captured === currentAuth.current;
    const headers = captured ? await sellerSessionHeaders(captured) : {};
    if (!stillCurrent())
      throw Object.assign(Error('Your session changed. Please try again.'), {
        status: 401,
      });
    const resp = await fetch(SELLER_API + path, {
      method,
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await resp.json().catch(() => null);
    if (
      stillCurrent() &&
      (resp.status === 401 ||
        (resp.status === 403 &&
          ['clerk-production', 'better-auth'].includes(
            captured?.provider || '',
          )))
    ) {
      setAuth(null);
      setAccount(null);
      setView('login');
      setSent(false);
    }
    if (!resp.ok)
      throw Object.assign(
        Error(data?.error || 'The request could not be completed.'),
        { status: resp.status },
      );
    if (!stillCurrent())
      throw Object.assign(Error('Your session changed. Please try again.'), {
        status: 401,
      });
    if (!data) throw Error('The request could not be completed.');
    return data;
  }
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function beginIdentity(method: IdentityMethod, link = false) {
    await perform(async () => {
      const proof =
        crypto.randomUUID().replaceAll('-', '') +
        crypto.randomUUID().replaceAll('-', '');
      const data = await api('/auth/start', 'POST', { method, proof, link });
      sessionStorage.setItem(
        identityKey,
        JSON.stringify({ state: data.state, proof, link }),
      );
      window.location.assign(data.authorizationUrl);
    });
  }
  function beginClerkOwnerConnection() {
    ownerGeneration.current += 1;
    storeClerkOwnerFlow(sessionStorage, {
      purpose: 'clerk-owner',
      phase: 'identity',
      requestedAt: Date.now(),
    });
    setOwnerProof(null);
    sessionStorage.removeItem(clerkLinkKey);
    sessionStorage.removeItem(identityKey);
    setClerkLinkOwner(null);
    setOwnerStage('identity');
    setError('');
    setMessage('');
    clearSellerAuthRoute();
    setView('clerk-owner');
  }
  async function beginOwnerPasswordVerification() {
    const generation = ownerGeneration.current;
    setOwnerStage('starting');
    try {
      const client = await getClerkProductionBrowser();
      if (generation !== ownerGeneration.current) return;
      const result = await client.startOwnerReauthentication();
      if (generation !== ownerGeneration.current) return;
      // Persist the dedicated purpose, state, proof, and CSRF before leaving RWAS.
      storeClerkOwnerFlow(sessionStorage, {
        ...result.transaction,
        phase: 'reauth',
      });
      clearSellerAuthRoute();
      window.location.assign(result.authorizationUrl);
    } catch {
      if (generation !== ownerGeneration.current) return;
      sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
      setOwnerStage('error');
      setError(
        'Password verification could not be started. Please start account connection again.',
      );
    }
  }
  async function confirmClerkOwnerConnection() {
    const proof = ownerProof;
    const generation = ownerGeneration.current;
    await perform(async () => {
      try {
        if (!proof || proof.expiresAt <= Date.now())
          throw new Error('Account connection expired. Please start again.');
        const client = await getClerkProductionBrowser();
        if (generation !== ownerGeneration.current) return;
        const connected = await client.link(proof);
        if (generation !== ownerGeneration.current) return;
        setAuth(connected);
        sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
        setOwnerProof(null);
        setMessage('Your existing seller account is connected.');
        setView(null);
      } catch (error) {
        if (generation !== ownerGeneration.current) return;
        sessionStorage.removeItem(CLERK_OWNER_FLOW_KEY);
        setOwnerProof(null);
        setOwnerStage('error');
        throw error;
      }
    });
  }
  async function load() {
    const data = await api('/my-listings');
    setItems(data.listings);
    setSavedDraft((await api('/draft')).draft);
    return data.listings as Listing[];
  }
  async function openListings() {
    if (!session) {
      setView('login');
      return;
    }
    setView('listings');
    await perform(async () => {
      await load();
    });
  }
  function edit(l: Listing | null) {
    editorGeneration.current += 1;
    setEditing(l);
    submission.current = crypto.randomUUID();
    setForm(
      Object.fromEntries(
        [...inputs, ...longInputs].map(([k]) => [k, String(l?.[k] ?? '')]),
      ),
    );
    setView('edit');
  }
  function openCreateListing() {
    setMessage('');
    setError('');
    setView(currentAuth.current ? 'create' : 'login');
  }
  async function openManualListing() {
    const current = currentAuth.current;
    if (!current) {
      setView('login');
      return;
    }
    await perform(async () => {
      const saved = await api('/draft');
      if (currentAuth.current !== current) return;
      const details = saved.draft?.intake ? saved.draft.fields : saved.draft;
      edit(null);
      if (details)
        setForm(
          Object.fromEntries(
            [...inputs, ...longInputs].map(([k]) => [
              k,
              String(details[k] ?? ''),
            ]),
          ),
        );
      setMessage('Enter your listing details and save a private draft.');
    });
  }
  manualListingAction.current = openManualListing;
  async function save() {
    const generation = editorGeneration.current;
    const values = Object.fromEntries(
      Object.entries(form).filter(([name, value]) => {
        if (['year', 'price'].includes(name) && !value.trim()) {
          if (editing?.[name])
            throw Error(
              `${name === 'year' ? 'Year' : 'Asking price'} is required. Enter a value before saving this change.`,
            );
          return false;
        }
        return editing || value.trim() !== '';
      }),
    );
    const data = await api(
      editing ? '/listings/' + editing.id : '/listings',
      editing ? 'PUT' : 'POST',
      values,
      editing ? undefined : { 'Idempotency-Key': submission.current },
    );
    if (generation !== editorGeneration.current) return data.listing as Listing;
    setEditing(data.listing);
    setMessage('Draft saved. Add media, then submit for review.');
    await load();
    return data.listing as Listing;
  }
  async function status(l: Listing, next: string) {
    await api('/listing/' + l.id + '/status', 'POST', { status: next });
    await load();
    setMessage(
      next === 'pending'
        ? 'Submitted for private RWAS review.'
        : 'Listing updated.',
    );
  }
  const onSubmit = (fn: () => Promise<void>) => (e: FormEvent) => {
    e.preventDefault();
    void perform(fn);
  };
  async function openAccount() {
    setAccountSection('profile');
    setAccount(null);
    setNewEmail('');
    setEmailCode('');
    setEmailSent(false);
    setView('account');
    await perform(async () => setAccount(await api('/account')));
  }
  async function beginClerkLink() {
    if (
      !session ||
      session.provider === 'clerk-production' ||
      !clerkExistingAccountLink
    )
      return;
    await perform(async () => {
      sessionStorage.setItem(
        clerkLinkKey,
        JSON.stringify({
          fingerprint: await clerkLinkFingerprint(session.token),
          requestedAt: Date.now(),
        }),
      );
      setClerkLinkOwner(session);
      setView('clerk');
    });
  }
  async function finishBetterSignOut() {
    if (!betterSignOutTarget.current)
      throw new Error(
        'Your secure sign-out target is unavailable. Please reload.',
      );
    await signOutBetterAuth(betterSignOutTarget.current);
    betterSignOutTarget.current = null;
    setBetterSignOutPending(false);
  }
  async function finishSecureSignOut() {
    if (currentAuth.current) return;
    const generation = authGeneration.current;
    const stillSignedOut = () =>
      !currentAuth.current && authGeneration.current === generation;
    setClerkSignOutPending(true);
    // An unresolved SDK request is not cancellation or confirmed sign-out.
    // Repeated clicks join it rather than dispatch another provider request.
    if (
      secureSignOutFlight.current &&
      secureSignOutFlight.current.generation !== generation
    )
      return;
    if (!secureSignOutFlight.current) {
      const promise = (async () => {
        const client = await getClerkProductionBrowser();
        if (!stillSignedOut()) return;
        await client.signOut();
      })();
      const entry = { generation, promise };
      secureSignOutFlight.current = entry;
      void promise.then(
        () => {
          if (secureSignOutFlight.current === entry)
            secureSignOutFlight.current = null;
          if (!stillSignedOut()) return;
          setClerkSignOutPending(false);
          closeSellerPanel();
        },
        () => {
          if (secureSignOutFlight.current === entry)
            secureSignOutFlight.current = null;
          if (stillSignedOut()) setClerkSignOutPending(true);
        },
      );
    }
    const entry = secureSignOutFlight.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        entry.promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Secure sign-out is still unconfirmed.')),
            5000,
          );
        }),
      ]);
    } catch {
      if (stillSignedOut() && secureSignOutFlight.current === entry)
        setClerkSignOutPending(true);
    } finally {
      clearTimeout(timer);
    }
  }
  async function signOutSeller() {
    const signingOut = currentAuth.current;
    if (!signingOut) return;
    const generation = authGeneration.current;
    const provider = signingOut.provider;
    if (signingOut.provider === 'better-auth')
      betterSignOutTarget.current = {
        userId: signingOut.identityUserId,
        sessionId: signingOut.identitySessionId,
      };
    let result: { ok?: boolean; logoutUrl?: string } = {};
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        api('/logout', 'POST', undefined, undefined, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Logout confirmation timed out.'));
          }, 5000);
        }),
      ]);
    } catch {
      // A failed request cannot confirm remote revocation. Local sign-out still runs.
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    // A late result from an old sign-out must not clear a newer sign-in.
    if (
      !(
        (currentAuth.current === signingOut &&
          authGeneration.current === generation) ||
        (!currentAuth.current && authGeneration.current === generation + 1)
      )
    )
      return;
    sessionStorage.removeItem(identityKey);
    setAuth(null);
    setAccount(null);
    setItems([]);
    setEditing(null);
    setSavedDraft(null);
    setForm({});
    setEmail('');
    setCode('');
    setSent(false);
    setNewEmail('');
    setEmailCode('');
    setEmailSent(false);
    closeSellerPanel();
    setSignOutNotice(
      result.ok === true
        ? 'Signed out on this device.'
        : 'Signed out on this device. RWAS could not confirm that the server session ended.',
    );
    const signedOutGeneration = authGeneration.current;
    if (provider === 'better-auth') {
      try {
        await finishBetterSignOut();
      } catch {
        setBetterSignOutPending(true);
        setSignOutNotice(
          'RWAS access was cleared on this device. Secure sign-out is not confirmed; choose Finish secure sign-out to retry.',
        );
      }
    }
    if (provider === 'clerk-production') {
      setClerkSignOutPending(true);
      await finishSecureSignOut();
    }
    if (currentAuth.current || authGeneration.current !== signedOutGeneration)
      return;
    if (result.ok === true && typeof result.logoutUrl === 'string')
      window.location.assign(result.logoutUrl);
  }
  async function jerry() {
    if (!session) {
      setView('login');
      return;
    }
    const w = window as unknown as { jerryChat?: (s: string) => void };
    if (w.jerryChat) {
      setView(null);
      w.jerryChat('I want to list my aircraft for sale.');
    } else {
      setMessage('Jerry is unavailable. You can start with the manual form.');
      await openManualListing();
    }
  }
  return (
    <>
      {clerkRouteStage && (
        <span hidden data-rwas-clerk-route-stage={clerkRouteStage} />
      )}
      <div className="a4s-user-entry">
        {!session && (
          <p>
            Buying or selling? Create an account or log in. After sign-in, you
            can start and manage your aircraft listings.
          </p>
        )}
        <div className="a4s-account-actions" aria-label="Marketplace account">
          {session ? (
            <>
              <button className="a4s-cta-btn" onClick={openCreateListing}>
                Create a Listing
              </button>
              <button
                className="a4s-cta-btn secondary"
                onClick={() => void openListings()}
              >
                My Listings
              </button>
              <button
                className="a4s-cta-btn secondary"
                onClick={() => void openAccount()}
              >
                Account
              </button>
              {!view && (
                <button
                  className="a4s-cta-btn secondary"
                  disabled={busy}
                  onClick={() => void perform(signOutSeller)}
                >
                  Sign Out
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="a4s-cta-btn"
                onClick={() => {
                  setAuthEntry('signup');
                  setView('login');
                }}
              >
                Create Account
              </button>
              <button
                className="a4s-cta-btn secondary"
                onClick={() => {
                  setAuthEntry('login');
                  setView('login');
                }}
              >
                User Login
              </button>
            </>
          )}
        </div>
      </div>
      {!session && !view && signOutNotice && (
        <div role="status" className="seller-signout-status">
          <p>{signOutNotice}</p>
          {betterSignOutPending && (
            <button
              disabled={busy}
              onClick={() => void perform(finishBetterSignOut)}
            >
              Finish secure sign-out
            </button>
          )}
          {clerkSignOutPending && (
            <>
              <p>
                {busy
                  ? 'Finishing secure sign-out…'
                  : 'Secure sign-out could not be completed. Choose Finish secure sign-out to retry.'}
              </p>
              <button
                disabled={busy}
                onClick={() => void perform(finishSecureSignOut)}
              >
                Finish secure sign-out
              </button>
            </>
          )}
        </div>
      )}
      <dialog
        ref={dialog}
        className={`seller-dialog${view === 'account' ? ' seller-account-dialog' : view === 'login' || view === 'better-auth' ? ' seller-auth-dialog' : ''}`}
        aria-labelledby="seller-title"
        onCancel={closeSellerPanel}
      >
        <header>
          <h2 id="seller-title">
            {view === 'login'
              ? authEntry === 'signup'
                ? 'Create Your Account'
                : 'User Login'
              : view === 'better-auth'
                ? 'Secure User Login'
                : view === 'clerk'
                  ? 'Secure User Login'
                  : view === 'clerk-owner'
                    ? 'Connect Existing Seller Account'
                    : view === 'account'
                      ? 'Your Account'
                      : view === 'edit'
                        ? 'Listing Draft'
                        : view === 'create'
                          ? 'Create a Listing'
                          : 'My Listings'}
          </h2>
          {session && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void perform(signOutSeller)}
            >
              Sign Out
            </button>
          )}
          <button
            type="button"
            aria-label="Close seller panel"
            onClick={closeSellerPanel}
          >
            Close
          </button>
        </header>
        {error && (
          <p role="alert" className="seller-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {view === 'login' && (
          <>
            {clerkSignOutPending && (
              <button
                disabled={busy}
                onClick={() => void perform(finishSecureSignOut)}
              >
                Finish secure sign-out
              </button>
            )}
            {session && (
              <button disabled={busy} onClick={() => void openAccount()}>
                Open your account
              </button>
            )}
            {betterAuthEnabled && !session && !betterSignOutPending && (
              <BetterAuthPanel
                initialMode={authEntry}
                providers={betterProviders}
                onSignedIn={(next) => {
                  setAuth(next);
                  setMessage('Signed in.');
                  closeSellerPanel();
                }}
              />
            )}
            {betterSignOutPending && (
              <button
                disabled={busy}
                onClick={() => void perform(finishBetterSignOut)}
              >
                Finish secure sign-out
              </button>
            )}
            {clerkProduction && !session && !clerkSignOutPending && (
              <nav aria-label="RWAS secure sign-in">
                <button disabled={busy} onClick={() => setView('clerk')}>
                  Continue with RWAS secure sign-in
                </button>
                <p>
                  Includes password sign-in, verified-email account creation,
                  and password recovery.
                </p>
              </nav>
            )}
            {!betterAuthEnabled && identityMethods.length > 0 && (
              <nav aria-label="Sign-in methods">
                {identityMethods.map((method) => (
                  <button
                    key={method}
                    disabled={busy}
                    onClick={() => void beginIdentity(method)}
                  >
                    {method === 'password'
                      ? methodLabels[method]
                      : 'Continue with ' + methodLabels[method]}
                  </button>
                ))}
                <p>
                  Create an account or recover your password on the secure
                  sign-in page.
                </p>
              </nav>
            )}
            {clerkOwnerReauthEnabled && !clerkSignOutPending && (
              <button disabled={busy} onClick={beginClerkOwnerConnection}>
                Connect existing seller account
              </button>
            )}
            {emailCodeLogin && (
              <form
                onSubmit={onSubmit(async () => {
                  if (!sent) {
                    await api('/send-code', 'POST', { email });
                    setSent(true);
                    setMessage('Code sent. Check your inbox.');
                  } else {
                    const d = await api('/check-code', 'POST', { email, code });
                    setAuth({ token: d.session, email: d.email, name: d.name });
                    setSent(false);
                    setCode('');
                    setView(null);
                  }
                })}
              >
                <p>
                  Sign in with a one-time email code. No password required.
                  Codes expire after 15 minutes; sessions expire after 24 hours.
                </p>
                <label className="seller-field">
                  Email
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={sent}
                  />
                </label>
                {sent && (
                  <label className="seller-field">
                    Verification code
                    <input
                      id="login-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                )}
                <button disabled={busy}>
                  {busy
                    ? 'Please wait…'
                    : sent
                      ? 'Verify & Sign In'
                      : 'Send Code'}
                </button>
                {sent && (
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setCode('');
                    }}
                  >
                    Use different email
                  </button>
                )}
              </form>
            )}
          </>
        )}
        {view === 'better-auth' && betterAuthEnabled && (
          <BetterAuthPanel
            providers={betterProviders}
            linkOwner={betterLinkOwner}
            onSignedIn={(next) => {
              setAuth(next);
              setMessage(
                betterLinkOwner
                  ? 'Secure sign-in connected to your seller account.'
                  : 'Signed in.',
              );
              closeSellerPanel();
            }}
          />
        )}
        {view === 'clerk' &&
          clerkProduction &&
          (!session || clerkLinkOwner ? (
            <ClerkProductionPanel
              linkOwner={clerkLinkOwner || undefined}
              onConnectExisting={
                clerkOwnerReauthEnabled ? beginClerkOwnerConnection : undefined
              }
              onSignedIn={(next) => {
                setAuth(next);
                setMessage(
                  clerkLinkOwner
                    ? 'Secure sign-in connected to your seller account.'
                    : 'Signed in.',
                );
                closeSellerPanel();
              }}
            />
          ) : (
            <>
              <p>
                You are already signed in to RWAS. Open your account to manage
                sign-in settings or connect secure sign-in.
              </p>
              <button disabled={busy} onClick={() => void openAccount()}>
                Open your account
              </button>
            </>
          ))}
        {view === 'clerk-owner' && (
          <section aria-label="Existing seller account connection">
            <p>
              Connect the password account you previously used for RWAS to your
              secure sign-in. Your existing contact profile and aircraft stay
              with that seller account. Matching email addresses alone do not
              connect accounts.
            </p>
            {ownerStage === 'identity' && clerkOwnerReauthEnabled && (
              <ClerkOwnerIdentityPanel
                onReady={() => void beginOwnerPasswordVerification()}
              />
            )}
            {ownerStage === 'starting' && (
              <p role="status">Verifying your existing seller account…</p>
            )}
            {ownerStage === 'confirmation' && ownerProof && (
              <>
                <p>Existing RWAS seller account: {ownerProof.email}</p>
                <p>
                  Your password identity is verified. Confirm to connect this
                  seller account to the secure identity you just signed in with.
                </p>
                <button
                  disabled={busy}
                  onClick={() => void confirmClerkOwnerConnection()}
                >
                  Connect this seller account
                </button>
              </>
            )}
            {ownerStage === 'error' && clerkOwnerReauthEnabled && (
              <button disabled={busy} onClick={beginClerkOwnerConnection}>
                Start account connection again
              </button>
            )}
          </section>
        )}
        {view === 'create' && (
          <section
            className="listing-start"
            aria-label="Choose how to create your listing"
          >
            <p>How would you like to prepare your listing?</p>
            <div className="listing-start-options">
              <button
                aria-label="Use Jerry as a listing assistant"
                disabled={busy}
                onClick={() => void jerry()}
              >
                <strong>Use Jerry as a listing assistant</strong>
                <span>Answer guided questions, then review your draft.</span>
              </button>
              <button
                aria-label="List manually"
                disabled={busy}
                onClick={() => void openManualListing()}
              >
                <strong>List manually</strong>
                <span>Enter the details yourself in the listing form.</span>
              </button>
            </div>
          </section>
        )}
        {view === 'listings' && (
          <>
            <nav>
              <button onClick={() => void openManualListing()}>
                New Manual Listing
              </button>
              <button onClick={() => void jerry()}>List with Jerry</button>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await load();
                  })
                }
              >
                Refresh
              </button>
            </nav>
            {savedDraft && (
              <button
                disabled={busy}
                onClick={() => {
                  if (savedDraft.intake) {
                    void jerry();
                  } else {
                    editorGeneration.current += 1;
                    setEditing(null);
                    submission.current = crypto.randomUUID();
                    setForm(
                      Object.fromEntries(
                        [...inputs, ...longInputs].map(([k]) => [
                          k,
                          String(savedDraft[k] ?? ''),
                        ]),
                      ),
                    );
                    setView('edit');
                  }
                }}
              >
                Resume Saved Draft
              </button>
            )}
            {!items.length && !busy && (
              <p>No listings yet. Save a draft to get started.</p>
            )}
            {items.map((l) => (
              <article className="seller-listing" key={l.id}>
                <h3>
                  {String(l.year || '')} {String(l.make || 'New')}{' '}
                  {String(l.model || 'draft')}
                </h3>
                <p>
                  Status: <strong>{l.status}</strong>
                </p>
                {l.reviewNote && <p>{l.reviewNote}</p>}
                <div className="seller-actions">
                  {!['deleted', 'archived'].includes(l.status) && (
                    <button onClick={() => edit(l)}>Edit</button>
                  )}
                  {['draft', 'rejected'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'pending'))}
                    >
                      Submit for Review
                    </button>
                  )}
                  {l.status === 'active' && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'paused'))}
                    >
                      Pause
                    </button>
                  )}
                  {l.status === 'paused' && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'active'))}
                    >
                      Resume
                    </button>
                  )}
                  {['active', 'paused'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'sold'))}
                    >
                      Mark Sold
                    </button>
                  )}
                  {!['deleted', 'archived'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'archived'))}
                    >
                      Archive
                    </button>
                  )}
                  {['archived', 'deleted'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'restore'))}
                    >
                      Restore to Draft
                    </button>
                  )}
                  {l.status !== 'deleted' ? (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Move this listing to trash? You can restore it as a draft.',
                          )
                        )
                          void perform(() => status(l, 'deleted'));
                      }}
                    >
                      Move to Trash
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Permanently delete this listing and all its files? This cannot be undone.',
                          )
                        )
                          void perform(async () => {
                            await api('/listings/' + l.id, 'DELETE', {
                              confirm: l.id,
                            });
                            await load();
                          });
                      }}
                    >
                      Delete Permanently
                    </button>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
        {view === 'edit' && (
          <ListingDraftWorkflow
            key={session?.token}
            values={form}
            onChange={(name, value) =>
              setForm((previous) => ({ ...previous, [name]: value }))
            }
            busy={busy}
            saved={!!editing}
            onSave={async () => {
              let saved = false;
              await perform(async () => {
                await save();
                saved = true;
              });
              return saved;
            }}
            onSubmitReview={async () => {
              const generation = editorGeneration.current;
              await perform(async () => {
                const listing = await save();
                if (generation !== editorGeneration.current) return;
                await status(listing, 'pending');
                if (generation === editorGeneration.current)
                  setView('listings');
              });
            }}
            mediaCounts={Object.fromEntries(
              categories.map(([category]) => [
                category,
                category === 'photos'
                  ? editing?.photos.length || 0
                  : category === 'videos'
                    ? editing?.videos.length || 0
                    : editing?.logbooks[category]?.length || 0,
              ]),
            )}
            renderMedia={(category) =>
              editing && (
                <SellerMedia
                  key={category}
                  listing={editing}
                  session={session!}
                  onlyCategory={category}
                  onBusy={setBusy}
                  onChange={async (stillCurrent) => {
                    if (!stillCurrent()) return;
                    const list = await load();
                    if (!stillCurrent()) return;
                    setEditing(list.find((l) => l.id === editing.id) || null);
                  }}
                />
              )
            }
          />
        )}
        {view === 'account' && account && (
          <AccountWorkspace
            label="Account index"
            value={accountSection}
            onValueChange={setAccountSection}
            disabled={busy}
            items={[
              { value: 'profile', label: 'Contact profile' },
              { value: 'email', label: 'Contact email' },
              { value: 'security', label: 'Sign-in and security' },
              { value: 'sessions', label: 'Active sessions' },
              { value: 'delete', label: 'Delete account' },
            ]}
          >
            <AccountSection value="profile">
              <form
                onSubmit={onSubmit(async () => {
                  const data = await api(
                    '/account',
                    'PATCH',
                    account.profile.email
                      ? {
                          name: account.profile.name,
                          phone: account.profile.phone,
                          location: account.profile.location,
                        }
                      : {},
                  );
                  setAccount({ ...account, profile: data.profile });
                  setMessage('Profile updated.');
                })}
              >
                <h3>Contact profile</h3>
                {['clerk-production', 'better-auth'].includes(
                  session?.provider || '',
                ) ? (
                  <>
                    <p>Contact email: {account.profile.email}</p>
                  </>
                ) : (
                  <p>Signed in as {account.profile.email}</p>
                )}
                {(['name', 'phone', 'location'] as const).map((k) => (
                  <label className="seller-field" key={k}>
                    {k}
                    <input
                      value={account.profile[k]}
                      onChange={(e) =>
                        setAccount({
                          ...account,
                          profile: { ...account.profile, [k]: e.target.value },
                        })
                      }
                      maxLength={200}
                    />
                  </label>
                ))}
                <button disabled={busy}>Save Profile</button>
              </form>
            </AccountSection>
            <AccountSection value="email">
              <form
                onSubmit={onSubmit(async () => {
                  if (!emailSent) {
                    await api('/account/email-code', 'POST', {
                      email: newEmail,
                    });
                    setEmailSent(true);
                  } else {
                    await api('/account/email', 'PUT', {
                      email: newEmail,
                      code: emailCode,
                    });
                    setAuth({
                      ...session!,
                      email: newEmail.trim().toLowerCase(),
                    });
                    setAccount(await api('/account'));
                    setEmailSent(false);
                    setMessage(
                      'Email verified and updated. Other sessions have been revoked.',
                    );
                  }
                })}
              >
                <h3>
                  {['clerk-production', 'better-auth'].includes(
                    session?.provider || '',
                  )
                    ? 'Change RWAS contact email'
                    : 'Change email'}
                </h3>
                {['clerk-production', 'better-auth'].includes(
                  session?.provider || '',
                ) && (
                  <p>
                    RWAS uses this address to contact you about your aircraft.
                    Changing it here does not change your secure sign-in email.
                  </p>
                )}
                <label className="seller-field">
                  New email
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </label>
                {emailSent && (
                  <label className="seller-field">
                    New email code
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      required
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                    />
                  </label>
                )}
                <button disabled={busy}>
                  {emailSent ? 'Verify New Email' : 'Send New Email Code'}
                </button>
              </form>
            </AccountSection>
            <AccountSection value="security">
              {session?.provider !== 'better-auth' &&
                session?.provider !== 'clerk-production' &&
                !betterLegacyLink &&
                !clerkExistingAccountLink &&
                !clerkOwnerReauthEnabled &&
                identityMethods.length === 0 && (
                  <>
                    <h3>Sign-in and security</h3>
                    <p>
                      You sign in with an email code. Review and revoke your
                      seller sessions in Active sessions.
                    </p>
                  </>
                )}
              {betterAuthEnabled && session?.provider === 'better-auth' && (
                <BetterAuthAccountPanel
                  expectedTarget={{
                    userId: session.identityUserId,
                    sessionId: session.identitySessionId,
                  }}
                  onIdentityEnded={() => {
                    if (currentAuth.current !== session) return;
                    setAuth(null);
                    setAccount(null);
                    setView('login');
                  }}
                  onIdentityUpdated={async (identity) => {
                    const captured = currentAuth.current;
                    const generation = authGeneration.current;
                    if (
                      !captured ||
                      captured.provider !== 'better-auth' ||
                      captured !== session
                    )
                      throw new Error('Your seller sign-in changed.');
                    const next = await connectBetterAuthSeller(
                      undefined,
                      identity,
                    );
                    if (
                      currentAuth.current !== captured ||
                      authGeneration.current !== generation
                    )
                      throw new Error('Your seller sign-in changed.');
                    setAuth(next);
                  }}
                />
              )}
              {betterAuthEnabled &&
                betterLegacyLink &&
                session &&
                session.provider !== 'better-auth' && (
                  <section aria-label="Connect new secure sign-in">
                    <h3>Connect secure sign-in</h3>
                    <p>
                      Keep this existing seller account by proving both your old
                      login and your new secure sign-in. Email matching alone
                      does not link accounts.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          sessionStorage.setItem(
                            betterLinkKey,
                            JSON.stringify({
                              fingerprint: await clerkLinkFingerprint(
                                session.token,
                              ),
                              requestedAt: Date.now(),
                            }),
                          );
                          setBetterLinkOwner({
                            token: session.token,
                            ...('csrf' in session
                              ? { csrf: session.csrf }
                              : {}),
                          });
                          setView('better-auth');
                        })
                      }
                    >
                      Connect secure sign-in
                    </button>
                  </section>
                )}

              {session?.provider !== 'clerk-production' &&
                clerkExistingAccountLink && (
                  <section aria-label="Connect secure sign-in">
                    <h3>Connect RWAS secure sign-in</h3>
                    <p>
                      Connect using an existing RWAS email-code session that is
                      less than ten minutes old to keep this seller account and
                      its aircraft. Expired, signed-out, and existing
                      sign-in-provider accounts can verify their existing
                      password account when account connection is available, or
                      contact RWAS for help.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() => void beginClerkLink()}
                    >
                      Connect RWAS secure sign-in
                    </button>
                  </section>
                )}
              {session?.provider !== 'clerk-production' &&
                clerkOwnerReauthEnabled && (
                  <button disabled={busy} onClick={beginClerkOwnerConnection}>
                    Connect existing seller account
                  </button>
                )}
              {session?.provider === 'clerk-production' && (
                <ClerkProductionAccountPanel />
              )}
              {!betterAuthEnabled &&
                session?.provider !== 'clerk-production' &&
                identityMethods.length > 0 && (
                  <section aria-label="Connected sign-in methods">
                    <h3>Sign-in methods</h3>
                    <p>
                      {account.loginMethods?.length
                        ? 'Connected: ' +
                          account.loginMethods
                            .map((method) => methodLabels[method])
                            .join(', ')
                        : 'Email-code login. Connect another method to use this same seller account.'}
                    </p>
                    {identityMethods.map((method) => (
                      <button
                        key={method}
                        disabled={busy}
                        onClick={() => void beginIdentity(method, true)}
                      >
                        Connect {methodLabels[method]}
                      </button>
                    ))}
                    {identityMethods.includes('password') && (
                      <button
                        disabled={busy}
                        onClick={() => void beginIdentity('password')}
                      >
                        Password help
                      </button>
                    )}
                  </section>
                )}
            </AccountSection>
            <AccountSection value="sessions">
              <h3>
                {['clerk-production', 'better-auth'].includes(
                  session?.provider || '',
                )
                  ? 'RWAS sessions'
                  : 'Active sessions'}
              </h3>
              {session?.provider === 'clerk-production' && (
                <p>
                  These are sessions for RWAS seller access. Manage your secure
                  sign-in sessions in the Sign-in and security section.
                </p>
              )}
              {account.sessions.map((s) => (
                <p key={s.id}>
                  {s.current ? 'This session' : 'Other session'} · expires{' '}
                  {new Date(s.expiresAt).toLocaleString()}{' '}
                  {!s.current && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await api('/account/sessions', 'DELETE', {
                            id: s.id,
                          });
                          setAccount(await api('/account'));
                        })
                      }
                    >
                      Revoke
                    </button>
                  )}
                </p>
              ))}
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await api('/account/sessions', 'DELETE', { all: true });
                    setAccount(await api('/account'));
                    setMessage('Other RWAS sessions revoked.');
                  })
                }
              >
                Sign Out Other Sessions
              </button>
            </AccountSection>
            <AccountSection value="delete">
              {session?.provider === 'better-auth' && (
                <BetterAuthDeleteAccount
                  expectedTarget={{
                    userId: session.identityUserId,
                    sessionId: session.identitySessionId,
                  }}
                  deleteBusiness={async (confirm) => {
                    await api('/account', 'DELETE', { confirm });
                  }}
                  onComplete={() => {
                    setAuth(null);
                    setAccount(null);
                    setView(null);
                    setSignOutNotice(
                      'Your seller account and secure sign-in were deleted.',
                    );
                  }}
                />
              )}
              {session?.provider !== 'better-auth' && (
                <>
                  <h3>Delete account</h3>
                  <p>
                    Permanently delete your listings first. Account deletion
                    requires a recent sign-in and removes your RWAS profile,
                    saved draft and connected login links. Your Google, Apple or
                    sign-in-provider account is managed separately.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const confirm = window.prompt(
                        'Type your current email to permanently delete your account.',
                      );
                      if (confirm)
                        void perform(async () => {
                          await api('/account', 'DELETE', { confirm });
                          setAuth(null);
                          setView(null);
                        });
                    }}
                  >
                    Delete Account
                  </button>
                </>
              )}
            </AccountSection>
          </AccountWorkspace>
        )}
      </dialog>
      <style jsx>{`
        .seller-dialog {
          width: min(860px, 94vw);
          max-height: 90vh;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 24px;
          background: #f7f4ef;
          color: #222;
          font-family: Arial, sans-serif;
        }
        .seller-account-dialog {
          width: min(1120px, 94vw);
        }
        .seller-dialog::backdrop {
          background: #0008;
        }
        .seller-auth-dialog {
          width: min(560px, 94vw);
        }
        .listing-start-options {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(240px, 100%), 1fr)
          );
          gap: 16px;
          margin-top: 20px;
        }
        .listing-start-options button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          margin: 0;
          padding: 20px;
          text-align: left;
          min-height: 120px;
        }
        .listing-start-options strong {
          font-size: 17px;
        }
        .listing-start-options span {
          font-size: 14px;
          line-height: 1.5;
        }
        .seller-auth-dialog header {
          flex-wrap: nowrap;
          gap: 12px;
        }
        .seller-auth-dialog header h2 {
          flex: 1 1 auto;
          min-width: 0;
          font-size: 24px;
        }
        header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .seller-dialog :global(h2),
        .seller-dialog :global(h3),
        .seller-dialog :global(h4),
        .seller-dialog :global(button),
        .seller-dialog :global(input),
        .seller-dialog :global(select),
        .seller-dialog :global(textarea) {
          font-family: Arial, sans-serif;
        }
        h2 {
          flex: 1 1 180px;
          font-size: 26px;
        }
        h3 {
          font-size: 20px;
          margin: 16px 0 8px;
        }
        p {
          margin: 12px 0;
          line-height: 1.5;
        }
        .seller-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 12px 0;
          font:
            14px Arial,
            sans-serif;
        }
        input,
        textarea {
          border: 1px solid #777;
          border-radius: 4px;
          background: white;
          color: #222;
          padding: 10px;
          width: 100%;
        }
        .seller-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 20px;
        }
        button {
          padding: 9px 14px;
          border: 1px solid #333;
          border-radius: 4px;
          margin: 4px;
          background: #fff;
          cursor: pointer;
        }
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible {
          outline: 3px solid #b26c22;
          outline-offset: 3px;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .seller-error {
          color: #9b2222;
        }
        .seller-listing {
          border-top: 1px solid #aaa;
          padding: 16px 0;
        }
        .seller-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        @media (max-width: 600px) {
          .seller-account-dialog header {
            justify-content: flex-end;
          }
          .seller-account-dialog header h2 {
            flex-basis: 100%;
          }
          .seller-fields {
            grid-template-columns: 1fr;
          }
          .seller-dialog {
            padding: 16px;
          }
        }
      `}</style>
    </>
  );
}

function SellerMedia({
  listing,
  session,
  onlyCategory,
  onChange,
  onBusy,
}: {
  listing: Listing;
  session: Session;
  onlyCategory?: string;
  onChange: (stillCurrent: () => boolean) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [needsUploadRefresh, setNeedsUploadRefresh] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const lifetime = useRef(0);
  useLayoutEffect(() => {
    lifetime.current += 1;
    setBusy(false);
    setError('');
    setMessage('');
    setNeedsUploadRefresh(false);
    setPreviewError('');
    return () => {
      lifetime.current += 1;
      onBusy(false);
    };
  }, [listing.id, session, onBusy]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const generation = lifetime.current;
    const stillCurrent = () => alive && lifetime.current === generation;
    const controller = new AbortController();
    const made: string[] = [];
    setUrls({});
    setPreviewError('');
    const media =
      onlyCategory === 'photos'
        ? listing.photos
        : onlyCategory === 'videos'
          ? listing.videos
          : onlyCategory
            ? []
            : [...listing.photos, ...listing.videos];
    void Promise.all(
      media.map(async (f) => {
        try {
          const headers = await sellerSessionHeaders(session);
          if (!stillCurrent()) return;
          const r = await fetch(
            SELLER_API + '/files/' + encodeURIComponent(f.key),
            { credentials: 'same-origin', headers, signal: controller.signal },
          );
          if (!stillCurrent()) return;
          if (!r.ok) throw Error('Preview request failed.');
          const blob = await r.blob();
          if (!stillCurrent()) return;
          const url = URL.createObjectURL(blob);
          made.push(url);
          setUrls((old) => ({ ...old, [f.key]: url }));
        } catch {
          if (stillCurrent())
            setPreviewError(
              'Some photos or videos could not be previewed. Reopen this draft to try again.',
            );
        }
      }),
    );
    return () => {
      alive = false;
      controller.abort();
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [listing, session, onlyCategory]);
  async function action(
    fn: (stillCurrent: () => boolean) => Promise<void>,
    upload = false,
  ) {
    const generation = lifetime.current;
    const stillCurrent = () => lifetime.current === generation;
    setBusy(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      await fn(stillCurrent);
      if (!stillCurrent()) return;
      await onChange(stillCurrent);
      if (!stillCurrent()) return;
      setNeedsUploadRefresh(false);
      if (needsUploadRefresh)
        setMessage(
          'Saved media refreshed. Check the files before uploading again.',
        );
    } catch (e) {
      if (!stillCurrent()) return;
      setMessage('');
      let notice = '';
      if (upload || needsUploadRefresh) {
        // A failed response can follow a saved upload or a partial batch.
        // Reconcile with a read; never automatically repeat an upload here.
        try {
          await onChange(stillCurrent);
          if (!stillCurrent()) return;
          setNeedsUploadRefresh(false);
          notice =
            ' Saved media refreshed. Check the files before uploading again.';
        } catch {
          if (!stillCurrent()) return;
          setNeedsUploadRefresh(true);
          notice =
            ' Saved media could not be refreshed. Refresh saved media before adding more files.';
        }
      }
      setError(
        (e instanceof Error ? e.message : 'Media request failed.') + notice,
      );
    } finally {
      if (stillCurrent()) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  async function request(path: string, method: string, body: unknown) {
    const r = await fetch(SELLER_API + path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(await sellerSessionHeaders(session)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  return (
    <section aria-label="Listing media">
      {!onlyCategory && <h3>Photos, video and records</h3>}
      <p>
        Photos, video and aircraft records remain private to your account and
        the RWAS review team during this intake launch. Attachments are
        optional.
      </p>
      {error && <p role="alert">{error}</p>}
      {previewError && <p role="alert">{previewError}</p>}
      {message && <p role="status">{message}</p>}
      {needsUploadRefresh && (
        <button disabled={busy} onClick={() => void action(async () => {})}>
          Refresh saved media
        </button>
      )}
      {categories
        .filter(([category]) => !onlyCategory || onlyCategory === category)
        .map(([category, label]) => {
          const files =
            category === 'photos'
              ? listing.photos
              : category === 'videos'
                ? listing.videos
                : listing.logbooks[category] || [];
          return (
            <fieldset
              key={category}
              style={{
                padding: 16,
                margin: '16px 0',
                border: '1px solid #aaa',
              }}
            >
              <legend>
                {label} ({files.length})
              </legend>
              <p>{mediaLimits(category)}</p>
              <label>
                Add {label.toLowerCase()}
                <input
                  type="file"
                  multiple
                  disabled={busy || needsUploadRefresh}
                  accept={
                    category === 'photos'
                      ? 'image/jpeg,image/png,image/gif,image/webp'
                      : category === 'videos'
                        ? 'video/mp4,video/webm'
                        : 'application/pdf'
                  }
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (!selected.length) return;
                    const invalid = selected
                      .map((file) => validateUpload(file, category))
                      .find(Boolean);
                    if (invalid) {
                      setError(invalid);
                      setMessage('');
                      return;
                    }
                    void action(async (stillCurrent) => {
                      if (typeof globalThis.crypto?.randomUUID !== 'function')
                        throw Error(
                          'This browser cannot securely identify uploads. Use a current browser to add files.',
                        );
                      // One identity per selected file, fixed before any request.
                      // A later intentional selection creates new identities.
                      const uploads = selected.map((file) => ({
                        file,
                        operationId:
                          'rwas-upload-v1.' +
                          Date.now() +
                          '.' +
                          crypto.randomUUID(),
                      }));
                      for (const { file: f, operationId } of uploads) {
                        if (!stillCurrent()) return;
                        setMessage('Uploading ' + f.name + '…');
                        const headers = await sellerSessionHeaders(session);
                        if (!stillCurrent()) return;
                        const r = await fetch(
                          SELLER_API +
                            '/upload?listingId=' +
                            listing.id +
                            '&category=' +
                            category +
                            '&filename=' +
                            encodeURIComponent(f.name),
                          {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                              ...headers,
                              'Idempotency-Key': operationId,
                            },
                            body: f,
                          },
                        );
                        const d = await r.json();
                        if (!stillCurrent()) return;
                        if (!r.ok) throw Error(d.error);
                      }
                      setMessage(
                        'Upload complete. Submit the updated draft for review.',
                      );
                    }, true);
                  }}
                />
              </label>
              {files.map((f, i) => (
                <div key={f.key} style={{ marginTop: 12 }}>
                  {category === 'photos' && urls[f.key] && (
                    <img
                      src={urls[f.key]}
                      alt={f.name}
                      style={{ maxWidth: '100%', maxHeight: 200 }}
                    />
                  )}
                  {category === 'videos' && urls[f.key] && (
                    <video
                      src={urls[f.key]}
                      controls
                      preload="metadata"
                      aria-label={f.name}
                      style={{ maxWidth: '100%' }}
                    />
                  )}
                  <p>{f.name}</p>
                  {!['photos', 'videos'].includes(category) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const r = await fetch(
                            SELLER_API + '/files/' + encodeURIComponent(f.key),
                            {
                              credentials: 'same-origin',
                              headers: await sellerSessionHeaders(session),
                            },
                          );
                          if (!r.ok)
                            throw Error('Could not download this record.');
                          const url = URL.createObjectURL(await r.blob()),
                            a = document.createElement('a');
                          a.href = url;
                          a.download = f.name;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        })
                      }
                    >
                      Download
                    </button>
                  )}
                  {category === 'photos' && i > 0 && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const order = files.map((x) => x.key);
                          [order[i - 1], order[i]] = [order[i], order[i - 1]];
                          await request(
                            '/listings/' + listing.id + '/photos/order',
                            'PUT',
                            { order },
                          );
                        })
                      }
                    >
                      Move Earlier
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Delete ' + f.name + '?'))
                        void action(async () => {
                          await request('/delete-file', 'POST', {
                            listingId: listing.id,
                            category,
                            fileKey: f.key,
                          });
                        });
                    }}
                  >
                    Delete {f.name}
                  </button>
                </div>
              ))}
            </fieldset>
          );
        })}
      <style jsx>{`
        section {
          min-width: 0;
        }
        fieldset {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        label {
          display: block;
        }
        p {
          overflow-wrap: anywhere;
          line-height: 1.6;
        }
        input[type='file'] {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          font:
            14px Arial,
            sans-serif;
        }
        input::file-selector-button,
        button {
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #fff;
          color: #222;
          font:
            14px Arial,
            sans-serif;
          cursor: pointer;
        }
        input::file-selector-button {
          margin-right: 8px;
        }
        button {
          margin: 4px;
        }
        button:disabled {
          opacity: 0.55;
        }
      `}</style>
    </section>
  );
}
