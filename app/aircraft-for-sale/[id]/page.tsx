/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
// ============================================================================
// Fix #6 / MEDIUM #1 — /aircraft-for-sale/[id]/page.tsx
// Server component. Renders the full detail for a single listing and includes
// JSON-LD Product markup for search/shopping previews.
// ============================================================================
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../newspaper.css';
import { PhotoCarousel } from './photo-carousel';

export const revalidate = 60;

// Required because the site is configured with `output: 'export'` (static
// export). At build time we enumerate every active listing and pre-render its
// detail page. New listings added after deploy won't have a detail page until
// the next build — an acceptable tradeoff given the review-before-live
// workflow (fix pack #2). If generateStaticParams() fails (sale-api down at
// build time), we return an empty array so the build still succeeds.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const resp = await fetch(
      'https://sale-api.rogerwilcoaviation.com/browse',
      { cache: 'no-store' },
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      listings?: Array<{ id?: string; status?: string }>;
    };
    return (data.listings || [])
      .filter((l) => l.id && (!l.status || l.status === 'active'))
      .map((l) => ({ id: l.id as string }));
  } catch {
    return [];
  }
}

// With `output: 'export'`, only the IDs returned above can render at runtime —
// dynamicParams: false makes unknown IDs 404 at build time rather than
// attempting a runtime render that would fail silently in a static host.
export const dynamicParams = false;

interface Photo {
  key: string;
  name?: string;
  contentType?: string;
}

interface Listing {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  sellerEmail?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerLocation?: string;
  make?: string;
  model?: string;
  year?: string;
  serialNumber?: string;
  nNumber?: string;
  totalTime?: string;
  engineTime?: string;
  engineModel?: string;
  propTime?: string;
  propModel?: string;
  price?: string;
  priceLabel?: string;
  description?: string;
  avionics?: string;
  equipmentList?: string;
  annualDue?: string;
  usefulLoad?: string;
  fuelCapacity?: string;
  cruiseSpeed?: string;
  range?: string;
  category?: string;
  condition?: string;
  damageHistory?: string;
  photos?: Photo[];
}

async function getListing(id: string): Promise<Listing | null> {
  try {
    const resp = await fetch(
      `https://sale-api.rogerwilcoaviation.com/listing/${encodeURIComponent(id)}`,
      { next: { revalidate: 60 } },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { listing?: Listing };
    const l = data.listing;
    if (!l || !l.id) return null;
    return l;
  } catch {
    return null;
  }
}

function headline(l: Listing): string {
  return (
    [l.year, l.make, l.model].filter(Boolean).join(' ') || 'Aircraft listing'
  );
}

function priceLabel(l: Listing): string {
  if (!l.price) return 'Price on request';
  const n = Number(String(l.price).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 'Price on request';
  return `$${n.toLocaleString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) {
    return {
      title: 'Listing not found — Roger Wilco Aviation Services',
      robots: { index: false, follow: false },
    };
  }
  const title = `${headline(l)} — ${priceLabel(l)} — RWAS`;
  const description =
    (l.description && l.description.slice(0, 160)) ||
    `${headline(l)} for sale at Roger Wilco Aviation Services, Yankton, SD. Tail ${l.nNumber || 'n/a'}.`;
  const url = `https://rogerwilcoaviation.com/aircraft-for-sale/${encodeURIComponent(l.id)}`;
  const firstPhoto = (l.photos || [])[0];
  const imageUrl = firstPhoto
    ? `https://sale-api.rogerwilcoaviation.com/files/${encodeURIComponent(firstPhoto.key)}`
    : 'https://rogerwilcoaviation.com/newspaper/images/r182_panel.jpg';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: [{ url: imageUrl, alt: `${headline(l)} — ${l.nNumber || ''}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AircraftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const h = headline(listing);
  const priceStr = priceLabel(listing);
  const photos = listing.photos || [];
  const photoUrls = photos.map(
    (p) =>
      `https://sale-api.rogerwilcoaviation.com/files/${encodeURIComponent(p.key)}`,
  );
  const canonicalUrl = `https://rogerwilcoaviation.com/aircraft-for-sale/${encodeURIComponent(listing.id)}`;

  // JSON-LD for Product schema
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: h,
    description: listing.description || h,
    url: canonicalUrl,
  };
  if (listing.make) jsonLd.brand = { '@type': 'Brand', name: listing.make };
  if (photoUrls.length) jsonLd.image = photoUrls;
  if (listing.price && Number(listing.price) > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: String(listing.price),
      priceCurrency: 'USD',
      availability:
        listing.status === 'active'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    };
  }

  // Spec fields in order
  const SPECS: Array<{ label: string; value?: string; suffix?: string }> = [
    { label: 'Tail Number', value: listing.nNumber },
    { label: 'Year', value: listing.year },
    { label: 'Make', value: listing.make },
    { label: 'Model', value: listing.model },
    { label: 'Serial Number', value: listing.serialNumber },
    { label: 'Airframe Total Time', value: listing.totalTime, suffix: 'hrs' },
    { label: 'Engine Time', value: listing.engineTime, suffix: 'hrs' },
    { label: 'Engine Model', value: listing.engineModel },
    { label: 'Prop Time', value: listing.propTime, suffix: 'hrs' },
    { label: 'Prop Model', value: listing.propModel },
    { label: 'Annual Due', value: listing.annualDue },
    { label: 'Useful Load', value: listing.usefulLoad, suffix: 'lbs' },
    { label: 'Fuel Capacity', value: listing.fuelCapacity, suffix: 'gal' },
    { label: 'Cruise Speed', value: listing.cruiseSpeed, suffix: 'kts' },
    { label: 'Range', value: listing.range, suffix: 'nm' },
    { label: 'Category', value: listing.category },
    { label: 'Condition', value: listing.condition },
    { label: 'Damage History', value: listing.damageHistory },
    { label: 'Location', value: listing.sellerLocation },
  ];
  const specs = SPECS.filter(
    (s) => s.value !== undefined && s.value !== null && String(s.value).trim() !== '',
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        body::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: url(/newspaper/images/enr_h05.png) center center / cover no-repeat;
          opacity: 0.18;
          z-index: 0;
          pointer-events: none;
        }
        body > * { position: relative; z-index: 1; }
        @media (max-width: 749px) { body::before { display: none !important; } }

        .a4s-detail-header { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; margin: 20px 0; }
        .a4s-detail-gallery { flex: 1 1 420px; min-width: 280px; }
        .a4s-detail-summary { flex: 1 1 320px; min-width: 260px; }
        .a4s-detail-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 34px;
          font-weight: 700;
          line-height: 1.1;
          margin: 0 0 8px;
        }
        .a4s-detail-subtitle {
          font-family: Arial, sans-serif;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6a6a6a;
          margin: 0 0 12px;
        }
        .a4s-detail-price {
          font-family: Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 12px 0;
        }
        .a4s-detail-cta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 18px 0 10px;
        }
        .a4s-detail-cta a, .a4s-detail-cta button {
          display: inline-block;
          padding: 10px 18px;
          background: #C49A2A;
          color: #111;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          text-decoration: none;
          border: 1px solid #111;
          cursor: pointer;
        }
        .a4s-detail-cta .secondary { background: transparent; }

        .a4s-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0;
          border: 1px solid #1a1a1a;
          background: rgba(245, 243, 239, 0.95);
          margin: 24px 0;
        }
        .a4s-spec {
          padding: 12px 16px;
          border-bottom: 1px solid #e0ddd5;
          border-right: 1px solid #e0ddd5;
        }
        .a4s-spec dt {
          font-family: Arial, sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6a6a6a;
          margin-bottom: 2px;
        }
        .a4s-spec dd {
          font-family: Georgia, serif;
          font-size: 15px;
          font-weight: 600;
          margin: 0;
        }

        .a4s-block-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 22px;
          font-weight: 700;
          margin: 32px 0 10px;
          letter-spacing: 0.02em;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 4px;
        }
        .a4s-prose {
          font-family: Georgia, serif;
          font-size: 15px;
          line-height: 1.65;
          color: #1a1a1a;
          white-space: pre-line;
        }
        .a4s-seller-card {
          border: 1px solid #1a1a1a;
          padding: 18px 20px;
          background: rgba(245, 243, 239, 0.95);
          margin: 20px 0;
        }
        .a4s-seller-card dl { margin: 8px 0 0; display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; }
        .a4s-seller-card dt { font-family: Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6a6a6a; }
        .a4s-seller-card dd { margin: 0; font-family: Georgia, serif; font-size: 15px; }
        .a4s-seller-card a { color: #1a1a1a; text-decoration: underline; }
      `}</style>
      <div
        className="np-wrapper"
        style={{
          background: '#ddd9d2',
          minHeight: '100vh',
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div className="np-page">
          {/* Dateline */}
          <div className="np-dateline">
            <span>Spring 2026 Edition</span>
            <span>Vol. XL &middot; No. 1</span>
            <span>rogerwilcoaviation.com</span>
          </div>

          {/* Masthead */}
          <div className="np-masthead">
            <img
              className="np-masthead-logo"
              src="/newspaper/images/logo.png"
              alt="Roger Wilco Aviation Services"
            />
            <div className="np-masthead-center">
              <div className="np-masthead-name">
                Roger Wilco Aviation Services
              </div>
              <hr className="np-masthead-rule" />
              <div className="np-masthead-tagline">
                FAA Cert. Repair Station &nbsp;&middot;&nbsp; Avionics &nbsp;&middot;&nbsp;
                Airframe &amp; Powerplant &nbsp;&middot;&nbsp; NDT &nbsp;&middot;&nbsp; Fabrication
              </div>
            </div>
            <div className="np-masthead-right">
              <div className="np-masthead-right-meta">
                Cert. No. RWSR491E
                <br />
                KYKN &middot; Yankton, SD
              </div>
              <a href="tel:+16052998178" className="np-masthead-phone">
                (605) 299-8178
              </a>
              <a href="/about#contact" className="np-masthead-cta">
                Book Service
              </a>
            </div>
          </div>

          {/* Navigation */}
          <nav className="np-nav">
            <a href="/">Home</a>
            <a href="/#ask-jerry" style={{ background: '#d4c47a' }} className="np-nav-jerry">
              Ask Jerry
            </a>
            <a href="/collections/on-sale">On Sale</a>
            <a href="/collections/garmin-avionics">Garmin</a>
            <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
            <a className="active" href="/aircraft-for-sale">
              Aircraft 4 Sale
            </a>
            <a href="/financing">Financing</a>
            <a href="/shop-capabilities">Shop Capabilities</a>
            <a href="/blog/">Blog Articles</a>
            <a href="/about">About</a>
          </nav>

          {/* Body */}
          <div className="np-body">
            <div style={{ padding: '10px 0 0' }}>
              <a
                href="/aircraft-for-sale"
                style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#6a6a6a',
                  textDecoration: 'none',
                }}
              >
                &larr; Back to listings
              </a>
            </div>

            <div className="a4s-detail-header">
              <div className="a4s-detail-gallery">
                <PhotoCarousel photoUrls={photoUrls} alt={h} />
              </div>
              <div className="a4s-detail-summary">
                <div className="a4s-detail-subtitle">
                  {listing.nNumber ? `Tail ${listing.nNumber}` : 'Aircraft listing'}
                </div>
                <h1 className="a4s-detail-title">{h}</h1>
                <div className="a4s-detail-price">{priceStr}</div>
                {listing.sellerLocation ? (
                  <div
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      fontSize: 12,
                      color: '#333',
                      marginBottom: 8,
                    }}
                  >
                    Located in {listing.sellerLocation}
                  </div>
                ) : null}
                <div className="a4s-detail-cta">
                  <a
                    href={`mailto:${listing.sellerEmail || 'service@rwas.team'}?subject=${encodeURIComponent('Inquiry: ' + h + (listing.nNumber ? ' (' + listing.nNumber + ')' : ''))}`}
                  >
                    Contact Seller
                  </a>
                  <a
                    href="tel:+16052998178"
                    className="secondary"
                  >
                    Call RWAS for Pre-Buy
                  </a>
                </div>
              </div>
            </div>

            {specs.length ? (
              <>
                <h2 className="a4s-block-title">Specifications</h2>
                <dl className="a4s-specs-grid">
                  {specs.map((s) => (
                    <div className="a4s-spec" key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>
                        {s.value}
                        {s.suffix ? <span> {s.suffix}</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {listing.description ? (
              <>
                <h2 className="a4s-block-title">Description</h2>
                <div className="a4s-prose">{listing.description}</div>
              </>
            ) : null}

            {listing.avionics ? (
              <>
                <h2 className="a4s-block-title">Avionics</h2>
                <div className="a4s-prose">{listing.avionics}</div>
              </>
            ) : null}

            {listing.equipmentList ? (
              <>
                <h2 className="a4s-block-title">Equipment</h2>
                <div className="a4s-prose">{listing.equipmentList}</div>
              </>
            ) : null}

            <h2 className="a4s-block-title">Seller</h2>
            <div className="a4s-seller-card">
              <dl>
                {listing.sellerName ? (
                  <>
                    <dt>Name</dt>
                    <dd>{listing.sellerName}</dd>
                  </>
                ) : null}
                {listing.sellerLocation ? (
                  <>
                    <dt>Location</dt>
                    <dd>{listing.sellerLocation}</dd>
                  </>
                ) : null}
                {listing.sellerEmail ? (
                  <>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${listing.sellerEmail}`}>
                        {listing.sellerEmail}
                      </a>
                    </dd>
                  </>
                ) : null}
                {listing.sellerPhone ? (
                  <>
                    <dt>Phone</dt>
                    <dd>
                      <a href={`tel:${listing.sellerPhone.replace(/[^0-9+]/g, '')}`}>
                        {listing.sellerPhone}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>
              <p
                style={{
                  marginTop: 14,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: 11,
                  color: '#555',
                  lineHeight: 1.55,
                }}
              >
                RWAS introduces buyers and sellers. We are not the seller of
                record unless explicitly noted. Pre-buy inspection by our
                FAA Part 145 repair station is available on request — call
                (605) 299-8178.
              </p>
            </div>

            {/* Footer line */}
            <div
              style={{
                borderTop: '2px solid #1a1a1a',
                marginTop: 40,
                padding: '16px 0',
                textAlign: 'center',
                fontSize: 11,
                color: '#333',
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0.04em',
              }}
            >
              Roger Wilco Aviation Services &middot; 700 E 31st Street,
              Yankton, SD 57078 &middot; (605) 299-8178 &middot;
              service@rwas.team
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
