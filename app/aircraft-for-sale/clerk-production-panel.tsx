'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clerkProductionFailureTelemetry,
  getClerkProductionBrowser,
  type ClerkProductionHandoffStage,
  type ClerkProductionSession,
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
}: {
  onSignedIn: (session: ClerkProductionSession) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const signedIn = useRef(onSignedIn);
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
  const observe = (next: ClerkProductionHandoffStage) => {
    currentStage.current = next;
    setStage(next);
  };

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
      setError('Sign-in could not be completed. Please try again.');
      return;
    }
    let active = true;
    let cleanup = () => {};
    void getClerkProductionBrowser()
      .then(async (client) => {
        if (!active || !mount.current) return;
        const element = mount.current;
        let completing = false;
        let terminalFailure = false;
        const complete = async () => {
          if (completing || terminalFailure || !client.hasSession()) return;
          completing = true;
          attempts.current += 1;
          try {
            const session = await client.connect(observe);
            if (active) signedIn.current(session);
          } catch (caught) {
            if (active) {
              terminalFailure = true;
              const telemetry = clerkProductionFailureTelemetry(caught);
              const observedAt = new Date().toISOString();
              const observedStage = currentStage.current;
              const clientStage = CLIENT_STAGES.has(
                observedStage as ClerkProductionHandoffStage,
              )
                ? (observedStage as ClerkProductionHandoffStage)
                : 'provider-session-present';
              writeFailureLatch({
                attemptCount: 1,
                clientStage,
                status: telemetry.status,
                serverStage: telemetry.serverStage,
                observedAt,
              });
              setFailureAttemptCount(attempts.current);
              setFailureStage(currentStage.current);
              setFailureStatus(telemetry.status);
              setServerFailureStage(telemetry.serverStage);
              setStage('failed');
              setError('Sign-in could not be completed. Please try again.');
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
        Sign in, create an account, verify your email, or reset your password
        with the secure RWAS identity service.
      </p>
      {error && <p role="alert">{error}</p>}
      <div ref={mount} />
    </section>
  );
}
