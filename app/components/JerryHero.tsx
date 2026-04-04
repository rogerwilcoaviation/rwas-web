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

      // Detect intake completion
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
              : 'Something went wrong. Please call: (605) 665-4414'
          );
        } catch {
          setConfirmed('Could not file intake. Please call: (605) 665-4414');
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
    <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#111111] p-5 shadow-2xl flex flex-col h-full min-h-[360px]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
          CJ
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500/80">
            Captain Jerry
          </div>
          <div className="text-xs text-white/50">
            RWAS AI Advisor · Avionics &amp; Service
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/40">online</span>
        </div>
      </div>

      {/* Chat history */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin"
        style={{ maxHeight: '220px' }}
      >
        {history.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'flex justify-end'
                : 'flex justify-start'
            }
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-primary-500/20 px-3 py-2 text-xs leading-relaxed text-primary-100'
                  : 'max-w-[90%] rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2 text-xs leading-relaxed text-white/85'
              }
              style={m.role === 'assistant' ? { background: 'rgba(255,255,255,0.07)' } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.07)' }}>
              thinking…
            </div>
          </div>
        )}
      </div>

      {/* Confirmation */}
      {confirmed && (
        <div className="rounded-xl bg-primary-500/15 border border-primary-500/30 px-3 py-2 text-xs text-primary-200 mb-3">
          {confirmed}
        </div>
      )}

      {/* Input */}
      {!submitted && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask Jerry anything…"
            disabled={loading}
            className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-primary-500/60 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-black hover:bg-primary-400 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
