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
 * cards for the letterpress lift over the enr_h05 watermark. Listings
 * fetch logic is unchanged (ISR, sale-api.rogerwilcoaviation.com).
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
import { ListingsGrid } from './listings-grid';
import SellerAuthPanel from './seller-auth-panel';

// ISR — re-render at most every 60 seconds.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Aircraft for Sale — Roger Wilco Aviation Services',
  description:
    'Aircraft listings from RWAS in Yankton, SD. Cessna, Piper, Beechcraft, and more. Verified logbooks, trusted sellers, FAA Cert. Repair Station support.',
  alternates: {
    canonical: 'https://www.rogerwilcoaviation.com/aircraft-for-sale',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.rogerwilcoaviation.com/aircraft-for-sale',
    title: 'Aircraft for Sale — Roger Wilco Aviation Services',
    description:
      'Browse aircraft listings backed by a FAA Part 145 repair station in Yankton, SD.',
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
    title: 'Aircraft for Sale — Roger Wilco Aviation Services',
    description:
      'Browse aircraft listings backed by a FAA Part 145 repair station in Yankton, SD.',
    images: ['https://www.rogerwilcoaviation.com/newspaper/images/r182_panel.jpg'],
  },
};

async function getListings(): Promise<Listing[]> {
  try {
    const resp = await fetch(
      'https://sale-api.rogerwilcoaviation.com/browse',
      { next: { revalidate: 60 } },
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as { listings?: Listing[] };
    return (data.listings || []).filter(
      (l) => !l.status || l.status === 'active',
    );
  } catch {
    return [];
  }
}

export default async function AircraftForSalePage() {
  const listings = await getListings();

  return (
    <BroadsheetLayout>
      {/* Page-scoped a4s styles. Only rules not already covered by
          broadsheet-tokens.css live here. */}
      <style>{`
        .a4s-cta-row { display: flex; justify-content: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
        .a4s-cta-btn {
          display: inline-block;
          padding: 10px 22px;
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
        .a4s-cta-btn.secondary { background: transparent; color: #111; }
        .a4s-cta-btn:hover { background: #a88422; }
        .a4s-how {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin: 8px 0 4px;
        }
        .a4s-how-step h3 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 6px;
          letter-spacing: 0.01em;
        }
        .a4s-how-step p {
          font-size: 12px;
          line-height: 1.55;
          margin: 0;
          color: #1a1a1a;
        }
        .a4s-admin-link {
          text-align: center;
          font-size: 10px;
          color: #888;
          font-family: Arial, sans-serif;
          margin-top: 20px;
          letter-spacing: 0.05em;
        }
        .a4s-admin-link a { color: #888; text-decoration: none; }
      `}</style>

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/aircraft-for-sale" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="a4s-hero">
          <span className="bs-kicker">RWAS Marketplace</span>
          <span className="bs-script-accent">&mdash; vetted by a Part 145 shop &mdash;</span>
          <h1 id="a4s-hero" className="bs-headline bs-headline--hero">
            Aircraft for Sale.
          </h1>
          <p className="bs-subhead">
            Pre-owned aircraft listings vetted by a FAA Part 145 repair station. Every listing comes with the option of a pre-buy inspection by the RWAS team.
          </p>
          <div className="bs-byline">
            Call <strong>(605) 299-8178</strong> &nbsp;&middot;&nbsp; Ask Captain Jerry &nbsp;&middot;&nbsp; Chan Gurney Municipal Airport (KYKN)
          </div>
          <div className="a4s-cta-row">
            <a className="a4s-cta-btn" href="#listings">
              Browse Aircraft
            </a>
            <SellerAuthPanel />
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
            Four Steps From Listing to Sale
          </h2>
          <hr className="section-rule" />
          <div className="a4s-how">
            <div className="a4s-how-step">
              <h3>1. Tell Captain Jerry</h3>
              <p>
                Click <em>List Your Aircraft</em> and walk through a short 13-question intake. Takes about five minutes.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>2. Add photos &amp; logs</h3>
              <p>
                You&rsquo;ll get an email link to upload photos and logbook PDFs. Logbooks are optional but help buyers take you seriously.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>3. RWAS reviews</h3>
              <p>
                We review every listing before it goes live to catch obvious data problems or safety concerns.
              </p>
            </div>
            <div className="a4s-how-step">
              <h3>4. Buyers contact you</h3>
              <p>
                Interested buyers reach out directly. Pre-buy inspections by RWAS available &mdash; ask the buyer, not us; you decide.
              </p>
            </div>
          </div>
        </Specimen>

        <div className="a4s-admin-link">
          <a
            href="https://sale-api.rogerwilcoaviation.com/admin"
            rel="noreferrer"
          >
            Admin
          </a>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
