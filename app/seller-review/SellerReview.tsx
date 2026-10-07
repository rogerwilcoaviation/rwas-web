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
class ReviewRequestError extends Error {
  constructor(public status: number) {
    super(
      status === 401 || status === 403
        ? 'Sign in with your approved staff account, then load the review queue again.'
        : status === 409
          ? 'Listing changed. Review the latest revision before deciding.'
          : status === 503
            ? 'Staff review is unavailable. Please try again after review access is configured.'
            : 'Review unavailable. Please try again.',
    );
  }
}
async function reviewResponse(r: Response) {
  if (r.redirected) throw new ReviewRequestError(403);
  if (!r.ok) throw new ReviewRequestError(r.status);
  if (!r.headers.get('Content-Type')?.includes('application/json'))
    throw new ReviewRequestError(403);
  try {
    return await r.json();
  } catch {
    throw new ReviewRequestError(502);
  }
}
const noteKey = (l: Review) => `${l.id}:${l.revision}`;
export default function SellerReview() {
  const [items, setItems] = useState<Review[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [queueLoaded, setQueueLoaded] = useState(false),
    [activity, setActivity] = useState<'idle' | 'loading' | 'reviewing'>(
      'idle',
    ),
    [notes, setNotes] = useState<Record<string, string>>({});
  async function loadQueue() {
    const r = await fetch(SELLER_API + '/admin/listings', {
      cache: 'no-store',
    });
    const d = await reviewResponse(r);
    if (!Array.isArray(d.listings)) throw new ReviewRequestError(502);
    const pending: Review[] = d.listings.filter(
      (l: Review) => l.status === 'pending',
    );
    setItems(pending);
    setNotes((previous) =>
      Object.fromEntries(
        pending
          .filter((l) => Object.hasOwn(previous, noteKey(l)))
          .map((l) => [noteKey(l), previous[noteKey(l)]]),
      ),
    );
    setQueueLoaded(true);
  }
  async function load() {
    setBusy(true);
    setActivity('loading');
    setQueueLoaded(false);
    setError('');
    try {
      await loadQueue();
    } catch (e) {
      setItems([]);
      setNotes({});
      setQueueLoaded(false);
      setError(
        e instanceof ReviewRequestError
          ? e.message
          : 'Review unavailable. Please try again.',
      );
    } finally {
      setBusy(false);
      setActivity('idle');
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
    setActivity('reviewing');
    setError('');
    try {
      const r = await fetch(SELLER_API + '/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: l.id,
          revision: l.revision,
          decision,
          note: notes[noteKey(l)] || '',
        }),
      });
      await reviewResponse(r);
      await loadQueue();
    } catch (e) {
      if (e instanceof ReviewRequestError && e.status === 409) {
        try {
          await loadQueue();
        } catch {
          setItems([]);
          setNotes({});
          setQueueLoaded(false);
        }
      } else {
        setItems([]);
        setNotes({});
        setQueueLoaded(false);
      }
      setError(
        e instanceof ReviewRequestError
          ? e.message
          : 'Review failed. Please load the queue again before deciding.',
      );
    } finally {
      setBusy(false);
      setActivity('idle');
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      style={{ maxWidth: 1000, margin: '40px auto', padding: 24 }}
    >
      <h1>Aircraft listing review</h1>
      <p>
        Staff access requires the approved identity service. Review details and
        media before publishing. A changed revision cannot be approved.
      </p>
      <button
        type="button"
        onClick={() => void load()}
        disabled={busy}
        aria-busy={activity === 'loading'}
      >
        {activity === 'loading' ? 'Loading Review Queue…' : 'Load Review Queue'}
      </button>
      {activity === 'loading' && <p role="status">Loading review queue…</p>}
      {activity === 'reviewing' && (
        <p role="status">Submitting review decision…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {queueLoaded && !error && items.length === 0 && (
        <p role="status">No listings are awaiting review.</p>
      )}
      {queueLoaded && !error && items.length > 0 && (
        <p role="status">
          {items.length === 1
            ? '1 listing is awaiting review.'
            : items.length + ' listings are awaiting review.'}
        </p>
      )}
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
              value={notes[noteKey(l)] || ''}
              onChange={(e) =>
                setNotes((previous) => ({
                  ...previous,
                  [noteKey(l)]: e.target.value,
                }))
              }
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
