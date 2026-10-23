'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { scheduleAbsoluteDeadline } from '../seller-accounts/authority-deadline';

type Administrator = {
  id: string;
  email: string;
  name: string;
  role: 'super-admin' | 'admin' | 'user';
  verified: boolean;
  suspended: boolean;
  mfaEnabled: boolean;
  revision: string;
};
type Directory = {
  administrators: Administrator[];
  candidate: Administrator | null;
  canManage: boolean;
  manageUntil: number;
};
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export default function AdministratorManagement({
  request,
}: {
  request: Request;
}) {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<{
    user: Administrator;
    action: 'grant' | 'revoke';
  } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!directory?.canManage) return;
    return scheduleAbsoluteDeadline(directory.manageUntil, () => {
      setDirectory((old) => (old ? { ...old, canManage: false } : old));
      setPending(null);
    });
  }, [directory?.canManage, directory?.manageUntil]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Reload administrators to check the current access.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function load(query = '') {
    const result = (await request(
      '/admin/administrators' +
        (query ? '?email=' + encodeURIComponent(query) : ''),
    )) as Directory;
    setDirectory(result);
    setPending(null);
    setConfirmation('');
    if (query && !result.candidate)
      setNotice(
        'No registered account found. Ask this person to create an account and verify their email, then search again.',
      );
  }
  function choose(user: Administrator, action: 'grant' | 'revoke') {
    setPending({ user, action });
    setConfirmation('');
    setError('');
    setNotice('');
  }
  function candidate(user: Administrator) {
    return (
      <article key={user.id}>
        <h4>{user.name || user.email}</h4>
        <p>{user.email}</p>
        <p>
          {user.role === 'super-admin'
            ? 'Super administrator · Protected owner account'
            : user.role === 'admin'
              ? 'Administrator'
              : 'Registered user'}
        </p>
        <p>
          {user.suspended
            ? 'Sign-in suspended'
            : !user.verified
              ? 'Email verification required'
              : user.mfaEnabled
                ? 'Two-factor authentication enabled'
                : 'Two-factor authentication required before administrator access'}
        </p>
        {user.role === 'user' && (
          <button
            disabled={
              busy || !directory?.canManage || !user.verified || user.suspended
            }
            onClick={() => choose(user, 'grant')}
          >
            Add administrator
          </button>
        )}
        {user.role === 'admin' && (
          <button
            disabled={busy || !directory?.canManage}
            onClick={() => choose(user, 'revoke')}
          >
            Remove administrator access
          </button>
        )}
      </article>
    );
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    if (!pending) return;
    const change = pending;
    void run(async () => {
      await request('/admin/administrators', 'POST', {
        id: change.user.id,
        action: change.action,
        revision: change.user.revision,
        confirmEmail: confirmation,
      });
      await load();
      setNotice(
        change.action === 'grant'
          ? 'Administrator added. They must sign in and complete two-factor authentication before using administrator tools.'
          : 'Administrator access removed. This person retains their regular user account.',
      );
    });
  }
  return (
    <section aria-label="Administrator management">
      <h3>Administrators</h3>
      <p>
        The original admin@rwas.team account is the protected super
        administrator. Only this account can add or remove administrators and
        manage other administrators.
      </p>
      <p>
        Administrators can approve, edit and delete listings, manage customer
        accounts, and provide customer support. They cannot add administrators
        or change another administrator’s account.
      </p>
      <button disabled={busy} onClick={() => void run(() => load())}>
        Load administrators
      </button>
      {directory && !directory.canManage && (
        <p role="status">
          Read-only access. Sign out and sign in again with two-factor
          authentication to change administrators.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => load(email.trim()));
        }}
      >
        <label>
          Find a registered user by email
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p>
          The person must first create an account and verify their email. You do
          not need their password.
        </p>
        <button disabled={busy}>Find account</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {pending && (
        <form onSubmit={apply} aria-label="Confirm administrator change">
          <h4>
            {pending.action === 'grant'
              ? 'Confirm administrator access'
              : 'Confirm removal of administrator access'}
          </h4>
          <p>
            {pending.user.email} will{' '}
            {pending.action === 'grant'
              ? 'receive administrator permissions after completing two-factor authentication'
              : 'lose all administrator permissions immediately'}
            .
          </p>
          <label>
            Type the account email to confirm
            <input
              type="email"
              required
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button
            disabled={
              busy ||
              !directory?.canManage ||
              confirmation !== pending.user.email
            }
          >
            Confirm{' '}
            {pending.action === 'grant' ? 'add administrator' : 'remove access'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {directory?.candidate && (
        <div aria-label="Account search result">
          {candidate(directory.candidate)}
        </div>
      )}
      {directory && (
        <div aria-label="Current administrators">
          <h4>Current administrators</h4>
          {directory.administrators.map(candidate)}
        </div>
      )}
      <style jsx>{`
        section {
          font-family: Arial, sans-serif;
        }
        form,
        article {
          padding: 18px 0;
          border-bottom: 1px solid #c5bfae;
        }
        label {
          display: grid;
          gap: 8px;
          font-weight: 600;
        }
        input {
          width: 100%;
          max-width: 480px;
          padding: 12px;
          box-sizing: border-box;
        }
        button {
          padding: 10px 14px;
          margin: 8px 8px 8px 0;
        }
        p {
          overflow-wrap: anywhere;
        }
      `}</style>
    </section>
  );
}
