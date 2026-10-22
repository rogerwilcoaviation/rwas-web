'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function AuthenticatorSetup({ uri }: { uri: string }) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <section aria-label="Set up your authenticator app">
      <p>
        In your authenticator app, add an account and scan this QR code. Keep it
        private: it gives access to your sign-in codes.
      </p>
      <QRCodeSVG
        value={uri}
        size={224}
        marginSize={4}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        title="Authenticator setup QR code"
        role="img"
        aria-label="Authenticator setup QR code"
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
      <details onToggle={(event) => setManualOpen(event.currentTarget.open)}>
        <summary>Can’t scan? Set up manually</summary>
        {manualOpen && (
          <label className="seller-field">
            Authenticator setup URI
            <textarea
              aria-label="Authenticator setup URI"
              readOnly
              spellCheck={false}
              autoComplete="off"
              value={uri}
            />
          </label>
        )}
      </details>
    </section>
  );
}
