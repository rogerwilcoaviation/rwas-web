'use client';

import { useState } from 'react';
import JerryHero from './JerryHero';

export default function JerryPopup() {
  const [open, setOpen] = useState(false);

  return (
    <span>
      {/* Nav link trigger */}
      <a
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        style={{ cursor: 'pointer' }}
        className="np-nav-jerry"
      >
        Ask Jerry
      </a>

      {/* Floating bubble — always visible when panel is closed */}
      {!open && (
        <div
          onClick={() => setOpen(true)}
          aria-label="Chat with Captain Jerry"
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#1a1a1a',
            border: '2px solid #d1b074',
            cursor: 'pointer',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          <span style={{
            color: '#d1b074',
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            lineHeight: 1,
          }}>J</span>
        </div>
      )}

      {/* Floating popup panel */}
      {open && (
        <>
          {/* Backdrop on mobile */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 9998,
            }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: '0',
              right: '0',
              width: '100%',
              maxWidth: '400px',
              height: '70vh',
              maxHeight: '520px',
              zIndex: 9999,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
              border: '2px solid #1a1a1a',
              background: '#ede9e2',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            {/* Header bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#1a1a1a',
                color: '#f7f4ef',
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#d1b074' }}>Captain Jerry &mdash; RWAS</span>
              <span
                onClick={() => setOpen(false)}
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                  padding: '0 4px',
                  color: '#f7f4ef',
                }}
              >
                &times;
              </span>
            </div>
            {/* Chat */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <JerryHero />
            </div>
          </div>
        </>
      )}
    </span>
  );
}
