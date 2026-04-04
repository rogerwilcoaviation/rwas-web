'use client';

import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function JerryHero() {
  const [history, setHistory] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Captain Jerry here. Avionics question, service inquiry, or just looking around — what can I do for you? — Capt. Jerry, RWAS",
    },
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [history]);

  async function send() {
    if (!input.trim() || loading || submitted) return;
    const msg = input.trim();
    setInput('');
    const next: Message[] = [...history, { role: 'user', content: msg }];
    setHistory(next);
    setLoading(true);

    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const raw  = data.reply || 'Radio trouble on my end. Try again. — Capt. Jerry, RWAS';

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
            body:    JSON.stringify(intake),
          });
          const ir = await r.json();
          setConfirmed(
            ir.ok
              ? "You're all set — our team will be in touch. Ref: " + (ir.ref || 'filed')
              : 'Something went wrong. Please call: (605) 299-8178'
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
    <div style={{
      border: '2px solid #1a1a1a',
      background: '#ede9e2',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {/* Status line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: '5px 8px',
        borderBottom: '1px dotted #bbb',
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#2a7e2a',
        }} />
        <span style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '9px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: '#555',
        }}>
          Online — Avionics &amp; Service
        </span>
      </div>

      {/* Chat history */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 8px',
          maxHeight: '240px',
          minHeight: '80px',
        }}
      >
        {history.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: '5px',
              textAlign: m.role === 'user' ? 'right' as const : 'left' as const,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                maxWidth: '92%',
                padding: '4px 7px',
                fontFamily: "Georgia, serif",
                fontSize: '11px',
                lineHeight: '1.5',
                textAlign: 'left' as const,
                ...(m.role === 'user'
                  ? {
                      background: '#f7f4ef',
                      border: '1px solid #ccc',
                      color: '#1a1a1a',
                    }
                  : {
                      background: '#fff',
                      border: '1px solid #1a1a1a',
                      color: '#333',
                      fontStyle: 'italic' as const,
                    }),
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ marginBottom: '5px' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 7px',
                background: '#fff',
                border: '1px solid #1a1a1a',
                fontFamily: 'Georgia, serif',
                fontSize: '11px',
                fontStyle: 'italic',
                color: '#999',
              }}
            >
              thinking…
            </div>
          </div>
        )}
      </div>

      {/* Confirmation */}
      {confirmed && (
        <div style={{
          margin: '0 8px 5px',
          padding: '4px 7px',
          border: '1px solid #2a7e2a',
          background: '#e8f5e8',
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#1a5e1a',
        }}>
          {confirmed}
        </div>
      )}

      {/* Input */}
      {!submitted && (
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '0 8px 8px',
        }}>
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
              background: '#fff',
              padding: '5px 7px',
              fontFamily: 'Georgia, serif',
              fontSize: '11px',
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
              padding: '5px 10px',
              fontFamily: 'Arial, sans-serif',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
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
  );
}
