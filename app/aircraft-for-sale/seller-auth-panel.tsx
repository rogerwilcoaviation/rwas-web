/* eslint-disable @next/next/no-img-element -- Authenticated blob previews cannot use the public image optimizer. */
'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SELLER_API } from '@/lib/seller-api';

type Session = { token: string; email: string; name: string };
type Media = {
  key: string;
  name: string;
  category: string;
  type: string;
  size: number;
};
type Listing = {
  id: string;
  status: string;
  revision: number;
  photos: Media[];
  videos: Media[];
  logbooks: Record<string, Media[]>;
  reviewNote?: string;
  [key: string]: unknown;
};
type IdentityMethod = 'password' | 'google' | 'apple';
const methodLabels: Record<IdentityMethod, string> = {
  password: 'Email and password',
  google: 'Google',
  apple: 'Apple',
};
type Account = {
  loginMethods?: IdentityMethod[];
  profile: { email: string; name: string; phone: string; location: string };
  sessions: {
    id: string;
    current: boolean;
    createdAt: number;
    expiresAt: number;
  }[];
};
const key = 'rwas_sale_v2';
const identityKey = 'rwas_sale_identity';
const inputs: [string, string, string?][] = [
  ['make', 'Make'],
  ['model', 'Model'],
  ['year', 'Year', 'number'],
  ['price', 'Asking price (USD)', 'number'],
  ['nNumber', 'N-number'],
  ['serialNumber', 'Serial number'],
  ['totalTime', 'Airframe total time'],
  ['engineTime', 'Engine time'],
  ['engineModel', 'Engine model'],
  ['propTime', 'Propeller time'],
  ['propModel', 'Propeller model'],
  ['sellerName', 'Seller name'],
  ['sellerPhone', 'Seller phone'],
  ['sellerLocation', 'Location'],
  ['annualDue', 'Annual due'],
  ['usefulLoad', 'Useful load'],
  ['fuelCapacity', 'Fuel capacity'],
  ['cruiseSpeed', 'Cruise speed'],
  ['range', 'Range'],
];
const longInputs: [string, string][] = [
  ['description', 'Description'],
  ['avionics', 'Avionics'],
  ['equipmentList', 'Equipment list'],
  ['damageHistory', 'Damage history'],
];
const categories: [string, string][] = [
  ['photos', 'Photos'],
  ['videos', 'Videos'],
  ['airframe', 'Airframe logbooks'],
  ['powerplant', 'Powerplant logbooks'],
  ['propeller', 'Propeller logbooks'],
  ['adSbCompliance', 'AD / SB compliance'],
  ['misc', 'Other records'],
];

export default function SellerAuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [identityMethods, setIdentityMethods] = useState<IdentityMethod[]>([]);
  const [emailCodeLogin, setEmailCodeLogin] = useState(false);
  const [view, setView] = useState<
    'login' | 'listings' | 'edit' | 'account' | null
  >(null);
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false);
  const [savedDraft, setSavedDraft] = useState<Record<string, unknown> | null>(
    null,
  );
  const [items, setItems] = useState<Listing[]>([]),
    [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState<Record<string, string>>({}),
    [account, setAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState(''),
    [emailCode, setEmailCode] = useState(''),
    [emailSent, setEmailSent] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    submission = useRef(crypto.randomUUID());
  const setAuth = (s: Session | null) => {
    setSession(s);
    if (s) sessionStorage.setItem(key, JSON.stringify(s));
    else sessionStorage.removeItem(key);
    // Compatibility envelope shared with the listing widget; no token logging.
    (window as unknown as { rwasSaleSession: Session | null }).rwasSaleSession =
      s;
    document.dispatchEvent(
      new CustomEvent('rwas:session-changed', { detail: s }),
    );
  };
  useEffect(() => {
    localStorage.removeItem('rwas_sale_session'); // Legacy sessions are not accepted by v2.
    try {
      const s = JSON.parse(
        sessionStorage.getItem(key) || 'null',
      ) as Session | null;
      if (s?.token && s.email) setAuth(s);
    } catch {
      sessionStorage.removeItem(key);
    }
    void fetch(SELLER_API + '/auth/methods', { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setIdentityMethods(
            (data.methods || []).filter((value: string) =>
              ['password', 'google', 'apple'].includes(value),
            ),
          );
          setEmailCodeLogin(data.emailCode === true);
        }
      })
      .catch(() => {});
    const callback = new URL(window.location.href);
    if (
      callback.searchParams.has('state') &&
      (callback.searchParams.has('code') || callback.searchParams.has('error'))
    ) {
      const state = callback.searchParams.get('state'),
        authorizationCode = callback.searchParams.get('code'),
        providerError = callback.searchParams.get('error');
      for (const name of ['state', 'code', 'error', 'error_description'])
        callback.searchParams.delete(name);
      history.replaceState(
        null,
        '',
        callback.pathname + callback.search + callback.hash,
      );
      let pending: { state: string; proof: string; link: boolean } | null =
        null;
      try {
        pending = JSON.parse(sessionStorage.getItem(identityKey) || 'null');
      } catch {
        /* Invalid local transaction. */
      }
      sessionStorage.removeItem(identityKey);
      if (!pending || pending.state !== state) {
        setError(
          'Sign-in was started in another tab or expired. Please try again.',
        );
        setView('login');
      } else {
        setBusy(true);
        void fetch(SELLER_API + '/auth/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            code: authorizationCode,
            error: providerError,
            proof: pending.proof,
          }),
        })
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok)
              throw Error(data.error || 'Sign-in could not be completed.');
            setAuth({
              token: data.session,
              email: data.email,
              name: data.name,
            });
            setMessage(
              pending?.link ? 'Login method connected.' : 'Signed in.',
            );
            setView(null);
          })
          .catch((error) => {
            setError(
              error instanceof Error
                ? error.message
                : 'Sign-in could not be completed.',
            );
            setView('login');
          })
          .finally(() => setBusy(false));
      }
    }
    const login = () => {
      setView('login');
      setSent(false);
      setError('');
    };
    const draft = (event: Event) => {
      const current = (window as unknown as { rwasSaleSession?: Session })
        .rwasSaleSession;
      if (!current) {
        login();
        return;
      }
      const details = (event as CustomEvent).detail || {};
      setEditing(null);
      submission.current = crypto.randomUUID();
      setForm(
        Object.fromEntries(
          [...inputs, ...longInputs].map(([k]) => [
            k,
            String(details[k] ?? ''),
          ]),
        ),
      );
      setView('edit');
      setMessage(
        'Review these details from Jerry. Save a private draft, then submit it for review.',
      );
    };
    document.addEventListener('rwas:seller-draft', draft);
    document.addEventListener('rwas:open-seller-login', login);
    return () => {
      document.removeEventListener('rwas:open-seller-login', login);
      document.removeEventListener('rwas:seller-draft', draft);
    };
  }, []);
  useEffect(() => {
    if (view && !dialog.current?.open) dialog.current?.showModal();
    else if (!view && dialog.current?.open) dialog.current.close();
  }, [view]);
  async function api(
    path: string,
    method = 'GET',
    body?: unknown,
    extra?: Record<string, string>,
  ) {
    const resp = await fetch(SELLER_API + path, {
      method,
      cache: 'no-store',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await resp.json();
    if (resp.status === 401) {
      setAuth(null);
      setView('login');
      setSent(false);
    }
    if (!resp.ok)
      throw Error(data.error || 'The request could not be completed.');
    return data;
  }
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function beginIdentity(method: IdentityMethod, link = false) {
    await perform(async () => {
      const proof =
        crypto.randomUUID().replaceAll('-', '') +
        crypto.randomUUID().replaceAll('-', '');
      const data = await api('/auth/start', 'POST', { method, proof, link });
      sessionStorage.setItem(
        identityKey,
        JSON.stringify({ state: data.state, proof, link }),
      );
      window.location.assign(data.authorizationUrl);
    });
  }
  async function load() {
    const data = await api('/my-listings');
    setItems(data.listings);
    setSavedDraft((await api('/draft')).draft);
    return data.listings as Listing[];
  }
  async function openListings() {
    if (!session) {
      setView('login');
      return;
    }
    setView('listings');
    await perform(async () => {
      await load();
    });
  }
  function edit(l: Listing | null) {
    setEditing(l);
    submission.current = crypto.randomUUID();
    setForm(
      Object.fromEntries(
        [...inputs, ...longInputs].map(([k]) => [k, String(l?.[k] ?? '')]),
      ),
    );
    setView('edit');
  }
  async function save() {
    const values = Object.fromEntries(
      Object.entries(form).filter(([, v]) => editing || v.trim() !== ''),
    );
    const data = await api(
      editing ? '/listings/' + editing.id : '/listings',
      editing ? 'PUT' : 'POST',
      values,
      editing ? undefined : { 'Idempotency-Key': submission.current },
    );
    setEditing(data.listing);
    setMessage('Draft saved. Add media, then submit for review.');
    await load();
  }
  async function status(l: Listing, next: string) {
    await api('/listing/' + l.id + '/status', 'POST', { status: next });
    await load();
    setMessage(
      next === 'pending'
        ? 'Submitted for private RWAS review. It will not be published during this intake launch.'
        : 'Listing updated.',
    );
  }
  const onSubmit = (fn: () => Promise<void>) => (e: FormEvent) => {
    e.preventDefault();
    void perform(fn);
  };
  async function openAccount() {
    setView('account');
    await perform(async () => setAccount(await api('/account')));
  }
  async function jerry() {
    if (!session) {
      setView('login');
      return;
    }
    const w = window as unknown as { jerryChat?: (s: string) => void };
    if (w.jerryChat) {
      setView(null);
      w.jerryChat('I want to list my aircraft for sale.');
    } else {
      setMessage('Jerry is unavailable. You can start with the manual form.');
      await openListings();
    }
  }
  const row = (name: string, label: string, type = 'text') => (
    <label key={name} className="seller-field">
      {label}
      <input
        name={name}
        type={type}
        value={form[name] || ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        maxLength={300}
        min={type === 'number' ? 1 : undefined}
      />
    </label>
  );
  return (
    <>
      <button className="a4s-cta-btn" onClick={() => void jerry()}>
        List Your Aircraft
      </button>
      <button
        className="a4s-cta-btn secondary"
        onClick={() => void openListings()}
      >
        {session ? 'My Listings' : 'Seller Login'}
      </button>
      {session && (
        <>
          <button
            className="a4s-cta-btn secondary"
            onClick={() => void openAccount()}
          >
            Account
          </button>
          <button
            className="a4s-cta-btn secondary"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const result = await api('/logout', 'POST');
                sessionStorage.removeItem(identityKey);
                setAuth(null);
                setView(null);
                if (result.logoutUrl) window.location.assign(result.logoutUrl);
              })
            }
          >
            Sign Out
          </button>
        </>
      )}
      <dialog
        ref={dialog}
        className="seller-dialog"
        aria-labelledby="seller-title"
        onCancel={() => setView(null)}
      >
        <header>
          <h2 id="seller-title">
            {view === 'login'
              ? 'Seller Login'
              : view === 'account'
                ? 'Your Account'
                : view === 'edit'
                  ? 'Listing Draft'
                  : 'My Listings'}
          </h2>
          <button
            type="button"
            aria-label="Close seller panel"
            onClick={() => setView(null)}
          >
            Close
          </button>
        </header>
        {error && (
          <p role="alert" className="seller-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {view === 'login' && (
          <>
            {identityMethods.length > 0 && (
              <nav aria-label="Sign-in methods">
                {identityMethods.map((method) => (
                  <button
                    key={method}
                    disabled={busy}
                    onClick={() => void beginIdentity(method)}
                  >
                    {method === 'password'
                      ? methodLabels[method]
                      : 'Continue with ' + methodLabels[method]}
                  </button>
                ))}
                <p>
                  Create an account or recover your password on the secure
                  sign-in page.
                </p>
              </nav>
            )}
            {emailCodeLogin && (
              <form
                onSubmit={onSubmit(async () => {
                  if (!sent) {
                    await api('/send-code', 'POST', { email });
                    setSent(true);
                    setMessage('Code sent. Check your inbox.');
                  } else {
                    const d = await api('/check-code', 'POST', { email, code });
                    setAuth({ token: d.session, email: d.email, name: d.name });
                    setSent(false);
                    setCode('');
                    setView(null);
                  }
                })}
              >
                <p>
                  Sign in with a one-time email code. No password required.
                  Codes expire after 15 minutes; sessions expire after 24 hours.
                </p>
                <label className="seller-field">
                  Email
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={sent}
                  />
                </label>
                {sent && (
                  <label className="seller-field">
                    Verification code
                    <input
                      id="login-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                )}
                <button disabled={busy}>
                  {busy
                    ? 'Please wait…'
                    : sent
                      ? 'Verify & Sign In'
                      : 'Send Code'}
                </button>
                {sent && (
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setCode('');
                    }}
                  >
                    Use different email
                  </button>
                )}
              </form>
            )}
          </>
        )}
        {view === 'listings' && (
          <>
            <nav>
              <button onClick={() => edit(null)}>New Manual Listing</button>
              <button onClick={() => void jerry()}>List with Jerry</button>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await load();
                  })
                }
              >
                Refresh
              </button>
            </nav>
            {savedDraft && (
              <button
                disabled={busy}
                onClick={() => {
                  if (savedDraft.intake) {
                    void jerry();
                  } else {
                    setEditing(null);
                    submission.current = crypto.randomUUID();
                    setForm(
                      Object.fromEntries(
                        [...inputs, ...longInputs].map(([k]) => [
                          k,
                          String(savedDraft[k] ?? ''),
                        ]),
                      ),
                    );
                    setView('edit');
                  }
                }}
              >
                Resume Saved Draft
              </button>
            )}
            {!items.length && !busy && (
              <p>No listings yet. Save a draft to get started.</p>
            )}
            {items.map((l) => (
              <article className="seller-listing" key={l.id}>
                <h3>
                  {String(l.year || '')} {String(l.make || 'New')}{' '}
                  {String(l.model || 'draft')}
                </h3>
                <p>
                  Status: <strong>{l.status}</strong>
                </p>
                {l.reviewNote && <p>{l.reviewNote}</p>}
                <div className="seller-actions">
                  {!['deleted', 'archived'].includes(l.status) && (
                    <button onClick={() => edit(l)}>Edit</button>
                  )}
                  {['draft', 'rejected'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'pending'))}
                    >
                      Submit for Review
                    </button>
                  )}
                  {l.status === 'active' && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'paused'))}
                    >
                      Pause
                    </button>
                  )}
                  {l.status === 'paused' && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'active'))}
                    >
                      Resume
                    </button>
                  )}
                  {['active', 'paused'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'sold'))}
                    >
                      Mark Sold
                    </button>
                  )}
                  {!['deleted', 'archived'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'archived'))}
                    >
                      Archive
                    </button>
                  )}
                  {['archived', 'deleted'].includes(l.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void perform(() => status(l, 'restore'))}
                    >
                      Restore to Draft
                    </button>
                  )}
                  {l.status !== 'deleted' ? (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Move this listing to trash? You can restore it as a draft.',
                          )
                        )
                          void perform(() => status(l, 'deleted'));
                      }}
                    >
                      Move to Trash
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Permanently delete this listing and all its files? This cannot be undone.',
                          )
                        )
                          void perform(async () => {
                            await api('/listings/' + l.id, 'DELETE', {
                              confirm: l.id,
                            });
                            await load();
                          });
                      }}
                    >
                      Delete Permanently
                    </button>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
        {view === 'edit' && (
          <>
            <form onSubmit={onSubmit(save)}>
              <p>
                Save your work as a private draft. Changes to listing details or
                media require a new review before publication.
              </p>
              <div className="seller-fields">
                {inputs.map(([k, l, t]) => row(k, l, t))}
              </div>
              {longInputs.map(([k, l]) => (
                <label key={k} className="seller-field">
                  {l}
                  <textarea
                    rows={4}
                    value={form[k] || ''}
                    maxLength={10000}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
              <button disabled={busy}>{busy ? 'Saving…' : 'Save Draft'}</button>
            </form>
            {editing ? (
              <>
                <SellerMedia
                  listing={editing}
                  session={session!}
                  onBusy={setBusy}
                  onChange={async () => {
                    const list = await load();
                    setEditing(list.find((l) => l.id === editing.id) || null);
                  }}
                />
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await status(editing, 'pending');
                      setView('listings');
                    })
                  }
                >
                  Submit for Review
                </button>
              </>
            ) : (
              <p>
                Save a draft before adding photos, video, or aircraft records.
              </p>
            )}
          </>
        )}
        {view === 'account' && account && (
          <>
            {identityMethods.length > 0 && (
              <section aria-label="Connected sign-in methods">
                <h3>Sign-in methods</h3>
                <p>
                  {account.loginMethods?.length
                    ? 'Connected: ' +
                      account.loginMethods
                        .map((method) => methodLabels[method])
                        .join(', ')
                    : 'Email-code login. Connect another method to use this same seller account.'}
                </p>
                {identityMethods.map((method) => (
                  <button
                    key={method}
                    disabled={busy}
                    onClick={() => void beginIdentity(method, true)}
                  >
                    Connect {methodLabels[method]}
                  </button>
                ))}
                {identityMethods.includes('password') && (
                  <button
                    disabled={busy}
                    onClick={() => void beginIdentity('password')}
                  >
                    Password help
                  </button>
                )}
              </section>
            )}
            <form
              onSubmit={onSubmit(async () => {
                const data = await api(
                  '/account',
                  'PATCH',
                  account.profile.email
                    ? {
                        name: account.profile.name,
                        phone: account.profile.phone,
                        location: account.profile.location,
                      }
                    : {},
                );
                setAccount({ ...account, profile: data.profile });
                setMessage('Profile updated.');
              })}
            >
              <p>Signed in as {account.profile.email}</p>
              {(['name', 'phone', 'location'] as const).map((k) => (
                <label className="seller-field" key={k}>
                  {k}
                  <input
                    value={account.profile[k]}
                    onChange={(e) =>
                      setAccount({
                        ...account,
                        profile: { ...account.profile, [k]: e.target.value },
                      })
                    }
                    maxLength={200}
                  />
                </label>
              ))}
              <button disabled={busy}>Save Profile</button>
            </form>
            <form
              onSubmit={onSubmit(async () => {
                if (!emailSent) {
                  await api('/account/email-code', 'POST', { email: newEmail });
                  setEmailSent(true);
                } else {
                  await api('/account/email', 'PUT', {
                    email: newEmail,
                    code: emailCode,
                  });
                  setAuth({
                    ...session!,
                    email: newEmail.trim().toLowerCase(),
                  });
                  setAccount(await api('/account'));
                  setEmailSent(false);
                  setMessage(
                    'Email verified and updated. Other sessions have been revoked.',
                  );
                }
              })}
            >
              <h3>Change email</h3>
              <label className="seller-field">
                New email
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </label>
              {emailSent && (
                <label className="seller-field">
                  New email code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                  />
                </label>
              )}
              <button disabled={busy}>
                {emailSent ? 'Verify New Email' : 'Send New Email Code'}
              </button>
            </form>
            <h3>Active sessions</h3>
            {account.sessions.map((s) => (
              <p key={s.id}>
                {s.current ? 'This session' : 'Other session'} · expires{' '}
                {new Date(s.expiresAt).toLocaleString()}{' '}
                {!s.current && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await api('/account/sessions', 'DELETE', { id: s.id });
                        setAccount(await api('/account'));
                      })
                    }
                  >
                    Revoke
                  </button>
                )}
              </p>
            ))}
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api('/account/sessions', 'DELETE', { all: true });
                  setAccount(await api('/account'));
                  setMessage('Other sessions revoked.');
                })
              }
            >
              Sign Out Other Sessions
            </button>
            <h3>Delete account</h3>
            <p>
              Permanently delete your listings first. Account deletion requires
              a recent sign-in and removes your RWAS profile, saved draft and
              connected login links. Your Google, Apple or sign-in-provider
              account is managed separately.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                const confirm = window.prompt(
                  'Type your current email to permanently delete your account.',
                );
                if (confirm)
                  void perform(async () => {
                    await api('/account', 'DELETE', { confirm });
                    setAuth(null);
                    setView(null);
                  });
              }}
            >
              Delete Account
            </button>
          </>
        )}
      </dialog>
      <style jsx>{`
        .seller-dialog {
          width: min(860px, 94vw);
          max-height: 90vh;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 24px;
          background: #f7f4ef;
          color: #222;
        }
        .seller-dialog::backdrop {
          background: #0008;
        }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        h2 {
          font-size: 26px;
        }
        h3 {
          font-size: 20px;
          margin: 16px 0 8px;
        }
        p {
          margin: 12px 0;
          line-height: 1.5;
        }
        .seller-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 12px 0;
          font:
            14px Arial,
            sans-serif;
        }
        input,
        textarea {
          border: 1px solid #777;
          border-radius: 4px;
          background: white;
          color: #222;
          padding: 10px;
          width: 100%;
        }
        .seller-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 20px;
        }
        button {
          padding: 9px 14px;
          border: 1px solid #333;
          border-radius: 4px;
          margin: 4px;
          background: #fff;
          cursor: pointer;
        }
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible {
          outline: 3px solid #b26c22;
          outline-offset: 3px;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .seller-error {
          color: #9b2222;
        }
        .seller-listing {
          border-top: 1px solid #aaa;
          padding: 16px 0;
        }
        .seller-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        @media (max-width: 600px) {
          .seller-fields {
            grid-template-columns: 1fr;
          }
          .seller-dialog {
            padding: 16px;
          }
        }
      `}</style>
    </>
  );
}

function SellerMedia({
  listing,
  session,
  onChange,
  onBusy,
}: {
  listing: Listing;
  session: Session;
  onChange: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setUrls({});
    const media = [...listing.photos, ...listing.videos];
    void Promise.all(
      media.map(async (f) => {
        const r = await fetch(
          SELLER_API + '/files/' + encodeURIComponent(f.key),
          { headers: { Authorization: 'Bearer ' + session.token } },
        );
        if (r.ok) {
          const url = URL.createObjectURL(await r.blob());
          made.push(url);
          if (alive) setUrls((old) => ({ ...old, [f.key]: url }));
        }
      }),
    ).catch(() => setError('Could not preview media.'));
    return () => {
      alive = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [listing, session.token]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Media request failed.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function request(path: string, method: string, body: unknown) {
    const r = await fetch(SELLER_API + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + session.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  return (
    <section aria-label="Listing media">
      <h3>Photos, video and records</h3>
      <p>
        Photos, video and aircraft records remain private to your account and
        the RWAS review team during this intake launch. Accepted: JPG, PNG, GIF,
        WebP; MP4/WebM; PDF. Up to 50 MB per file.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {categories.map(([category, label]) => {
        const files =
          category === 'photos'
            ? listing.photos
            : category === 'videos'
              ? listing.videos
              : listing.logbooks[category] || [];
        return (
          <fieldset
            key={category}
            style={{ padding: 16, margin: '16px 0', border: '1px solid #aaa' }}
          >
            <legend>
              {label} ({files.length})
            </legend>
            <label>
              Add {label.toLowerCase()}
              <input
                type="file"
                multiple
                disabled={busy}
                accept={
                  category === 'photos'
                    ? 'image/jpeg,image/png,image/gif,image/webp'
                    : category === 'videos'
                      ? 'video/mp4,video/webm'
                      : 'application/pdf'
                }
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  e.target.value = '';
                  void action(async () => {
                    for (const f of selected) {
                      if (f.size > 50 * 1024 * 1024)
                        throw Error('50 MB per file limit.');
                      setMessage('Uploading ' + f.name + '…');
                      const r = await fetch(
                        SELLER_API +
                          '/upload?listingId=' +
                          listing.id +
                          '&category=' +
                          category +
                          '&filename=' +
                          encodeURIComponent(f.name),
                        {
                          method: 'POST',
                          headers: { Authorization: 'Bearer ' + session.token },
                          body: f,
                        },
                      );
                      const d = await r.json();
                      if (!r.ok) throw Error(d.error);
                    }
                    setMessage(
                      'Upload complete. Submit the updated draft for review.',
                    );
                  });
                }}
              />
            </label>
            {files.map((f, i) => (
              <div key={f.key} style={{ marginTop: 12 }}>
                {category === 'photos' && urls[f.key] && (
                  <img
                    src={urls[f.key]}
                    alt={f.name}
                    style={{ maxWidth: '100%', maxHeight: 200 }}
                  />
                )}
                {category === 'videos' && urls[f.key] && (
                  <video
                    src={urls[f.key]}
                    controls
                    preload="metadata"
                    aria-label={f.name}
                    style={{ maxWidth: '100%' }}
                  />
                )}
                <p>{f.name}</p>
                {!['photos', 'videos'].includes(category) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const r = await fetch(
                          SELLER_API + '/files/' + encodeURIComponent(f.key),
                          {
                            headers: {
                              Authorization: 'Bearer ' + session.token,
                            },
                          },
                        );
                        if (!r.ok)
                          throw Error('Could not download this record.');
                        const url = URL.createObjectURL(await r.blob()),
                          a = document.createElement('a');
                        a.href = url;
                        a.download = f.name;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      })
                    }
                  >
                    Download
                  </button>
                )}
                {category === 'photos' && i > 0 && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const order = files.map((x) => x.key);
                        [order[i - 1], order[i]] = [order[i], order[i - 1]];
                        await request(
                          '/listings/' + listing.id + '/photos/order',
                          'PUT',
                          { order },
                        );
                      })
                    }
                  >
                    Move Earlier
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Delete ' + f.name + '?'))
                      void action(async () => {
                        await request('/delete-file', 'POST', {
                          listingId: listing.id,
                          category,
                          fileKey: f.key,
                        });
                      });
                  }}
                >
                  Delete {f.name}
                </button>
              </div>
            ))}
          </fieldset>
        );
      })}
    </section>
  );
}
