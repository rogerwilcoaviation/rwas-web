'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { marketplaceStaffFetch } from '@/lib/marketplace-staff-fetch';
import {
  AccountSection,
  AccountWorkspace,
} from '@/components/shared/AccountWorkspace';
import { scheduleAbsoluteDeadline } from './authority-deadline';
import BetterAuthIdentityAdmin from './BetterAuthIdentityAdmin';

type Summary = {
  id: string;
  email: string;
  name: string;
  status: string;
  adminSuspended: boolean;
  adminDeleted?: boolean;
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
type Operation =
  | 'update-profile'
  | 'suspend'
  | 'reinstate'
  | 'revoke-sessions'
  | 'delete-account'
  | 'restore-account';
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
  'delete-account': 'Delete user account',
  'restore-account': 'Restore user account',
};
const reasons = {
  'support-request': 'Customer support request',
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
  const r = await marketplaceStaffFetch('/admin/accounts' + path, {
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
export default function SellerAccounts({
  allowIdentityAdministration = true,
}: {
  allowIdentityAdministration?: boolean;
}) {
  const [adminSection, setAdminSection] = useState('directory');
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
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const focusSelected = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (focusSelected.current && selected && adminSection === 'details') {
      const trigger = focusSelected.current;
      focusSelected.current = null;
      if (
        document.activeElement === trigger ||
        document.activeElement === document.body
      ) {
        selectedHeading.current?.focus();
      }
    }
  }, [selected, adminSection]);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const previewFocus = useRef<{
    trigger: HTMLButtonElement;
    accountId: string;
    inputId: string;
    generation: number;
    authority: Authority | null;
  } | null>(null);
  const focusRequest = useRef<'confirmation' | 'return' | null>(null);
  useLayoutEffect(() => {
    const focus = previewFocus.current;
    if (!focus) return;
    if (
      focus.generation !== generation.current ||
      focus.accountId !== selected?.id ||
      focus.authority !== authority ||
      !authority?.canManage ||
      authority.expiresAt <= Date.now() ||
      (authority.manageUntil !== null && authority.manageUntil <= Date.now()) ||
      !focus.trigger.isConnected
    ) {
      previewFocus.current = null;
      focusRequest.current = null;
      return;
    }
    if (busy) return;
    if (
      focusRequest.current === 'confirmation' &&
      pending?.input.id === focus.inputId
    ) {
      focusRequest.current = null;
      confirmationHeading.current?.focus();
    } else if (
      focusRequest.current === 'return' &&
      !pending &&
      !focus.trigger.matches(':disabled')
    ) {
      previewFocus.current = null;
      focusRequest.current = null;
      focus.trigger.focus();
    }
  }, [authority, busy, pending, selected?.id]);
  function clearPrivate() {
    setAdminSection('directory');
    focusSelected.current = null;
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
      previewFocus.current = null;
      focusRequest.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!authority) return;
    const cancelExpiry = scheduleAbsoluteDeadline(authority.expiresAt, () => {
      clearPrivate();
      setError(
        'Administrator access expired. Sign in again and load accounts.',
      );
    });
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
      cancelExpiry();
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
    setAdminSection('directory');
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
    const trigger = document.activeElement;
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
      if (await detail(id, g)) {
        focusSelected.current = trigger;
        setAdminSection('details');
      }
    } catch (e) {
      if (g === generation.current) failure(e);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function preview(operation: Operation, trigger: HTMLButtonElement) {
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
    previewFocus.current = {
      trigger,
      accountId: selected.id,
      inputId: input.id,
      generation: g,
      authority,
    };
    focusRequest.current = 'confirmation';
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
      if (g === generation.current) {
        previewFocus.current = null;
        focusRequest.current = null;
        failure(e);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  function cancelPreview() {
    focusRequest.current = 'return';
    setPending(null);
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
        <h1>User accounts</h1>
        <p>Find a user, review account activity, and manage sign-in access.</p>
      </header>
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
      <AccountWorkspace
        label="Admin index"
        value={adminSection}
        onValueChange={setAdminSection}
        disabled={busy || !!pending}
        items={[
          { value: 'directory', label: 'Account directory' },
          {
            value: 'details',
            label: 'Contact and access',
            disabled: !selected,
          },
          { value: 'listings', label: 'User listings', disabled: !selected },
          { value: 'sessions', label: 'Active sessions', disabled: !selected },
          {
            value: 'activity',
            label: 'Administrator activity',
            disabled: !selected,
          },
          ...(allowIdentityAdministration
            ? [
                {
                  value: 'identity',
                  label: 'Identity accounts',
                  disabled: !authority,
                },
              ]
            : []),
        ]}
      >
        <AccountSection value="directory">
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
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
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
          <section aria-label="Account directory">
            <h2>Account directory</h2>
            <p>{total} matching accounts</p>
            <p>Choose View to open a user in the account index.</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
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
                        {r.name || 'Unnamed user'}
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
        </AccountSection>
        {selected ? (
          <div
            role="region"
            aria-label="Selected account"
            hidden={adminSection === 'directory' || adminSection === 'identity'}
          >
            <h2 ref={selectedHeading} tabIndex={-1}>
              {selected.name || 'Unnamed user'}
            </h2>
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
            <AccountSection value="details">
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
                <button
                  onClick={(e) =>
                    void preview('update-profile', e.currentTarget)
                  }
                >
                  Preview contact update
                </button>
                <button
                  onClick={(e) =>
                    void preview(
                      selected.adminSuspended ? 'reinstate' : 'suspend',
                      e.currentTarget,
                    )
                  }
                >
                  {selected.adminSuspended
                    ? 'Preview reinstatement'
                    : 'Preview suspension'}
                </button>
                <button
                  onClick={(e) =>
                    void preview('revoke-sessions', e.currentTarget)
                  }
                >
                  Preview session revocation
                </button>
                <button
                  onClick={(e) =>
                    void preview(
                      selected.adminDeleted
                        ? 'restore-account'
                        : 'delete-account',
                      e.currentTarget,
                    )
                  }
                >
                  {selected.adminDeleted
                    ? 'Preview account restoration'
                    : 'Preview account deletion'}
                </button>
                <p>
                  Deleting a user revokes sign-in and moves their listings to
                  trash. Records remain recoverable; restoring the user does not
                  republish listings.
                </p>
              </fieldset>
              {pending ? (
                <section
                  aria-label="Confirm account operation"
                  className="confirmation"
                >
                  <h3 ref={confirmationHeading} tabIndex={-1}>
                    Confirm {labels[pending.input.operation].toLowerCase()}
                  </h3>
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
                  <p>
                    {pending.input.operation === 'delete-account'
                      ? 'This account will lose sign-in access and its listings will move to trash. Files are retained for recovery.'
                      : pending.input.operation === 'restore-account'
                        ? 'Sign-in access is restored subject to other security holds. Listings remain in trash.'
                        : 'Listings, media and ownership stay unchanged.'}
                  </p>
                  {pending.preview.securityHoldRemains ? (
                    <p>The separate security hold remains in effect.</p>
                  ) : null}
                  <button
                    disabled={busy || !authority?.canManage}
                    onClick={() => void apply()}
                  >
                    Confirm operation
                  </button>
                  <button disabled={busy} onClick={cancelPreview}>
                    Cancel operation
                  </button>
                </section>
              ) : null}
            </AccountSection>
            <AccountSection value="listings">
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
            </AccountSection>
            <AccountSection value="sessions">
              <h3>Active sessions</h3>
              <ul>
                {selected.sessions.map((s, i) => (
                  <li key={`${s.createdAt}:${i}`}>
                    {s.method} · started {time(s.createdAt)} · expires{' '}
                    {time(s.expiresAt)}
                  </li>
                ))}
              </ul>
            </AccountSection>
            <AccountSection value="activity">
              <h3>Administrator activity</h3>
              {audit.length ? (
                <ul>
                  {audit.map((a) => (
                    <li key={a.operationId}>
                      {time(a.at)} · {a.actor} · {a.operation} · {a.reasonCode}{' '}
                      · {a.revokedSessions} sessions revoked
                      {a.changedFields.length
                        ? ' · fields: ' + a.changedFields.join(', ')
                        : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No administrator operations recorded.</p>
              )}
            </AccountSection>
          </div>
        ) : null}
        <AccountSection value="identity">
          {authority && allowIdentityAdministration ? (
            <BetterAuthIdentityAdmin
              key={`${authority.actor}:${authority.expiresAt}`}
              canManage={authority.canManage}
            />
          ) : null}
        </AccountSection>
      </AccountWorkspace>
      <style jsx>{`
        .accounts-admin {
          width: 100%;
          min-width: 0;
          max-width: 1300px;
          margin: 0 auto;
          padding: 32px 20px;
          color: #1c1c1a;
          font-family: Arial, sans-serif;
          background: #f7f4ec;
          min-height: 65vh;
        }
        .accounts-admin :global(h1),
        .accounts-admin :global(h2),
        .accounts-admin :global(h3),
        .accounts-admin :global(h4),
        .accounts-admin :global(button),
        .accounts-admin :global(input),
        .accounts-admin :global(select),
        .accounts-admin :global(textarea) {
          font-family: Arial, sans-serif;
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
        button:focus-visible,
        input:focus-visible,
        select:focus-visible {
          outline: 3px solid #8a681b;
          outline-offset: 3px;
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
          min-width: min(220px, 100%);
        }
        section {
          padding: 0;
          background: #fff;
          border: 0;
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
          padding: 18px;
          border: 1px solid #d5cec1;
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
