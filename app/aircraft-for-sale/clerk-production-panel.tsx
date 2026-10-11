'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clerkProductionFailureTelemetry,
  getClerkProductionBrowser,
  type ClerkProductionHandoffStage,
  type ClerkProductionLinkOwner,
  type ClerkProductionSession,
  type ClerkProductionBrowser,
  type ClerkProductionIdentityState,
} from './clerk-production-browser';

const FAILURE_LATCH = 'rwas-clerk-production-failure-v1';
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set(['network', '429', '503']);
type RetryIdentity = Pick<ClerkProductionIdentityState, 'sessionId' | 'userId'>;
type FailureLatch = {
  attemptCount: number;
  attemptId?: string;
  retryIdentity?: RetryIdentity;
  clientStage: ClerkProductionHandoffStage;
  status: string;
  serverStage: string;
  observedAt: string;
};
let panelGeneration = 0;
let panelController: AbortController | null = null;

function sameIdentity(left: RetryIdentity, right: RetryIdentity) {
  return Boolean(
    typeof left.sessionId === 'string' &&
      left.sessionId.length > 0 &&
      left.sessionId.length <= 500 &&
      typeof left.userId === 'string' &&
      left.userId.length > 0 &&
      left.userId.length <= 500 &&
      left.sessionId === right.sessionId &&
      left.userId === right.userId,
  );
}
function canRetryFailure(value: FailureLatch) {
  return Boolean(
    RETRYABLE_STATUSES.has(value.status) &&
      value.attemptCount < MAX_ATTEMPTS &&
      typeof value.attemptId === 'string' &&
      value.attemptId.length === 36 &&
      value.retryIdentity &&
      sameIdentity(value.retryIdentity, value.retryIdentity),
  );
}
const CLIENT_STAGES = new Set<ClerkProductionHandoffStage>([
  'provider-session-present',
  'clerk-token-request',
  'rwas-start-request',
  'rwas-start-accepted',
  'rwas-finish-request',
  'rwas-finish-accepted',
  'rwas-account-request',
  'complete',
]);
const FAILURE_STATUSES = new Set([
  '',
  'network',
  'other-http',
  'non-json',
  '400',
  '401',
  '403',
  '404',
  '405',
  '409',
  '413',
  '429',
  '500',
  '502',
  '503',
  '504',
]);
const SERVER_STAGES = new Set([
  '',
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
function readFailureLatch(): FailureLatch | null {
  try {
    const raw = sessionStorage.getItem(FAILURE_LATCH);
    if (!raw) return null;
    const value = JSON.parse(raw) as FailureLatch;
    return Number.isSafeInteger(value?.attemptCount) &&
      value.attemptCount >= 1 &&
      value.attemptCount <= MAX_ATTEMPTS &&
      CLIENT_STAGES.has(value.clientStage) &&
      FAILURE_STATUSES.has(value.status) &&
      SERVER_STAGES.has(value.serverStage) &&
      typeof value.observedAt === 'string' &&
      !Number.isNaN(Date.parse(value.observedAt))
      ? value
      : null;
  } catch {
    return null;
  }
}
function writeFailureLatch(value: FailureLatch) {
  sessionStorage.setItem(FAILURE_LATCH, JSON.stringify(value));
  history.replaceState({ ...(history.state || {}), [FAILURE_LATCH]: true }, '');
}
function clearFailureLatch(expected: FailureLatch) {
  const current = readFailureLatch();
  if (
    !current ||
    current.attemptId !== expected.attemptId ||
    current.attemptCount !== expected.attemptCount ||
    current.status !== expected.status
  )
    return false;
  sessionStorage.removeItem(FAILURE_LATCH);
  const state = { ...(history.state || {}) };
  delete state[FAILURE_LATCH];
  history.replaceState(state, '');
  return true;
}
function failureStorageReady() {
  try {
    const probe = FAILURE_LATCH + '-probe';
    sessionStorage.setItem(probe, '1');
    sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export default function ClerkProductionPanel({
  onSignedIn,
  linkOwner,
  onConnectExisting,
}: {
  onSignedIn: (session: ClerkProductionSession) => void;
  linkOwner?: ClerkProductionLinkOwner;
  onConnectExisting?: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const signedIn = useRef(onSignedIn);
  const owner = useRef(linkOwner);
  signedIn.current = onSignedIn;
  const [error, setError] = useState('');
  const [stage, setStage] = useState<
    | ClerkProductionHandoffStage
    | 'client-loading'
    | 'provider-session-absent'
    | 'failed'
  >('client-loading');
  const currentStage = useRef(stage);
  const attempts = useRef(0);
  const [failureAttemptCount, setFailureAttemptCount] = useState(0);
  const [failureStage, setFailureStage] = useState('');
  const [failureStatus, setFailureStatus] = useState('');
  const [serverFailureStage, setServerFailureStage] = useState('');
  const [retryCycle, setRetryCycle] = useState(0);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const retryAction = useRef<() => Promise<void>>(async () => {});
  const expectedRetryIdentity = useRef<RetryIdentity | null>(null);
  useEffect(() => {
    const generation = ++panelGeneration;
    panelController?.abort();
    const controller = new AbortController();
    panelController = controller;
    let active = true;
    let retrying = false;
    let cleanup = () => {};
    const isCurrent = () => active && generation === panelGeneration;
    const showFailure = (failure: FailureLatch) => {
      currentStage.current = failure.clientStage;
      setFailureAttemptCount(failure.attemptCount);
      setFailureStage(failure.clientStage);
      setFailureStatus(failure.status);
      setServerFailureStage(failure.serverStage);
      setStage('failed');
      const retryable = !owner.current && canRetryFailure(failure);
      setRetryAvailable(retryable);
      setError(
        retryable
          ? `Secure sign-in is temporarily unavailable. You can retry in this tab. Up to ${MAX_ATTEMPTS} attempts are allowed; ${MAX_ATTEMPTS - failure.attemptCount} remaining.`
          : 'Sign-in could not be completed. Further attempts in this tab are paused. Please use another sign-in method or contact RWAS for help.',
      );
      retryAction.current = async () => {
        if (!isCurrent() || retrying || !retryable) return;
        retrying = true;
        setRetryPending(true);
        try {
          const client = await getClerkProductionBrowser();
          if (!isCurrent()) return;
          if (
            !client.hasSession() ||
            !failure.retryIdentity ||
            !sameIdentity(failure.retryIdentity, client.identityState())
          ) {
            setRetryAvailable(false);
            setError(
              'Your secure sign-in changed. Please sign in again or contact RWAS for help.',
            );
            return;
          }
          if (!clearFailureLatch(failure)) {
            setRetryAvailable(false);
            setError(
              'The sign-in attempt changed. Please reopen seller sign-in.',
            );
            return;
          }
          attempts.current = failure.attemptCount;
          expectedRetryIdentity.current = failure.retryIdentity;
          setRetryAvailable(false);
          setFailureAttemptCount(0);
          setFailureStage('');
          setFailureStatus('');
          setServerFailureStage('');
          setError('');
          setStage('client-loading');
          setRetryCycle((value) => value + 1);
        } catch {
          if (isCurrent())
            setError(
              'Secure sign-in is temporarily unavailable. Please try again later.',
            );
        } finally {
          retrying = false;
          if (isCurrent()) setRetryPending(false);
        }
      };
    };
    if (!failureStorageReady()) {
      setFailureStage('client-loading');
      setStage('failed');
      setError('Secure sign-in is unavailable. Please use another method.');
    } else {
      const retained = readFailureLatch();
      if (retained) {
        attempts.current = retained.attemptCount;
        showFailure(retained);
      } else {
        const observe = (next: ClerkProductionHandoffStage) => {
          if (!isCurrent()) return;
          currentStage.current = next;
          setStage(next);
        };
        void getClerkProductionBrowser()
          .then(async (client) => {
            if (!isCurrent() || !mount.current) return;
            const element = mount.current;
            let completing = false;
            let completed = false;
            let failed = false;
            const complete = async () => {
              if (
                !isCurrent() ||
                completing ||
                completed ||
                failed ||
                !client.hasSession()
              )
                return;
              completing = true;
              const binding = client.identityState();
              const attemptId = crypto.randomUUID();
              attempts.current += 1;
              try {
                if (
                  expectedRetryIdentity.current &&
                  !sameIdentity(expectedRetryIdentity.current, binding)
                )
                  throw new Error('Secure sign-in changed before retry.');
                const session = owner.current
                  ? await client.link(owner.current, observe)
                  : await client.connect(observe, controller.signal);
                if (!isCurrent()) return;
                if (
                  !owner.current &&
                  !sameIdentity(binding, client.identityState())
                )
                  throw new Error(
                    'Secure sign-in changed during authentication.',
                  );
                completed = true;
                signedIn.current(session);
              } catch (caught) {
                if (
                  generation !== panelGeneration ||
                  (!owner.current && controller.signal.aborted)
                )
                  return;
                failed = true;
                const telemetry = clerkProductionFailureTelemetry(caught);
                const observedStage = currentStage.current;
                const failure: FailureLatch = {
                  attemptCount: attempts.current,
                  attemptId,
                  clientStage: CLIENT_STAGES.has(
                    observedStage as ClerkProductionHandoffStage,
                  )
                    ? (observedStage as ClerkProductionHandoffStage)
                    : 'provider-session-present',
                  status: telemetry.status,
                  serverStage: telemetry.serverStage,
                  observedAt: new Date().toISOString(),
                  ...(!owner.current && sameIdentity(binding, binding)
                    ? {
                        retryIdentity: {
                          sessionId: binding.sessionId,
                          userId: binding.userId,
                        },
                      }
                    : {}),
                };
                writeFailureLatch(failure);
                if (isCurrent()) showFailure(failure);
              } finally {
                completing = false;
              }
            };
            const unsubscribe = client.addSessionListener(
              () => void complete(),
            );
            cleanup = unsubscribe;
            if (client.hasSession()) {
              await complete();
              return;
            }
            const unmount = client.mountAuthentication(element);
            cleanup = () => {
              unsubscribe();
              unmount();
            };
            if (client.hasSession()) await complete();
            else {
              currentStage.current = 'provider-session-absent';
              setStage('provider-session-absent');
            }
          })
          .catch(() => {
            if (isCurrent()) {
              setFailureStage(currentStage.current);
              setStage('failed');
              setError(
                'Secure sign-in is unavailable. Please use another method.',
              );
            }
          });
      }
    }
    return () => {
      active = false;
      controller.abort();
      cleanup();
      if (panelController === controller) panelController = null;
    };
  }, [retryCycle]);

  return (
    <section
      aria-label="Secure seller sign-in"
      data-rwas-clerk-stage={stage}
      data-rwas-clerk-failure-stage={failureStage || undefined}
      data-rwas-clerk-failure-attempt={failureAttemptCount || undefined}
      data-rwas-clerk-failure-status={failureStatus || undefined}
      data-rwas-clerk-server-stage={serverFailureStage || undefined}
    >
      <p>
        {linkOwner
          ? 'Sign in to the secure identity account you want to connect to your existing RWAS seller account. Your RWAS contact profile and aircraft stay with your existing account.'
          : 'Sign in, create an account, verify your email, or reset your password with the secure RWAS identity service.'}
      </p>
      {error && <p role="alert">{error}</p>}
      {retryAvailable && (
        <button
          type="button"
          disabled={retryPending}
          onClick={() => void retryAction.current()}
        >
          Retry secure sign-in
        </button>
      )}
      {!linkOwner && failureStatus === '409' && onConnectExisting && (
        <button type="button" onClick={onConnectExisting}>
          Connect existing seller account
        </button>
      )}
      <div ref={mount} />
    </section>
  );
}

export function ClerkOwnerIdentityPanel({ onReady }: { onReady: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let completed = false;
    let cleanup = () => {};
    void getClerkProductionBrowser()
      .then((client) => {
        if (!active || !mount.current) return;
        const complete = () => {
          if (!active || completed || !client.hasSession()) return;
          completed = true;
          ready.current();
        };
        const unsubscribe = client.addSessionListener(complete);
        cleanup = unsubscribe;
        if (client.hasSession()) complete();
        else {
          const unmount = client.mountAuthentication(mount.current);
          cleanup = () => {
            unsubscribe();
            unmount();
          };
          complete();
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Secure sign-in is unavailable. Please start account connection again.',
          );
      });
    return () => {
      active = false;
      cleanup();
    };
  }, []);
  return (
    <section aria-label="Sign in before connecting an existing seller account">
      <p>
        Sign in to your secure RWAS identity, then verify the password account
        you previously used for RWAS.
      </p>
      {error && <p role="alert">{error}</p>}
      <div ref={mount} />
    </section>
  );
}

export function ClerkProductionAccountPanel() {
  const mount = useRef<HTMLDivElement>(null);
  const client = useRef<ClerkProductionBrowser | null>(null);
  const cleanup = useRef(() => {});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getClerkProductionBrowser()
      .then((browser) => {
        if (!active || !mount.current) return;
        client.current = browser;
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            'Secure account settings are unavailable. Please sign in again.',
          );
      });
    return () => {
      active = false;
      client.current = null;
      cleanup.current();
    };
  }, []);

  return (
    <section aria-label="Secure sign-in account settings">
      <h3>Sign-in and security</h3>
      <p>
        Manage your sign-in email, password, connected accounts, and secure
        sign-in sessions here. Available options depend on your identity
        account. Password changes can require a new sign-in to RWAS.
      </p>
      <p>
        Your RWAS contact profile and contact email are managed separately
        below.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!client.current || !mount.current) return;
          try {
            cleanup.current();
            cleanup.current = client.current.openAccount(mount.current);
            setError('');
          } catch {
            setError(
              'Secure account settings are unavailable. Please sign in again.',
            );
          }
        }}
      >
        Manage sign-in and security
      </button>
      <div ref={mount} />
    </section>
  );
}
