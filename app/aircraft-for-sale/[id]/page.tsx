/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
/*
 * /aircraft-for-sale/[id] — Ship 3 Tranche C migration
 *
 * Server component. Renders the full detail for a single listing and
 * includes JSON-LD Product markup for search/shopping previews.
 *
 * Chrome now matches the rest of Ship 2/3: BroadsheetLayout → Dateline →
 * Masthead → BroadsheetNav → CredentialsBar → BulletinBar → <main.bs-stage>
 * → BroadsheetFooter. Content blocks are wrapped in Specimen cards for the
 * letterpress lift over the enr_h05 watermark.
 *
 * ISR, generateStaticParams, and the sale-api fetch logic are unchanged.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
  Specimen,
} from '@/components/shared/broadsheet';
import { PhotoCarousel } from './photo-carousel';

export const revalidate = 60;

/*
 * Required because the site is configured with `output: 'export'` (static
 * export). At build time we enumerate every active listing and pre-render
 * its detail page. New listings added after deploy won't have a detail page
 * until the next build — an acceptable tradeoff given the review-before-live
 * workflow. If generateStaticParams() fails (sale-api down at build time),
 * we return an empty array so the build still succeeds.
 */
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

// With `output: 'export'`, only the IDs returned above can render at runtime
// — dynamicParams: false makes unknown IDs 404 at build time rather than
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
  logbooks?: {
    airframe?: Array<{ key: string; name?: string; size?: number }>;
    powerplant?: Array<{ key: string; name?: string; size?: number }>;
    propeller?: Array<{ key: string; name?: string; size?: number }>;
    adSbCompliance?: Array<{ key: string; name?: string; size?: number }>;
    misc?: Array<{ key: string; name?: string; size?: number }>;
  };
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
  const url = `https://www.rogerwilcoaviation.com/aircraft-for-sale/${encodeURIComponent(l.id)}`;
  const firstPhoto = (l.photos || [])[0];
  const imageUrl = firstPhoto
    ? `https://sale-api.rogerwilcoaviation.com/files/${encodeURIComponent(firstPhoto.key)}`
    : 'https://www.rogerwilcoaviation.com/newspaper/images/r182_panel.jpg';
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
  const canonicalUrl = `https://www.rogerwilcoaviation.com/aircraft-for-sale/${encodeURIComponent(listing.id)}`;

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
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        .a4s-back {
          font-family: Arial, sans-serif;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6a6a6a;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 12px;
        }
        .a4s-detail-header { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start; }
        .a4s-detail-gallery { flex: 1 1 420px; min-width: 280px; }
        .a4s-detail-summary { flex: 1 1 320px; min-width: 260px; }
        .a4s-detail-subtitle {
          font-family: Arial, sans-serif;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6a6a6a;
          margin: 0 0 6px;
        }
        .a4s-detail-price {
          font-family: Georgia, serif;
          font-size: 26px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 10px 0 4px;
        }
        .a4s-detail-location {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          margin-bottom: 4px;
        }
        .a4s-detail-cta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 14px 0 4px;
        }
        .a4s-detail-cta a {
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
        }
        .a4s-detail-cta .secondary { background: transparent; }

        .a4s-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0;
          border-top: 1px solid #e0ddd5;
          border-left: 1px solid #e0ddd5;
          margin: 4px 0;
        }
        .a4s-spec {
          padding: 10px 14px;
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

        .a4s-prose {
          font-family: Georgia, serif;
          font-size: 15px;
          line-height: 1.65;
          color: #1a1a1a;
          white-space: pre-line;
          margin: 0;
        }
        .a4s-logbooks { display: flex; flex-direction: column; gap: 12px; }
        .a4s-logbook-section {
          padding: 10px 12px;
          background: rgba(250, 250, 247, 0.85);
          border: 1px solid #e5e5dc;
        }
        .a4s-logbook-section h3 {
          font-family: Georgia, serif;
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 6px;
          color: #1a1a1a;
        }
        .a4s-logbook-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .a4s-logbook-section a {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: #fff;
          border: 1px solid #ddd;
          color: #1a1a1a;
          text-decoration: none;
          font-size: 12px;
        }
        .a4s-logbook-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .a4s-logbook-size { font-size: 10px; color: #888; }

        .a4s-seller-card dl {
          margin: 8px 0 0;
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 6px 12px;
        }
        .a4s-seller-card dt {
          font-family: Arial, sans-serif;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6a6a6a;
        }
        .a4s-seller-card dd {
          margin: 0;
          font-family: Georgia, serif;
          font-size: 15px;
        }
        .a4s-seller-card a { color: #1a1a1a; text-decoration: underline; }
        .a4s-seller-disclaimer {
          margin-top: 14px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #555;
          line-height: 1.55;
        }
      `}</style>

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/aircraft-for-sale" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <a href="/aircraft-for-sale" className="a4s-back">
          &larr; Back to listings
        </a>

        {/* ── HERO: Gallery + Summary ────────────────────────────────── */}
        <Specimen variant="hero" as="section" className="a4s-detail-hero">
          <div className="a4s-detail-header">
            <div className="a4s-detail-gallery">
              <PhotoCarousel photoUrls={photoUrls} alt={h} />
            </div>
            <div className="a4s-detail-summary">
              <div className="a4s-detail-subtitle">
                {listing.nNumber ? `Tail ${listing.nNumber}` : 'Aircraft listing'}
              </div>
              <h1 className="bs-headline bs-headline--section" style={{ margin: '0 0 6px' }}>
                {h}
              </h1>
              <div className="a4s-detail-price">{priceStr}</div>
              {listing.sellerLocation ? (
                <div className="a4s-detail-location">
                  Located in {listing.sellerLocation}
                </div>
              ) : null}
              <div className="a4s-detail-cta">
                <a
                  href={`mailto:${listing.sellerEmail || 'service@rwas.team'}?subject=${encodeURIComponent('Inquiry: ' + h + (listing.nNumber ? ' (' + listing.nNumber + ')' : ''))}`}
                >
                  Contact Seller
                </a>
                <a href="tel:+16052998178" className="secondary">
                  Call RWAS for Pre-Buy
                </a>
              </div>
            </div>
          </div>
        </Specimen>

        {/* ── SPECIFICATIONS ─────────────────────────────────────────── */}
        {specs.length ? (
          <Specimen variant="flat" as="section">
            <span className="bs-kicker">Section B2</span>
            <h2 className="bs-headline bs-headline--section">Specifications</h2>
            <hr className="section-rule" />
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
          </Specimen>
        ) : null}

        {/* ── DESCRIPTION ────────────────────────────────────────────── */}
        {listing.description ? (
          <Specimen variant="flat" as="section">
            <span className="bs-kicker">Section B3</span>
            <h2 className="bs-headline bs-headline--section">Description</h2>
            <hr className="section-rule" />
            <p className="a4s-prose">{listing.description}</p>
          </Specimen>
        ) : null}

        {/* ── AVIONICS ───────────────────────────────────────────────── */}
        {listing.avionics ? (
          <Specimen variant="flat" as="section">
            <span className="bs-kicker">Section B4</span>
            <h2 className="bs-headline bs-headline--section">Avionics</h2>
            <hr className="section-rule" />
            <p className="a4s-prose">{listing.avionics}</p>
          </Specimen>
        ) : null}

        {/* ── EQUIPMENT ──────────────────────────────────────────────── */}
        {listing.equipmentList ? (
          <Specimen variant="flat" as="section">
            <span className="bs-kicker">Section B5</span>
            <h2 className="bs-headline bs-headline--section">Equipment</h2>
            <hr className="section-rule" />
            <p className="a4s-prose">{listing.equipmentList}</p>
          </Specimen>
        ) : null}

        {/* ── LOGBOOKS & DOCUMENTS ───────────────────────────────────── */}
        {(() => {
          const lb = listing.logbooks || {};
          const sections: Array<{
            key: string;
            label: string;
            files: Array<{ key: string; name?: string; size?: number }>;
          }> = [
            { key: 'airframe', label: 'Airframe Logbook', files: lb.airframe || [] },
            { key: 'powerplant', label: 'Engine Logbook', files: lb.powerplant || [] },
            { key: 'propeller', label: 'Propeller Logbook', files: lb.propeller || [] },
            { key: 'adSbCompliance', label: 'AD / SB Compliance', files: lb.adSbCompliance || [] },
            { key: 'misc', label: 'Other Documents', files: lb.misc || [] },
          ].filter((s) => s.files.length > 0);
          if (!sections.length) return null;
          const fmtSize = (n?: number) => {
            if (!n || n <= 0) return '';
            if (n < 1024) return n + ' B';
            if (n < 1048576) return Math.round(n / 1024) + ' KB';
            return (n / 1048576).toFixed(1) + ' MB';
          };
          return (
            <Specimen variant="flat" as="section">
              <span className="bs-kicker">Section B6</span>
              <h2 className="bs-headline bs-headline--section">
                Logbooks &amp; Documents
              </h2>
              <hr className="section-rule" />
              <div className="a4s-logbooks">
                {sections.map((s) => (
                  <div key={s.key} className="a4s-logbook-section">
                    <h3>{s.label}</h3>
                    <ul>
                      {s.files.map((f) => (
                        <li key={f.key}>
                          <a
                            href={`https://sale-api.rogerwilcoaviation.com/files/${encodeURIComponent(f.key)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span style={{ fontSize: 14 }}>📄</span>
                            <span className="a4s-logbook-name">
                              {f.name || f.key.split('/').pop()}
                            </span>
                            {f.size ? (
                              <span className="a4s-logbook-size">
                                {fmtSize(f.size)}
                              </span>
                            ) : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Specimen>
          );
        })()}

        {/* ── SELLER ─────────────────────────────────────────────────── */}
        <Specimen variant="flat" as="section" className="a4s-seller-card">
          <span className="bs-kicker">Section B7</span>
          <h2 className="bs-headline bs-headline--section">Seller</h2>
          <hr className="section-rule" />
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
          <p className="a4s-seller-disclaimer">
            RWAS introduces buyers and sellers. We are not the seller of record unless explicitly noted. Pre-buy inspection by our FAA Part 145 repair station is available on request &mdash; call (605) 299-8178.
          </p>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
