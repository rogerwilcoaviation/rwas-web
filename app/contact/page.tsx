/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';

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
          <a href="javascript:void(0)" className="np-nav-jerry" style={{ background: '#d4c47a' }}>Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
          <a className="active" href="/contact">Contact</a>
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

        {/* Body — two column layout */}
        <div className="np-body">
          <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #1a1a1a' }}>

            {/* LEFT — Service Desk */}
            <div style={{ flex: '1 1 0', padding: '14px 16px 14px 0', borderRight: '1px solid #1a1a1a' }}>
              <span className="np-kicker" style={{ display: 'block', textAlign: 'center' }}>Service Desk</span>
              <h1 className="np-headline-xl" style={{ textAlign: 'center', fontSize: '28px', margin: '6px 0' }}>Talk to Captain Jerry</h1>
              <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', marginBottom: '10px' }}>
                AI-Powered Intake Coordinator &middot; Available 24/7
              </div>
              <hr className="np-rule" />

              <p className="np-body-text" style={{ marginBottom: '10px' }}>
                Captain Jerry is your first point of contact for all service inquiries, quote requests, and scheduling. Describe your aircraft, the work needed, and your timeline &mdash; Jerry will collect the details and route your request directly to our team.
              </p>
              <p className="np-body-text" style={{ marginBottom: '14px' }}>
                Jerry can help with avionics installation quotes, annual inspection scheduling, parts availability, Papa-Alpha tool orders, and general shop questions.
              </p>

              <div style={{ marginTop: '12px', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#888', letterSpacing: '0.05em' }}>
                Prefer to call? <a href="tel:+16052998178" style={{ color: '#1a1a1a', textDecoration: 'underline' }}>(605) 299-8178</a> &nbsp;&middot;&nbsp;
                Email: <a href="mailto:avionics@rwas.team" style={{ color: '#1a1a1a', textDecoration: 'underline' }}>avionics@rwas.team</a>
              </div>
            </div>

            {/* RIGHT — Shop Info sidebar */}
            <div style={{ width: '280px', flexShrink: 0, padding: '14px 0 14px 16px' }}>
              <span className="np-kicker" style={{ display: 'block', textAlign: 'center' }}>Shop Information</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none', textAlign: 'center' }}>Roger Wilco Aviation Services</h3>
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
                <div className="np-box-row"><a href="/garmin"><span>Garmin Avionics</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/rigging-tools"><span>Papa-Alpha Tools</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>A&amp;P Maintenance</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/shop-capabilities"><span>NDT Inspection</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/financing"><span>Financing</span><span className="np-box-pg">&rarr;</span></a></div>
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
  );
}
