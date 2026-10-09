'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getClerkProductionBrowser,
  type ClerkProductionSession,
} from './clerk-production-browser';

export default function ClerkProductionPanel({
  onSignedIn,
}: {
  onSignedIn: (session: ClerkProductionSession) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

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
            const session = await client.connect();
            if (active) onSignedIn(session);
          } catch {
            if (active)
              setError('Sign-in could not be completed. Please try again.');
          } finally {
            completing = false;
          }
        };
        const unsubscribe = client.addSessionListener(() => void complete());
        const unmount = client.mountAuthentication(element);
        if (client.hasSession()) await complete();
        cleanup = () => {
          unsubscribe();
          unmount();
        };
      })
      .catch(() => {
        if (active)
          setError('Secure sign-in is unavailable. Please use another method.');
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [onSignedIn]);

  return (
    <section aria-label="Secure seller sign-in">
      <p>
        Sign in, create an account, verify your email, or reset your password
        with the secure RWAS identity service.
      </p>
      {error && <p role="alert">{error}</p>}
      <div ref={mount} />
    </section>
  );
}
