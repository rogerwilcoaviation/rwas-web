/* eslint-disable @next/next/no-img-element -- Staff media uses the authenticated service. */
'use client';
import { useState } from 'react';
import { SELLER_API } from '@/lib/seller-api';
import {
  marketplaceStaffFetch,
  marketplaceStaffMediaPath,
} from '@/lib/marketplace-staff-fetch';
import { listingTitle } from '@/lib/marketplace/schema.mjs';
type Decision =
  | 'approve'
  | 'reject'
  | 'acceptance-approve'
  | 'acceptance-unpublish'
  | 'unpublish';
const decisions: Decision[] = [
  'approve',
  'reject',
  'acceptance-approve',
  'acceptance-unpublish',
  'unpublish',
];
type Review = {
  id: string;
  revision: number;
  status: string;
  reviewActions?: Decision[];
  acceptancePublicUntil?: number;
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
    [publicationAllowed, setPublicationAllowed] = useState(false),
    [activity, setActivity] = useState<'idle' | 'loading' | 'reviewing'>(
      'idle',
    ),
    [notes, setNotes] = useState<Record<string, string>>({});
  async function loadQueue() {
    setPublicationAllowed(false);
    const availability = fetch(SELLER_API + '/auth/methods', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
      .then(reviewResponse)
      .then((d) => d?.publicListings === true)
      .catch(() => false);
    const [d, publicationAvailable] = await Promise.all([
      marketplaceStaffFetch('/admin/listings', { cache: 'no-store' }).then(
        reviewResponse,
      ),
      availability,
    ]);
    if (!Array.isArray(d.listings)) throw new ReviewRequestError(502);
    const listings: Review[] = d.listings.map((l: Review) => ({
      ...l,
      reviewActions: Array.isArray(l.reviewActions)
        ? l.reviewActions.filter((action) => decisions.includes(action))
        : [],
    }));
    const reviewable = listings.filter(
      (l: Review) =>
        l.status === 'pending' ||
        l.reviewActions?.some((action) =>
          ['unpublish', 'acceptance-unpublish'].includes(action),
        ),
    );
    setPublicationAllowed(publicationAvailable);
    setItems(reviewable);
    setNotes((previous) =>
      Object.fromEntries(
        reviewable
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
  async function review(l: Review, decision: Decision) {
    if (
      decision === 'approve' &&
      (!publicationAllowed || !l.reviewActions?.includes('approve'))
    ) {
      setError(
        'Ordinary publication is unavailable. You can still request changes.',
      );
      return;
    }
    if (decision !== 'reject' && !l.reviewActions?.includes(decision)) {
      setError('This action is unavailable. Please reload the review queue.');
      return;
    }
    const confirmation: Record<Decision, string> = {
      approve: 'Publish this reviewed revision?',
      reject: 'Return this revision to the seller?',
      'acceptance-approve':
        'Temporarily publish this designated QA revision for up to 10 minutes?',
      'acceptance-unpublish': 'Remove this QA publication from public view?',
      unpublish:
        'Unpublish this listing and require a fresh review before publication?',
    };
    if (!confirm(confirmation[decision])) return;
    setBusy(true);
    setActivity('reviewing');
    setError('');
    try {
      const r = await marketplaceStaffFetch('/admin/review', {
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
      className="seller-review"
      id="main-content"
      tabIndex={-1}
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: 1000,
        boxSizing: 'border-box',
        margin: '40px auto',
        padding: 24,
        overflowWrap: 'anywhere',
      }}
    >
      <h1>Listing approvals</h1>
      <p>
        Staff access requires the approved identity service. Review details and
        media before deciding. A changed revision cannot be approved.
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
      {queueLoaded && !publicationAllowed && (
        <p role="status">
          Ordinary publication is unavailable. You can still request changes.
        </p>
      )}
      {queueLoaded && !error && items.every((l) => l.status !== 'pending') && (
        <p role="status">No listings are awaiting review.</p>
      )}
      {queueLoaded && !error && items.some((l) => l.status === 'pending') && (
        <p role="status">
          {items.filter((l) => l.status === 'pending').length === 1
            ? '1 listing is awaiting review.'
            : items.filter((l) => l.status === 'pending').length +
              ' listings are awaiting review.'}
        </p>
      )}
      {items.map((l) => (
        <section key={l.id} style={{ borderTop: '1px solid', marginTop: 24 }}>
          <h2>{listingTitle(l.fields)}</h2>
          <p>Revision {l.revision}</p>
          <p>Status: {l.status}</p>
          {l.reviewActions?.includes('acceptance-unpublish') && (
            <p>
              QA publication expiry:{' '}
              {new Date(l.acceptancePublicUntil!).toLocaleString()}.
            </p>
          )}
          <dl>
            {Object.entries(l.fields).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === 'object' ? JSON.stringify(v) : v}</dd>
              </div>
            ))}
          </dl>
          <p>
            {l.photos.length} photos · {l.videos.length} videos
          </p>
          {l.photos.map((f) => (
            <img
              key={f.key}
              src={marketplaceStaffMediaPath(f.key)}
              alt={f.name}
              style={{ maxWidth: '100%', maxHeight: 250 }}
            />
          ))}
          {l.videos.map((f) => (
            <video
              key={f.key}
              src={marketplaceStaffMediaPath(f.key)}
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
                  <a href={marketplaceStaffMediaPath(f.key)} download={f.name}>
                    {f.name}
                  </a>
                </p>
              ))}
            </div>
          ))}
          {l.status === 'pending' && (
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
                style={{ maxWidth: '100%', boxSizing: 'border-box' }}
              />
            </label>
          )}
          {l.status === 'pending' && (
            <>
              <button
                disabled={
                  busy ||
                  !publicationAllowed ||
                  !l.reviewActions?.includes('approve')
                }
                onClick={() => void review(l, 'approve')}
              >
                Approve and Publish
              </button>
              <button disabled={busy} onClick={() => void review(l, 'reject')}>
                Request Changes
              </button>
            </>
          )}
          {l.reviewActions?.includes('acceptance-approve') && (
            <button
              disabled={busy}
              onClick={() => void review(l, 'acceptance-approve')}
            >
              Publish QA Test Temporarily
            </button>
          )}
          {l.reviewActions?.includes('acceptance-unpublish') && (
            <button
              disabled={busy}
              onClick={() => void review(l, 'acceptance-unpublish')}
            >
              Unpublish QA Test
            </button>
          )}
          {l.reviewActions?.includes('unpublish') && (
            <button disabled={busy} onClick={() => void review(l, 'unpublish')}>
              Unpublish Listing
            </button>
          )}
        </section>
      ))}
    </main>
  );
}
