/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';

export const metadata = {
  title: 'About | Roger Wilco Aviation Services',
  description: 'About Roger Wilco Aviation Services — FAA Part 145 Repair Station in Yankton, South Dakota. Over 40 years of aviation experience.',
};

export default function AboutPage() {
  return (
    <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">

        {/* Dateline */}
        <div className="np-dateline">
          <span>Spring 2026 Edition</span>
          <span>Vol. XL &middot; No. 1</span>
          <span>rogerwilcoaviation.com</span>
        </div>

        {/* Masthead */}
        <div className="np-masthead">
          <a href="/"><img className="np-masthead-logo" src="/newspaper/images/logo.png" alt="Roger Wilco Aviation Services" /></a>
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

        {/* Edition bar */}
        <div className="np-edition-bar">
          <span>Garmin Spring 2026 pricing now active</span>
          <span>GFC 500 autopilot installations available</span>
          <span>Now accepting spring scheduling</span>
        </div>

        {/* Nav */}
        <nav className="np-nav">
          <a href="/">Home</a>
          <a href="#ask-jerry" style={{ background: '#d4c47a', cursor: 'pointer' }} className="np-nav-jerry">Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a className="active" href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        {/* Ticker */}
        <div className="np-ticker-bar">
          <span className="np-ticker-label">Bulletin</span>
          <span className="np-ticker-text">
            Papa-Alpha rigging reference tools now shipping worldwide &nbsp;&bull;&nbsp;
            Garmin G3X Touch installations booking into summer 2026 &nbsp;&bull;&nbsp;
            Annual inspection slots available &mdash; call (605) 299-8178
          </span>
        </div>

        {/* Body */}
        <div className="np-body">

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 340px', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'stretch' }}>

            {/* LEFT — About copy */}
            <div style={{ padding: '0 2px' }}>
              <span className="np-kicker">About the Shop</span>
              <h1 className="np-headline-xl" style={{ fontSize: '28px', marginBottom: '6px' }}>
                Roger Wilco Aviation Services
              </h1>
              <div className="np-byline">FAA Part 145 Repair Station &middot; Certificate No. RWSR491E</div>
              <hr className="np-rule" />

              <p className="np-body-text np-drop">
                Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating under Certificate No. RWSR491E, the station is authorized for a complete range of maintenance, repair, and alteration work.
              </p>

              <p className="np-body-text">
                Under the direction of John Halsted &mdash; with more than 40 years of aviation experience &mdash; RWAS delivers sheet metal fabrication, structural repair, and complete Garmin avionics installations including the G3X Touch suite, GTN navigator series, and GFC 500 autopilot.
              </p>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Our Mission</span>
              <p className="np-body-text" style={{ marginTop: '6px' }}>
                To deliver honest, professional aircraft maintenance and avionics work &mdash; on time, documented correctly, and built to last. Every aircraft that leaves this shop is one we&rsquo;d fly ourselves.
              </p>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Capabilities</span>
              <p className="np-body-text" style={{ marginTop: '6px' }}>
                RWAS supports light sport aircraft with Rotax engines, traditional general aviation piston singles and twins, and global aviation needs through our Papa-Alpha precision rigging reference tools &mdash; shipped worldwide. Our technicians are American Bonanza Society trained and Garmin certified.
              </p>

              <p className="np-body-text">
                Shop capabilities include annual and 100-hour inspections, Garmin avionics sales and installation, eddy current and dye penetrant NDT inspection, sheet metal fabrication, structural repair, fiber laser cutting and welding, and custom CNC work.
              </p>

              <hr className="np-rule" />

              <div className="np-photo-box" style={{ marginTop: '10px' }}>
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
            </div>

            <div className="np-col-divider" />

            {/* RIGHT — Shop details */}
            <div style={{ padding: '0 2px' }}>
              <span className="np-kicker">Shop Details</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none' }}>Quick Reference</h3>
              <hr className="np-rule" />

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Location</div>
                <p className="np-body-text">
                  Chan Gurney Municipal Airport<br />
                  Yankton, South Dakota<br />
                  Airport ID: KYKN
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Phone</div>
                <p className="np-body-text">
                  <a href="tel:+16052998178" style={{ color: '#1a1a1a', textDecoration: 'underline', textUnderlineOffset: '2px' }}>(605) 299-8178</a>
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Certifications &amp; Memberships</div>
                <p className="np-body-text">
                  FAA Repair Station RWSR491E<br />
                  NBAA Member<br />
                  AEA Member<br />
                  Certified Garmin Dealer<br />
                  American Bonanza Society Trained
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Services</div>
                <div className="np-box-row"><a href="/pages/garmin-avionics-accessories"><span>Garmin Avionics</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/rigging-tools"><span>Papa-Alpha Tools</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>A&amp;P Maintenance</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>NDT Inspection</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>Sheet Metal &amp; Fabrication</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/financing"><span>Financing</span><span className="np-box-pg">&rarr;</span></a></div>
              </div>

              <div className="np-pull-quote" style={{ fontSize: '12px' }}>
                &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
              </div>

              <div className="np-ad-box" style={{ marginTop: '10px' }}>
                <div className="np-ad-title">Get In Touch</div>
                <div className="np-ad-sub">Schedule service or request a quote</div>
                <a className="np-ad-btn" href="/contact">Contact RWAS</a>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
                <div className="np-credentials-bar">
          NBAA Member &nbsp;&middot;&nbsp; AEA Member &nbsp;&middot;&nbsp; Certified &amp; Trained
        </div>

        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>&copy; 2026 RWAS &middot; All Rights Reserved</span>
        </div>

      </div>
    </div>
  );
}
