/* eslint-disable @next/next/no-img-element */
// ============================================================================
// PhotoManager — client component for seller photo management
// Target: ~/projects/rwas-web/app/aircraft-for-sale/photo-manager.tsx (NEW)
// ============================================================================
//
// Used inside EditListingModal (seller-auth-panel.tsx). Lets sellers add,
// delete, and reorder photos on an existing listing. Photo operations hit
// the Worker immediately (not staged like the text form) and are authed with
// the seller's Bearer session token.
//
// Backend endpoints used:
//   POST   /upload?listingId=X&category=photos&filename=Y   (binary body)
//   POST   /delete-file                                     { listingId, category, fileKey }
//   PUT    /listings/:id/photos/order                       { order: [keys] }
// ============================================================================

'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const API = 'https://sale-api.rogerwilcoaviation.com';

export interface Photo {
  key: string;
  name?: string;
  contentType?: string;
  size?: number;
}

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const MAX_BYTES = 50 * 1024 * 1024;

export function PhotoManager({
  listingId,
  initialPhotos,
  sessionToken,
  onPhotosChange,
}: {
  listingId: string;
  initialPhotos: Photo[];
  sessionToken: string;
  onPhotosChange?: (photos: Photo[]) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos || []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPhotos(initialPhotos || []);
  }, [initialPhotos]);

  const apply = (next: Photo[]) => {
    setPhotos(next);
    onPhotosChange?.(next);
  };

  const authHeaders = (extra?: Record<string, string>) => ({
    Authorization: 'Bearer ' + sessionToken,
    ...(extra || {}),
  });

  const uploadOne = async (f: File): Promise<Photo | null> => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`Skipped "${f.name}" — only JPG / PNG / WebP / GIF allowed.`);
      return null;
    }
    if (f.size > MAX_BYTES) {
      setError(`Skipped "${f.name}" — over 50 MB.`);
      return null;
    }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buf = await f.arrayBuffer();
    const url =
      API +
      '/upload?listingId=' +
      encodeURIComponent(listingId) +
      '&category=photos&filename=' +
      encodeURIComponent(safe);
    const resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': f.type || 'application/octet-stream',
      }),
      body: buf,
    });
    const data = (await resp.json().catch(() => ({}))) as {
      ok?: boolean;
      file?: Photo;
      error?: string;
    };
    if (!resp.ok || !data.ok || !data.file) {
      setError(data.error || `Upload failed for "${f.name}" (${resp.status}).`);
      return null;
    }
    return data.file;
  };

  const handleUpload = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    setBusy(true);
    setError('');
    setStatus(`Uploading ${arr.length} photo${arr.length > 1 ? 's' : ''}…`);
    let current = [...photos];
    let ok = 0;
    for (const f of arr) {
      const uploaded = await uploadOne(f);
      if (uploaded) {
        current = [...current, uploaded];
        ok++;
        apply(current);
      }
    }
    setBusy(false);
    setStatus(
      ok === arr.length
        ? `Uploaded ${ok} photo${ok > 1 ? 's' : ''}.`
        : `Uploaded ${ok}/${arr.length}. See error above.`,
    );
    if (inputRef.current) inputRef.current.value = '';
    setTimeout(() => setStatus(''), 4000);
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      const resp = await fetch(API + '/delete-file', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ listingId, category: 'photos', fileKey: key }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!resp.ok || !data.ok) {
        setError(data.error || `Delete failed (${resp.status}).`);
      } else {
        apply(photos.filter((p) => p.key !== key));
        setStatus('Photo deleted.');
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (e) {
      setError('Network error deleting photo.');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (key: string, dir: -1 | 1) => {
    const order = photos.map((p) => p.key);
    const i = order.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setBusy(true);
    setError('');
    try {
      const resp = await fetch(API + '/listings/' + listingId + '/photos/order', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ order }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        photos?: Photo[];
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        setError(data.error || `Reorder failed (${resp.status}).`);
        return;
      }
      if (Array.isArray(data.photos)) {
        apply(data.photos);
      } else {
        const byKey = new Map(photos.map((p) => [p.key, p]));
        apply(order.map((k) => byKey.get(k)).filter(Boolean) as Photo[]);
      }
    } catch (e) {
      setError('Network error reordering photos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <h3 style={headingStyle}>Photos ({photos.length})</h3>
        <span style={hintStyle}>JPG / PNG / WebP / GIF · up to 50 MB each</span>
      </div>

      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) handleUpload(e.dataTransfer.files);
        }}
        style={{
          ...dropZoneStyle,
          borderColor: dragOver ? '#5a7a5a' : '#bbb',
          background: dragOver ? '#eef7ee' : '#fff',
          cursor: busy ? 'wait' : 'pointer',
          color: dragOver ? '#5a7a5a' : '#666',
        }}
      >
        {busy && status ? status : 'Click to add photos or drop files here'}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => handleUpload(e.target.files)}
        style={{ display: 'none' }}
      />

      {error ? <div style={errorStyle}>{error}</div> : null}
      {!error && status && !busy ? <div style={statusStyle}>{status}</div> : null}

      {photos.length > 0 ? (
        <div style={gridStyle}>
          {photos.map((p, i) => (
            <div key={p.key} style={tileStyle}>
              <img
                src={API + '/files/' + encodeURIComponent(p.key)}
                alt={p.name || 'Listing photo ' + (i + 1)}
                loading="lazy"
                style={imgStyle}
              />
              <div style={tileCtrlsStyle}>
                {i > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMove(p.key, -1)}
                    title="Move earlier"
                    style={tileBtnStyle}
                  >
                    ‹
                  </button>
                ) : null}
                {i < photos.length - 1 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMove(p.key, 1)}
                    title="Move later"
                    style={tileBtnStyle}
                  >
                    ›
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(p.key)}
                  title="Delete"
                  style={tileDelStyle}
                >
                  ×
                </button>
              </div>
              <div style={orderBadgeStyle}>{i + 1}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>No photos yet — add some above.</div>
      )}
    </div>
  );
}

// ─── inline styles (matches seller-auth-panel.tsx aesthetic) ───

const wrapStyle: CSSProperties = {
  margin: '20px 0',
  padding: 14,
  border: '1px solid #ddd',
  background: '#fafaf7',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  gap: 10,
  flexWrap: 'wrap',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, serif',
  fontSize: 16,
  fontWeight: 700,
  color: '#1a1a1a',
};

const hintStyle: CSSProperties = { fontSize: 11, color: '#888' };

const dropZoneStyle: CSSProperties = {
  padding: 20,
  borderWidth: 1,
  borderStyle: 'dashed',
  textAlign: 'center',
  fontSize: 12,
  marginBottom: 10,
  transition: 'border-color 120ms, background 120ms, color 120ms',
};

const errorStyle: CSSProperties = {
  color: '#a55',
  fontSize: 12,
  marginBottom: 10,
  padding: '6px 10px',
  background: '#faf0f0',
  border: '1px solid #e5c5c5',
};

const statusStyle: CSSProperties = {
  color: '#5a7a5a',
  fontSize: 12,
  marginBottom: 10,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 6,
};

const tileStyle: CSSProperties = {
  position: 'relative',
  background: '#fff',
  border: '1px solid #ddd',
  aspectRatio: '4 / 3',
  overflow: 'hidden',
};

const imgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const tileCtrlsStyle: CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 3,
  display: 'flex',
  gap: 2,
};

const tileBtnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  color: '#1a1a1a',
  border: '1px solid #888',
  cursor: 'pointer',
  padding: '1px 6px',
  fontSize: 12,
  lineHeight: 1,
  fontFamily: 'inherit',
};

const tileDelStyle: CSSProperties = {
  ...tileBtnStyle,
  background: 'rgba(165,85,85,0.92)',
  color: '#fff',
  borderColor: '#a55',
};

const orderBadgeStyle: CSSProperties = {
  position: 'absolute',
  bottom: 3,
  left: 3,
  background: 'rgba(26,26,26,0.85)',
  color: '#d4c47a',
  padding: '1px 6px',
  fontSize: 10,
  fontFamily: 'Georgia, serif',
  fontWeight: 700,
  letterSpacing: '0.05em',
};

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: 20,
  color: '#999',
  fontSize: 12,
  fontStyle: 'italic',
};
