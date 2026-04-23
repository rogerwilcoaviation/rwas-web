'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Listing = {
  id: string;
  make?: string;
  model?: string;
  year?: string | number;
  category?: string;
  price?: string | number;
  photos?: Array<{ key: string }>;
  logbooks?: Record<string, unknown[] | null>;
};

type FeedState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; listings: Listing[] };

const LOADING_STYLE: React.CSSProperties = {
  fontStyle: 'italic',
  fontSize: '12px',
  color: '#888',
  padding: '8px 0',
};

export default function AircraftSaleFeed() {
  const [state, setState] = useState<FeedState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch('https://sale-api.rogerwilcoaviation.com/browse')
      .then((r) => r.json())
      .then((data: { listings?: Listing[] }) => {
        if (!alive) return;
        const listings = (data.listings || []).slice(0, 4);
        if (!listings.length) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'ready', listings });
        }
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.status === 'loading') {
    return <div style={LOADING_STYLE}>Loading listings&hellip;</div>;
  }

  if (state.status === 'error') {
    return (
      <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#888' }}>
        Could not load listings.
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div style={LOADING_STYLE}>
        No aircraft currently listed.{' '}
        <Link
          href="/aircraft-for-sale#sell"
          style={{ color: '#1a1a1a', textDecoration: 'underline' }}
        >
          List yours today.
        </Link>
      </div>
    );
  }

  return (
    <>
      {state.listings.map((l) => {
        const priceRaw = l.price ? String(l.price).replace(/[^0-9]/g, '') : '';
        const price = priceRaw
          ? '$' + parseInt(priceRaw, 10).toLocaleString()
          : 'Call';
        const lbCount = l.logbooks
          ? Object.values(l.logbooks).reduce<number>(
              (s, a) => s + (Array.isArray(a) ? a.length : 0),
              0
            )
          : 0;
        const photoKey = l.photos && l.photos.length ? l.photos[0].key : null;
        const cat = (l.category || '').replace(/-/g, ' ');
        const year = l.year != null ? String(l.year) : '';
        const meta = year + (cat ? ' \u00b7 ' + cat : '');
        return (
          <Link
            key={l.id}
            href={`/aircraft-for-sale/${l.id}`}
            className="bs-listing"
          >
            <div className="bs-listing__img">
              {photoKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://sale-api.rogerwilcoaviation.com/files/${photoKey}`}
                  alt={`${l.make || ''} ${l.model || ''}`.trim()}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                'Photo'
              )}
            </div>
            <div className="bs-listing__body">
              <div>
                <div className="bs-listing__meta">{meta}</div>
                <h3 className="bs-listing__title">
                  {(l.make || '') + ' ' + (l.model || '')}
                </h3>
              </div>
              <div className="bs-listing__foot">
                <span className="bs-listing__price">{price}</span>
                {lbCount > 0 && (
                  <span className="bs-listing__logs">
                    {'\u2713 '}
                    {lbCount} logbook doc{lbCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}
