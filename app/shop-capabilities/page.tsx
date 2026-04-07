/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';

export const metadata = {
  title: 'Shop Capabilities | Roger Wilco Aviation Services',
  description: 'FAA Part 145 Repair Station RWSR491E — Garmin avionics installations, NDT, sheet metal fabrication, CNC routing, annual inspections, and aircraft management.',
};

export default function ShopCapabilitiesPage() {
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
          <a href="/"><img className="np-masthead-logo" src="/newspaper/images/logo.png" alt="RWAS" /></a>
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
          <a className="active" href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a href="/about">About</a>
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

          {/* Header section */}
          <div style={{ borderBottom: '2px solid #1a1a1a', padding: '14px 0' }}>
            <span className="np-kicker">FAA Part 145 Repair Station &middot; Certificate #RWSR491E</span>
            <h1 className="np-headline-xl" style={{ fontSize: '30px', marginBottom: '6px' }}>
              Full-Spectrum Aircraft Maintenance,<br />
              <em>Avionics &amp; Fabrication</em>
            </h1>
            <div className="np-byline">Limited Airframe &middot; Limited Instrument &middot; Limited Radio &middot; NDT Inspection &amp; Testing</div>
          </div>

          {/* Two-column: capabilities + Jerry */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 320px', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'start' }}>

            {/* LEFT — Capabilities */}
            <div style={{ padding: '0 2px' }}>

              {/* Garmin Avionics */}
              <div className="np-sec-label">Garmin Avionics Installations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: '14px' }}>
                <div>
                  <p className="np-body-text">Certified Garmin dealer and installation center. Full glass cockpit upgrades including the G3X Touch suite with ADAHRS, EIS, and synthetic vision.</p>
                </div>
                <div>
                  <div className="np-svc"><div className="np-svc-name"><a href="/collections/garmin-avionics">G3X Touch Suite</a></div></div>
                  <div className="np-svc"><div className="np-svc-name"><a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a></div></div>
                  <div className="np-svc"><div className="np-svc-name"><a href="/collections/garmin-avionics">GFC 500 Autopilot</a></div></div>
                  <div className="np-svc"><div className="np-svc-name"><a href="/collections/garmin-avionics">ADS-B Out Compliance</a></div></div>
                </div>
              </div>

              <hr className="np-rule-thick" />

              {/* Airframe & Maintenance */}
              <div className="np-sec-label">Airframe &amp; Powerplant</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: '14px' }}>
                <div>
                  <p className="np-body-text">Comprehensive airframe and powerplant services for GA, corporate, and commercial operators. All work performed by certificated mechanics with full logbook documentation.</p>
                </div>
                <div>
                  <div className="np-svc"><div className="np-svc-name">Annual Inspections</div><div className="np-svc-desc">Per FAR 43 with discrepancy reports</div></div>
                  <div className="np-svc"><div className="np-svc-name">Condition &amp; Pre-Buy Inspections</div></div>
                  <div className="np-svc"><div className="np-svc-name">100-Hour Inspections</div><div className="np-svc-desc">Part 91 and Part 135</div></div>
                  <div className="np-svc"><div className="np-svc-name">AOG &ldquo;Go-Van&rdquo; Service</div></div>
                  <div className="np-svc"><div className="np-svc-name">Propeller Balancing</div></div>
                  <div className="np-svc"><div className="np-svc-name">Aircraft Weight Certification</div><div className="np-svc-desc">Up to 30,000 lbs</div></div>
                </div>
              </div>

              <hr className="np-rule-thick" />

              {/* NDT */}
              <div className="np-sec-label">Non-Destructive Testing &amp; Inspection</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: '14px' }}>
                <div>
                  <p className="np-body-text">Level 3 NDT services with FAA Form 8130-3 return to service and Airworthiness Directive compliance. Full range of inspection methods for structural integrity verification.</p>
                </div>
                <div>
                  <div className="np-svc"><div className="np-svc-name">Eddy Current Testing</div><div className="np-svc-desc">Subsurface crack and corrosion detection</div></div>
                  <div className="np-svc"><div className="np-svc-name">Dye Penetrant Testing</div><div className="np-svc-desc">Surface crack detection per ASTM E1417</div></div>
                  <div className="np-svc"><div className="np-svc-name">Magnetic Particle Inspection</div></div>
                  <div className="np-svc"><div className="np-svc-name">Ultrasound Testing</div></div>
                  <div className="np-svc"><div className="np-svc-name">Visual Testing</div></div>
                  <div className="np-svc"><div className="np-svc-name">Rockwell Hardness Testing</div></div>
                </div>
              </div>

              <hr className="np-rule-thick" />

              {/* Fabrication */}
              <div className="np-sec-label">Fabrication &amp; Manufacturing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: '14px' }}>
                <div>
                  <p className="np-body-text">In-house CNC machining, laser cutting, and fabrication capabilities for aircraft panels, structural components, and precision tooling. Home of Papa-Alpha rigging reference tools.</p>
                  <div style={{ marginTop: '8px' }}>
                    <img src="/newspaper/images/laser_cutter.jpg" alt="Fiber laser cutting" style={{ width: '100%', border: '1px solid #1a1a1a', display: 'block' }} />
                    <div className="np-img-box-cap">Fiber laser cutting &mdash; new capability at RWAS.</div>
                  </div>
                </div>
                <div>
                  <div className="np-svc"><div className="np-svc-name">CNC Router Fabrication</div></div>
                  <div className="np-svc"><div className="np-svc-name">Fiber Laser Cutting &amp; Welding</div></div>
                  <div className="np-svc"><div className="np-svc-name">Aircraft Panel Fabrication</div></div>
                  <div className="np-svc"><div className="np-svc-name">Sheet Metal Repair &amp; Replacement</div></div>
                  <div className="np-svc"><div className="np-svc-name">Multi-Color Powder Coating</div></div>
                  <div className="np-svc"><div className="np-svc-name">UV Printing</div></div>
                  <div className="np-svc"><div className="np-svc-name">CO2 Laser Engraving</div></div>
                  <div className="np-svc"><div className="np-svc-name">Computer Aided Design (CAD)</div></div>
                  <div className="np-svc"><div className="np-svc-name"><a href="/collections/rigging-tools">Papa-Alpha Reference Tools</a></div><div className="np-svc-desc">Precision Piper rigging tools &mdash; designed and manufactured in-house</div></div>
                </div>
              </div>

            </div>

            <div className="np-col-divider" />

            {/* RIGHT — Quick Info */}
            <div style={{ padding: '0 2px' }}>
              <span className="np-kicker">Schedule Service</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none' }}>Contact RWAS</h3>
              <hr className="np-rule" />
              <p className="np-body-text" style={{ marginBottom: '10px' }}>
                Ready to schedule an inspection, get an avionics quote, or discuss a project? Use the Jerry popup in the navigation or contact our team directly.
              </p>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Quick Contact</div>
                <p className="np-body-text">
                  <a href="tel:+16052998178" style={{ color: '#1a1a1a', textDecoration: 'underline', textUnderlineOffset: '2px' }}>(605) 299-8178</a>
                </p>
                <p className="np-body-text" style={{ marginTop: '4px' }}>
                  Chan Gurney Municipal (KYKN)<br />Yankton, South Dakota
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Certifications</div>
                <p className="np-body-text">
                  FAA Part 145 Repair Station<br />
                  Certificate #RWSR491E<br />
                  Limited Airframe<br />
                  Limited Instrument<br />
                  Limited Radio<br />
                  NDT Level 3<br />
                  NBAA Member &middot; AEA Member
                </p>
              </div>

              <div className="np-photo-box" style={{ marginTop: '10px' }}>
                <div className="np-photo-area">
                  <img src="/newspaper/images/r182_panel.jpg" alt="Garmin G3X cockpit" />
                </div>
                <div className="np-photo-cap">
                  Cessna 182RG &mdash; full Garmin G3X Touch installation by RWAS.
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <img src="/newspaper/images/papa_alpha_kit.jpg" alt="Papa-Alpha rigging tools" style={{ width: '100%', border: '1px solid #1a1a1a', display: 'block' }} />
                <div className="np-img-box-cap">Papa-Alpha rigging reference tools &mdash; manufactured at RWAS.</div>
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
