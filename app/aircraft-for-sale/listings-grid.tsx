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
// state.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { ListingCard, type Listing } from './listing-card';

const API = 'https://sale-api.rogerwilcoaviation.com';

export function ListingsGrid({ initialListings }: { initialListings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetch(API + '/browse', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { listings?: Listing[] }) => {
        if (cancelled) return;
        const fresh = (data.listings || []).filter(
          (l) => !l.status || l.status === 'active',
        );
        setListings(fresh);
      })
      .catch(() => {
        // Network or server error — keep showing initialListings rather than blanking
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
