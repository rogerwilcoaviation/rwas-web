'use client';

/*
 * Seller Auth Panel — Aircraft 4 Sale
 * ------------------------------------
 * Client component that handles:
 *  - Magic-link email login  (→ localStorage.rwas_sale_session)
 *  - My Listings dashboard   (edit, pause/resume, mark sold, delete)
 *  - Manual listing form     (alternative to Jerry intake)
 *  - Edit listing form
 *
 * Also listens for DOM events fired by jerry-widget.js:
 *   'rwas:open-seller-login'  → opens login modal
 *   'rwas:open-manual-form'   → opens manual listing form (logs in first if needed)
 *
 * Backend endpoints (all on https://sale-api.rogerwilcoaviation.com):
 *   POST /send-code              { email, name?, contactType?: 'email' }
 *   POST /check-code             { email, code }  → { session, name }
 *   GET  /my-listings            Authorization: Bearer <session>
 *   POST /listings               create
 *   PUT  /listings/:id           edit
 *   DELETE /listings/:id         remove
 *   POST /listing/:id/status     { status: 'active'|'paused'|'sold'|'deleted' }
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';

const API = 'https://sale-api.rogerwilcoaviation.com';
const SESSION_KEY = 'rwas_sale_session';

// ─────────────────────────── Types ───────────────────────────

type Session = { token: string; email: string; name: string };

type Listing = {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  sellerEmail?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerLocation?: string;
  make?: string;
  model?: string;
  year?: string | number;
  serialNumber?: string;
  nNumber?: string;
  totalTime?: string;
  engineTime?: string;
  engineModel?: string;
  propTime?: string;
  propModel?: string;
  price?: string | number;
  priceLabel?: string;
  description?: string;
  avionics?: string;
  equipmentList?: string;
  annualDue?: string;
  usefulLoad?: string;
  fuelCapacity?: string;
  cruiseSpeed?: string;
  range?: string;
  category?: string;
  condition?: string;
  damageHistory?: string;
  photos?: Array<{ key: string; name?: string }>;
};

type ModalKind =
  | null
  | 'login'
  | 'my-listings'
  | 'edit'
  | 'manual'
  | 'confirm-delete';

// ─────────────────────── Session helpers ───────────────────────

function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const token = String(parsed.token || parsed.session || '');
    const email = String(parsed.email || parsed.userEmail || '');
    const name = String(parsed.name || parsed.userName || '');
    if (!token || !email) return null;
    return { token, email, name };
  } catch {
    return null;
  }
}

function persistSession(s: Session | null) {
  if (typeof window === 'undefined') return;
  if (s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  (window as unknown as { rwasSaleSession?: Session | null }).rwasSaleSession = s;
  document.dispatchEvent(
    new CustomEvent('rwas:session-changed', { detail: s }),
  );
}

// Fire Jerry widget open with a seed message
function openJerryWithSeed(seed: string) {
  const w = window as unknown as { jerryChat?: (s: string) => void };
  if (typeof w.jerryChat === 'function') {
    w.jerryChat(seed);
  }
}

// ─────────────────────────── Styles ───────────────────────────

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(20, 18, 14, 0.55)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
  zIndex: 9999,
  overflowY: 'auto',
};

const modalStyle: React.CSSProperties = {
  background: '#f7f4ef',
  border: '2px solid #1a1a1a',
  maxWidth: 560,
  width: '100%',
  padding: '24px 28px',
  fontFamily: "Georgia, 'Times New Roman', serif",
  color: '#1a1a1a',
  boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
  margin: '0 auto',
};

const modalWideStyle: React.CSSProperties = { ...modalStyle, maxWidth: 820 };

const modalTitleStyle: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 22,
  fontWeight: 700,
  margin: '0 0 4px',
};

const modalKickerStyle: React.CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: '#777',
  display: 'block',
  marginBottom: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Arial, sans-serif',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#333',
  margin: '14px 0 4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontFamily: 'Arial, sans-serif',
  fontSize: 13,
  color: '#1a1a1a',
  background: '#fff',
  border: '1px solid #8a8a8a',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 72,
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  lineHeight: 1.4,
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 22px',
  background: '#C49A2A',
  color: '#111',
  fontFamily: 'Arial, sans-serif',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  border: '1px solid #111',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'transparent',
  color: '#111',
};

const ghostBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'transparent',
  color: '#555',
  border: '1px solid #aaa',
};

const dangerBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: '#a33d2a',
  color: '#fff',
};

const errorStyle: React.CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: '#a33d2a',
  margin: '10px 0 0',
};

const mutedStyle: React.CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: '#666',
  lineHeight: 1.5,
};

// Simple grid for field columns inside manual/edit form
const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0 14px',
};

// ─────────────────────────── Main ───────────────────────────

export default function SellerAuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [myListings, setMyListings] = useState<Listing[] | null>(null);
  const [listingsError, setListingsError] = useState<string>('');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Listing | null>(null);

  // Mount: hydrate session, wire event listeners
  useEffect(() => {
    setSession(loadSession());
    const onOpenLogin = () => setModal('login');
    const onOpenManual = () => {
      if (loadSession()) setModal('manual');
      else setModal('login');
    };
    document.addEventListener('rwas:open-seller-login', onOpenLogin);
    document.addEventListener('rwas:open-manual-form', onOpenManual);
    return () => {
      document.removeEventListener('rwas:open-seller-login', onOpenLogin);
      document.removeEventListener('rwas:open-manual-form', onOpenManual);
    };
  }, []);

  const fetchMyListings = useCallback(async (sess: Session) => {
    setListingsError('');
    setMyListings(null);
    try {
      const resp = await fetch(API + '/my-listings', {
        headers: { Authorization: 'Bearer ' + sess.token },
      });
      if (resp.status === 401) {
        persistSession(null);
        setSession(null);
        setListingsError('Your session expired — please log in again.');
        setModal('login');
        return;
      }
      const data = (await resp.json()) as { listings?: Listing[] };
      setMyListings(data.listings || []);
    } catch {
      setListingsError('Could not load your listings. Try again in a moment.');
      setMyListings([]);
    }
  }, []);

  const handleLoginSuccess = (s: Session, nextModal: ModalKind = null) => {
    persistSession(s);
    setSession(s);
    setModal(nextModal);
  };

  const handleSignOut = () => {
    persistSession(null);
    setSession(null);
    setMyListings(null);
    setModal(null);
  };

  const handleOpenMyListings = async () => {
    if (!session) {
      setModal('login');
      return;
    }
    setModal('my-listings');
    await fetchMyListings(session);
  };

  const handleListAircraft = () => {
    if (session) {
      openJerryWithSeed('I want to list my aircraft for sale.');
    } else {
      setModal('login');
    }
  };

  const handleStatusChange = async (listing: Listing, status: string) => {
    if (!session) return;
    try {
      const resp = await fetch(API + '/listing/' + listing.id + '/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.token,
        },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        alert(data.error || 'Status change failed (' + resp.status + ')');
        return;
      }
      await fetchMyListings(session);
    } catch {
      alert('Network error changing status. Try again.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!session || !pendingDelete) return;
    try {
      const resp = await fetch(API + '/listings/' + pendingDelete.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token },
      });
      if (!resp.ok && resp.status !== 404) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        alert(data.error || 'Delete failed (' + resp.status + ')');
        return;
      }
      setPendingDelete(null);
      setModal('my-listings');
      await fetchMyListings(session);
    } catch {
      alert('Network error deleting listing. Try again.');
    }
  };

  return (
    <>
      {/* ── Buttons rendered inline inside the a4s-cta-row ── */}
      <button
        type="button"
        className="a4s-cta-btn"
        onClick={handleListAircraft}
      >
        List Your Aircraft
      </button>

      {!session ? (
        <button
          type="button"
          className="a4s-cta-btn secondary"
          onClick={() => setModal('login')}
        >
          Seller Login
        </button>
      ) : (
        <>
          <button
            type="button"
            className="a4s-cta-btn secondary"
            onClick={handleOpenMyListings}
            title={'Signed in as ' + session.email}
          >
            My Listings
          </button>
          <button
            type="button"
            className="a4s-cta-btn secondary"
            onClick={handleSignOut}
            style={{ fontSize: 10, padding: '10px 14px' }}
          >
            Sign Out
          </button>
        </>
      )}

      {/* ── Modals ── */}
      {modal === 'login' && (
        <LoginModal
          onClose={() => setModal(null)}
          onSuccess={(s) => handleLoginSuccess(s, null)}
        />
      )}

      {modal === 'my-listings' && session && (
        <MyListingsModal
          listings={myListings}
          error={listingsError}
          session={session}
          onClose={() => setModal(null)}
          onEdit={(l) => {
            setEditingListing(l);
            setModal('edit');
          }}
          onDelete={(l) => {
            setPendingDelete(l);
            setModal('confirm-delete');
          }}
          onStatusChange={handleStatusChange}
          onNewManual={() => setModal('manual')}
          onNewJerry={() => {
            setModal(null);
            openJerryWithSeed('I want to list my aircraft for sale.');
          }}
        />
      )}

      {modal === 'edit' && session && editingListing && (
        <EditListingModal
          listing={editingListing}
          session={session}
          onClose={() => {
            setEditingListing(null);
            setModal('my-listings');
            void fetchMyListings(session);
          }}
        />
      )}

      {modal === 'manual' && (
        <ManualFormModal
          session={session}
          onSessionRequired={() => setModal('login')}
          onClose={() => setModal(null)}
          onSuccess={async (newListing) => {
            if (session) {
              setModal('my-listings');
              await fetchMyListings(session);
            } else {
              setModal(null);
            }
          }}
        />
      )}

      {modal === 'confirm-delete' && pendingDelete && (
        <ConfirmDeleteModal
          listing={pendingDelete}
          onCancel={() => {
            setPendingDelete(null);
            setModal('my-listings');
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

// ─────────────────────── Login Modal ───────────────────────

function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (s: Session) => void;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(API + '/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          name: name.trim(),
          contactType: 'email',
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!resp.ok) {
        setError(data.error || 'Could not send code (' + resp.status + ')');
        return;
      }
      setStep('code');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedCode = code.trim();
    if (!/^\d{4,8}$/.test(trimmedCode)) {
      setError('Enter the code from your email.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(API + '/check-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: trimmedCode,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        verified?: boolean;
        session?: string;
        name?: string;
        error?: string;
      };
      if (!resp.ok || !data.session) {
        setError(data.error || 'Code was rejected. Try again.');
        return;
      }
      onSuccess({
        token: data.session,
        email: email.trim().toLowerCase(),
        name: data.name || name.trim() || '',
      });
    } catch {
      setError('Network error verifying the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <span style={modalKickerStyle}>RWAS Marketplace</span>
        <h2 style={modalTitleStyle}>Seller Login</h2>
        <p style={mutedStyle}>
          Enter your email to get a one-time code. No password required. Your
          session lasts 24 hours.
        </p>

        {step === 'email' && (
          <form onSubmit={handleSendCode}>
            <label style={labelStyle} htmlFor="login-email">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
              autoFocus
              required
            />

            <label style={labelStyle} htmlFor="login-name">
              Name <span style={{ color: '#888', fontWeight: 400 }}>(optional — first time only)</span>
            </label>
            <input
              id="login-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Jane Seller"
            />

            {error && <div style={errorStyle}>{error}</div>}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
              }}
            >
              <button type="button" style={ghostBtnStyle} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" style={primaryBtnStyle} disabled={loading}>
                {loading ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode}>
            <p style={mutedStyle}>
              We emailed a 6-digit code to <strong>{email}</strong>. Check your
              inbox (and spam) and enter it below.
            </p>
            <label style={labelStyle} htmlFor="login-code">
              Verification code
            </label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ ...inputStyle, fontSize: 22, letterSpacing: '0.3em', textAlign: 'center' }}
              placeholder="000000"
              autoFocus
              required
            />

            {error && <div style={errorStyle}>{error}</div>}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 18,
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                style={{ ...ghostBtnStyle, border: 'none', background: 'transparent' }}
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
              >
                ← Use different email
              </button>
              <button type="submit" style={primaryBtnStyle} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────── My Listings Modal ───────────────────

function MyListingsModal({
  listings,
  error,
  session,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onNewJerry,
  onNewManual,
}: {
  listings: Listing[] | null;
  error: string;
  session: Session;
  onClose: () => void;
  onEdit: (l: Listing) => void;
  onDelete: (l: Listing) => void;
  onStatusChange: (l: Listing, status: string) => void | Promise<void>;
  onNewJerry: () => void;
  onNewManual: () => void;
}) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalWideStyle} onClick={(e) => e.stopPropagation()}>
        <span style={modalKickerStyle}>Signed in as {session.email}</span>
        <h2 style={modalTitleStyle}>My Listings</h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            margin: '12px 0 16px',
          }}
        >
          <button type="button" style={primaryBtnStyle} onClick={onNewJerry}>
            + New Listing (with Jerry)
          </button>
          <button type="button" style={secondaryBtnStyle} onClick={onNewManual}>
            + Manual Form
          </button>
          <button
            type="button"
            style={ghostBtnStyle}
            onClick={onClose}
            title="Close"
          >
            Close
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {listings === null && (
          <div style={mutedStyle}>Loading your listings…</div>
        )}

        {listings && listings.length === 0 && (
          <div
            style={{
              border: '1px dashed #aaa',
              padding: 24,
              textAlign: 'center',
              background: 'rgba(255,255,255,0.5)',
              fontFamily: 'Arial, sans-serif',
              fontSize: 12,
              color: '#555',
            }}
          >
            You haven&rsquo;t created any listings yet. Use the buttons above
            to start one.
          </div>
        )}

        {listings && listings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listings.map((l) => (
              <ListingRow
                key={l.id}
                listing={l}
                onEdit={() => onEdit(l)}
                onDelete={() => onDelete(l)}
                onStatusChange={(s) => onStatusChange(l, s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListingRow({
  listing,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  listing: Listing;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void | Promise<void>;
}) {
  const status = (listing.status || 'pending').toLowerCase();
  const title =
    [listing.year, listing.make, listing.model].filter(Boolean).join(' ') ||
    listing.nNumber ||
    'Untitled listing';
  const price = listing.price
    ? '$' + Number(String(listing.price).replace(/[^\d]/g, '')).toLocaleString()
    : '';

  const statusColor =
    status === 'active' || status === 'approved'
      ? '#1f6b3a'
      : status === 'paused'
      ? '#8a6a00'
      : status === 'sold'
      ? '#4a4a4a'
      : status === 'rejected' || status === 'deleted'
      ? '#a33d2a'
      : '#8a6a00'; // pending

  return (
    <div
      style={{
        border: '1px solid #1a1a1a',
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.7)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 16px',
      }}
    >
      <div style={{ flex: '1 1 220px', minWidth: 220 }}>
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 11,
            color: '#555',
            marginTop: 2,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {listing.nNumber && <span>{listing.nNumber}</span>}
          {price && <span>{price}</span>}
          <span
            style={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: statusColor,
            }}
          >
            {status}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 10 }}
          onClick={onEdit}
        >
          Edit
        </button>
        {status === 'active' && (
          <button
            type="button"
            style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 10 }}
            onClick={() => onStatusChange('paused')}
          >
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            type="button"
            style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 10 }}
            onClick={() => onStatusChange('active')}
          >
            Resume
          </button>
        )}
        {status !== 'sold' && (
          <button
            type="button"
            style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: 10 }}
            onClick={() => onStatusChange('sold')}
          >
            Mark Sold
          </button>
        )}
        <button
          type="button"
          style={{ ...dangerBtnStyle, padding: '6px 12px', fontSize: 10 }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─────────────────── Confirm Delete Modal ───────────────────

function ConfirmDeleteModal({
  listing,
  onCancel,
  onConfirm,
}: {
  listing: Listing;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    [listing.year, listing.make, listing.model].filter(Boolean).join(' ') ||
    listing.nNumber ||
    'this listing';
  return (
    <div style={modalOverlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>Delete listing?</h2>
        <p style={mutedStyle}>
          Are you sure you want to delete <strong>{title}</strong>? This removes
          it from the marketplace. If you just want to stop showing it for now,
          cancel and use <em>Pause</em> instead.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 18,
          }}
        >
          <button type="button" style={ghostBtnStyle} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" style={dangerBtnStyle} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Shared listing-form fields ───────────────────

type ListingForm = {
  sellerName: string;
  sellerPhone: string;
  sellerLocation: string;
  make: string;
  model: string;
  year: string;
  serialNumber: string;
  nNumber: string;
  totalTime: string;
  engineTime: string;
  engineModel: string;
  propTime: string;
  propModel: string;
  price: string;
  priceLabel: string;
  description: string;
  avionics: string;
  equipmentList: string;
  annualDue: string;
  usefulLoad: string;
  fuelCapacity: string;
  cruiseSpeed: string;
  range: string;
  category: string;
  condition: string;
  damageHistory: string;
};

const emptyListingForm: ListingForm = {
  sellerName: '',
  sellerPhone: '',
  sellerLocation: '',
  make: '',
  model: '',
  year: '',
  serialNumber: '',
  nNumber: '',
  totalTime: '',
  engineTime: '',
  engineModel: '',
  propTime: '',
  propModel: '',
  price: '',
  priceLabel: '',
  description: '',
  avionics: '',
  equipmentList: '',
  annualDue: '',
  usefulLoad: '',
  fuelCapacity: '',
  cruiseSpeed: '',
  range: '',
  category: 'single-piston',
  condition: 'used',
  damageHistory: 'none',
};

function listingToForm(l: Listing): ListingForm {
  return {
    sellerName: l.sellerName || '',
    sellerPhone: l.sellerPhone || '',
    sellerLocation: l.sellerLocation || '',
    make: l.make || '',
    model: l.model || '',
    year: l.year ? String(l.year) : '',
    serialNumber: l.serialNumber || '',
    nNumber: l.nNumber || '',
    totalTime: l.totalTime || '',
    engineTime: l.engineTime || '',
    engineModel: l.engineModel || '',
    propTime: l.propTime || '',
    propModel: l.propModel || '',
    price: l.price ? String(l.price) : '',
    priceLabel: l.priceLabel || '',
    description: l.description || '',
    avionics: l.avionics || '',
    equipmentList: l.equipmentList || '',
    annualDue: l.annualDue || '',
    usefulLoad: l.usefulLoad || '',
    fuelCapacity: l.fuelCapacity || '',
    cruiseSpeed: l.cruiseSpeed || '',
    range: l.range || '',
    category: l.category || 'single-piston',
    condition: l.condition || 'used',
    damageHistory: l.damageHistory || 'none',
  };
}

function ListingFormFields({
  value,
  onChange,
}: {
  value: ListingForm;
  onChange: (patch: Partial<ListingForm>) => void;
}) {
  const set = <K extends keyof ListingForm>(k: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => onChange({ [k]: e.target.value } as Partial<ListingForm>);

  return (
    <>
      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Seller name</label>
          <input style={inputStyle} value={value.sellerName} onChange={set('sellerName')} />
        </div>
        <div>
          <label style={labelStyle}>Seller phone</label>
          <input style={inputStyle} value={value.sellerPhone} onChange={set('sellerPhone')} placeholder="605-555-1212" />
        </div>
      </div>

      <label style={labelStyle}>Location (city, state)</label>
      <input style={inputStyle} value={value.sellerLocation} onChange={set('sellerLocation')} placeholder="Yankton, SD" />

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>N-number</label>
          <input style={inputStyle} value={value.nNumber} onChange={set('nNumber')} placeholder="N12345" />
        </div>
        <div>
          <label style={labelStyle}>Year</label>
          <input style={inputStyle} value={value.year} onChange={set('year')} placeholder="1980" />
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Make</label>
          <input style={inputStyle} value={value.make} onChange={set('make')} placeholder="CESSNA" />
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <input style={inputStyle} value={value.model} onChange={set('model')} placeholder="R182" />
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Serial number</label>
          <input style={inputStyle} value={value.serialNumber} onChange={set('serialNumber')} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={value.category} onChange={set('category')}>
            <option value="single-piston">Single-engine piston</option>
            <option value="multi-piston">Multi-engine piston</option>
            <option value="turboprop">Turboprop</option>
            <option value="jet">Jet</option>
            <option value="experimental">Experimental</option>
            <option value="lsa">LSA</option>
            <option value="helicopter">Helicopter</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Total time (TT)</label>
          <input style={inputStyle} value={value.totalTime} onChange={set('totalTime')} placeholder="5432.1" />
        </div>
        <div>
          <label style={labelStyle}>Engine time (SMOH)</label>
          <input style={inputStyle} value={value.engineTime} onChange={set('engineTime')} placeholder="842" />
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Engine model</label>
          <input style={inputStyle} value={value.engineModel} onChange={set('engineModel')} placeholder="Lycoming O-540" />
        </div>
        <div>
          <label style={labelStyle}>Propeller time</label>
          <input style={inputStyle} value={value.propTime} onChange={set('propTime')} />
        </div>
      </div>

      <label style={labelStyle}>Propeller model</label>
      <input style={inputStyle} value={value.propModel} onChange={set('propModel')} placeholder="McCauley B3D32C412" />

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Price (USD)</label>
          <input style={inputStyle} value={value.price} onChange={set('price')} placeholder="300000" />
        </div>
        <div>
          <label style={labelStyle}>Price label (optional)</label>
          <input style={inputStyle} value={value.priceLabel} onChange={set('priceLabel')} placeholder='e.g. "Make offer"' />
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Condition</label>
          <select style={inputStyle} value={value.condition} onChange={set('condition')}>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="project">Project</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Damage history</label>
          <select style={inputStyle} value={value.damageHistory} onChange={set('damageHistory')}>
            <option value="none">None known</option>
            <option value="repaired">Repaired</option>
            <option value="current">Current damage</option>
          </select>
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Annual due</label>
          <input style={inputStyle} value={value.annualDue} onChange={set('annualDue')} placeholder="2026-08" />
        </div>
        <div>
          <label style={labelStyle}>Useful load (lb)</label>
          <input style={inputStyle} value={value.usefulLoad} onChange={set('usefulLoad')} />
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <label style={labelStyle}>Fuel capacity (gal)</label>
          <input style={inputStyle} value={value.fuelCapacity} onChange={set('fuelCapacity')} />
        </div>
        <div>
          <label style={labelStyle}>Cruise speed (kt)</label>
          <input style={inputStyle} value={value.cruiseSpeed} onChange={set('cruiseSpeed')} />
        </div>
      </div>

      <label style={labelStyle}>Range (nm)</label>
      <input style={inputStyle} value={value.range} onChange={set('range')} />

      <label style={labelStyle}>Avionics (short summary)</label>
      <textarea style={textareaStyle} value={value.avionics} onChange={set('avionics')} placeholder="Garmin GTN 650, GFC 500, G5 PFD…" />

      <label style={labelStyle}>Equipment list</label>
      <textarea style={textareaStyle} value={value.equipmentList} onChange={set('equipmentList')} placeholder="Any extras, mods, or installed options." />

      <label style={labelStyle}>Description / notes for buyers</label>
      <textarea style={{ ...textareaStyle, minHeight: 110 }} value={value.description} onChange={set('description')} />
    </>
  );
}

// ─────────────────── Manual Form Modal ───────────────────

function ManualFormModal({
  session,
  onSessionRequired,
  onClose,
  onSuccess,
}: {
  session: Session | null;
  onSessionRequired: () => void;
  onClose: () => void;
  onSuccess: (listing: Listing) => void;
}) {
  const [form, setForm] = useState<ListingForm>({
    ...emptyListingForm,
    sellerName: session?.name || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) onSessionRequired();
  }, [session, onSessionRequired]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) {
      onSessionRequired();
      return;
    }
    setError('');
    if (!form.make.trim() || !form.model.trim() || !form.year.trim()) {
      setError('Make, model, and year are required.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        sellerEmail: session.email,
        year: parseInt(form.year, 10) || form.year,
        price: form.price.replace(/[^\d]/g, '') || '0',
      };
      const resp = await fetch(API + '/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.token,
        },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        listing?: Listing;
        id?: string;
      };
      if (!resp.ok) {
        setError(data.error || 'Submission failed (' + resp.status + ')');
        return;
      }
      onSuccess(data.listing || { id: data.id || '' });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalWideStyle} onClick={(e) => e.stopPropagation()}>
        <span style={modalKickerStyle}>RWAS Marketplace</span>
        <h2 style={modalTitleStyle}>List Your Aircraft — Manual Form</h2>
        <p style={mutedStyle}>
          Fill in the fields you know. You can upload photos and logbooks after
          submission from <em>My Listings</em>. Everything is editable later.
        </p>

        <form onSubmit={handleSubmit}>
          <ListingFormFields
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          {error && <div style={errorStyle}>{error}</div>}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 20,
              position: 'sticky',
              bottom: 0,
              background: '#f7f4ef',
              paddingTop: 12,
              borderTop: '1px solid #ddd',
            }}
          >
            <button type="button" style={ghostBtnStyle} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={primaryBtnStyle} disabled={loading}>
              {loading ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────── Edit Listing Modal ───────────────────

function EditListingModal({
  listing,
  session,
  onClose,
}: {
  listing: Listing;
  session: Session;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ListingForm>(listingToForm(listing));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        sellerEmail: session.email,
        year: parseInt(form.year, 10) || form.year,
        price: form.price.replace(/[^\d]/g, '') || '0',
      };
      const resp = await fetch(API + '/listings/' + listing.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.token,
        },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error || 'Save failed (' + resp.status + ')');
        return;
      }
      onClose();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalWideStyle} onClick={(e) => e.stopPropagation()}>
        <span style={modalKickerStyle}>Listing ID {listing.id}</span>
        <h2 style={modalTitleStyle}>Edit Listing</h2>

        <form onSubmit={handleSubmit}>
          <ListingFormFields
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          {error && <div style={errorStyle}>{error}</div>}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 20,
              position: 'sticky',
              bottom: 0,
              background: '#f7f4ef',
              paddingTop: 12,
              borderTop: '1px solid #ddd',
            }}
          >
            <button type="button" style={ghostBtnStyle} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={primaryBtnStyle} disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
