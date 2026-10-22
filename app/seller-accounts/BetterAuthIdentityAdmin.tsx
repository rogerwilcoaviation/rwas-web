'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createAuthClient } from 'better-auth/client';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { SELLER_API } from '@/lib/seller-api';

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
    return 'Identity administration requires a separately authorized identity account and completed multi-factor verification. Sign in and verify under Seller Account, then load identity accounts again.';
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
}: {
  canManage: boolean;
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
  return enabled ? <IdentityDirectory canManage={canManage} /> : null;
}

function IdentityDirectory({ canManage }: { canManage: boolean }) {
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
    <section aria-label="Identity account administration">
      <h2>Identity accounts</h2>
      <p>
        Identity administrator authorization and multi-factor verification are
        checked separately from seller account access.
      </p>
      <form onSubmit={search}>
        <label>
          Search identity email
          <input
            value={query}
            maxLength={254}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button disabled={busy} type="submit">
          Load identity accounts
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <p>{total} matching identity accounts</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Identity</th>
              <th>Email verification</th>
              <th>Sign-in</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.name}
                  <br />
                  {user.email}
                  <br />
                  ID: {user.id}
                </td>
                <td>{user.emailVerified ? 'Verified' : 'Unverified'}</td>
                <td>{user.banned ? 'Suspended' : 'Available'}</td>
                <td>
                  <button disabled={busy} onClick={() => void open(user)}>
                    View identity {user.id}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {offset > 0 ? (
        <button
          disabled={busy}
          onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous identity page
        </button>
      ) : null}
      {offset + PAGE_SIZE < total ? (
        <button disabled={busy} onClick={() => void load(offset + PAGE_SIZE)}>
          Next identity page
        </button>
      ) : null}
      {selected ? (
        <section aria-label="Selected identity account">
          <h3>{selected.email}</h3>
          <p>Identity ID: {selected.id}</p>
          <button
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
            disabled={busy || !canManage}
            onClick={() =>
              setPending({ user: selected, operation: 'revoke-all' })
            }
          >
            Review all identity session revocation
          </button>
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                Session ID: {session.id} · started {date(session.createdAt)} ·
                expires {date(session.expiresAt)}{' '}
                <button
                  disabled={busy || !canManage}
                  onClick={() =>
                    setPending({
                      user: selected,
                      operation: 'revoke-one',
                      session,
                    })
                  }
                >
                  Review revocation of identity session {session.id}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pending ? (
        <section aria-label="Confirm identity operation">
          <h3>Confirm {labels[pending.operation].toLowerCase()}</h3>
          <p>Target identity: {pending.user.id}</p>
          <p>Email: {pending.user.email}</p>
          {pending.session ? (
            <p>Target session ID: {pending.session.id}</p>
          ) : null}
          <p>
            {pending.operation === 'ban'
              ? 'This suspends identity sign-in and revokes its active sessions.'
              : pending.operation === 'unban'
                ? 'This permits identity sign-in again. Separate seller account holds remain in effect.'
                : pending.operation === 'revoke-all'
                  ? 'Every identity session for this user will be signed out.'
                  : 'Only the identified identity session will be signed out.'}
          </p>
          <button disabled={busy || !canManage} onClick={() => void apply()}>
            Confirm identity operation
          </button>
          <button disabled={busy} onClick={() => setPending(null)}>
            Cancel identity operation
          </button>
        </section>
      ) : null}
    </section>
  );
}
