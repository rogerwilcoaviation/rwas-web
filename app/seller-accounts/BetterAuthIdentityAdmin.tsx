'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createAuthClient } from 'better-auth/client';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { SELLER_API } from '@/lib/seller-api';
import {
  AdminListingStyles,
  ListingStatus,
} from '../aircraft-for-sale/admin-listing-presentation';
import PermanentAccountRemoval from './PermanentAccountRemoval';

type Identity = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  banned?: boolean | null;
};
type IdentitySession = {
  id: string;
  token: string;
  createdAt: Date | string;
  expiresAt: Date | string;
};
type Pending = {
  user: Identity;
  operation: 'ban' | 'unban' | 'revoke-all' | 'revoke-one';
  session?: IdentitySession;
};
type Operator = { userId: string; sessionId: string };
const sameOperator = (left: Operator, right: Operator | null) =>
  right !== null &&
  left.userId === right.userId &&
  left.sessionId === right.sessionId;
const PAGE_SIZE = 20;
const labels: Record<Pending['operation'], string> = {
  ban: 'Suspend identity sign-in',
  unban: 'Reinstate identity sign-in',
  'revoke-all': 'Revoke all identity sessions',
  'revoke-one': 'Revoke identity session',
};
const date = (value: Date | string) => new Date(value).toLocaleString();

function failureMessage(error: unknown, mutation = false) {
  const status = (error as { status?: unknown })?.status;
  const code = (error as { code?: unknown })?.code;
  if (status === 401 || status === 403 || code === 'MFA_REQUIRED')
    return 'Identity administration requires a separately authorized identity account and completed multi-factor verification. Sign in and complete multi-factor verification, then load identity accounts again.';
  if (status === 429)
    return 'Too many requests. Wait before loading identity accounts again.';
  return mutation
    ? 'The identity operation could not be confirmed. Load identity accounts and check the target before attempting another change.'
    : 'Identity accounts could not be loaded. Please try again.';
}

// This component is mounted only after the existing Access-protected account
// directory has established administrator authority. Better Auth independently
// authorizes immutable identity IDs and MFA; an email match grants no authority.
export default function BetterAuthIdentityAdmin({
  canManage,
  onManageAccount,
}: {
  canManage: boolean;
  onManageAccount?: (email: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(SELLER_API + '/auth/methods', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (
          !response.ok ||
          response.redirected ||
          !response.headers.get('Content-Type')?.includes('application/json')
        )
          return;
        const value = await response.json();
        if (!controller.signal.aborted)
          setEnabled(
            Array.isArray(value?.methods) &&
              value.methods.includes('better-auth'),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return enabled ? (
    <IdentityDirectory
      canManage={canManage}
      onManageAccount={onManageAccount}
    />
  ) : (
    <p role="status">
      Identity administration is unavailable for the current sign-in service.
    </p>
  );
}

function IdentityDirectory({
  canManage,
  onManageAccount,
}: {
  canManage: boolean;
  onManageAccount?: (email: string) => void;
}) {
  const [client] = useState(() =>
    createAuthClient({
      baseURL: window.location.origin,
      basePath: SELLER_API + '/identity',
      plugins: [adminClient(), twoFactorClient()],
      fetchOptions: { credentials: 'same-origin' },
    }),
  );
  const [rows, setRows] = useState<Identity[]>([]);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Identity | null>(null);
  // The official administrator API requires the session token for revocation.
  // Keep it in component memory only; never render, persist, log or copy it.
  const [sessions, setSessions] = useState<IdentitySession[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const viewer = useRef<Operator | null>(null);

  function clearPrivate() {
    generation.current++;
    viewer.current = null;
    setRows([]);
    setTotal(0);
    setSelected(null);
    setSessions([]);
    setPending(null);
    setBusy(false);
  }
  useEffect(() => {
    // Capture the stable counter container without freezing its current value.
    const lifecycleGeneration = generation;
    const clear = () => {
      clearPrivate();
      setNotice(
        'Load identity accounts again to refresh administrator access.',
      );
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') clear();
    };
    window.addEventListener('focus', clear);
    document.addEventListener('visibilitychange', hide);
    return () => {
      lifecycleGeneration.current++;
      window.removeEventListener('focus', clear);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  useEffect(() => {
    if (!canManage) setPending(null);
  }, [canManage]);

  async function identity() {
    const result = await client.getSession({
      query: { disableCookieCache: true },
    });
    if (result.error) throw result.error;
    if (!result.data?.user?.id || !result.data.session?.id)
      throw { status: 401 };
    return {
      userId: result.data.user.id,
      sessionId: result.data.session.id,
    };
  }
  async function load(nextOffset = 0) {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setRows([]);
    setSelected(null);
    setSessions([]);
    setPending(null);
    try {
      const actor = await identity();
      if (g !== generation.current) return;
      viewer.current = actor;
      const result = await client.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: nextOffset,
          sortBy: 'createdAt',
          sortDirection: 'desc',
          ...(query.trim()
            ? {
                searchValue: query.trim(),
                searchField: 'email',
                searchOperator: 'contains',
              }
            : {}),
        },
      });
      if (g !== generation.current) return;
      if (result.error) throw result.error;
      if (!Array.isArray(result.data?.users)) throw { status: 502 };
      setRows(result.data.users);
      setTotal(result.data.total);
      setOffset(nextOffset);
    } catch (caught) {
      if (g !== generation.current) return;
      clearPrivate();
      setError(failureMessage(caught));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function open(user: Identity) {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setPending(null);
    setSelected(null);
    setSessions([]);
    try {
      const actor = await identity();
      if (g !== generation.current) return;
      if (!sameOperator(actor, viewer.current)) throw { status: 401 };
      const result = await client.admin.listUserSessions({ userId: user.id });
      if (g !== generation.current) return;
      if (result.error) throw result.error;
      if (!Array.isArray(result.data?.sessions)) throw { status: 502 };
      setSelected(user);
      setSessions(result.data.sessions);
    } catch (caught) {
      if (g !== generation.current) return;
      clearPrivate();
      setError(failureMessage(caught));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function apply() {
    if (!pending || !canManage || busy) return;
    const action = pending;
    const g = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const actor = await identity();
      if (g !== generation.current) return;
      const operator = viewer.current;
      if (!operator || !sameOperator(actor, operator)) throw { status: 401 };
      const fetchOptions = {
        headers: {
          'X-RWAS-Identity-User': operator.userId,
          'X-RWAS-Identity-Session': operator.sessionId,
        },
      };
      const result =
        action.operation === 'ban'
          ? await client.admin.banUser(
              {
                userId: action.user.id,
                banReason: 'RWAS account administrator action',
              },
              fetchOptions,
            )
          : action.operation === 'unban'
            ? await client.admin.unbanUser(
                { userId: action.user.id },
                fetchOptions,
              )
            : action.operation === 'revoke-all'
              ? await client.admin.revokeUserSessions(
                  { userId: action.user.id },
                  fetchOptions,
                )
              : action.session
                ? await client.admin.revokeUserSession(
                    { sessionToken: action.session.token },
                    fetchOptions,
                  )
                : { error: { status: 400 } };
      if (g !== generation.current) return;
      if (result.error) throw result.error;
      clearPrivate();
      setNotice(
        `${labels[action.operation]} completed for identity ${action.user.id}. Load identity accounts to review the current state.`,
      );
    } catch (caught) {
      if (g !== generation.current) return;
      clearPrivate();
      setError(failureMessage(caught, true));
    }
  }
  function search(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  return (
    <section
      className="admin-listing-panel identity-panel"
      aria-label="Identity account administration"
    >
      <AdminListingStyles />
      <header className="admin-panel-heading">
        <div>
          <h2>Identity accounts</h2>
          <p>
            Review registered sign-in accounts, email verification and active
            sessions. Use the account controls below to manage access or review
            permanent removal.
          </p>
        </div>
      </header>
      <form className="identity-search" onSubmit={search}>
        <label>
          Search identity email
          <input
            value={query}
            maxLength={254}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email address"
          />
        </label>
        <button className="admin-button" disabled={busy} type="submit">
          Load identity accounts
        </button>
      </form>
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
      <p className="admin-muted">{total} matching identity accounts</p>
      <div className="admin-listing-list">
        {rows.map((user) => (
          <article
            className="admin-listing-card"
            key={user.id}
            aria-label={'Identity ' + user.email}
          >
            <header className="admin-card-heading">
              <div>
                <h3 className="admin-card-title">
                  {user.name || 'Unnamed user'}
                </h3>
                <p>{user.email}</p>
                <p className="admin-muted identity-id">
                  Identity ID: {user.id}
                </p>
              </div>
              <ListingStatus status={user.banned ? 'suspended' : 'active'} />
            </header>
            <div className="identity-row-actions">
              <p>
                {user.emailVerified ? 'Email verified' : 'Email not verified'}
              </p>
              <button
                className="admin-button"
                disabled={busy}
                onClick={() => void open(user)}
                aria-label={'View identity ' + user.id}
              >
                View account
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="admin-action-row">
        {offset > 0 && (
          <button
            className="admin-button"
            disabled={busy}
            onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous identity page
          </button>
        )}
        {offset + PAGE_SIZE < total && (
          <button
            className="admin-button"
            disabled={busy}
            onClick={() => void load(offset + PAGE_SIZE)}
          >
            Next identity page
          </button>
        )}
      </div>
      {selected && (
        <section
          className="identity-selected"
          aria-label="Selected identity account"
        >
          <h3>{selected.email}</h3>
          <p className="admin-muted identity-id">Identity ID: {selected.id}</p>
          <div className="admin-action-row">
            <button
              className="admin-button"
              disabled={busy || !canManage}
              onClick={() =>
                setPending({
                  user: selected,
                  operation: selected.banned ? 'unban' : 'ban',
                })
              }
            >
              {selected.banned
                ? 'Review identity reinstatement'
                : 'Review identity suspension'}
            </button>
            <button
              className="admin-button"
              disabled={busy || !canManage}
              onClick={() =>
                setPending({ user: selected, operation: 'revoke-all' })
              }
            >
              Review all identity session revocation
            </button>
            {onManageAccount && (
              <button
                className="admin-button"
                disabled={busy}
                onClick={() => onManageAccount(selected.email)}
              >
                Open marketplace account
              </button>
            )}
          </div>
          <h4>Active sign-in sessions</h4>
          {!sessions.length && (
            <p className="admin-empty">This identity has no active sessions.</p>
          )}
          <div className="identity-sessions">
            {sessions.map((session) => (
              <article className="identity-session" key={session.id}>
                <p className="identity-id">Session ID: {session.id}</p>
                <dl>
                  <div>
                    <dt>Started</dt>
                    <dd>{date(session.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{date(session.expiresAt)}</dd>
                  </div>
                </dl>
                <button
                  className="admin-button"
                  disabled={busy || !canManage}
                  onClick={() =>
                    setPending({
                      user: selected,
                      operation: 'revoke-one',
                      session,
                    })
                  }
                  aria-label={
                    'Review revocation of identity session ' + session.id
                  }
                >
                  Review session revocation
                </button>
              </article>
            ))}
          </div>
          {!pending && (
            <PermanentAccountRemoval
              key={selected.id}
              target={{ identityId: selected.id }}
              canManage={canManage && !busy}
              onComplete={() => void load(offset)}
            />
          )}
        </section>
      )}
      {pending && (
        <section
          className="identity-confirm"
          aria-label="Confirm identity operation"
        >
          <h3>Confirm {labels[pending.operation].toLowerCase()}</h3>
          <p>Target identity: {pending.user.id}</p>
          <p>Email: {pending.user.email}</p>
          {pending.session && <p>Target session ID: {pending.session.id}</p>}
          <p>
            {pending.operation === 'ban'
              ? 'This suspends identity sign-in and revokes its active sessions.'
              : pending.operation === 'unban'
                ? 'This permits identity sign-in again. Separate marketplace account holds remain in effect.'
                : pending.operation === 'revoke-all'
                  ? 'Every identity session for this user will be signed out.'
                  : 'Only the identified identity session will be signed out.'}
          </p>
          <div className="admin-action-row">
            <button
              className="admin-button admin-primary"
              disabled={busy || !canManage}
              onClick={() => void apply()}
            >
              Confirm identity operation
            </button>
            <button
              className="admin-button"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel identity operation
            </button>
          </div>
        </section>
      )}
      <style jsx>{`
        .identity-panel {
          min-width: 0;
          font:
            15px/1.6 Arial,
            sans-serif;
        }
        .identity-search {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: end;
          margin: 20px 0;
        }
        .identity-search label {
          display: grid;
          gap: 8px;
          flex: 1;
          min-width: min(240px, 100%);
          font-weight: 600;
        }
        .identity-search input {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #8e877b;
          border-radius: 4px;
          background: white;
          color: #25251f;
          font:
            15px/1.5 Arial,
            sans-serif;
        }
        .identity-search input:focus-visible {
          outline: 3px solid #8b6c0a;
          outline-offset: 3px;
        }
        .identity-panel p {
          margin: 8px 0;
          overflow-wrap: anywhere;
        }
        .identity-id {
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .identity-row-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .identity-selected {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid #d5cec1;
        }
        .identity-sessions {
          display: grid;
          gap: 12px;
        }
        .identity-session {
          padding: 16px;
          border: 1px solid #d5cec1;
          border-radius: 4px;
          background: #faf8f3;
        }
        .identity-session dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin: 12px 0;
        }
        .identity-session dt {
          font-size: 13px;
          font-weight: 600;
          color: #6d665a;
        }
        .identity-session dd {
          margin: 4px 0;
          overflow-wrap: anywhere;
        }
        .identity-confirm {
          margin-top: 24px;
          padding: 20px;
          border: 1px solid #c9ac5b;
          background: #fff9e8;
        }
        @media (max-width: 680px) {
          .identity-search button {
            width: 100%;
          }
          .identity-session dl {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
