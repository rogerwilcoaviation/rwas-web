/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';
import JerryPopup from '../components/JerryPopup';

export const metadata = {
  title: 'Contact Roger Wilco Aviation Services | Ask Captain Jerry',
  description: 'Contact RWAS for avionics installations, maintenance scheduling, parts orders, and service inquiries. Chat with Captain Jerry for immediate assistance.',
};

export default function ContactPage() {
  return (
    <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">

        {/* Dateline */}
        <div className="np-dateline">
          <span>Contact &amp; Service Inquiries</span>
          <span>Roger Wilco Aviation Services</span>
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
          <span>Contact &amp; Intake</span>
          <span>Schedule Service</span>
          <span>Request a Quote</span>
        </div>

        {/* Nav */}
        <nav className="np-nav">
          <a href="/">Home</a>
          <JerryPopup />
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a className="active" href="/contact">Contact</a>
        </nav>

        {/* Body */}
        <div className="np-body">

          {/* Shop info */}
          <div style={{ padding: '14px 0', borderBottom: '2px solid #1a1a1a' }}>
            <div style={{ maxWidth: '420px' }}>
              <span className="np-kicker">Shop Information</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none' }}>Roger Wilco Aviation Services</h3>
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
                <div className="np-box-title">Certifications</div>
                <p className="np-body-text">
                  FAA Repair Station RWSR491E<br />
                  NBAA Member<br />
                  AEA Member
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Services</div>
                <div className="np-box-row"><a href="/pages/garmin-avionics-accessories"><span>Garmin Avionics</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/rigging-tools"><span>Papa-Alpha Tools</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>A&amp;P Maintenance</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>NDT Inspection</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/financing"><span>Financing</span><span className="np-box-pg">&rarr;</span></a></div>
              </div>

              <div className="np-pull-quote" style={{ fontSize: '12px' }}>
                &ldquo;We don&rsquo;t just fix aircraft &mdash; we keep them flying safely.&rdquo;
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="np-footer">
          <span className="np-footer-name">Roger Wilco Aviation Services</span>
          <span>&copy; 2026 RWAS &middot; All Rights Reserved</span>
        </div>

      </div>
    </div>
  );
}
