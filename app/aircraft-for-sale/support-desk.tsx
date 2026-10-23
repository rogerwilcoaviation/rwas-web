'use client';
import { useState } from 'react';
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
type Ticket = {
  id: string;
  email?: string;
  subject: string;
  status: string;
  revision: number;
  messages: { from: string; text: string; at: number }[];
};
export default function SupportDesk({
  request,
  admin = false,
}: {
  request: Request;
  admin?: boolean;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [subject, setSubject] = useState(''),
    [message, setMessage] = useState(''),
    [reply, setReply] = useState<Record<string, string>>({}),
    [status, setStatus] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const path = admin ? '/admin/support' : '/support';
  async function load() {
    const data = (await request(path)) as { tickets: Ticket[] };
    setTickets(data.tickets);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Support is unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label={admin ? 'Customer support' : 'Contact support'}>
      <h3>{admin ? 'Customer support' : 'Contact support'}</h3>
      <p>
        {admin
          ? 'Review customer requests and reply in their account. Replies remain in the support conversation.'
          : 'Send a request to RWAS and return here to read the response.'}
      </p>
      <button disabled={busy} onClick={() => void run(load)}>
        Load support requests
      </button>
      {!admin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await request(path, 'POST', { subject, message });
              setSubject('');
              setMessage('');
              await load();
              setNotice('Support request saved.');
            });
          }}
        >
          <label>
            Subject
            <input
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button disabled={busy}>Send support request</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {tickets.map((ticket) => (
        <article key={ticket.id}>
          <h4>{ticket.subject}</h4>
          <p>
            {ticket.status}
            {admin && ticket.email ? ' · ' + ticket.email : ''}
          </p>
          {ticket.messages.map((entry, i) => (
            <p key={i}>
              <strong>
                {entry.from === 'support' ? 'RWAS Support' : 'Customer'}:
              </strong>{' '}
              {entry.text}
            </p>
          ))}
          {admin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await request(path + '/' + ticket.id, 'PATCH', {
                    revision: ticket.revision,
                    reply: reply[ticket.id] || '',
                    status: status[ticket.id] || 'in-progress',
                  });
                  setReply((old) => ({ ...old, [ticket.id]: '' }));
                  await load();
                  setNotice('Reply saved to the customer’s account.');
                });
              }}
            >
              <label>
                Support reply
                <textarea
                  required
                  maxLength={5000}
                  value={reply[ticket.id] || ''}
                  onChange={(e) =>
                    setReply((old) => ({ ...old, [ticket.id]: e.target.value }))
                  }
                />
              </label>
              <label>
                Request status
                <select
                  value={status[ticket.id] || 'in-progress'}
                  onChange={(e) =>
                    setStatus((old) => ({
                      ...old,
                      [ticket.id]: e.target.value,
                    }))
                  }
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <button disabled={busy}>Save reply and status</button>
            </form>
          )}
        </article>
      ))}
      <style jsx>{`
        section {
          font-family: Arial, sans-serif;
        }
        label {
          display: grid;
          gap: 8px;
          margin: 16px 0;
        }
        input,
        textarea,
        select {
          padding: 10px;
          border: 1px solid #777;
          font: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        textarea {
          min-height: 110px;
        }
        button {
          padding: 10px 16px;
          margin: 6px 8px 6px 0;
        }
        article {
          border-top: 1px solid #aaa;
          margin-top: 20px;
          padding-top: 12px;
        }
        p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      `}</style>
    </section>
  );
}
