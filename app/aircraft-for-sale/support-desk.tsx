'use client';
import { useState } from 'react';
import {
  AdminListingStyles,
  ListingStatus,
} from './admin-listing-presentation';
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
  updatedAt?: number;
  messages: { from: string; text: string; at: number }[];
};
const draftKey = (ticket: Ticket) => ticket.id + ':' + ticket.revision;
const date = (at?: number) =>
  at && Number.isFinite(at)
    ? new Date(at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
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
    [notice, setNotice] = useState(''),
    [loaded, setLoaded] = useState(false),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const path = admin ? '/admin/support' : '/support';
  async function load() {
    const data = (await request(path)) as { tickets: Ticket[] };
    if (!Array.isArray(data.tickets))
      throw Error('Support requests could not be loaded. Please try again.');
    setTickets(data.tickets);
    setLoaded(true);
    const keys = new Set(data.tickets.map(draftKey));
    setReply((old) =>
      Object.fromEntries(Object.entries(old).filter(([key]) => keys.has(key))),
    );
    setStatus((old) =>
      Object.fromEntries(Object.entries(old).filter(([key]) => keys.has(key))),
    );
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
  const visible = tickets.filter(
    (ticket) =>
      (filter === 'all' || ticket.status === filter) &&
      [
        ticket.subject,
        ticket.email,
        ...ticket.messages.map((entry) => entry.text),
      ].some((text) =>
        String(text || '')
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
  );
  return (
    <section
      className="admin-listing-panel support-panel"
      aria-label={admin ? 'Customer support' : 'Contact support'}
    >
      <AdminListingStyles />
      <header className="admin-panel-heading">
        <div>
          <h3>{admin ? 'Customer support' : 'Contact support'}</h3>
          <p>
            {admin
              ? 'Review customer requests, follow the conversation and save a reply with the next request status.'
              : 'Send a request to RWAS and return here to read the response.'}
          </p>
        </div>
        <button
          className="admin-button"
          disabled={busy}
          onClick={() => void run(load)}
        >
          Load support requests
        </button>
      </header>
      {!admin && (
        <form
          className="support-new-request"
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
          <h4>New support request</h4>
          <label>
            Subject
            <input
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What can we help with?"
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength={5000}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include the listing or account details that will help us assist you."
            />
          </label>
          <p className="admin-muted">
            Maximum 5,000 characters. Messages and replies stay in your account.
          </p>
          <button
            className="admin-button admin-primary"
            disabled={busy || !subject.trim() || !message.trim()}
          >
            Send support request
          </button>
        </form>
      )}
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-feedback" role="status">
          {notice}
        </p>
      )}
      {!loaded && admin && !error && (
        <div className="admin-empty">
          <strong>Customer conversations in one place</strong>
          <p>
            Load support requests to see open questions, review previous replies
            and help customers with their accounts or listings.
          </p>
        </div>
      )}
      {loaded && (
        <>
          <div className="admin-listing-toolbar">
            <label>
              Search support requests
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  admin
                    ? 'Subject, customer email or message'
                    : 'Subject or message'
                }
              />
            </label>
            <label>
              Filter request status
              <select
                aria-label="Filter request status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in-progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>
          <p className="admin-muted" role="status">
            Showing {visible.length} of {tickets.length} support requests
          </p>
        </>
      )}
      {loaded && !visible.length && (
        <p className="admin-empty">
          {tickets.length
            ? 'No support requests match your search.'
            : admin
              ? 'No customer support requests yet.'
              : 'You have no support requests yet. Use the form above to contact RWAS.'}
        </p>
      )}
      <div className="admin-listing-list">
        {visible.map((ticket) => (
          <article
            className="admin-listing-card"
            key={draftKey(ticket)}
            aria-label={ticket.subject}
          >
            <header className="admin-card-heading">
              <div>
                <h4 className="admin-card-title">{ticket.subject}</h4>
                {admin && ticket.email && (
                  <p className="support-customer">{ticket.email}</p>
                )}
                <p className="admin-card-revision">
                  {date(ticket.updatedAt || ticket.messages.at(-1)?.at)
                    ? 'Updated ' +
                      date(ticket.updatedAt || ticket.messages.at(-1)?.at)
                    : 'Request ' + ticket.id.slice(0, 8)}
                </p>
              </div>
              <ListingStatus status={ticket.status} />
            </header>
            <ol
              className="support-conversation"
              aria-label="Support conversation"
            >
              {ticket.messages.map((entry, index) => (
                <li
                  className={
                    entry.from === 'support'
                      ? 'support-message support-team'
                      : 'support-message'
                  }
                  key={index}
                >
                  <header>
                    <strong>
                      {entry.from === 'support'
                        ? 'RWAS Support'
                        : admin
                          ? 'Customer'
                          : 'You'}
                    </strong>
                    {date(entry.at) && (
                      <time dateTime={new Date(entry.at).toISOString()}>
                        {date(entry.at)}
                      </time>
                    )}
                  </header>
                  <p>{entry.text}</p>
                </li>
              ))}
            </ol>
            {admin && (
              <form
                className="support-reply"
                onSubmit={(e) => {
                  e.preventDefault();
                  const key = draftKey(ticket);
                  void run(async () => {
                    await request(path + '/' + ticket.id, 'PATCH', {
                      revision: ticket.revision,
                      reply: reply[key] || '',
                      status: status[key] || 'in-progress',
                    });
                    setReply((old) => ({ ...old, [key]: '' }));
                    await load();
                    setNotice('Reply saved to the customer’s account.');
                  });
                }}
              >
                <label>
                  Support reply
                  <textarea
                    required
                    rows={4}
                    maxLength={5000}
                    value={reply[draftKey(ticket)] || ''}
                    onChange={(e) =>
                      setReply((old) => ({
                        ...old,
                        [draftKey(ticket)]: e.target.value,
                      }))
                    }
                    placeholder="Write a clear response for the customer."
                  />
                </label>
                <div className="support-reply-actions">
                  <label>
                    Request status
                    <select
                      aria-label="Request status"
                      value={status[draftKey(ticket)] || 'in-progress'}
                      onChange={(e) =>
                        setStatus((old) => ({
                          ...old,
                          [draftKey(ticket)]: e.target.value,
                        }))
                      }
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <button
                    className="admin-button admin-primary"
                    disabled={busy || !reply[draftKey(ticket)]?.trim()}
                  >
                    Save reply and status
                  </button>
                </div>
                <p className="admin-muted">
                  The customer can read your reply in their account. This does
                  not send an email.
                </p>
              </form>
            )}
          </article>
        ))}
      </div>
      <style jsx global>{`
        .support-panel .support-new-request,
        .support-panel .support-reply {
          padding: 20px 0;
          margin: 0 0 24px;
          border-bottom: 1px solid #ded7c9;
        }
        .support-panel .support-reply {
          border-top: 1px solid #ded7c9;
          border-bottom: 0;
          margin: 20px 0 0;
          padding-bottom: 0;
        }
        .support-panel .support-new-request h4 {
          margin: 0 0 16px;
          font-size: 18px;
        }
        .support-panel .support-new-request label,
        .support-panel .support-reply label {
          display: grid;
          gap: 8px;
          margin: 0 0 16px;
          font:
            600 14px/1.5 Arial,
            sans-serif;
          min-width: 0;
        }
        .support-panel .support-new-request input,
        .support-panel .support-new-request textarea,
        .support-panel .support-reply textarea,
        .support-panel .support-reply select {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #8e877b;
          border-radius: 4px;
          background: #fff;
          color: #25251f;
          font:
            400 15px/1.6 Arial,
            sans-serif;
        }
        .support-panel textarea {
          min-height: 110px;
          resize: vertical;
        }
        .support-panel .support-customer {
          margin: 0 0 6px;
          color: #635d51;
          font-size: 14px;
        }
        .support-panel .support-conversation {
          list-style: none;
          display: grid;
          gap: 12px;
          padding: 0;
          margin: 20px 0 0;
        }
        .support-panel .support-message {
          padding: 16px;
          border: 1px solid #e2dbcf;
          border-left: 3px solid #c4b9a4;
          background: #faf8f3;
          border-radius: 4px;
        }
        .support-panel .support-team {
          background: #fff;
          border-left-color: #b99727;
        }
        .support-panel .support-message header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 6px 16px;
          align-items: baseline;
        }
        .support-panel .support-message time {
          font-size: 12px;
          color: #726a5b;
        }
        .support-panel .support-message p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin: 10px 0 0;
          line-height: 1.65;
        }
        .support-panel .support-reply-actions {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
        }
        .support-panel .support-reply-actions label {
          min-width: 180px;
          flex: 1 1 180px;
          margin: 0;
        }
        .support-panel .admin-listing-status[data-status='open'] {
          background: #fbf2d9;
          border-color: #ddc783;
          color: #705218;
        }
        .support-panel .admin-listing-status[data-status='in-progress'] {
          background: #eef1f5;
          border-color: #bcc6d1;
          color: #40536c;
        }
        .support-panel .admin-listing-status[data-status='resolved'] {
          background: #eaf3e9;
          border-color: #b5cbb0;
          color: #365b32;
        }
        @media (max-width: 680px) {
          .support-panel .support-reply-actions .admin-button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
