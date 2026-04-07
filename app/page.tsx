/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import './newspaper.css';

export const metadata = {
  title: 'Roger Wilco Aviation Services | Garmin Avionics, NDT, Fabrication & Aircraft Support',
  description:
    'FAA-certificated repair station offering Garmin avionics installations, NDT, sheet metal fabrication, and aircraft maintenance in Yankton, South Dakota.',
};

export default function Home() {
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
        body > * {
          position: relative;
          z-index: 1;
        }
        @media (max-width: 749px) {
          body::before {
            display: none !important;
          }
        }
      `}</style>
      <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">

        {/* ── Dateline ── */}
        <div className="np-dateline">
          <span>Spring 2026 Edition</span>
          <span>Vol. XL &middot; No. 1</span>
          <span>rogerwilcoaviation.com</span>
        </div>

        {/* ── Masthead ── */}
        <div className="np-masthead">
          <img
            className="np-masthead-logo"
            src="/newspaper/images/logo.png"
            alt="Roger Wilco Aviation Services"
          />
          <div className="np-masthead-center">
            <div className="np-masthead-name">Roger Wilco Aviation Services</div>
            <hr className="np-masthead-rule" />
            <div className="np-masthead-tagline">
              FAA Cert. Repair Station &nbsp;&middot;&nbsp; Avionics &nbsp;&middot;&nbsp; Airframe &amp; Powerplant &nbsp;&middot;&nbsp; NDT &nbsp;&middot;&nbsp; Fabrication
            </div>
          </div>
          <div className="np-masthead-right">
            Cert. No. RWSR491E<br />
            KYKN &middot; Yankton, SD
          </div>
        </div>

        {/* ── Edition bar ── */}
        <div className="np-edition-bar">
          <span>Garmin Spring 2026 pricing now active</span>
          <span>GFC 500 autopilot installations available</span>
          <span>Now accepting spring scheduling</span>
        </div>

        {/* ── Navigation ── */}
        <nav className="np-nav">
          <a className="active" href="/">Home</a>
          <a href="#ask-jerry" style={{ background: '#d4c47a', cursor: 'pointer' }} className="np-nav-jerry">Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a href="/about">About</a>
        </nav>

        {/* ── Ticker bar ── */}
        <div className="np-ticker-bar">
          <span className="np-ticker-label">Bulletin</span>
          <span className="np-ticker-text">
            Papa-Alpha rigging reference tools now shipping worldwide &nbsp;&bull;&nbsp;
            Garmin G3X Touch installations booking into summer 2026 &nbsp;&bull;&nbsp;
            Annual inspection slots available &mdash; call (605) 299-8178
          </span>
        </div>

        {/* ── Body ── */}
        <div className="np-body">

          {/* ── Above-fold 3-column grid ── */}
          <div className="np-above-fold">

            {/* ── LEFT COLUMN ── */}
            <div className="np-col np-col-left">
              <div className="np-box">
                <div className="np-box-title">Today&rsquo;s Edition</div>
                <div className="np-box-row">
                  <a href="/pages/garmin-avionics-accessories"><span>Latest From Garmin</span><span className="np-box-pg">A2 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/garmin"><span>Garmin Store</span><span className="np-box-pg">A3 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/collections/rigging-tools"><span>Tool Procurement</span><span className="np-box-pg">B1 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/shop-capabilities"><span>Annual Inspections</span><span className="np-box-pg">B2 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/shop-capabilities"><span>NDT Services</span><span className="np-box-pg">C1 &rarr;</span></a>
                </div>
                <div className="np-box-row">
                  <a href="/contact"><span>Scheduling</span><span className="np-box-pg">D1 &rarr;</span></a>
                </div>
              </div>

              <div className="np-pull-quote">
                &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
              </div>

              <div className="np-ad-box">
                <div className="np-ad-title">Papa-Alpha Depot</div>
                <div className="np-ad-sub">Precision Piper rigging tools</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#666', marginBottom: '7px', letterSpacing: '0.05em' }}>
                  Tiered pricing on all components
                </div>
                <a className="np-ad-btn" href="/collections/rigging-tools">Order Papa-Alpha</a>
              </div>

              <div className="np-img-box">
                <img src="/newspaper/images/papa_alpha_kit.jpg" alt="Papa-Alpha rigging reference tools" />
                <div className="np-img-box-cap">
                  Papa-Alpha rigging reference tools &mdash; CNC-machined aircraft-grade aluminum.
                </div>
              </div>

            </div>

            <div className="np-col-divider" />

            {/* ── CENTER COLUMN ── */}
            <div className="np-col">
              <span className="np-kicker" style={{ display: "block", textAlign: "center" }}>General Aviation Maintenance &amp; Avionics</span>
              <a href="/shop-capabilities" className="np-headline-link">
                <h1 className="np-headline-xl np-headline-xl-link" style={{ textAlign: "center" }}>
                  Premier Avionics &amp;<br />
                  <em>Maintenance Services</em><br />
                  in the Northern Plains
                </h1>
              </a>
              <div className="np-byline" style={{ textAlign: "center" }}>Roger Wilco Aviation Services &middot; FAA Cert. RWSR491E</div>
              <hr className="np-rule" />

              <div className="np-photo-box">
                <div className="np-photo-area">
                  <img
                    src="/newspaper/images/r182_panel.jpg"
                    alt="Cessna 182RG avionics panel"
                  />
                </div>
                <div className="np-photo-cap">
                  Cessna 182RG (N5171S) &mdash; full G500Txi install by Roger Wilco Aviation Services.
                </div>
              </div>

              <p className="np-body-text np-drop">
                Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating under Certificate No. RWSR491E, the station is authorized for a complete range of maintenance, repair, and alteration work.
              </p>
              <p className="np-body-text">
                Under the direction of John Halsted &mdash; with more than 40 years of aviation experience &mdash; RWAS delivers sheet metal fabrication, structural repair, and complete Garmin avionics installations including the G3X Touch suite, GTN navigator series, and GFC 500 autopilot.
              </p>

            </div>

            <div className="np-col-divider" />

            {/* ── RIGHT COLUMN ── */}
            <div className="np-col">
              <span className="np-kicker">Promotion</span>
              <a href="/blog/article?id=garmin-gfc500-stc-expansion-2026" className="np-headline-link">
                <h3 className="np-headline-md">New Dual G5 AI/HSI Kit &mdash; Save Over $600</h3>
              </a>
              <hr className="np-rule" />
              <p className="np-body-text">
                Garmin promotional Dual G5 Kit with combined attitude indicator and HSI, plus all installation accessories. Special pricing through June 15, 2026.
              </p>

              <hr className="np-rule-thick" />
              <span className="np-kicker">Maintenance</span>
              <a href="/shop-capabilities" className="np-headline-link">
                <h3 className="np-headline-md">Annual Inspections &amp; A&amp;P Service</h3>
              </a>
              <hr className="np-rule" />
              <p className="np-body-text">
                Certified A&amp;P mechanics on staff. Scheduled maintenance, logbook entries, and return-to-service documentation.
              </p>

              <hr className="np-rule-thick" />
              <span className="np-kicker">Special Capabilities</span>
              <a href="/shop-capabilities" className="np-headline-link">
                <h3 className="np-headline-md">NDT &amp; Sheet Metal Fabrication</h3>
              </a>
              <hr className="np-rule" />
              <p className="np-body-text">
                Eddy current, dye penetrant, and magnetic particle inspection. Custom fabrication and structural repair.
              </p>

              <hr className="np-rule-thick" />

              <div className="np-photo-box">
                <div className="np-photo-area">
                  <img
                    src="/newspaper/images/laser_cutter.jpg"
                    alt="Industrial fiber laser cutting"
                    style={{ objectPosition: 'center center' }}
                  />
                </div>
                <div className="np-photo-cap">
                  New capability &mdash; fiber laser cutting, welding, and scaling.
                </div>
              </div>

            </div>

          </div>


          {/* ── Lower 4-column services grid ── */}
          <div className="np-lower">

            {/* Papa-Alpha Tools */}
            <div className="np-lower-col">
              <div className="np-sec-label">Papa-Alpha Tools</div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Piper Rigging Reference Tools</a>
                </div>
                <div className="np-svc-desc">
                  Precision flight control rigging tools for Piper PA-28, PA-30, PA-31, PA-36 series. CNC-machined aircraft-grade aluminum, powder coated and UV printed. Sold worldwide.
                </div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/products/rigging-kit">Rigging Kit</a>
                </div>
                <div className="np-svc-desc">Complete rigging kit covering stabilator, rudder, aileron, flap, and bell crank. From $264.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Individual Tools</a>
                </div>
                <div className="np-svc-desc">Stabilator, rudder, aileron &amp; flap, bell crank, and PA-31/PA-36 specific tools available separately. From $59.99.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name">
                  <a href="/collections/rigging-tools">Available At</a>
                </div>
                <div className="np-svc-desc">rogerwilcoaviation.com, Aircraft Spruce, and Amazon (coming soon). Made by professional mechanics for professional mechanics.</div>
              </div>
            </div>

            {/* Avionics */}
            <div className="np-lower-col">
              <div className="np-sec-label">Avionics</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">G3X Touch Suite</a></div>
                <div className="np-svc-desc">Full glass cockpit with ADAHRS, EIS, and synthetic vision. STC&rsquo;d for most single-engine piston aircraft.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a></div>
                <div className="np-svc-desc">GPS/NAV/COMM with WAAS LPV approaches. Full IFR certification and flight plan integration.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">GFC 500 Autopilot</a></div>
                <div className="np-svc-desc">Retrofit digital autopilot with GPSS steering, altitude hold, and vertical speed modes.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/collections/garmin-avionics">ADS-B Out Compliance</a></div>
                <div className="np-svc-desc">FAR 91.227 compliant installations. Transponder upgrades and system certification.</div>
              </div>
            </div>

            {/* Airframe & Powerplant */}
            <div className="np-lower-col">
              <div className="np-sec-label">Airframe &amp; Powerplant</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Annual Inspections</a></div>
                <div className="np-svc-desc">Thorough airworthiness inspections per FAR 43. Discrepancy reports and return-to-service documentation.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">100-Hour Inspections</a></div>
                <div className="np-svc-desc">For aircraft operated for hire under 14 C.F.R. Part 91 and Part 135 requirements.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Sheet Metal &amp; Fabrication</a></div>
                <div className="np-svc-desc">Structural repair, skin replacement, and custom fabrication in aircraft-grade aluminum alloys.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Engine Troubleshooting</a></div>
                <div className="np-svc-desc">Powerplant diagnostics, mag checks, compression testing, and engine runs.</div>
              </div>
            </div>

            {/* NDT & Certification */}
            <div className="np-lower-col">
              <div className="np-sec-label">NDT &amp; Certification</div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Eddy Current Inspection</a></div>
                <div className="np-svc-desc">Subsurface crack and corrosion detection in aluminum and ferrous components without disassembly.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/shop-capabilities">Dye Penetrant Testing</a></div>
                <div className="np-svc-desc">Surface crack detection per ASTM E1417 for engine components, castings, and structural parts.</div>
              </div>
              <div className="np-svc">
                <div className="np-svc-name"><a href="/pages/about">Certified Repair Station</a></div>
                <div className="np-svc-desc">FAA Certificate RWSR491E. All work by certificated mechanics with full logbook documentation.</div>
              </div>
              <div className="np-ornament">&#9670; &nbsp; &#9670; &nbsp; &#9670;</div>
              <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '11.5px', color: '#666' }}>
                Schedule your inspection today
              </div>
            </div>

          </div>

        </div>

        {/* ── Credentials ── */}
          <div className="np-credentials-bar">
            NBAA Member &nbsp;&middot;&nbsp; AEA Member &nbsp;&middot;&nbsp; Certified &amp; Trained
          </div>

        {/* ── Footer ── */}
        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>&copy; 2026 RWAS &middot; All Rights Reserved</span>
        </div>

      </div>
    </div>
    </>
  );
}
