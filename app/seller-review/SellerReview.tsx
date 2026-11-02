/* eslint-disable @next/next/no-img-element -- Staff media uses the authenticated service. */
'use client';
import { useEffect, useState } from 'react';
import JerryResearchPanel, {
  type JerryResearch,
} from '../aircraft-for-sale/jerry-research-panel';
import { SELLER_API } from '@/lib/seller-api';
import {
  marketplaceStaffFetch,
  marketplaceStaffMediaPath,
} from '@/lib/marketplace-staff-fetch';
import { listingTitle } from '@/lib/marketplace/schema.mjs';
import {
  AdminListingStyles,
  ListingDetails,
  ListingFacts,
  ListingStatus,
  fieldLabel,
} from '../aircraft-for-sale/admin-listing-presentation';
import { mediaSteps } from '../aircraft-for-sale/listing-draft-fields';
import ReviewNotifications, {
  NotificationSummary,
  type NotificationReceipt,
} from './ReviewNotifications';
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
  createdAt?: number | string;
  updatedAt?: number | string;
  reviewSubmittedAt?: number | string;
  reviewNotifications?: NotificationReceipt | null;
  jerryReview?: JerryResearch;
  reviewActions?: Decision[];
  acceptancePublicUntil?: number;
  fields: Record<string, unknown>;
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
const reviewTime = (l: Review) => {
  const value = l.reviewSubmittedAt || l.updatedAt || l.createdAt;
  const timestamp = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};
export default function SellerReview({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const Container = embedded ? 'div' : 'main';
  const Heading = embedded ? 'h2' : 'h1';
  const CardHeading = embedded ? 'h3' : 'h2';
  const DetailHeading = embedded ? 'h4' : 'h3';
  const [items, setItems] = useState<Review[]>([]),
    [selectedId, setSelectedId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [queueLoaded, setQueueLoaded] = useState(false),
    [publicationAllowed, setPublicationAllowed] = useState(false),
    [activity, setActivity] = useState<'idle' | 'loading' | 'reviewing'>(
      'idle',
    ),
    [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      'listing',
    );
    if (requested && /^[a-f0-9-]{36}$/i.test(requested))
      setSelectedId(requested);
  }, []);
  useEffect(() => {
    if (
      busy ||
      !items.some((item) =>
        ['queued', 'researching'].includes(item.jerryReview?.status || ''),
      )
    )
      return;
    const timer = setTimeout(
      () =>
        void loadQueue().catch((error) =>
          setError(
            error instanceof Error
              ? error.message
              : 'Research could not be refreshed.',
          ),
        ),
      5000,
    );
    return () => clearTimeout(timer);
    // Refresh advisory reports only while research is in flight.
  }, [items, busy]);
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
    const reviewable = listings
      .filter(
        (l: Review) =>
          l.status === 'pending' ||
          l.reviewActions?.some((action) =>
            ['unpublish', 'acceptance-unpublish'].includes(action),
          ),
      )
      .sort(
        (a, b) =>
          Number(b.status === 'pending') - Number(a.status === 'pending') ||
          reviewTime(b) - reviewTime(a) ||
          a.id.localeCompare(b.id),
      );
    setPublicationAllowed(publicationAvailable);
    setItems(reviewable);
    setSelectedId((previous) =>
      reviewable.some((listing) => listing.id === previous)
        ? previous
        : reviewable[0]?.id || '',
    );
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
    <Container
      className={
        'admin-listing-panel seller-review' +
        (embedded ? '' : ' admin-review-standalone')
      }
      id={embedded ? undefined : 'main-content'}
      tabIndex={-1}
    >
      <AdminListingStyles />
      <style jsx global>{`
        .seller-review {
          width: 100%;
        }
        .seller-review .admin-review-queue {
          margin: 20px 0 24px;
        }
        .seller-review .admin-review-table-scroll {
          min-width: 0;
          max-width: 100%;
          overflow-x: auto;
          border: 1px solid #d5cec1;
          border-radius: 6px;
        }
        .seller-review .admin-review-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          background: #fff;
          text-align: left;
        }
        .seller-review .admin-review-table th {
          background: #ede9df;
          color: #514b40;
          font-size: 12px;
        }
        .seller-review .admin-review-table th,
        .seller-review .admin-review-table td {
          padding: 12px;
          border-bottom: 1px solid #ded8cd;
          vertical-align: middle;
        }
        .seller-review .admin-review-table tr:last-child td {
          border-bottom: 0;
        }
        .seller-review .admin-review-table tr[data-selected='true'] {
          background: #fcf5df;
          box-shadow: inset 3px 0 #b99727;
        }
        .seller-review .admin-review-table tbody tr:hover {
          background: #f5f2e9;
        }
        .seller-review .admin-review-table input[type='radio'] {
          width: 18px;
          height: 18px;
          min-height: 0;
          padding: 0;
          accent-color: #8b6c0a;
          cursor: pointer;
        }
        .seller-review .admin-review-row-title {
          padding: 6px 0;
          border: 0;
          background: transparent;
          color: #292820;
          font:
            600 14px/1.4 Arial,
            sans-serif;
          text-align: left;
          text-decoration: underline;
          cursor: pointer;
        }
        .seller-review .admin-review-row-title:focus-visible,
        .seller-review .admin-review-table-scroll:focus-visible {
          outline: 3px solid #8b6c0a;
          outline-offset: 3px;
        }
        .seller-review .admin-review-table time {
          font-size: 13px;
        }
        .seller-review .admin-review-queue > p {
          margin: 0 0 10px;
        }
      `}</style>
      <header className="admin-panel-heading">
        <div>
          <Heading>Listing approvals</Heading>
          <p>
            Select a listing below to review its details, photos and documents,
            then approve publication or request changes from the seller.
          </p>
        </div>
        <button
          className="admin-button"
          type="button"
          onClick={() => void load()}
          disabled={busy}
          aria-busy={activity === 'loading'}
        >
          {activity === 'loading'
            ? 'Loading Review Queue…'
            : 'Load Review Queue'}
        </button>
      </header>
      <ReviewNotifications />
      {!queueLoaded && !busy && !error && (
        <p className="admin-empty">
          Load the review queue to see listings awaiting your decision.
        </p>
      )}
      {activity === 'loading' && (
        <p className="admin-feedback" role="status">
          Loading review queue…
        </p>
      )}
      {activity === 'reviewing' && (
        <p className="admin-feedback" role="status">
          Submitting review decision…
        </p>
      )}
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
      {queueLoaded && !publicationAllowed && (
        <p className="admin-feedback" role="status">
          Ordinary publication is unavailable. You can still request changes.
        </p>
      )}
      {queueLoaded && !error && items.every((l) => l.status !== 'pending') && (
        <p className="admin-feedback" role="status">
          No listings are awaiting review.
        </p>
      )}
      {queueLoaded && !error && items.some((l) => l.status === 'pending') && (
        <p className="admin-feedback" role="status">
          {items.filter((l) => l.status === 'pending').length === 1
            ? '1 listing is awaiting review.'
            : items.filter((l) => l.status === 'pending').length +
              ' listings are awaiting review.'}
        </p>
      )}
      {items.length > 0 && (
        <div className="admin-review-queue">
          <p className="admin-muted">
            Newest submissions first. Times are shown in your local time.
          </p>
          <div
            className="admin-review-table-scroll"
            role="region"
            aria-label="Listing approval queue"
            tabIndex={0}
          >
            <table className="admin-review-table">
              <caption className="sr-only">
                Select a listing to review. Awaiting approval first, newest
                submissions first.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Seller</th>
                  <th scope="col">Submitted / updated</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} data-selected={l.id === selectedId}>
                    <td>
                      <input
                        type="radio"
                        name={
                          embedded
                            ? 'embedded-review-listing'
                            : 'review-listing'
                        }
                        checked={l.id === selectedId}
                        disabled={busy}
                        onChange={() => setSelectedId(l.id)}
                        aria-label={'Select ' + listingTitle(l.fields)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-review-row-title"
                        disabled={busy}
                        aria-pressed={l.id === selectedId}
                        aria-controls={
                          embedded
                            ? 'embedded-review-details'
                            : 'review-details'
                        }
                        onClick={() => setSelectedId(l.id)}
                      >
                        {listingTitle(l.fields)}
                      </button>
                    </td>
                    <td>{String(l.fields.sellerName || 'Not provided')}</td>
                    <td>
                      {reviewTime(l) ? (
                        <time dateTime={new Date(reviewTime(l)).toISOString()}>
                          {new Date(reviewTime(l)).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </time>
                      ) : (
                        'Not recorded'
                      )}
                    </td>
                    <td>
                      <ListingStatus status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div
        className="admin-listing-list"
        id={embedded ? 'embedded-review-details' : 'review-details'}
      >
        {items
          .filter((l) => l.id === selectedId)
          .map((l) => (
            <section
              className="admin-listing-card"
              key={l.id}
              aria-label={listingTitle(l.fields)}
            >
              <header className="admin-card-heading">
                <div>
                  <CardHeading className="admin-card-title">
                    {listingTitle(l.fields)}
                  </CardHeading>
                  <p className="admin-card-revision">
                    Revision {l.revision}
                    {l.fields.sellerName
                      ? ' · Seller: ' + String(l.fields.sellerName)
                      : ''}
                  </p>
                </div>
                <ListingStatus status={l.status} />
              </header>
              <NotificationSummary receipt={l.reviewNotifications} />
              {l.reviewActions?.includes('acceptance-unpublish') && (
                <p className="admin-feedback">
                  QA publication expiry:{' '}
                  {new Date(l.acceptancePublicUntil!).toLocaleString()}.
                </p>
              )}
              <JerryResearchPanel
                review={l.jerryReview}
                disabled={busy || !['pending', 'active'].includes(l.status)}
                onRefresh={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      await marketplaceStaffFetch('/admin/review', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          listingId: l.id,
                          revision: l.revision,
                          decision: 'research',
                        }),
                      }).then(reviewResponse);
                      await loadQueue();
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : 'Research could not be requested.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              />
              <ListingFacts fields={l.fields} />
              <ListingDetails
                fields={l.fields}
                headingLevel={embedded ? 4 : 3}
              />
              <div className="admin-review-media">
                <DetailHeading>Photos and videos</DetailHeading>
                <p className="admin-muted">
                  {l.photos.length} photos · {l.videos.length} videos. Select a
                  photo to open the full image.
                </p>
                <div className="admin-photo-grid">
                  {l.photos.map((f) => (
                    <a
                      key={f.key}
                      href={marketplaceStaffMediaPath(f.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={marketplaceStaffMediaPath(f.key)}
                        alt={f.name}
                        loading="lazy"
                      />
                      <span className="admin-photo-caption">{f.name}</span>
                    </a>
                  ))}
                  {l.videos.map((f) => (
                    <div key={f.key}>
                      <video
                        src={marketplaceStaffMediaPath(f.key)}
                        controls
                        preload="metadata"
                        aria-label={f.name}
                      />
                      <span className="admin-photo-caption">{f.name}</span>
                    </div>
                  ))}
                </div>
                {!l.photos.length && !l.videos.length && (
                  <p className="admin-muted">No photos or videos attached.</p>
                )}
              </div>
              <div className="admin-documents">
                <DetailHeading>Documents</DetailHeading>
                {Object.entries(l.logbooks || {})
                  .filter(([, files]) => files.length)
                  .map(([category, files]) => (
                    <details className="admin-document-group" key={category}>
                      <summary>
                        {mediaSteps.find(([key]) => key === category)?.[1] ||
                          fieldLabel(category)}{' '}
                        ({files.length})
                      </summary>
                      {files.map((f) => (
                        <p key={f.key}>
                          <a
                            href={marketplaceStaffMediaPath(f.key)}
                            download={f.name}
                          >
                            {f.name}
                          </a>
                        </p>
                      ))}
                    </details>
                  ))}
                {!Object.values(l.logbooks || {}).some(
                  (files) => files.length,
                ) && <p className="admin-muted">No documents attached.</p>}
              </div>
              <div className="admin-review-footer">
                {l.status === 'pending' && (
                  <label className="admin-review-note">
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
                      rows={3}
                      placeholder="Add feedback for the seller, if needed."
                    />
                  </label>
                )}
                <div className="admin-action-row">
                  {l.status === 'pending' && (
                    <>
                      <button
                        className="admin-button admin-primary"
                        disabled={
                          busy ||
                          !publicationAllowed ||
                          !l.reviewActions?.includes('approve')
                        }
                        onClick={() => void review(l, 'approve')}
                      >
                        Approve and Publish
                      </button>
                      <button
                        className="admin-button"
                        disabled={busy}
                        onClick={() => void review(l, 'reject')}
                      >
                        Request Changes
                      </button>
                    </>
                  )}
                  {l.reviewActions?.includes('acceptance-approve') && (
                    <button
                      className="admin-button"
                      disabled={busy}
                      onClick={() => void review(l, 'acceptance-approve')}
                    >
                      Publish QA Test Temporarily
                    </button>
                  )}
                  {l.reviewActions?.includes('acceptance-unpublish') && (
                    <button
                      className="admin-button"
                      disabled={busy}
                      onClick={() => void review(l, 'acceptance-unpublish')}
                    >
                      Unpublish QA Test
                    </button>
                  )}
                  {l.reviewActions?.includes('unpublish') && (
                    <button
                      className="admin-button admin-danger"
                      disabled={busy}
                      onClick={() => void review(l, 'unpublish')}
                    >
                      Unpublish Listing
                    </button>
                  )}
                </div>
              </div>
            </section>
          ))}
      </div>
    </Container>
  );
}
