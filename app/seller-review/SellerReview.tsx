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
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [queueLoaded, setQueueLoaded] = useState(false),
    [publicationAllowed, setPublicationAllowed] = useState(false),
    [activity, setActivity] = useState<'idle' | 'loading' | 'reviewing'>(
      'idle',
    ),
    [notes, setNotes] = useState<Record<string, string>>({});
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
    <Container
      className={
        'admin-listing-panel seller-review' +
        (embedded ? '' : ' admin-review-standalone')
      }
      id={embedded ? undefined : 'main-content'}
      tabIndex={-1}
    >
      <AdminListingStyles />
      <header className="admin-panel-heading">
        <div>
          <Heading>Listing approvals</Heading>
          <p>
            Review the listing details, photos and documents, then approve
            publication or request changes from the seller.
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
      <div className="admin-listing-list">
        {items.map((l) => (
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
            {l.reviewActions?.includes('acceptance-unpublish') && (
              <p className="admin-feedback">
                QA publication expiry:{' '}
                {new Date(l.acceptancePublicUntil!).toLocaleString()}.
              </p>
            )}
            <JerryResearchPanel
              review={l.jerryReview}
              disabled={busy || l.status !== 'pending'}
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
            <ListingDetails fields={l.fields} headingLevel={embedded ? 4 : 3} />
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
