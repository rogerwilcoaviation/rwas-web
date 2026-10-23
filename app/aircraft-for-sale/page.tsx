/*
 * /aircraft-for-sale — Ship 3 Tranche C
 *
 * Migrated to the shared broadsheet chrome (BroadsheetLayout → Dateline →
 * Masthead → BroadsheetNav → CredentialsBar → BulletinBar → <main.bs-stage>
 * → BroadsheetFooter). Watermark + tokens now inherit from
 * broadsheet-tokens.css via the `.broadsheet` wrapper — no more local
 * body::before overlay, no `np-*` ink classes.
 *
 * Hero, How-It-Works steps, and the Admin footnote are wrapped in Specimen
 * cards for the letterpress lift over the enr_h05 watermark.
 * Baseline builds retain the public legacy SEO snapshot. Replacement builds
 * start empty and the client refreshes only the new seller browse endpoint.
 */
import type { Metadata } from 'next';
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
import { type Listing } from './listing-card';
import {
  LEGACY_AIRCRAFT_API,
  marketplaceListingHref,
  publicMarketplaceListings,
  replaceLegacyAircraftCatalog,
} from '@/lib/public-aircraft-marketplace.mjs';
import { ListingsGrid } from './listings-grid';
import SellerAuthPanelLoader from './seller-auth-panel-loader';

// ISR — re-render at most every 60 seconds.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: 'Aircraft for Sale — RWAS Marketplace' },
  description:
    'Aircraft4Sale connects aircraft owners and buyers for aircraft and aviation part transactions. Browse aircraft, create an account, or log in to get started.',
  alternates: {
    canonical: 'https://www.rogerwilcoaviation.com/aircraft-for-sale',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.rogerwilcoaviation.com/aircraft-for-sale',
    title: 'Aircraft for Sale — RWAS Marketplace',
    description:
      'Connect with aircraft owners and buyers. Create an account or log in to get started with Aircraft4Sale.',
    images: [
      {
        url: 'https://www.rogerwilcoaviation.com/newspaper/images/r182_panel.jpg',
        width: 1200,
        height: 630,
        alt: 'Cessna 182RG avionics panel — Roger Wilco Aviation Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aircraft for Sale — RWAS Marketplace',
    description:
      'Connect with aircraft owners and buyers. Create an account or log in to get started with Aircraft4Sale.',
    images: [
      'https://www.rogerwilcoaviation.com/newspaper/images/r182_panel.jpg',
    ],
  },
};

async function getListings(): Promise<Listing[]> {
  if (replaceLegacyAircraftCatalog()) return [];
  try {
    const resp = await fetch(LEGACY_AIRCRAFT_API + '/browse?include=sold', {
      next: { revalidate: 60 },
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    return publicMarketplaceListings(await resp.json(), 'legacy');
  } catch {
    return [];
  }
}

export default async function AircraftForSalePage() {
  const listings = await getListings();
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://www.rogerwilcoaviation.com/aircraft-for-sale#itemlist',
    name: 'Aircraft for Sale at Roger Wilco Aviation Services',
    url: 'https://www.rogerwilcoaviation.com/aircraft-for-sale',
    numberOfItems: listings.length,
    itemListElement: listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: new URL(
        marketplaceListingHref(listing),
        'https://www.rogerwilcoaviation.com',
      ).href,
      name:
        [listing.year, listing.make, listing.model].filter(Boolean).join(' ') ||
        'Aircraft listing',
    })),
  };

  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema).replace(/</g, '\\u003c'),
        }}
      />
      {/* Page-scoped a4s styles. Only rules not already covered by
          broadsheet-tokens.css live here. */}
      <style>{`
        .a4s-cta-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 24px; padding: 20px 0; border-top: 1px solid #111; flex-wrap: wrap; }
        .a4s-user-entry { flex: 1 1 340px; min-width: 0; }
        .a4s-user-entry p { margin: 0 0 12px; max-width: 640px; font-size: 15px; line-height: 1.5; }
        .a4s-account-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .a4s-cta-row .a4s-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 12px 20px;
          background: #C49A2A;
          color: #111;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-decoration: none;
          border: 1px solid #111;
          border-radius: 0;
          margin: 0;
          line-height: 1.2;
          cursor: pointer;
        }
        .a4s-cta-row .a4s-cta-btn.secondary { background: transparent; color: #111; }
        .a4s-cta-row .a4s-cta-btn:hover { background: #a88422; }
        .a4s-cta-row .a4s-cta-btn:focus-visible { outline: 3px solid #111; outline-offset: 3px; }
        .a4s-marketplace-note { margin-top: 24px; padding-top: 18px; border-top: 1px solid #777; font-size: 14px; line-height: 1.6; }
        @media (max-width: 600px) {
          .a4s-cta-row { gap: 14px; }
          .a4s-user-entry { flex-basis: 100%; }
          .a4s-account-actions .a4s-cta-btn { flex: 1 1 130px; }
          .a4s-browse { width: 100%; }
        }
        .a4s-how {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin: 8px 0 4px;
        }
        .a4s-how-step h3 {
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 6px;
          letter-spacing: 0.01em;
        }
        .a4s-how-step p {
          font-size: 14px;
          line-height: 1.55;
          margin: 0;
          color: #1a1a1a;
        }
      `}</style>

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/aircraft-for-sale" />
      <CredentialsBar />
      <BulletinBar />

      <main id="main-content" tabIndex={-1} className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="a4s-hero">
          <span className="bs-kicker">
            Aircraft4Sale · The RWAS Marketplace
          </span>
          <span className="bs-script-accent">Connect. Buy. Sell.</span>
          <h1 id="a4s-hero" className="bs-headline bs-headline--hero">
            Aircraft for Sale.
          </h1>
          <p className="bs-subhead">
            Connect with owners and buyers to buy or sell an aircraft or
            aviation part.
          </p>
          <div className="bs-byline">
            Aircraft4Sale by Roger Wilco Aviation Services
          </div>
          <div className="a4s-cta-row">
            <SellerAuthPanelLoader />
            <a className="a4s-cta-btn secondary a4s-browse" href="#listings">
              Browse Aircraft
            </a>
          </div>
        </section>

        {/* ── CURRENT LISTINGS ──────────────────────────────────────── */}
        <section id="listings" aria-labelledby="a4s-listings">
          <span className="bs-kicker">Section B1</span>
          <h2 id="a4s-listings" className="bs-headline bs-headline--section">
            Current Listings
          </h2>
          <hr className="section-rule" />
          <ListingsGrid initialListings={listings} />
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
        <Specimen variant="hero" as="section" className="a4s-how-section">
          <span className="bs-kicker">How It Works</span>
          <h2 className="bs-headline bs-headline--section">
            Make Your Next Connection
          </h2>
          <hr className="section-rule" />
          <div className="a4s-how">
            <div className="a4s-how-step">
              <h3>1. Create your account</h3>
              <p>
                Buying or selling? Create an account or choose User Login to get
                started. Once signed in, sellers can choose Create a Listing to
                prepare a listing.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>2. Prepare your listing</h3>
              <p>
                Tell Captain Jerry about your aircraft, save a draft, and add
                photos, video, and optional logbook PDFs. You control the
                information you provide.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>3. Submit your draft</h3>
              <p>
                New submissions remain private during this launch. RWAS reviews
                listing content for publication; this is not an inspection or
                verification of the aircraft or its condition.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>4. Connect directly</h3>
              <p>
                Buyers and owners discuss the details and arrange their
                transaction directly. Buyers arrange their own independent
                inspections and confirm the information that matters to them.
              </p>
            </div>
          </div>
          <p className="a4s-marketplace-note">
            RWAS is an FAA Part 145 repair station. We do not vet seller
            aircraft or offer pre-buy inspections. If you need an independent
            pre-buy inspection, we can{' '}
            <a href="/contact?reason=service&source=aircraft4sale-referral">
              recommend a pre-buy facility
            </a>
            .
          </p>
        </Specimen>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
