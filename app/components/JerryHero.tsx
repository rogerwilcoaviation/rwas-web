'use client';

import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function JerryHero() {
  const SK = 'jerry_chat_history';
  const defaultMsg: Message[] = [{
    role: 'assistant',
    content: 'Captain Jerry here. Avionics question, service inquiry, or just looking around — what can I do for you? — Capt. Jerry, RWAS',
  }];

  const [history, setHistory] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(SK);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return defaultMsg;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const [open, setOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
    try {
      sessionStorage.setItem(SK, JSON.stringify(history));
    } catch {}
  }, [history, open]);

  async function send() {
    if (!input.trim() || loading || submitted) return;
    const msg = input.trim();
    setInput('');
    const next: Message[] = [...history, { role: 'user', content: msg }];
    setHistory(next);
    setLoading(true);
    setOpen(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const raw = data.reply || 'Radio trouble on my end. Try again. — Capt. Jerry, RWAS';

      const m = raw.match(/INTAKE_COMPLETE:(\{[\s\S]*?\})\s*$/m);
      const display = m ? raw.replace(/INTAKE_COMPLETE:\{[\s\S]*?\}\s*$/m, '').trim() : raw;

      setHistory([...next, { role: 'assistant', content: display }]);

      if (m && !submitted) {
        setSubmitted(true);
        try {
          const intake = JSON.parse(m[1]);
          intake._secret = 'rwas-intake-2026';
          const r = await fetch('/api/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intake),
          });
          const ir = await r.json();
          setConfirmed(
            ir.ok
              ? "You're all set — our team will be in touch. Ref: " + (ir.ref || 'filed')
              : 'Something went wrong. Please call: (605) 299-8178',
          );
        } catch {
          setConfirmed('Could not file intake. Please call: (605) 299-8178');
        }
      }
    } catch {
      setHistory([
        ...next,
        {
          role: 'assistant',
          content: 'Radio trouble on my end. Try jerry.rwas.team directly — Capt. Jerry, RWAS',
        },
      ]);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 1000,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {open ? (
        <div
          style={{
            width: '380px',
            height: '500px',
            background: '#f7f4ef',
            border: '2px solid #1a1a1a',
            boxShadow: '0 14px 38px rgba(0,0,0,0.28)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              background: '#1a1a1a',
              color: '#f7f4ef',
              borderBottom: '1px solid #3a3a3a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <img
                src="/newspaper/images/captain_jerry.jpg"
                alt="Captain Jerry"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  border: '1px solid rgba(247,244,239,0.4)',
                  background: '#ddd9d2',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#d1b074',
                  }}
                >
                  Captain Jerry
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#d7d1c7' }}>Avionics &amp; Service</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{
                border: '1px solid rgba(247,244,239,0.35)',
                background: 'transparent',
                color: '#f7f4ef',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderBottom: '1px dotted #bbb',
              background: '#ede9e2',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#2a7e2a',
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#555',
              }}
            >
              Online — Avionics &amp; Service
            </span>
          </div>

          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              background: '#f1eee8',
            }}
          >
            {history.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '10px',
                  textAlign: m.role === 'user' ? ('right' as const) : ('left' as const),
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '92%',
                    padding: '10px 12px',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: '1.35',
                    textAlign: 'left' as const,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    ...(m.role === 'user'
                      ? {
                          background: '#1a1a1a',
                          border: '1px solid #1a1a1a',
                          color: '#f7f4ef',
                        }
                      : {
                          background: '#fffdf9',
                          border: '1px solid #1a1a1a',
                          color: '#1a1a1a',
                        }),
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ marginBottom: '10px' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '10px 12px',
                    background: '#fffdf9',
                    border: '1px solid #1a1a1a',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#666',
                  }}
                >
                  thinking…
                </div>
              </div>
            )}
          </div>

          {confirmed && (
            <div
              style={{
                margin: '0 12px 10px',
                padding: '10px 12px',
                border: '1px solid #2a7e2a',
                background: '#e8f5e8',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1a5e1a',
              }}
            >
              {confirmed}
            </div>
          )}

          {!submitted && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 12px 12px',
                borderTop: '1px solid #c8c1b8',
                background: '#ede9e2',
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask Jerry anything…"
                disabled={loading}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: '1px solid #1a1a1a',
                  background: '#fffdf9',
                  padding: '10px 12px',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1a1a1a',
                  outline: 'none',
                  opacity: loading ? 0.5 : 1,
                }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                style={{
                  background: '#1a1a1a',
                  color: '#f7f4ef',
                  border: 'none',
                  padding: '10px 14px',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  opacity: loading || !input.trim() ? 0.4 : 1,
                  flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Captain Jerry chat"
          style={{
            width: '74px',
            height: '74px',
            borderRadius: '999px',
            border: '2px solid #1a1a1a',
            background: '#f7f4ef',
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
            padding: 0,
            cursor: 'pointer',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/newspaper/images/captain_jerry.jpg"
            alt="Captain Jerry"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        </button>
      )}
    </div>
  );
}
