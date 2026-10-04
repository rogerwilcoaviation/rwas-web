'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SELLER_API } from '@/lib/seller-api';

type Summary = {
  id: string;
  email: string;
  name: string;
  status: string;
  adminSuspended: boolean;
  securityHeld: boolean;
  listingCount: number;
  activeSessions: number;
  createdAt: number;
};
type Account = Summary & {
  phone: string;
  location: string;
  loginMethods: string[];
  sessions: { createdAt: number; expiresAt: number; method: string }[];
  listings: { id: string; title: string; status: string; revision: number }[];
  hasSavedDraft: boolean;
  mediaCount: number;
};
type Audit = {
  operationId: string;
  actor: string;
  operation: string;
  reasonCode: string;
  changedFields: string[];
  revokedSessions: number;
  at: number;
};
type Operation = 'update-profile' | 'suspend' | 'reinstate' | 'revoke-sessions';
type Input = {
  id: string;
  operation: Operation;
  reasonCode: string;
  changes?: { name: string; phone: string; location: string };
};
type Preview = {
  confirmation: string;
  accountId: string;
  operation: Operation;
  proposedChanges: Record<string, string> | null;
  sessionsToRevoke: number;
  securityHoldRemains: boolean;
  changedFields: string[];
};
type Authority = {
  actor: string;
  canManage: boolean;
  expiresAt: number;
  manageUntil: number | null;
};
const labels: Record<Operation, string> = {
  'update-profile': 'Update contact details',
  suspend: 'Suspend sign-in',
  reinstate: 'Reinstate sign-in',
  'revoke-sessions': 'Revoke all sessions',
};
const reasons = {
  'support-request': 'Seller support request',
  'contact-correction': 'Contact correction',
  'abuse-prevention': 'Abuse prevention',
  'account-recovery': 'Account recovery',
  maintenance: 'Maintenance',
};
class AccountRequestError extends Error {
  constructor(public status: number) {
    super(
      status === 401 || status === 403
        ? 'Sign in with your approved account administrator identity, then load accounts again.'
        : status === 409
          ? 'Account changed. Review the refreshed details and preview again.'
          : status === 400
            ? 'Check the contact details and operation reason, then try again.'
            : status === 404
              ? 'Account is no longer available. Load accounts again.'
              : status === 503
                ? 'Account administration is unavailable. Access and the account service must be configured.'
                : 'The operation could not be confirmed. Retry the same operation or reload the account.',
    );
  }
}
async function request(path: string, input?: unknown) {
  const r = await fetch(SELLER_API + '/admin/accounts' + path, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...(input
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      : {}),
  });
  if (
    r.redirected ||
    !r.headers.get('Content-Type')?.includes('application/json')
  )
    throw new AccountRequestError(403);
  if (!r.ok) throw new AccountRequestError(r.status);
  try {
    return await r.json();
  } catch {
    throw new AccountRequestError(502);
  }
}
const time = (value: number) => new Date(value).toLocaleString();
export default function SellerAccounts() {
  const [rows, setRows] = useState<Summary[]>([]),
    [selected, setSelected] = useState<Account | null>(null),
    [audit, setAudit] = useState<Audit[]>([]);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [cursor, setCursor] = useState<string | null>(null),
    [total, setTotal] = useState(0);
  const [authority, setAuthority] = useState<Authority | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [contact, setContact] = useState({ name: '', phone: '', location: '' }),
    [reason, setReason] = useState('support-request');
  const [pending, setPending] = useState<{
    input: Input;
    preview: Preview;
  } | null>(null);
  const generation = useRef(0);
  function clearPrivate() {
    generation.current++;
    setRows([]);
    setSelected(null);
    setAudit([]);
    setPending(null);
    setContact({ name: '', phone: '', location: '' });
    setAuthority(null);
    setCursor(null);
    setTotal(0);
    setNotice('');
    setReason('support-request');
    setBusy(false);
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!authority) return;
    const timer = setTimeout(
      () => {
        clearPrivate();
        setError(
          'Administrator access expired. Sign in again and load accounts.',
        );
      },
      Math.max(0, authority.expiresAt - Date.now()),
    );
    const manageTimer = authority.manageUntil
      ? setTimeout(
          () => {
            generation.current++;
            setBusy(false);
            setAuthority((a) =>
              a ? { ...a, canManage: false, manageUntil: null } : null,
            );
            setPending(null);
          },
          Math.max(0, authority.manageUntil - Date.now()),
        )
      : undefined;
    return () => {
      clearTimeout(timer);
      if (manageTimer) clearTimeout(manageTimer);
    };
  }, [authority]);
  function failure(e: unknown) {
    if (e instanceof AccountRequestError && [401, 403, 503].includes(e.status))
      clearPrivate();
    setError(
      e instanceof AccountRequestError
        ? e.message
        : 'The request could not be confirmed. Please try again.',
    );
  }
  async function load(next = false) {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setSelected(null);
    setPending(null);
    setAudit([]);
    setContact({ name: '', phone: '', location: '' });
    try {
      const search = new URLSearchParams({ q: query, status: filter });
      if (next && cursor) search.set('cursor', cursor);
      const d = await request('?' + search);
      if (g !== generation.current) return;
      if (!Array.isArray(d.accounts)) throw new AccountRequestError(502);
      setRows(d.accounts);
      setCursor(d.nextCursor);
      setTotal(d.total);
      setAuthority({
        actor: d.actor,
        canManage: d.canManage,
        expiresAt: d.expiresAt,
        manageUntil: d.manageUntil,
      });
    } catch (e) {
      if (g === generation.current) {
        setRows([]);
        failure(e);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function detail(id: string, g: number) {
    const d = await request('/' + encodeURIComponent(id));
    if (g !== generation.current) return null;
    if (!d.account || d.account.id !== id || !Array.isArray(d.audit))
      throw new AccountRequestError(502);
    setSelected(d.account);
    setAudit(d.audit);
    setContact({
      name: d.account.name,
      phone: d.account.phone,
      location: d.account.location,
    });
    setAuthority({
      actor: d.actor,
      canManage: d.canManage,
      expiresAt: d.expiresAt,
      manageUntil: d.manageUntil,
    });
    return d.account as Account;
  }
  async function open(id: string) {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setPending(null);
    setSelected(null);
    setAudit([]);
    setContact({ name: '', phone: '', location: '' });
    setReason('support-request');
    try {
      await detail(id, g);
    } catch (e) {
      if (g === generation.current) failure(e);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function preview(operation: Operation) {
    if (!selected) return;
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setPending(null);
    const input: Input = {
      id: crypto.randomUUID(),
      operation,
      reasonCode: reason,
      ...(operation === 'update-profile' ? { changes: contact } : {}),
    };
    try {
      const d = await request('/' + selected.id + '/preview', input);
      if (g !== generation.current) return;
      if (
        d.replayed ||
        d.accountId !== selected.id ||
        typeof d.confirmation !== 'string'
      )
        throw new AccountRequestError(409);
      setPending({ input, preview: d });
    } catch (e) {
      if (g === generation.current) failure(e);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function apply() {
    if (!selected || !pending) return;
    const g = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const d = await request('/' + selected.id + '/apply', {
        ...pending.input,
        confirmation: pending.preview.confirmation,
      });
      if (g !== generation.current) return;
      setPending(null);
      setNotice(
        `${labels[pending.input.operation]} completed. ${d.revokedSessions} sessions revoked.`,
      );
      const account = await detail(selected.id, g);
      if (account)
        setRows((previous) =>
          previous.map((r) => (r.id === selected.id ? account : r)),
        );
    } catch (e) {
      if (g !== generation.current) return;
      if (e instanceof AccountRequestError && e.status === 409) {
        setPending(null);
        try {
          await detail(selected.id, g);
        } catch (refresh) {
          if (g === generation.current) failure(refresh);
          return;
        }
      }
      if (g === generation.current) failure(e);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  const search = (e: FormEvent) => {
    e.preventDefault();
    void load();
  };
  return (
    <main className="accounts-admin" id="main-content" tabIndex={-1}>
      <header>
        <p className="eyebrow">RWAS administration</p>
        <h1>Seller accounts</h1>
        <p>
          Find a seller, review account activity, and manage sign-in access.
        </p>
      </header>
      <form onSubmit={search} className="search-form">
        <label>
          Search accounts
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            placeholder="Name, email or account ID"
          />
        </label>
        <label>
          Account status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All accounts</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="security-held">Security hold</option>
          </select>
        </label>
        <button disabled={busy} type="submit">
          Load accounts
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {authority ? (
        <p>
          Signed in as {authority.actor}.{' '}
          {authority.canManage
            ? 'Account management available.'
            : 'Read-only access. Sign in again to manage accounts.'}
        </p>
      ) : (
        <p>Approved account administrator access is required.</p>
      )}
      <div className="admin-grid">
        <section aria-label="Account directory">
          <h2>Account directory</h2>
          <p>{total} matching accounts</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Listings</th>
                  <th>Active sessions</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name || 'Unnamed seller'}
                      <br />
                      {r.email}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.listingCount}</td>
                    <td>{r.activeSessions}</td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => void open(r.id)}
                        aria-label={'View account ' + r.email}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor ? (
            <button disabled={busy} onClick={() => void load(true)}>
              Next page
            </button>
          ) : null}
        </section>
        {selected ? (
          <section aria-label="Selected account">
            <h2>{selected.name || 'Unnamed seller'}</h2>
            <p>{selected.email}</p>
            <p>Account ID: {selected.id}</p>
            <p>
              Status: {selected.status}. Created: {time(selected.createdAt)}
            </p>
            {selected.securityHeld ? (
              <p role="note">
                A separate security hold is active. Reinstating sign-in does not
                clear it; verified security recovery is required.
              </p>
            ) : null}
            <p>Sign-in methods: {selected.loginMethods.join(', ')}</p>
            <p>
              {selected.listingCount} listings · {selected.mediaCount} media
              files ·{' '}
              {selected.hasSavedDraft
                ? 'Saved intake draft'
                : 'No saved intake draft'}
            </p>
            <h3>Contact details</h3>
            <fieldset disabled={busy || !authority?.canManage || !!pending}>
              <label>
                Name
                <input
                  value={contact.name}
                  maxLength={200}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Phone
                <input
                  value={contact.phone}
                  maxLength={200}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, phone: e.target.value }))
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={contact.location}
                  maxLength={200}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, location: e.target.value }))
                  }
                />
              </label>
              <label>
                Operation reason
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {Object.entries(reasons).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => void preview('update-profile')}>
                Preview contact update
              </button>
              <button
                onClick={() =>
                  void preview(
                    selected.adminSuspended ? 'reinstate' : 'suspend',
                  )
                }
              >
                {selected.adminSuspended
                  ? 'Preview reinstatement'
                  : 'Preview suspension'}
              </button>
              <button onClick={() => void preview('revoke-sessions')}>
                Preview session revocation
              </button>
            </fieldset>
            {pending ? (
              <section
                aria-label="Confirm account operation"
                className="confirmation"
              >
                <h3>Confirm {labels[pending.input.operation].toLowerCase()}</h3>
                <p>Target: {selected.email}</p>
                <p>
                  Reason:{' '}
                  {reasons[pending.input.reasonCode as keyof typeof reasons]}
                </p>
                {pending.preview.proposedChanges ? (
                  <dl>
                    {Object.entries(pending.preview.proposedChanges).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value || '(empty)'}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                ) : null}
                <p>
                  {pending.preview.sessionsToRevoke} stored sessions will be
                  revoked.
                </p>
                <p>Listings, media and ownership stay unchanged.</p>
                {pending.preview.securityHoldRemains ? (
                  <p>The separate security hold remains in effect.</p>
                ) : null}
                <button
                  disabled={busy || !authority?.canManage}
                  onClick={() => void apply()}
                >
                  Confirm operation
                </button>
                <button disabled={busy} onClick={() => setPending(null)}>
                  Cancel operation
                </button>
              </section>
            ) : null}
            <h3>Listings</h3>
            {selected.listings.length ? (
              <ul>
                {selected.listings.map((l) => (
                  <li key={l.id}>
                    {l.title} · {l.status} · revision {l.revision}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No listings</p>
            )}
            <h3>Active sessions</h3>
            <ul>
              {selected.sessions.map((s, i) => (
                <li key={`${s.createdAt}:${i}`}>
                  {s.method} · started {time(s.createdAt)} · expires{' '}
                  {time(s.expiresAt)}
                </li>
              ))}
            </ul>
            <h3>Administrator activity</h3>
            {audit.length ? (
              <ul>
                {audit.map((a) => (
                  <li key={a.operationId}>
                    {time(a.at)} · {a.actor} · {a.operation} · {a.reasonCode} ·{' '}
                    {a.revokedSessions} sessions revoked
                    {a.changedFields.length
                      ? ' · fields: ' + a.changedFields.join(', ')
                      : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No administrator operations recorded.</p>
            )}
          </section>
        ) : null}
      </div>
      <style jsx>{`
        .accounts-admin {
          max-width: 1300px;
          margin: 0 auto;
          padding: 32px 20px;
          color: #1c1c1a;
          background: #f7f4ec;
          min-height: 65vh;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 13px;
          color: #765517;
        }
        h1 {
          font-size: 36px;
        }
        h2 {
          font-size: 24px;
        }
        h3 {
          font-size: 19px;
          margin-top: 22px;
        }
        p {
          margin: 12px 0;
        }
        button,
        input,
        select {
          font: inherit;
        }
        button {
          padding: 10px 14px;
          background: #1c1c1a;
          color: #fff;
          border: 1px solid #1c1c1a;
          cursor: pointer;
          margin: 4px 8px 4px 0;
        }
        button:disabled {
          opacity: 0.5;
          cursor: default;
        }
        input,
        select {
          display: block;
          width: 100%;
          border: 1px solid #999;
          padding: 10px;
          background: #fff;
          color: #1c1c1a;
        }
        label {
          display: block;
          margin: 10px 0;
        }
        .search-form {
          display: flex;
          align-items: end;
          gap: 16px;
          flex-wrap: wrap;
        }
        .search-form label:first-child {
          flex: 1;
          min-width: 220px;
        }
        .admin-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        section {
          padding: 18px;
          background: #fff;
          border: 1px solid #bbb;
          overflow-wrap: anywhere;
        }
        .table-scroll {
          overflow-x: auto;
        }
        table {
          width: 100%;
          min-width: 580px;
          border-collapse: collapse;
          font-size: 14px;
        }
        td:first-child {
          min-width: 160px;
        }
        th,
        td {
          text-align: left;
          padding: 10px 8px;
          border-bottom: 1px solid #ddd;
        }
        th {
          white-space: nowrap;
        }
        fieldset {
          border: 0;
          padding: 0;
        }
        .confirmation {
          background: #fbf4dd;
          margin-top: 18px;
        }
        dl div {
          display: flex;
          gap: 14px;
        }
        dt {
          font-weight: bold;
          min-width: 70px;
        }
        ul {
          padding-left: 20px;
        }
        li {
          margin: 8px 0;
        }
        [role='alert'] {
          padding: 14px;
          background: #f9e6e1;
        }
        [role='status'] {
          padding: 14px;
          background: #e9f1e8;
        }
        @media (max-width: 900px) {
          .admin-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          h1 {
            font-size: 29px;
          }
          .accounts-admin {
            padding: 22px 12px;
          }
        }
      `}</style>
    </main>
  );
}
