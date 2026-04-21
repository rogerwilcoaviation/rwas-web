/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
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

export const metadata = {
  title: 'Home Mockup (Ship 3 Tranche B) — Roger Wilco Aviation Services',
  description:
    'Preview of the shared-broadsheet Home page. Not linked from production navigation.',
};

/*
 * /preview/home-sample — Ship 3 Tranche B mockup for the Home page.
 * Uses the shared broadsheet chrome kit and the bs-* helpers added in
 * broadsheet-chrome.css. Content mirrors app/page.tsx verbatim, with
 * dynamic feeds (aircraft-for-sale, blog articles) stubbed to sample
 * rows so John can sign off on the layout without waiting for data.
 */
export default function HomeSamplePage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="home-hero">
          <span className="bs-kicker">General Aviation Maintenance &amp; Avionics</span>
          <span className="bs-script-accent">&mdash; wheels-up since 2022 &mdash;</span>
          <h1 id="home-hero" className="bs-headline bs-headline--hero">
            Premier Avionics &amp;
            <br />
            <em>Maintenance Services</em>
            <br />
            in the Northern Plains
          </h1>
          <p className="bs-subhead">
            Roger Wilco Aviation Services &middot; FAA Cert. RWSR491E &middot; KYKN &middot; Yankton, SD
          </p>
          <div className="bs-byline">
            Avionics &middot; Airframe &amp; Powerplant &middot; NDT &middot; Fabrication &middot; Aircraft 4 Sale
          </div>
        </section>

        {/* ── ABOVE-FOLD 3-COL GRID (LEFT RAIL | HERO | RIGHT RAIL) ── */}
        <div className="bs-3col">
          {/* LEFT RAIL -------------------------------------------------- */}
          <div>
            {/* Today's Edition TOC */}
            <Specimen variant="flat" as="aside" className="bs-toc">
              <div className="bs-toc__title">Today&rsquo;s Edition</div>
              <div className="bs-toc__row">
                <a href="/garmin">
                  <span>Latest From Garmin</span>
                  <span className="bs-toc__pg">A2 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/collections/garmin-avionics">
                  <span>Garmin Store</span>
                  <span className="bs-toc__pg">A3 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/collections/rigging-tools">
                  <span>Tool Procurement</span>
                  <span className="bs-toc__pg">B1 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/shop-capabilities">
                  <span>Annual Inspections</span>
                  <span className="bs-toc__pg">B2 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/shop-capabilities">
                  <span>NDT Services</span>
                  <span className="bs-toc__pg">C1 &rarr;</span>
                </a>
              </div>
              <div className="bs-toc__row">
                <a href="/about#contact">
                  <span>Scheduling</span>
                  <span className="bs-toc__pg">D1 &rarr;</span>
                </a>
              </div>
            </Specimen>

            <p className="bs-pullquote">
              &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
            </p>

            {/* Papa-Alpha Depot boxed ad */}
            <aside className="bs-ad" aria-label="Papa-Alpha Depot advertisement">
              <div className="bs-ad__kicker">Advertisement</div>
              <h3 className="bs-ad__title">Papa-Alpha Depot</h3>
              <p className="bs-ad__sub">Precision Piper rigging tools &middot; Tiered pricing</p>
              <a className="bs-ad__cta" href="/collections/rigging-tools">
                Order Papa-Alpha
              </a>
            </aside>

            {/* Papa-Alpha kit figure */}
            <Specimen variant="flat" as="figure" className="bs-specimen-figure">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit.jpg"
                alt="Papa-Alpha rigging reference tools"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Papa-Alpha rigging reference tools &mdash; CNC-machined aircraft-grade aluminum.
              </Specimen.Caption>
            </Specimen>
          </div>

          {/* CENTER HERO ----------------------------------------------- */}
          <div>
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Lead Story</span>
              <h2 className="bs-headline bs-headline--section">
                Full-Spectrum Repair Station, Northern Plains
              </h2>
              <hr className="section-rule" />

              {/* Hero photo — Cessna 182RG G500TXi install */}
              <Specimen variant="flat" as="figure" className="bs-specimen-figure">
                <Specimen.Image
                  src="/newspaper/images/r182_panel.jpg"
                  alt="Full Garmin G500TXi Suite installation in a Cessna 182RG"
                />
                <Specimen.CaptionRule />
                <Specimen.Caption numeral="FIG. 02">
                  Cessna 182RG &mdash; full Garmin G500TXi Suite installation by RWAS.
                </Specimen.Caption>
              </Specimen>

              <div className="bs-body">
                <p className="bs-drop">
                  Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating under Certificate No. RWSR491E, the station is authorized for a complete range of maintenance, repair, and alteration work.
                </p>
                <p>
                  Under the direction of John Halsted &mdash; with more than 40 years of aviation experience &mdash; RWAS delivers sheet metal fabrication, structural repair, and complete Garmin avionics installations including the G3X Touch suite, GTN navigator series, and GFC 500 autopilot.
                </p>
              </div>
            </Specimen>

            {/* Aircraft 4 Sale feed (stubbed for mockup) */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Classifieds</span>
              <h2 className="bs-headline bs-headline--section">Aircraft 4 Sale</h2>
              <hr className="section-rule" />

              <a href="/aircraft-for-sale#listing/sample-001" className="bs-listing">
                <div className="bs-listing__img">Photo</div>
                <div className="bs-listing__body">
                  <div>
                    <div className="bs-listing__meta">1979 &middot; Single Engine Piston</div>
                    <h3 className="bs-listing__title">Cessna 182RG Skylane</h3>
                  </div>
                  <div className="bs-listing__foot">
                    <span className="bs-listing__price">$189,500</span>
                    <span className="bs-listing__logs">&#10003; 3 logbook docs</span>
                  </div>
                </div>
              </a>
              <a href="/aircraft-for-sale#listing/sample-002" className="bs-listing">
                <div className="bs-listing__img">Photo</div>
                <div className="bs-listing__body">
                  <div>
                    <div className="bs-listing__meta">1968 &middot; Twin Engine Piston</div>
                    <h3 className="bs-listing__title">Piper PA-30 Twin Comanche</h3>
                  </div>
                  <div className="bs-listing__foot">
                    <span className="bs-listing__price">$112,000</span>
                    <span className="bs-listing__logs">&#10003; 2 logbook docs</span>
                  </div>
                </div>
              </a>
              <a href="/aircraft-for-sale#listing/sample-003" className="bs-listing">
                <div className="bs-listing__img">Photo</div>
                <div className="bs-listing__body">
                  <div>
                    <div className="bs-listing__meta">1976 &middot; Single Engine Piston</div>
                    <h3 className="bs-listing__title">Piper PA-28R-200 Arrow</h3>
                  </div>
                  <div className="bs-listing__foot">
                    <span className="bs-listing__price">$94,900</span>
                    <span className="bs-listing__logs">&#10003; 4 logbook docs</span>
                  </div>
                </div>
              </a>

              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <a href="/aircraft-for-sale" className="bs-ad__cta">
                  Browse All Listings &rarr;
                </a>
              </div>
              <p
                className="bs-body"
                style={{ marginTop: '10px', textAlign: 'center', fontStyle: 'italic' }}
              >
                <strong>Selling?</strong> Click the Jerry bubble &mdash; our AI concierge will walk you through listing your aircraft step by step.
              </p>
            </Specimen>
          </div>

          {/* RIGHT RAIL ------------------------------------------------ */}
          <div>
            {/* Blog articles feed (stubbed) */}
            <Specimen variant="flat" as="aside">
              <span className="bs-kicker">Press Release</span>
              <a href="/blog/article.html?id=spring-2026">
                <h3 className="bs-headline bs-headline--section">
                  Spring 2026 Scheduling &mdash; Now Booking Annual Inspections
                </h3>
              </a>
              <hr className="section-rule" />
              <p className="bs-body">
                RWAS is now accepting spring scheduling for annual inspections, 100-hour inspections, and ADS-B Out compliance installations. Call the shop for available slots and lead times.
              </p>

              <hr className="section-rule" style={{ marginTop: '18px' }} />

              <span className="bs-kicker">Service Bulletin</span>
              <a href="/blog/article.html?id=gfc-500-installs">
                <h3 className="bs-headline bs-headline--section">
                  GFC 500 Autopilot Installations Open Into Summer 2026
                </h3>
              </a>
              <hr className="section-rule" />
              <p className="bs-body">
                Demand for the GFC 500 retrofit continues to climb. Book early &mdash; installation slots are being reserved through summer on a first-call, first-scheduled basis.
              </p>

              <hr className="section-rule" style={{ marginTop: '18px' }} />

              <span className="bs-kicker">Product Update</span>
              <a href="/blog/article.html?id=papa-alpha-worldwide">
                <h3 className="bs-headline bs-headline--section">
                  Papa-Alpha Rigging Tools Now Shipping Worldwide
                </h3>
              </a>
              <hr className="section-rule" />
              <p className="bs-body">
                The full Papa-Alpha Piper rigging kit &mdash; stabilator, rudder, aileron, flap, and bell crank tools &mdash; is available directly from RWAS and through Aircraft Spruce.
              </p>
            </Specimen>

            {/* Laser cutter new-capability figure */}
            <Specimen variant="flat" as="figure" className="bs-specimen-figure">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.jpg"
                alt="Industrial fiber laser cutting at Roger Wilco Aviation Services"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 03">
                New capability &mdash; fiber laser cutting, welding, and scaling.
              </Specimen.Caption>
            </Specimen>
          </div>
        </div>

        {/* ── 4-COL SERVICES BAND ───────────────────────────────────── */}
        <section aria-labelledby="services-heading" style={{ marginTop: '32px' }}>
          <h2
            id="services-heading"
            className="bs-headline bs-headline--section"
            style={{ textAlign: 'center' }}
          >
            Services &amp; Capabilities
          </h2>
          <hr className="section-rule" />

          <div className="bs-4col">
            {/* Papa-Alpha Tools */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Papa-Alpha Tools</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/rigging-tools">Piper Rigging Reference Tools</a>
                  </p>
                  <p className="bs-svc-desc">
                    Precision flight-control rigging for PA-28, PA-30, PA-31, PA-36. CNC-machined aluminum, powder coated, UV printed. Sold worldwide.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/products/rigging-kit">Complete Rigging Kit</a>
                  </p>
                  <p className="bs-svc-desc">
                    Stabilator, rudder, aileron, flap, and bell crank in one case. From $264.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/rigging-tools">Individual Tools</a>
                  </p>
                  <p className="bs-svc-desc">
                    Stabilator, rudder, aileron &amp; flap, bell crank, PA-31/PA-36 specifics. From $59.99.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">Available At</p>
                  <p className="bs-svc-desc">
                    rogerwilcoaviation.com, Aircraft Spruce, Amazon (coming soon). Made by mechanics, for mechanics.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* Avionics */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Avionics</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">G3X Touch Suite</a>
                  </p>
                  <p className="bs-svc-desc">
                    Full glass cockpit with ADAHRS, EIS, and synthetic vision. STC&rsquo;d for most single-engine piston aircraft.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a>
                  </p>
                  <p className="bs-svc-desc">
                    GPS/NAV/COMM with WAAS LPV approaches, IFR certification, and flight-plan integration.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">GFC 500 Autopilot</a>
                  </p>
                  <p className="bs-svc-desc">
                    Retrofit digital autopilot with GPSS steering, altitude hold, and vertical-speed modes.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/collections/garmin-avionics">ADS-B Out Compliance</a>
                  </p>
                  <p className="bs-svc-desc">
                    FAR 91.227 compliant installations. Transponder upgrades and system certification.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* Airframe & Powerplant */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">Airframe &amp; Powerplant</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Annual Inspections</a>
                  </p>
                  <p className="bs-svc-desc">
                    Thorough airworthiness inspections per FAR 43. Discrepancy reports and return-to-service documentation.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">100-Hour Inspections</a>
                  </p>
                  <p className="bs-svc-desc">
                    For aircraft operated for hire under 14 C.F.R. Part 91 and Part 135 requirements.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Sheet Metal &amp; Fabrication</a>
                  </p>
                  <p className="bs-svc-desc">
                    Structural repair, skin replacement, custom fabrication in aircraft-grade aluminum alloys.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Engine Troubleshooting</a>
                  </p>
                  <p className="bs-svc-desc">
                    Powerplant diagnostics, mag checks, compression testing, and engine runs.
                  </p>
                </li>
              </ul>
            </Specimen>

            {/* NDT & Certification */}
            <Specimen variant="flat" as="article">
              <span className="bs-kicker">NDT &amp; Certification</span>
              <hr className="section-rule" />
              <ul className="bs-svc-list">
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Eddy Current Inspection</a>
                  </p>
                  <p className="bs-svc-desc">
                    Subsurface crack and corrosion detection in aluminum and ferrous components &mdash; without disassembly.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/shop-capabilities">Dye Penetrant Testing</a>
                  </p>
                  <p className="bs-svc-desc">
                    Surface crack detection per ASTM E1417 for engine components, castings, and structural parts.
                  </p>
                </li>
                <li className="bs-svc">
                  <p className="bs-svc-name">
                    <a href="/about">Certified Repair Station</a>
                  </p>
                  <p className="bs-svc-desc">
                    FAA Certificate RWSR491E. All work by certificated mechanics with full logbook documentation.
                  </p>
                </li>
              </ul>

              <p
                className="bs-kicker"
                style={{ marginTop: '18px', textAlign: 'center', display: 'block' }}
              >
                Schedule your inspection today
              </p>
              <div className="bs-cta-row">
                <a href="tel:+16052998178" className="bs-cta-primary">
                  Call (605) 299-8178
                </a>
                <a href="/about#contact" className="bs-cta-secondary">
                  Request a Quote
                </a>
              </div>
            </Specimen>
          </div>
        </section>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
                                                                                                                                                                                                                                                                 