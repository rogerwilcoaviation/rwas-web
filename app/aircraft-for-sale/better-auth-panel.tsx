'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import AuthenticatorSetup from './authenticator-setup';
import {
  connectBetterAuthSeller,
  getSellerIdentityClient,
  getBoundSellerIdentityClient,
  sellerIdentityResponseTarget,
  type SellerIdentityTarget,
  sellerIdentityError,
  sellerIdentityReturnUrl,
  signOutBetterAuth,
  type BetterAuthLinkOwner,
  type BetterAuthProvider,
  type BetterAuthSellerSession,
} from './better-auth-client';

type Mode =
  | 'login'
  | 'signup'
  | 'forgot'
  | 'reset'
  | 'verify'
  | 'mfa'
  | 'setup-mfa'
  | 'finish-delete'
  | 'confirm-link';
type IdentitySession = {
  user: {
    id: string;
    name: string;
    email: string;
    twoFactorEnabled?: boolean;
    role?: string;
  };
  session: {
    id: string;
    token?: string;
    createdAt: string | Date;
    expiresAt: string | Date;
    mfaVerifiedAt?: string | Date | number | null;
    requiresMfa?: boolean;
  };
};

function BetterAuthStyles() {
  return (
    <style jsx global>{`
      [data-rwas-better-auth] .seller-field,
      [data-rwas-better-auth-account] .seller-field,
      [data-rwas-better-auth-delete] .seller-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 12px 0;
        font:
          14px Arial,
          sans-serif;
      }
      [data-rwas-better-auth] input,
      [data-rwas-better-auth-account] input,
      [data-rwas-better-auth-account] textarea,
      [data-rwas-better-auth-delete] input {
        border: 1px solid #777;
        border-radius: 4px;
        background: #fff;
        color: #222;
        padding: 10px;
        width: 100%;
        box-sizing: border-box;
      }
      [data-rwas-better-auth] button,
      [data-rwas-better-auth-account] button,
      [data-rwas-better-auth-delete] button {
        padding: 9px 14px;
        border: 1px solid #333;
        border-radius: 4px;
        margin: 4px;
        background: #fff;
        color: #222;
        cursor: pointer;
      }
      [data-rwas-better-auth] button:disabled,
      [data-rwas-better-auth-account] button:disabled,
      [data-rwas-better-auth-delete] button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      [data-rwas-better-auth] :focus-visible,
      [data-rwas-better-auth-account] :focus-visible,
      [data-rwas-better-auth-delete] :focus-visible {
        outline: 3px solid #b26c22;
        outline-offset: 3px;
      }
      [data-rwas-better-auth] [role='alert'],
      [data-rwas-better-auth-account] [role='alert'],
      [data-rwas-better-auth-delete] [role='alert'] {
        color: #9b2222;
      }
      [data-rwas-better-auth] {
        width: 100%;
        max-width: 480px;
        margin: 16px auto 0;
        font-size: 14px;
        line-height: 1.5;
      }
      [data-rwas-better-auth] > h3 {
        margin: 0 0 16px;
        font-size: 20px;
      }
      [data-rwas-better-auth] .seller-field {
        gap: 7px;
        margin: 0 0 18px;
        font-weight: 600;
      }
      [data-rwas-better-auth] input {
        min-height: 46px;
        font-size: 16px;
        font-weight: 400;
      }
      [data-rwas-better-auth] button {
        min-height: 44px;
        margin: 0;
        font-size: 14px;
      }
      [data-rwas-better-auth] > button {
        margin-top: 18px;
      }
      [data-rwas-better-auth] .auth-submit-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 20px;
        margin-top: 4px;
      }
      [data-rwas-better-auth] .auth-primary {
        min-width: 104px;
        padding: 11px 20px;
        background: #c49a2a;
        border-color: #222;
        font-weight: 700;
      }
      [data-rwas-better-auth] .auth-primary:hover:not(:disabled) {
        background: #b28a21;
      }
      [data-rwas-better-auth] .auth-forgot-link {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        color: #333;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      [data-rwas-better-auth] .auth-forgot-link[aria-disabled='true'] {
        opacity: 0.6;
        cursor: wait;
      }
      [data-rwas-better-auth] .auth-providers {
        display: grid;
        gap: 12px;
        margin-top: 22px;
      }
      [data-rwas-better-auth] .auth-divider {
        display: flex;
        align-items: center;
        gap: 14px;
        color: #666;
        font-size: 13px;
      }
      [data-rwas-better-auth] .auth-divider::before,
      [data-rwas-better-auth] .auth-divider::after {
        content: '';
        flex: 1;
        border-top: 1px solid #bcb7ae;
      }
      [data-rwas-better-auth] .auth-provider {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 12px;
        border-color: #747775;
        background: #fff;
        color: #1f1f1f;
        font-weight: 500;
      }
      [data-rwas-better-auth] .auth-provider:hover:not(:disabled) {
        background: #f5f5f5;
      }
      [data-rwas-better-auth] .auth-provider img {
        flex: 0 0 20px;
        width: 20px;
        height: 20px;
        object-fit: contain;
      }
    `}</style>
  );
}

function consumeResetToken() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  if (url.searchParams.get('seller-auth') !== 'reset') return '';
  const value = url.searchParams.get('token') || '';
  url.searchParams.delete('token');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return value.length > 10 && value.length < 4096 ? value : '';
}

export default function BetterAuthPanel({
  onSignedIn,
  providers,
  linkOwner,
  onConnectExisting,
  initialMode = 'login',
}: {
  onSignedIn: (session: BetterAuthSellerSession) => void;
  providers: BetterAuthProvider[];
  linkOwner?: BetterAuthLinkOwner;
  onConnectExisting?: () => void;
  initialMode?: 'login' | 'signup';
}) {
  const [resetToken] = useState(consumeResetToken);
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('seller-auth') === 'reset'
      ? 'reset'
      : typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('seller-auth') ===
            'forgot'
        ? 'forgot'
        : initialMode,
  );
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const pendingLink = useRef<{
    owner: string;
    subject: string;
    session: string;
  } | null>(null);
  const confirmedLink = useRef<typeof pendingLink.current>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const completing = useRef(false);
  const identityTarget = useRef<SellerIdentityTarget | null>(null);
  const signedIn = useRef(onSignedIn);
  signedIn.current = onSignedIn;
  const owner = useRef(linkOwner);
  owner.current = linkOwner;

  async function complete() {
    if (!mounted.current || completing.current) return;
    completing.current = true;
    const current = generation.current;
    try {
      const identity = await (
        identityTarget.current
          ? getBoundSellerIdentityClient(identityTarget.current, (next) => {
              identityTarget.current = next;
            })
          : getSellerIdentityClient()
      ).getSession({
        query: { disableCookieCache: true },
      });
      sellerIdentityError(identity);
      if (!mounted.current || current !== generation.current) return;
      const active = identity.data as IdentitySession | null;
      if (!active) throw new Error('Please sign in to continue.');
      if (
        identityTarget.current &&
        (identityTarget.current.userId !== active.user.id ||
          identityTarget.current.sessionId !== active.session.id)
      )
        throw new Error('Your secure sign-in changed. Start again.');
      identityTarget.current = {
        userId: active.user.id,
        sessionId: active.session.id,
      };
      if (
        (active.user.twoFactorEnabled || active.session.requiresMfa) &&
        !active.session.mfaVerifiedAt
      ) {
        if (current === generation.current)
          setMode(active.user.twoFactorEnabled ? 'mfa' : 'setup-mfa');
        return;
      }
      if (owner.current) {
        const binding = {
          owner: owner.current.token,
          subject: active.user.id,
          session: active.session.id,
        };
        if (
          !confirmedLink.current ||
          confirmedLink.current.owner !== binding.owner ||
          confirmedLink.current.subject !== binding.subject ||
          confirmedLink.current.session !== binding.session
        ) {
          pendingLink.current = binding;
          confirmedLink.current = null;
          setLinkEmail(active.user.email);
          setMode('confirm-link');
          return;
        }
      }
      let next;
      try {
        next = await connectBetterAuthSeller(owner.current, {
          userId: active.user.id,
          sessionId: active.session.id,
        });
      } catch (caught) {
        if (
          caught &&
          typeof caught === 'object' &&
          'code' in caught &&
          caught.code === 'ACCOUNT_DELETION_PENDING'
        ) {
          if (mounted.current && current === generation.current)
            setMode('finish-delete');
          return;
        }
        throw caught;
      }
      if (current === generation.current) signedIn.current(next);
    } finally {
      completing.current = false;
    }
  }
  useEffect(() => {
    // Keep the stable counter container; cleanup must invalidate its latest value.
    const lifecycleGeneration = generation;
    mounted.current = true;
    const current = ++generation.current;
    if (resetToken || mode === 'reset')
      return () => {
        mounted.current = false;
        lifecycleGeneration.current++;
      };
    void getSellerIdentityClient()
      .getSession({ query: { disableCookieCache: true } })
      .then(async (result) => {
        if (current !== generation.current || !result.data) return;
        identityTarget.current = {
          userId: result.data.user.id,
          sessionId: result.data.session.id,
        };
        await complete();
      })
      .catch(() => {
        if (current === generation.current)
          setError('Secure sign-in could not be completed. Please try again.');
      });
    return () => {
      mounted.current = false;
      lifecycleGeneration.current++;
    };
    // Initial handoff only; form changes must not replay authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    const current = generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (caught) {
      if (current === generation.current)
        setError(
          caught instanceof Error
            ? caught.message
            : 'The request could not be completed.',
        );
    } finally {
      if (current === generation.current) {
        setBusy(false);
        setPassword('');
        setCode('');
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const client = getSellerIdentityClient();
      if (mode === 'login') {
        const result = await client.signIn.email(
          { email, password },
          {
            onSuccess: ({ response }) => {
              identityTarget.current = sellerIdentityResponseTarget(response);
            },
          },
        );
        sellerIdentityError(result);
        if (
          (result.data as { twoFactorRedirect?: boolean } | null)
            ?.twoFactorRedirect
        ) {
          if (
            identityTarget.current?.sessionId !== 'pending-mfa' ||
            !identityTarget.current.challengeId
          )
            throw new Error('Your verification sign-in changed. Start again.');
          setMode('mfa');
        } else {
          if (!identityTarget.current)
            throw new Error(
              'Your secure sign-in could not be bound. Start again.',
            );
          await complete();
        }
      } else if (mode === 'signup') {
        const result = await client.signUp.email({
          email,
          password,
          name,
          callbackURL: sellerIdentityReturnUrl(),
        });
        sellerIdentityError(result);
        setMode('verify');
        setNotice(
          'Check your email and open the verification link to finish creating your account.',
        );
      } else if (mode === 'forgot') {
        const result = await client.requestPasswordReset({
          email,
          redirectTo: sellerIdentityReturnUrl('reset'),
        });
        sellerIdentityError(result);
        setNotice(
          'If this address has an account, a password-reset email has been sent.',
        );
      } else if (mode === 'reset') {
        if (!resetToken)
          throw new Error(
            'This reset link is missing or invalid. Request a new reset email.',
          );
        const result = await client.resetPassword({
          newPassword: password,
          token: resetToken,
        });
        sellerIdentityError(result);
        setMode('login');
        setNotice(
          'Password changed. Sign in with your new password. Previous sessions were revoked.',
        );
      } else if (mode === 'verify') {
        const result = await client.sendVerificationEmail({
          email,
          callbackURL: sellerIdentityReturnUrl(),
        });
        sellerIdentityError(result);
        setNotice('If verification is needed, a new email has been sent.');
      } else if (mode === 'mfa') {
        if (!identityTarget.current)
          throw new Error('Your verification sign-in changed. Start again.');
        const client = getBoundSellerIdentityClient(
          identityTarget.current,
          (next) => {
            identityTarget.current = next;
          },
        );
        const result = backup
          ? await client.twoFactor.verifyBackupCode({
              code,
              trustDevice: false,
            })
          : await client.twoFactor.verifyTotp({ code, trustDevice: false });
        sellerIdentityError(result);
        await complete();
      }
    });
  }
  const title = {
    login: 'Sign in',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
    verify: 'Verify your email',
    mfa: 'Verify your identity',
    'setup-mfa': 'Set up two-factor authentication',
    'finish-delete': 'Finish account deletion',
    'confirm-link': 'Confirm account connection',
  }[mode];
  return (
    <section aria-label="User secure sign-in" data-rwas-better-auth="true">
      <BetterAuthStyles />
      <h3>
        {linkOwner ? 'Connect secure sign-in to this seller account' : title}
      </h3>
      {linkOwner && (
        <p>
          Sign in to your new identity below. Both sign-ins are required;
          matching email addresses alone do not connect accounts.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {mode === 'setup-mfa' && (
        <>
          <p>
            Two-factor authentication is required before seller access is
            available.
          </p>
          <BetterAuthAccountPanel
            enrollmentOnly
            expectedTarget={identityTarget.current!}
            onTargetUpdated={(target) => {
              identityTarget.current = target;
            }}
            onIdentityEnded={() => setMode('login')}
            onContinue={() => void run(complete)}
          />
        </>
      )}
      {mode === 'confirm-link' && (
        <section aria-label="Confirm secure identity connection">
          <p>Verified secure login: {linkEmail}</p>
          <p>
            Connect this login to the existing RWAS account you just signed
            into. Continue only if both accounts belong to you.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              confirmedLink.current = pendingLink.current;
              void run(complete);
            }}
          >
            Connect this verified login
          </button>
        </section>
      )}
      {mode === 'finish-delete' && (
        <BetterAuthDeleteAccount
          identityOnly
          expectedTarget={identityTarget.current!}
          onComplete={() => {
            document.dispatchEvent(new Event('rwas:better-auth-invalidated'));
            setMode('login');
            setNotice('Your seller account and secure sign-in were deleted.');
          }}
        />
      )}
      {mode !== 'setup-mfa' &&
        mode !== 'finish-delete' &&
        mode !== 'confirm-link' && (
          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label className="seller-field">
                Name
                <input
                  autoComplete="name"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {['login', 'signup', 'forgot', 'verify'].includes(mode) && (
              <label className="seller-field">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {['login', 'signup', 'reset'].includes(mode) && (
              <label className="seller-field">
                {mode === 'reset' ? 'New password' : 'Password'}
                <input
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={mode === 'login' ? 1 : 12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {mode === 'mfa' && (
              <>
                <p>
                  {backup
                    ? 'Enter an unused recovery code.'
                    : 'Enter the code from your authenticator app.'}
                </p>
                <label className="seller-field">
                  {backup ? 'Recovery code' : 'Authenticator code'}
                  <input
                    autoComplete="one-time-code"
                    inputMode={backup ? 'text' : 'numeric'}
                    maxLength={128}
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBackup((value) => !value);
                    setCode('');
                  }}
                >
                  {backup ? 'Use authenticator app' : 'Use a recovery code'}
                </button>
              </>
            )}
            <div className="auth-submit-row">
              <button
                className="auth-primary"
                disabled={busy || (mode === 'reset' && !resetToken)}
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'verify'
                    ? 'Resend verification email'
                    : mode === 'forgot'
                      ? 'Send reset email'
                      : mode === 'mfa'
                        ? 'Verify'
                        : title}
              </button>
              {mode === 'login' && (
                <a
                  className="auth-forgot-link"
                  href={sellerIdentityReturnUrl('forgot')}
                  aria-disabled={busy}
                  onClick={(event) => {
                    if (busy) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    setMode('forgot');
                    setError('');
                    setPassword('');
                  }}
                >
                  Forgot password?
                </a>
              )}
            </div>
          </form>
        )}
      {(mode === 'login' || mode === 'signup') && (
        <>
          {providers.some(
            (provider) => provider === 'google' || provider === 'apple',
          ) && (
            <div className="auth-providers" aria-label="Other sign-in options">
              <div className="auth-divider" aria-hidden="true">
                or
              </div>
              {(['google', 'apple'] as const)
                .filter((provider) => providers.includes(provider))
                .map((provider) => (
                  <button
                    type="button"
                    className="auth-provider"
                    key={provider}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result =
                          await getSellerIdentityClient().signIn.social({
                            provider,
                            callbackURL: sellerIdentityReturnUrl(),
                            errorCallbackURL: sellerIdentityReturnUrl(),
                          });
                        sellerIdentityError(result);
                      })
                    }
                  >
                    {provider === 'google' && (
                      // The provider's unmodified brand asset is served locally.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/auth/google-g.png"
                        width={20}
                        height={20}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {mode === 'signup' ? 'Sign up with ' : 'Continue with '}
                      {provider === 'google' ? 'Google' : 'Apple'}
                    </span>
                  </button>
                ))}
            </div>
          )}
          {mode === 'login' && onConnectExisting && (
            <button disabled={busy} onClick={onConnectExisting}>
              Use an existing RWAS login
            </button>
          )}
        </>
      )}
      {mode !== 'login' &&
        mode !== 'mfa' &&
        mode !== 'setup-mfa' &&
        mode !== 'finish-delete' && (
          <button
            disabled={busy}
            onClick={() => {
              setMode('login');
              setError('');
              setPassword('');
            }}
          >
            Back to sign in
          </button>
        )}
      {mode === 'mfa' && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (
                identityTarget.current &&
                identityTarget.current.sessionId !== 'pending-mfa'
              )
                await signOutBetterAuth(identityTarget.current);
              identityTarget.current = null;
              setMode('login');
            })
          }
        >
          Cancel sign-in
        </button>
      )}
    </section>
  );
}

export function BetterAuthAccountPanel({
  onIdentityEnded,
  onIdentityUpdated,
  expectedTarget,
  onTargetUpdated,
  enrollmentOnly = false,
  onContinue,
}: {
  onIdentityEnded: () => void;
  expectedTarget: SellerIdentityTarget;
  onTargetUpdated?: (target: SellerIdentityTarget) => void;
  onIdentityUpdated?: (identity: {
    userId: string;
    sessionId: string;
  }) => Promise<void>;
  enrollmentOnly?: boolean;
  onContinue?: () => void;
}) {
  const [identity, setIdentity] = useState<IdentitySession | null>(null);
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      token: string;
      createdAt: string | Date;
      expiresAt: string | Date;
    }>
  >([]);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [factorCode, setFactorCode] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const binding = useRef<SellerIdentityTarget>({ ...expectedTarget });
  const displayed = useRef<SellerIdentityTarget>({ ...expectedTarget });
  const boundClient = () =>
    getBoundSellerIdentityClient(binding.current, (next) => {
      if (next.userId !== displayed.current.userId)
        throw new Error('Your secure identity changed.');
      binding.current = next;
      onTargetUpdated?.(next);
    });
  async function refresh(afterSecurityChange = false) {
    const client = boundClient();
    const result = await client.getSession({
      query: { disableCookieCache: true },
    });
    sellerIdentityError(result);
    if (!active.current) return;
    if (!result.data) {
      onIdentityEnded();
      return;
    }
    const current = result.data as IdentitySession;
    if (
      binding.current.userId !== current.user.id ||
      binding.current.sessionId !== current.session.id
    ) {
      onIdentityEnded();
      throw new Error(
        'Your secure sign-in identity changed. Please sign in again.',
      );
    }
    if (displayed.current.sessionId !== current.session.id && !enrollmentOnly) {
      if (!afterSecurityChange || !onIdentityUpdated) {
        onIdentityEnded();
        throw new Error('Your secure sign-in changed. Please sign in again.');
      }
      await onIdentityUpdated({
        userId: current.user.id,
        sessionId: current.session.id,
      });
      if (!active.current) return;
    }
    displayed.current = {
      userId: current.user.id,
      sessionId: current.session.id,
    };
    setIdentity(current);
    if (enrollmentOnly) return;
    const list = await client.listSessions();
    sellerIdentityError(list);
    if (active.current) setSessions((list.data || []) as typeof sessions);
  }
  useEffect(() => {
    active.current = true;
    void refresh().catch(() => {
      if (active.current) setError('Sign-in settings could not be loaded.');
    });
    return () => {
      active.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (caught) {
      if (active.current)
        setError(
          caught instanceof Error
            ? caught.message
            : 'The security change could not be completed.',
        );
    } finally {
      if (active.current) {
        setBusy(false);
        setPassword('');
        setNewPassword('');
        setFactorCode('');
      }
    }
  }
  return (
    <section
      aria-label="Sign-in and security"
      data-rwas-better-auth-account="true"
    >
      <BetterAuthStyles />
      <h3>Sign-in and security</h3>
      {identity && <p>Sign-in email: {identity.user.email}</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!enrollmentOnly && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await boundClient().changeEmail({
                newEmail: signInEmail,
                callbackURL: sellerIdentityReturnUrl(),
              });
              sellerIdentityError(result);
              setSignInEmail('');
              setNotice(
                'Follow the confirmation email sent to your current address, then verify your new address. Your sign-in email is not changed until verification finishes.',
              );
            });
          }}
        >
          <h4>Change sign-in email</h4>
          <p>
            This changes your login address. Your RWAS contact email is managed
            in the Contact email section.
          </p>
          <label className="seller-field">
            New sign-in email
            <input
              type="email"
              autoComplete="email"
              required
              value={signInEmail}
              onChange={(event) => setSignInEmail(event.target.value)}
            />
          </label>
          <button disabled={busy}>Verify new sign-in email</button>
        </form>
      )}
      {!enrollmentOnly && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await boundClient().changePassword({
                currentPassword: password,
                newPassword,
                revokeOtherSessions: true,
              });
              sellerIdentityError(result);
              setNotice(
                'Password changed. Other sign-in sessions were revoked.',
              );
              await refresh(true);
            });
          }}
        >
          <h4>Change password</h4>
          <label className="seller-field">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="seller-field">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <button disabled={busy}>Change password</button>
        </form>
      )}
      <h4>Authenticator app</h4>
      <p>
        {identity?.user.twoFactorEnabled
          ? 'Two-factor authentication is enabled.'
          : 'Add an authenticator app to protect your sign-in.'}
      </p>
      <label className="seller-field">
        Password for security changes (if your account uses one)
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!identity?.user.twoFactorEnabled && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await boundClient().twoFactor.enable({
                password: password || undefined,
                issuer: 'Roger Wilco Aviation',
                method: 'totp',
              });
              sellerIdentityError(result);
              if (result.data?.method !== 'totp')
                throw new Error('Authenticator setup could not be completed.');
              setTotpUri(result.data.totpURI);
              setBackupCodes(result.data.backupCodes);
              setShowBackupCodes(false);
            })
          }
        >
          Set up authenticator
        </button>
      )}
      {totpUri && (
        <>
          <AuthenticatorSetup uri={totpUri} />
          <label className="seller-field">
            Authenticator code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={factorCode}
              onChange={(event) => setFactorCode(event.target.value)}
            />
          </label>
          <button
            disabled={busy || !factorCode}
            onClick={() =>
              void run(async () => {
                const result = await boundClient().twoFactor.verifyTotp({
                  code: factorCode,
                  trustDevice: false,
                });
                sellerIdentityError(result);
                setTotpUri('');
                setNotice(
                  'Authenticator verified. Save your recovery codes in your password manager.',
                );
                await refresh(true);
              })
            }
          >
            Verify authenticator
          </button>
        </>
      )}
      {identity?.user.twoFactorEnabled && (
        <>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result =
                  await boundClient().twoFactor.generateBackupCodes({
                    password: password || undefined,
                  });
                sellerIdentityError(result);
                setBackupCodes(result.data?.backupCodes || []);
                setShowBackupCodes(false);
                setNotice('New recovery codes replace the previous set.');
              })
            }
          >
            Replace recovery codes
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await boundClient().twoFactor.disable({
                  password: password || undefined,
                });
                sellerIdentityError(result);
                setTotpUri('');
                setBackupCodes([]);
                setShowBackupCodes(false);
                setNotice('Two-factor authentication disabled.');
                await refresh(true);
              })
            }
          >
            Disable authenticator
          </button>
        </>
      )}
      {backupCodes.length > 0 && (
        <section aria-label="Private recovery codes">
          <p>Store these recovery codes securely. Each can be used once.</p>
          <details
            open={showBackupCodes}
            onToggle={(event) => setShowBackupCodes(event.currentTarget.open)}
          >
            <summary>Show recovery codes</summary>
            {showBackupCodes && (
              <ul>
                {backupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            )}
          </details>
          {showBackupCodes && (
            <button
              onClick={() => {
                setBackupCodes([]);
                setShowBackupCodes(false);
              }}
            >
              Hide recovery codes
            </button>
          )}
        </section>
      )}
      {enrollmentOnly && onContinue && (
        <button
          disabled={
            busy ||
            !identity?.user.twoFactorEnabled ||
            !identity.session.mfaVerifiedAt
          }
          onClick={onContinue}
        >
          Continue to seller account
        </button>
      )}
      {!enrollmentOnly && (
        <>
          <h4>Sign-in sessions</h4>
          {sessions.map((item) => (
            <p key={item.id}>
              {item.id === identity?.session.id
                ? 'This sign-in'
                : 'Other sign-in'}{' '}
              · expires {new Date(item.expiresAt).toLocaleString()}
              {item.id !== identity?.session.id && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await boundClient().revokeSession({
                        token: item.token,
                      });
                      sellerIdentityError(result);
                      await refresh(true);
                    })
                  }
                >
                  Revoke sign-in
                </button>
              )}
            </p>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await boundClient().revokeOtherSessions();
                sellerIdentityError(result);
                setNotice('Other sign-in sessions revoked.');
                await refresh(true);
              })
            }
          >
            Sign out other devices
          </button>
        </>
      )}
    </section>
  );
}

export function BetterAuthDeleteAccount({
  deleteBusiness,
  onComplete,
  identityOnly = false,
  expectedTarget,
}: {
  deleteBusiness?: (confirmation: string) => Promise<void>;
  onComplete: () => void;
  identityOnly?: boolean;
  expectedTarget: SellerIdentityTarget;
}) {
  const [pendingIdentity, setPendingIdentity] = useState(identityOnly);
  const target = useRef<SellerIdentityTarget>({ ...expectedTarget });
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <section
      aria-label="Delete seller account"
      data-rwas-better-auth-delete="true"
    >
      <BetterAuthStyles />
      <h3>
        {pendingIdentity ? 'Finish secure identity deletion' : 'Delete account'}
      </h3>
      <p>
        {pendingIdentity
          ? 'Your RWAS seller profile has been removed. Secure identity deletion still needs confirmation. Retry only this remaining step.'
          : 'Permanently delete your listings and files first. This removes your RWAS profile and its connected secure sign-in. Your Google or Apple account remains with that provider.'}
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          void (async () => {
            if (!pendingIdentity) {
              if (!deleteBusiness)
                throw new Error('Seller account deletion is unavailable.');
              await deleteBusiness(confirmation);
              if (active.current) setPendingIdentity(true);
            }
            const result = await getBoundSellerIdentityClient(
              target.current,
            ).deleteUser({
              password: password || undefined,
              callbackURL: sellerIdentityReturnUrl(),
            });
            sellerIdentityError(result);
            if (result.data?.message !== 'User deleted')
              throw new Error(
                'Your RWAS profile is removed. Follow the verification email to finish secure identity deletion.',
              );
            if (active.current) onComplete();
          })()
            .catch((caught) => {
              if (active.current)
                setError(
                  caught instanceof Error
                    ? caught.message
                    : 'Deletion is not confirmed.',
                );
            })
            .finally(() => {
              if (active.current) {
                setBusy(false);
                setPassword('');
              }
            });
        }}
      >
        {!pendingIdentity && (
          <label className="seller-field">
            Current RWAS contact email
            <input
              type="email"
              required
              autoComplete="email"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        )}
        <label className="seller-field">
          Password to confirm deletion (if your account uses one)
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button disabled={busy}>
          {busy
            ? 'Please wait…'
            : pendingIdentity
              ? 'Finish secure identity deletion'
              : 'Permanently delete account'}
        </button>
      </form>
    </section>
  );
}
