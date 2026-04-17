/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import '../newspaper.css';
import { ListingCard, type Listing } from './listing-card';
import { ListingsGrid } from './listings-grid';
import SellerAuthPanel from './seller-auth-panel';

// ISR — re-render at most every 60 seconds.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Aircraft for Sale — Roger Wilco Aviation Services',
  description:
    'Aircraft listings from RWAS in Yankton, SD. Cessna, Piper, Beechcraft, and more. Verified logbooks, trusted sellers, FAA Cert. Repair Station support.',
  alternates: {
    canonical: 'https://rogerwilcoaviation.com/aircraft-for-sale',
  },
  openGraph: {
    type: 'website',
    url: 'https://rogerwilcoaviation.com/aircraft-for-sale',
    title: 'Aircraft for Sale — Roger Wilco Aviation Services',
    description:
      'Browse aircraft listings backed by a FAA Part 145 repair station in Yankton, SD.',
    images: [
      {
        url: 'https://rogerwilcoaviation.com/newspaper/images/r182_panel.jpg',
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
    images: ['https://rogerwilcoaviation.com/newspaper/images/r182_panel.jpg'],
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
    <>
      <style>{`
        body::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: url(/newspaper/images/enr_h05.png) center center / cover no-repeat;
          opacity: 0.25;
          z-index: 0;
          pointer-events: none;
        }
        body > * { position: relative; z-index: 1; }
        @media (max-width: 749px) { body::before { display: none !important; } }

        .a4s-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin: 24px 0; }
        .a4s-empty { text-align: center; padding: 64px 16px; font-style: italic; color: #555; }
        .a4s-hero { text-align: center; padding: 24px 16px 8px; }
        .a4s-hero h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 42px; font-weight: 700; line-height: 1.1; margin: 8px 0; }
        .a4s-hero h1 em { font-style: italic; }
        .a4s-hero p { font-size: 14px; color: #333; max-width: 620px; margin: 12px auto 0; line-height: 1.5; }
        .a4s-cta-row { display: flex; justify-content: center; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
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
        .a4s-section-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          margin: 32px 0 8px;
          letter-spacing: 0.02em;
        }
        .a4s-how {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin: 20px 0 40px;
        }
        .a4s-how-step {
          border: 1px solid #1a1a1a;
          padding: 16px;
          background: rgba(245, 243, 239, 0.75);
        }
        .a4s-how-step h3 {
          font-family: Georgia, serif;
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 6px;
        }
        .a4s-how-step p { font-size: 12px; line-height: 1.55; margin: 0; color: #333; }
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
            <section className="a4s-hero">
              <span className="np-kicker">RWAS Marketplace</span>
              <h1>
                Aircraft <em>for Sale</em>
              </h1>
              <p>
                Pre-owned aircraft listings vetted by a FAA Part 145 repair
                station. Every listing comes with the option of a pre-buy
                inspection by the RWAS team — call <strong>(605) 299-8178</strong>{' '}
                or use the chat in the corner to ask Captain Jerry.
              </p>
              <div className="a4s-cta-row">
                <a
                  className="a4s-cta-btn"
                  href="#listings"
                >
                  Browse Aircraft
                </a>
                <SellerAuthPanel />
              </div>
            </section>

            <hr className="np-rule-thick" />

            <h2 className="a4s-section-title" id="listings">
              Current Listings
            </h2>

            <ListingsGrid initialListings={listings} />

            <hr className="np-rule-thick" />

            <h2 className="a4s-section-title">How It Works</h2>
            <div className="a4s-how">
              <div className="a4s-how-step">
                <h3>1. Tell Captain Jerry</h3>
                <p>
                  Click <em>List Your Aircraft</em> and walk through a short
                  13-question intake. Takes about five minutes.
                </p>
              </div>
              <div className="a4s-how-step">
                <h3>2. Add photos &amp; logs</h3>
                <p>
                  You&rsquo;ll get an email link to upload photos and logbook
                  PDFs. Logbooks are optional but help buyers take you
                  seriously.
                </p>
              </div>
              <div className="a4s-how-step">
                <h3>3. RWAS reviews</h3>
                <p>
                  We review every listing before it goes live to catch obvious
                  data problems or safety concerns.
                </p>
              </div>
              <div className="a4s-how-step">
                <h3>4. Buyers contact you</h3>
                <p>
                  Interested buyers reach out directly. Pre-buy inspections by
                  RWAS available — ask the buyer, not us; you decide.
                </p>
              </div>
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

            <div
              style={{
                textAlign: 'center',
                fontSize: 10,
                color: '#888',
                fontFamily: 'Arial, sans-serif',
                marginTop: 6,
                letterSpacing: '0.05em',
              }}
            >
              <a
                href="https://sale-api.rogerwilcoaviation.com/admin"
                style={{ color: '#888', textDecoration: 'none' }}
              >
                Admin
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
