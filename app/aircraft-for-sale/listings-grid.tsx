// ============================================================================
// ListingsGrid — client component that keeps public inventory fresh
// Target: ~/projects/rwas-web/app/aircraft-for-sale/listings-grid.tsx (NEW)
// ============================================================================
//
// The /aircraft-for-sale page is built with `output: 'export'`, which freezes
// server-rendered data at build time. Without client-side refresh, new
// listings don't appear until the next site rebuild. This component fixes
// that by hydrating from server-provided `initialListings` (for SEO and fast
// first paint), then refetching from /browse on mount, while visible, and
// when returning to the page. New seller inventory comes only from its public
// route; private account listings never feed this grid.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { ListingCard, type Listing } from './listing-card';
import {
  marketplaceListingKey,
  marketplaceInitialListings,
  refreshPublicMarketplaceListings,
} from '@/lib/public-aircraft-marketplace.mjs';

const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_TIMEOUT_MS = 10_000;

export function ListingsGrid({
  initialListings,
}: {
  initialListings: Listing[];
}) {
  const [listings, setListings] = useState<Listing[]>(() =>
    marketplaceInitialListings(initialListings),
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fallback = marketplaceInitialListings(initialListings);
    let controller: AbortController | undefined;
    let timeout: number | undefined;
    const refresh = () => {
      if (cancelled || controller || document.visibilityState === 'hidden')
        return;
      const request = new AbortController();
      controller = request;
      timeout = window.setTimeout(() => request.abort(), REFRESH_TIMEOUT_MS);
      setRefreshing(true);
      refreshPublicMarketplaceListings(
        (input, options) =>
          fetch(input, { ...options, signal: request.signal }),
        fallback,
      )
        .then((fresh) => {
          if (cancelled) return;
          fallback = fresh;
          setListings(fresh);
        })
        .finally(() => {
          window.clearTimeout(timeout);
          controller = undefined;
          if (!cancelled) setRefreshing(false);
        });
    };
    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      controller?.abort();
    };
  }, [initialListings]);

  if (listings.length === 0) {
    return (
      <div className="a4s-empty">
        No aircraft are listed for sale right now. Check back soon — or click{' '}
        <strong>List Your Aircraft</strong> above to get yours in front of
        buyers.
      </div>
    );
  }

  return (
    <div
      className="a4s-grid"
      style={{ opacity: refreshing ? 0.88 : 1, transition: 'opacity 200ms' }}
    >
      {listings.map((l) => (
        <ListingCard key={marketplaceListingKey(l)} listing={l} />
      ))}
    </div>
  );
}
