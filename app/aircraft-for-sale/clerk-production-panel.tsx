'use client';

import { useEffect, useRef, useState } from 'react';
import {
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
  const [failureStage, setFailureStage] = useState('');
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
        const complete = async () => {
          if (completing || !client.hasSession()) return;
          completing = true;
          try {
            const session = await client.connect(observe);
            if (active) signedIn.current(session);
          } catch {
            if (active) {
              setFailureStage(currentStage.current);
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
