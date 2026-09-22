'use client';

import { useState } from 'react';

/** User-requested deletion is deliberately limited to our analytics identifier. */
export function BrowserDataControls() {
  const [message, setMessage] = useState('');
  function clearIdentifier() {
    try {
      window.localStorage.removeItem('rwas_anon_session');
      setMessage('The RWAS analytics identifier has been removed from this browser. A new identifier may be created by later site activity. This does not delete server records or turn off analytics.');
    } catch {
      setMessage('Browser storage is unavailable. Use your browser’s site-data settings to remove data for this website.');
    }
  }
  return (
    <div>
      <button type="button" className="bs-btn" onClick={clearIdentifier}>
        Clear this browser’s RWAS analytics identifier
      </button>
      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
