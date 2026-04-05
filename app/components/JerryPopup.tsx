'use client';

import { useState } from 'react';
import JerryHero from './JerryHero';

export default function JerryPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Nav link trigger */}
      <a
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        style={{ cursor: 'pointer' }}
        className="np-nav-jerry"
      >
        Ask Jerry
      </a>

      {/* Floating popup */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '380px',
            maxHeight: '520px',
            zIndex: 9999,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
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
              padding: '6px 10px',
              background: '#1a1a1a',
              color: '#f7f4ef',
              fontFamily: 'Arial, sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
            }}
          >
            <span>Captain Jerry &mdash; RWAS</span>
            <span
              onClick={() => setOpen(false)}
              style={{
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 4px',
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
      )}
    </>
  );
}
