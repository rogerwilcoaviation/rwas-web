/* eslint-disable @next/next/no-img-element -- Staff media uses the authenticated service. */
'use client';
import { useState } from 'react';
import { SELLER_API } from '@/lib/seller-api';
type Review = {
  id: string;
  revision: number;
  status: string;
  fields: Record<string, string | number>;
  photos: { key: string; name: string }[];
  videos: { key: string; name: string }[];
  logbooks: Record<string, { key: string; name: string }[]>;
};
export default function SellerReview() {
  const [items, setItems] = useState<Review[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState('');
  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(SELLER_API + '/admin/listings', {
        cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setItems(d.listings.filter((l: Review) => l.status === 'pending'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function review(l: Review, decision: string) {
    if (
      !confirm(
        decision === 'approve'
          ? 'Publish this reviewed revision?'
          : 'Return this revision to the seller?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(SELLER_API + '/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: l.id,
          revision: l.revision,
          decision,
          note,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', padding: 24 }}>
      <h1>Aircraft listing review</h1>
      <p>
        Staff access is verified by the approved identity service. Review
        details and media before publishing. A changed revision cannot be
        approved.
      </p>
      <button onClick={() => void load()} disabled={busy}>
        Load Review Queue
      </button>
      {error && <p role="alert">{error}</p>}
      {items.map((l) => (
        <section key={l.id} style={{ borderTop: '1px solid', marginTop: 24 }}>
          <h2>
            {l.fields.year} {l.fields.make} {l.fields.model}
          </h2>
          <p>Revision {l.revision}</p>
          <dl>
            {Object.entries(l.fields).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p>
            {l.photos.length} photos · {l.videos.length} videos
          </p>
          {l.photos.map((f) => (
            <img
              key={f.key}
              src={SELLER_API + '/admin/files/' + encodeURIComponent(f.key)}
              alt={f.name}
              style={{ maxWidth: '100%', maxHeight: 250 }}
            />
          ))}
          {l.videos.map((f) => (
            <video
              key={f.key}
              src={SELLER_API + '/admin/files/' + encodeURIComponent(f.key)}
              controls
              preload="metadata"
              aria-label={f.name}
              style={{ maxWidth: '100%' }}
            />
          ))}
          {Object.entries(l.logbooks || {}).map(([category, files]) => (
            <div key={category}>
              <h3>
                {category} records ({files.length})
              </h3>
              {files.map((f) => (
                <p key={f.key}>
                  <a
                    href={
                      SELLER_API + '/admin/files/' + encodeURIComponent(f.key)
                    }
                    download={f.name}
                  >
                    {f.name}
                  </a>
                </p>
              ))}
            </div>
          ))}
          <label>
            Review note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </label>
          <button disabled={busy} onClick={() => void review(l, 'approve')}>
            Approve and Publish
          </button>
          <button disabled={busy} onClick={() => void review(l, 'reject')}>
            Request Changes
          </button>
        </section>
      ))}
    </main>
  );
}
