// ============================================================================
// ListingsGrid — client component that fetches fresh listings on every visit
// Target: ~/projects/rwas-web/app/aircraft-for-sale/listings-grid.tsx (NEW)
// ============================================================================
//
// The /aircraft-for-sale page is built with `output: 'export'`, which freezes
// server-rendered data at build time. Without client-side refresh, new
// listings don't appear until the next site rebuild. This component fixes
// that by hydrating from server-provided `initialListings` (for SEO and fast
// first paint), then refetching from /browse on mount to show the current
// state. New seller inventory comes only from its anonymous public browse
// route; private account listings never feed this grid.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { ListingCard, type Listing } from './listing-card';
import {
  marketplaceListingKey,
  refreshPublicMarketplaceListings,
} from '@/lib/public-aircraft-marketplace.mjs';

export function ListingsGrid({ initialListings }: { initialListings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setRefreshing(true);
    refreshPublicMarketplaceListings(
      (input, options) => fetch(input, { ...options, signal: controller.signal }),
      initialListings,
    )
      .then((fresh) => {
        if (cancelled) return;
        setListings(fresh);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialListings]);

  if (listings.length === 0) {
    return (
      <div className="a4s-empty">
        No aircraft are listed for sale right now. Check back soon — or click{' '}
        <strong>List Your Aircraft</strong> above to get yours in front of buyers.
      </div>
    );
  }

  return (
    <div className="a4s-grid" style={{ opacity: refreshing ? 0.88 : 1, transition: 'opacity 200ms' }}>
      {listings.map((l) => (
        <ListingCard key={marketplaceListingKey(l)} listing={l} />
      ))}
    </div>
  );
}
