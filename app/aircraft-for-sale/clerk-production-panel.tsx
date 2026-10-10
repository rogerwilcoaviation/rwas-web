'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clerkProductionFailureTelemetry,
  getClerkProductionBrowser,
  type ClerkProductionHandoffStage,
  type ClerkProductionSession,
} from './clerk-production-browser';

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
