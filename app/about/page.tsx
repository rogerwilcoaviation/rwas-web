/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';

export const metadata = {
  title: 'About | Roger Wilco Aviation Services',
  description: 'About Roger Wilco Aviation Services — FAA Part 145 Repair Station in Yankton, South Dakota. Over 40 years of aviation experience. Contact information, history, and capabilities.',
};

export default function AboutPage() {
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
        .np-lightbox {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 100000;
          background: rgba(0,0,0,0.92);
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .np-lightbox:target {
          display: flex;
        }
        .np-lightbox img {
          max-width: 95vw;
          max-height: 90vh;
          object-fit: contain;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }
        .np-lightbox-close {
          position: absolute;
          top: 20px; right: 30px;
          font-size: 40px;
          color: #f7f4ef;
          text-decoration: none;
          font-weight: 700;
          z-index: 100001;
        }
      `}</style>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 300px', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'start' }}>

            {/* LEFT — About & History */}
            <div style={{ padding: '0 16px 0 0' }}>
              <span className="np-kicker">About the Shop</span>
              <h1 className="np-headline-xl" style={{ fontSize: '28px', marginBottom: '6px' }}>
                Roger Wilco Aviation Services
              </h1>
              <div className="np-byline">FAA Part 145 Repair Station &middot; Certificate No. RWSR491E &middot; Yankton, South Dakota</div>
              <hr className="np-rule" />

              <p className="np-body-text np-drop">
                Roger Wilco Aviation Services is an FAA-certificated repair station providing full-spectrum airframe, powerplant, avionics, and non-destructive testing services to general aviation, corporate, and commercial operators across the Northern Plains. Operating from Chan Gurney Municipal Airport (KYKN) in Yankton, South Dakota, the station is authorized under Certificate No. RWSR491E for a complete range of maintenance, repair, and alteration work.
              </p>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Our History</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none', marginBottom: '6px' }}>Four Decades in Aviation</h3>
              <hr className="np-rule" />

              <p className="np-body-text">
                RWAS was founded by John Halsted, a veteran Delta Air Lines captain with more than 40 years of aviation experience spanning airline operations, aircraft maintenance, avionics systems, and flight instruction. What started as a single-hangar maintenance shop at Chan Gurney Municipal Airport in Yankton, South Dakota, has evolved into a full-service FAA-certificated repair station serving aircraft owners and operators across the upper Midwest and beyond.
              </p>

              <p className="np-body-text">
                Halsted earned his Airline Transport Pilot certificate at 21 and has spent the decades since building deep expertise on both sides of the cockpit, flying the line and turning wrenches. That dual perspective shapes everything RWAS does.
              </p>

              <p className="np-body-text">
                In its early years the shop focused on annual inspections, airframe repair, and basic avionics work for the local general-aviation fleet. When the Garmin glass-cockpit revolution reshaped the industry, Halsted saw an opportunity: bring modern avionics capability to the Northern Plains, a region where most owners had been forced to ferry their aircraft hundreds of miles to metro shops for panel upgrades. RWAS became a certified Garmin dealer and installation center, specializing in the G3X Touch suite, GTN Xi navigator series, and GFC 500 autopilot.
              </p>

              <div className="np-photo-box" style={{ margin: '12px 0' }}>
                <div className="np-photo-area">
                  <a href="#panel-lightbox">
                    <img src="/newspaper/images/n5171s_panel.jpg" alt="N5171S instrument panel" style={{ cursor: 'pointer' }} />
                  </a>
                </div>
                <div className="np-photo-cap">
                  N5171S &mdash; Custom laser-cut instrument panel by Roger Wilco Aviation Services.
                </div>
              </div>

              <div id="panel-lightbox" className="np-lightbox">
                <a href="#_" className="np-lightbox-close">&times;</a>
                <img src="/newspaper/images/n5171s_panel.jpg" alt="N5171S instrument panel" />
              </div>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Papa-Alpha Tools</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none', marginBottom: '6px' }}>Precision Rigging, Built In-House</h3>
              <hr className="np-rule" />

              <p className="np-body-text">
                One of the unique capabilities to come out of the RWAS shop is the Papa-Alpha line of precision rigging reference tools for Piper aircraft. Designed by Halsted after years of frustration with imprecise field methods for flight control rigging, the Papa-Alpha tools are CNC-machined from aircraft-grade aluminum, powder coated, and UV printed with permanent reference markings.
              </p>

              <p className="np-body-text">
                The tools cover stabilator, rudder, aileron, flap, and bell crank rigging for the PA-28, PA-30, PA-31, and PA-36 series &mdash; replacing the guesswork and tribal knowledge that has plagued Piper rigging for decades. Papa-Alpha tools are now shipped worldwide to maintenance shops, flight schools, and individual owners, and are available through rogerwilcoaviation.com, Aircraft Spruce, and Amazon.
              </p>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Special Capabilities</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none', marginBottom: '6px' }}>NDT, Fabrication &amp; Laser Cutting</h3>
              <hr className="np-rule" />

              <p className="np-body-text">
                Beyond avionics and airframe maintenance, RWAS operates non-destructive testing services including eddy current, dye penetrant, and magnetic particle inspection. The shop also maintains a sheet metal fabrication capability for structural repairs, custom cowlings, and bracket fabrication in aircraft-grade aluminum alloys.
              </p>

              <p className="np-body-text">
                Recent additions include a fiber laser cutting and welding system, enabling precision work on thin-gauge metals that was previously outsourced. This technology supports both aircraft work and the manufacturing of Papa-Alpha tools in-house.
              </p>

              <hr className="np-rule-thick" />

              <span className="np-kicker">Our Mission</span>
              <p className="np-body-text" style={{ marginTop: '6px' }}>
                To deliver honest, professional aircraft maintenance and avionics work &mdash; on time, documented correctly, and built to last. Every aircraft that leaves this shop is one we&rsquo;d fly ourselves.
              </p>

              <div className="np-pull-quote" style={{ marginTop: '12px' }}>
                &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
              </div>
            </div>

            <div className="np-col-divider" />

            {/* RIGHT — Contact & Quick Reference */}
            <div style={{ padding: '0 0 0 16px' }}>
              <span className="np-kicker" style={{ display: 'block', textAlign: 'center' }}>Contact &amp; Info</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none', textAlign: 'center' }}>Quick Reference</h3>
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
                <div className="np-box-title">Email</div>
                <p className="np-body-text">
                  <a href="mailto:avionics@rwas.team" style={{ color: '#1a1a1a', textDecoration: 'underline', textUnderlineOffset: '2px' }}>avionics@rwas.team</a>
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Hours</div>
                <p className="np-body-text">
                  Monday &ndash; Friday<br />
                  8:00 AM &ndash; 5:00 PM CT
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
                <div className="np-box-row"><a href="/collections/garmin-avionics"><span>Garmin Avionics</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/rigging-tools"><span>Papa-Alpha Tools</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>A&amp;P Maintenance</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>NDT Inspection</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>Sheet Metal &amp; Fabrication</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/financing"><span>Financing</span><span className="np-box-pg">&rarr;</span></a></div>
              </div>

              <div className="np-ad-box" style={{ marginTop: '10px' }}>
                <div className="np-ad-title">Talk to Captain Jerry</div>
                <div className="np-ad-sub">Service inquiries &amp; scheduling</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#666', marginBottom: '7px', letterSpacing: '0.05em' }}>
                  AI-powered intake &middot; Available 24/7
                </div>
                <a className="np-ad-btn" href="#ask-jerry">Ask Jerry</a>
              </div>

              <div className="np-photo-box" style={{ marginTop: '12px' }}>
                <div className="np-photo-area">
                  <img src="/newspaper/images/laser_cutter.jpg" alt="Fiber laser cutting" style={{ objectPosition: 'center center' }} />
                </div>
                <div className="np-photo-cap">
                  Fiber laser cutting &mdash; precision fabrication in-house at RWAS.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Credentials */}
        <div className="np-credentials-bar">
          NBAA Member &nbsp;&middot;&nbsp; AEA Member &nbsp;&middot;&nbsp; Certified &amp; Trained
        </div>

        {/* Footer */}
        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>&copy; 2026 RWAS &middot; All Rights Reserved</span>
        </div>

      </div>
    </div>
    </>
  );
}
