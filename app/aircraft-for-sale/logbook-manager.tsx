/* eslint-disable @next/next/no-img-element */
// ============================================================================
// LogbookManager — client component for seller logbook uploads
// Target: ~/projects/rwas-web/app/aircraft-for-sale/logbook-manager.tsx (NEW)
// ============================================================================
//
// Used inside EditListingModal alongside PhotoManager. Sellers can upload,
// view, and delete PDF logbook documents across five categories:
//   airframe · powerplant · propeller · adSbCompliance · misc
//
// PDF only by seller request. Backend accepts more formats, but this UI
// intentionally restricts to application/pdf.
//
// Endpoints used:
//   POST   /upload?listingId=X&category=<cat>&filename=Y  (binary body)
//   POST   /delete-file                                    { listingId, category, fileKey }
// ============================================================================

'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const API = 'https://sale-api.rogerwilcoaviation.com';

export interface LogbookFile {
  key: string;
  name?: string;
  size?: number;
  contentType?: string;
}

export type LogbookCategory =
  | 'airframe'
  | 'powerplant'
  | 'propeller'
  | 'adSbCompliance'
  | 'misc';

export interface Logbooks {
  airframe?: LogbookFile[];
  powerplant?: LogbookFile[];
  propeller?: LogbookFile[];
  adSbCompliance?: LogbookFile[];
  misc?: LogbookFile[];
}

const CATEGORIES: { key: LogbookCategory; label: string; hint: string }[] = [
  { key: 'airframe', label: 'Airframe Logbook', hint: 'Aircraft airframe records' },
  { key: 'powerplant', label: 'Engine Logbook', hint: 'Powerplant / engine records' },
  { key: 'propeller', label: 'Propeller Logbook', hint: 'Propeller records' },
  { key: 'adSbCompliance', label: 'AD / SB Compliance', hint: 'Airworthiness Directive & Service Bulletin records' },
  { key: 'misc', label: 'Other Documents', hint: 'Weight & balance, equipment list, STCs, 337s, etc.' },
];

const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n?: number) {
  if (!n || n <= 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function LogbookManager({
  listingId,
  initialLogbooks,
  sessionToken,
  onLogbooksChange,
}: {
  listingId: string;
  initialLogbooks: Logbooks;
  sessionToken: string;
  onLogbooksChange?: (lb: Logbooks) => void;
}) {
  const [logbooks, setLogbooks] = useState<Logbooks>(initialLogbooks || {});
  const [busyCat, setBusyCat] = useState<LogbookCategory | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLogbooks(initialLogbooks || {});
  }, [initialLogbooks]);

  const update = (next: Logbooks) => {
    setLogbooks(next);
    onLogbooksChange?.(next);
  };

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <h3 style={headingStyle}>Logbooks &amp; Documents</h3>
        <span style={hintStyle}>PDF only · up to 50 MB each</span>
      </div>
      {error ? <div style={errorStyle}>{error}</div> : null}

      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          category={cat.key}
          label={cat.label}
          hint={cat.hint}
          files={logbooks[cat.key] || []}
          listingId={listingId}
          sessionToken={sessionToken}
          busy={busyCat === cat.key}
          setBusy={(b) => setBusyCat(b ? cat.key : null)}
          setError={setError}
          onChange={(nextFiles) => update({ ...logbooks, [cat.key]: nextFiles })}
        />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  label,
  hint,
  files,
  listingId,
  sessionToken,
  busy,
  setBusy,
  setError,
  onChange,
}: {
  category: LogbookCategory;
  label: string;
  hint: string;
  files: LogbookFile[];
  listingId: string;
  sessionToken: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (s: string) => void;
  onChange: (files: LogbookFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const authHeaders = (extra?: Record<string, string>) => ({
    Authorization: 'Bearer ' + sessionToken,
    ...(extra || {}),
  });

  const uploadOne = async (f: File): Promise<LogbookFile | null> => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'pdf') {
      setError(`"${f.name}" skipped — PDF files only.`);
      return null;
    }
    if (f.type && f.type !== 'application/pdf') {
      setError(`"${f.name}" skipped — detected type "${f.type}" is not a PDF.`);
      return null;
    }
    if (f.size > MAX_BYTES) {
      setError(`"${f.name}" skipped — over 50 MB.`);
      return null;
    }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buf = await f.arrayBuffer();
    const url =
      API +
      '/upload?listingId=' +
      encodeURIComponent(listingId) +
      '&category=' +
      encodeURIComponent(category) +
      '&filename=' +
      encodeURIComponent(safe);
    const resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/pdf' }),
      body: buf,
    });
    const data = (await resp.json().catch(() => ({}))) as {
      ok?: boolean;
      file?: LogbookFile;
      error?: string;
    };
    if (!resp.ok || !data.ok || !data.file) {
      setError(data.error || `Upload failed for "${f.name}" (${resp.status}).`);
      return null;
    }
    return data.file;
  };

  const handleUpload = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList);
    if (!arr.length) return;
    setBusy(true);
    setError('');
    let current = [...files];
    for (const f of arr) {
      const uploaded = await uploadOne(f);
      if (uploaded) current = [...current, uploaded];
    }
    onChange(current);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      const resp = await fetch(API + '/delete-file', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ listingId, category, fileKey: key }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!resp.ok || !data.ok) {
        setError(data.error || `Delete failed (${resp.status}).`);
      } else {
        onChange(files.filter((f) => f.key !== key));
      }
    } catch (e) {
      setError('Network error deleting document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={sectionLabelStyle}>{label}</div>
          <div style={sectionHintStyle}>{hint}</div>
        </div>
        <span style={countStyle}>
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
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
          borderColor: dragOver ? '#5a7a5a' : '#ccc',
          background: dragOver ? '#eef7ee' : '#fff',
          cursor: busy ? 'wait' : 'pointer',
          color: dragOver ? '#5a7a5a' : '#666',
        }}
      >
        {busy ? 'Uploading…' : 'Click or drop PDFs here'}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        onChange={(e) => handleUpload(e.target.files)}
        style={{ display: 'none' }}
      />

      {files.length > 0 ? (
        <ul style={listStyle}>
          {files.map((f) => (
            <li key={f.key} style={fileRowStyle}>
              <a
                href={API + '/files/' + encodeURIComponent(f.key)}
                target="_blank"
                rel="noreferrer"
                style={fileLinkStyle}
              >
                <span style={iconStyle}>📄</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name || f.key.split('/').pop()}
                </span>
                {f.size ? <span style={sizeStyle}>{formatBytes(f.size)}</span> : null}
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(f.key)}
                title="Delete"
                style={deleteBtnStyle}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── inline styles ───

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

const errorStyle: CSSProperties = {
  color: '#a55',
  fontSize: 12,
  marginBottom: 10,
  padding: '6px 10px',
  background: '#faf0f0',
  border: '1px solid #e5c5c5',
};

const sectionStyle: CSSProperties = {
  marginBottom: 12,
  padding: 10,
  background: '#fff',
  border: '1px solid #e5e5dc',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 8,
  gap: 10,
};

const sectionLabelStyle: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: 14,
  fontWeight: 700,
  color: '#1a1a1a',
};

const sectionHintStyle: CSSProperties = {
  fontSize: 11,
  color: '#888',
  marginTop: 1,
};

const countStyle: CSSProperties = {
  fontSize: 10,
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '2px 8px',
  border: '1px solid #ddd',
  borderRadius: 2,
  background: '#fafaf7',
  flexShrink: 0,
};

const dropZoneStyle: CSSProperties = {
  padding: 12,
  borderWidth: 1,
  borderStyle: 'dashed',
  textAlign: 'center',
  fontSize: 12,
  marginBottom: 8,
  transition: 'border-color 120ms, background 120ms, color 120ms',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const fileRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  background: '#fafaf7',
  border: '1px solid #e5e5dc',
  fontSize: 12,
};

const fileLinkStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  color: '#1a1a1a',
  textDecoration: 'none',
};

const iconStyle: CSSProperties = { fontSize: 14, flexShrink: 0 };

const sizeStyle: CSSProperties = {
  fontSize: 10,
  color: '#888',
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};

const deleteBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid #c88',
  color: '#a55',
  cursor: 'pointer',
  padding: '2px 8px',
  fontSize: 14,
  lineHeight: 1,
  fontFamily: 'inherit',
  flexShrink: 0,
};
