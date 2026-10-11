'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clerkProductionFailureTelemetry,
  getClerkProductionBrowser,
  type ClerkProductionHandoffStage,
  type ClerkProductionLinkOwner,
  type ClerkProductionSession,
  type ClerkProductionBrowser,
} from './clerk-production-browser';

const FAILURE_LATCH = 'rwas-clerk-production-failure-v1';
type FailureLatch = {
  attemptCount: 1;
  clientStage: ClerkProductionHandoffStage;
  status: string;
  serverStage: string;
  observedAt: string;
};
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
    return value?.attemptCount === 1 &&
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
  useEffect(() => {
    if (!failureStorageReady()) {
      setFailureStage('client-loading');
      setStage('failed');
      setError('Secure sign-in is unavailable. Please use another method.');
      return;
    }
    const retained = readFailureLatch();
    if (retained) {
      currentStage.current = retained.clientStage;
      setFailureAttemptCount(retained.attemptCount);
      setFailureStage(retained.clientStage);
      setFailureStatus(retained.status);
      setServerFailureStage(retained.serverStage);
      setStage('failed');
      setError(
        'Sign-in could not be completed. Further attempts in this tab are paused. Please use another sign-in method or contact RWAS for help.',
      );
      return;
    }
    let active = true;
    let cleanup = () => {};
    const observe = (next: ClerkProductionHandoffStage) => {
      currentStage.current = next;
      if (active) setStage(next);
    };
    void getClerkProductionBrowser()
      .then(async (client) => {
        if (!active || !mount.current) return;
        const element = mount.current;
        let completing = false;
        let completed = false;
        let terminalFailure = false;
        const complete = async () => {
          if (
            !active ||
            completing ||
            completed ||
            terminalFailure ||
            !client.hasSession()
          )
            return;
          completing = true;
          attempts.current += 1;
          try {
            const session = owner.current
              ? await client.link(owner.current, observe)
              : await client.connect(observe);
            completed = true;
            if (active) signedIn.current(session);
          } catch (caught) {
            terminalFailure = true;
            const telemetry = clerkProductionFailureTelemetry(caught);
            const observedAt = new Date().toISOString();
            const observedStage = currentStage.current;
            const clientStage = CLIENT_STAGES.has(
              observedStage as ClerkProductionHandoffStage,
            )
              ? (observedStage as ClerkProductionHandoffStage)
              : 'provider-session-present';
            // Closing a dialog does not erase the result of its handoff.
            writeFailureLatch({
              attemptCount: 1,
              clientStage,
              status: telemetry.status,
              serverStage: telemetry.serverStage,
              observedAt,
            });
            if (active) {
              setFailureAttemptCount(attempts.current);
              setFailureStage(currentStage.current);
              setFailureStatus(telemetry.status);
              setServerFailureStage(telemetry.serverStage);
              setStage('failed');
              setError(
                'Sign-in could not be completed. Further attempts in this tab are paused. Please use another sign-in method or contact RWAS for help.',
              );
            }
          } finally {
            completing = false;
          }
        };
        const unsubscribe = client.addSessionListener(() => void complete());
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
        if (active) {
          setFailureStage(currentStage.current);
          setStage('failed');
          setError('Secure sign-in is unavailable. Please use another method.');
        }
      });
    return () => {
      active = false;
      cleanup();
    };
  }, []);

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
