import Link from 'next/link';

type Listing = {
  id: string;
  make?: string;
  model?: string;
  year?: string | number;
  category?: string;
  status?: string;
  price?: string | number;
  photos?: Array<{ key: string }>;
  logbooks?: Record<string, unknown[] | null>;
};

const LOADING_STYLE: React.CSSProperties = {
  fontStyle: 'italic',
  fontSize: '12px',
  color: '#888',
  padding: '8px 0',
};

async function getHomepageListings(): Promise<Listing[]> {
  try {
    const response = await fetch(
      'https://sale-api.rogerwilcoaviation.com/browse?include=sold',
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { listings?: Listing[] };
    // Sold aircraft stay listed (John, 2026-07-26) and follow active inventory.
    return (data.listings || [])
      .filter(
        (listing) =>
          !listing.status ||
          listing.status === 'active' ||
          listing.status === 'sold',
      )
      .sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold'))
      .slice(0, 4);
  } catch {
    return [];
  }
}

export default async function AircraftSaleFeed() {
  const listings = await getHomepageListings();

  if (!listings.length) {
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
      {listings.map((l) => {
        const priceRaw = l.price ? String(l.price).replace(/[^0-9]/g, '') : '';
        const price = priceRaw
          ? '$' + parseInt(priceRaw, 10).toLocaleString()
          : 'Call';
        const lbCount = l.logbooks
          ? Object.values(l.logbooks).reduce<number>(
              (s, a) => s + (Array.isArray(a) ? a.length : 0),
              0,
            )
          : 0;
        const photoKey = l.photos && l.photos.length ? l.photos[0].key : null;
        const cat = (l.category || '').replace(/-/g, ' ');
        const year = l.year != null ? String(l.year) : '';
        const meta = year + (cat ? ' \u00b7 ' + cat : '');
        const isSold = l.status === 'sold';
        return (
          <Link
            key={l.id}
            href={`/aircraft-for-sale/${l.id}`}
            className="bs-listing"
          >
            <div className="bs-listing__img" style={{ position: 'relative' }}>
              {isSold && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    zIndex: 2,
                    background: '#8b0000',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '.12em',
                    padding: '2px 7px',
                    textTransform: 'uppercase',
                  }}
                >
                  Sold
                </span>
              )}
              {photoKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://sale-api.rogerwilcoaviation.com/files/${photoKey}?w=600&q=80`}
                  srcSet={`https://sale-api.rogerwilcoaviation.com/files/${photoKey}?w=400&q=80 400w, https://sale-api.rogerwilcoaviation.com/files/${photoKey}?w=600&q=80 600w, https://sale-api.rogerwilcoaviation.com/files/${photoKey}?w=900&q=80 900w`}
                  sizes="(max-width: 600px) 92vw, (max-width: 1024px) 45vw, 280px"
                  alt={`${l.make || ''} ${l.model || ''}`.trim()}
                  loading="lazy"
                  decoding="async"
                  width={600}
                  height={450}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: isSold ? 'grayscale(0.55)' : undefined,
                  }}
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
                <span
                  className="bs-listing__price"
                  style={isSold ? { color: '#8b0000' } : undefined}
                >
                  {isSold ? 'Sold' : price}
                </span>
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
