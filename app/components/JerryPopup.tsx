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
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#1a1a1a',
            border: '2px solid #f7f4ef',
            cursor: 'pointer',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <img
            src="/newspaper/images/jerry_aviator.png"
            alt="Ask Captain Jerry"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="color:#f7f4ef;font-family:Arial,sans-serif;font-size:20px;font-weight:700;">J</span>';
            }}
          />
        </div>
      )}

      {/* Floating popup panel */}
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
    </span>
  );
}
