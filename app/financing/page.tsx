/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */
import '../newspaper.css';
import LoanCalc from '../components/LoanCalc';

export const metadata = {
  title: 'Avionics Financing | Roger Wilco Aviation Services',
  description: 'Affordable avionics financing for Garmin installations, upgrades, and aircraft maintenance. Payment estimator and flexible terms from RWAS.',
};

export default function FinancingPage() {
  return (
    <div className="np-wrapper" style={{ background: '#ddd9d2', minHeight: '100vh', fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="np-page">

        <div className="np-dateline">
          <span>Spring 2026 Edition</span>
          <span>Vol. XL &middot; No. 1</span>
          <span>rogerwilcoaviation.com</span>
        </div>

        <div className="np-masthead">
          <a href="/"><img className="np-masthead-logo" src="/newspaper/images/logo.png" alt="RWAS" /></a>
          <div className="np-masthead-center">
            <div className="np-masthead-name">Roger Wilco Aviation Services</div>
            <hr className="np-masthead-rule" />
            <div className="np-masthead-tagline">
              FAA Cert. Repair Station &nbsp;&middot;&nbsp; Avionics &nbsp;&middot;&nbsp; Airframe &amp; Powerplant &nbsp;&middot;&nbsp; NDT &nbsp;&middot;&nbsp; Fabrication
            </div>
          </div>
          <div className="np-masthead-right">Cert. No. RWSR491E<br />KYKN &middot; Yankton, SD</div>
        </div>

        <div className="np-edition-bar">
          <span>Garmin Spring 2026 pricing now active</span>
          <span>GFC 500 autopilot installations available</span>
          <span>Now accepting spring scheduling</span>
        </div>

        <nav className="np-nav">
          <a href="/">Home</a>
          <a href="javascript:void(0)" className="np-nav-jerry" style={{ background: '#d4c47a' }}>Ask Jerry</a>
          <a href="/collections/on-sale">On Sale</a>
          <a href="/collections/garmin-avionics">Garmin</a>
          <a href="/collections/rigging-tools">Papa-Alpha Tools</a>
          <a className="active" href="/financing">Financing</a>
          <a href="/shop-capabilities">Shop Capabilities</a>
          <a href="/blog/">Blog Articles</a>
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

        <div className="np-body">

          {/* Header */}
          <div style={{ borderBottom: '2px solid #1a1a1a', padding: '14px 0' }}>
            <span className="np-kicker">Avionics &amp; Maintenance Financing</span>
            <h1 className="np-headline-xl" style={{ fontSize: '28px', marginBottom: '6px' }}>
              Don&rsquo;t Tie Up Your Capital &mdash;<br />
              <em>Finance Your Upgrade</em>
            </h1>
            <div className="np-byline">Affordable lending with reasonable terms &middot; Keep your capital available</div>
          </div>

          {/* Two-column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 320px', padding: '14px 0', borderBottom: '2px solid #1a1a1a', alignItems: 'start' }}>

            {/* LEFT — Calculator + Info */}
            <div style={{ padding: '0 2px' }}>

              <div className="np-sec-label">Payment Estimator</div>
              <p className="np-body-text" style={{ marginBottom: '12px' }}>
                Use the calculator below to estimate monthly payments for your avionics installation or maintenance project. Adjust the loan amount, interest rate, and term to find a payment plan that works for your budget.
              </p>

              <LoanCalc />

              <hr className="np-rule-thick" />

              <div className="np-sec-label">What Can Be Financed?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: '14px' }}>
                <div>
                  <div className="np-svc"><div className="np-svc-name">Garmin G3X Touch Suite</div><div className="np-svc-desc">Full glass cockpit with ADAHRS, EIS, and synthetic vision</div></div>
                  <div className="np-svc"><div className="np-svc-name">GTN 650Xi / 750Xi</div><div className="np-svc-desc">GPS/NAV/COMM with WAAS LPV approaches</div></div>
                  <div className="np-svc"><div className="np-svc-name">GFC 500 Autopilot</div><div className="np-svc-desc">Retrofit digital autopilot with GPSS steering</div></div>
                </div>
                <div>
                  <div className="np-svc"><div className="np-svc-name">ADS-B Out Upgrades</div><div className="np-svc-desc">FAR 91.227 compliant installations</div></div>
                  <div className="np-svc"><div className="np-svc-name">Panel Upgrades</div><div className="np-svc-desc">Custom fabrication and installation</div></div>
                  <div className="np-svc"><div className="np-svc-name">Major Maintenance</div><div className="np-svc-desc">Annuals, overhauls, and structural work</div></div>
                </div>
              </div>

              <hr className="np-rule-thick" />

              <div className="np-sec-label">How It Works</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div className="np-box">
                  <div className="np-box-title">Step 1</div>
                  <p className="np-body-text">Talk to Captain Jerry or call us to scope your project and get a quote.</p>
                </div>
                <div className="np-box">
                  <div className="np-box-title">Step 2</div>
                  <p className="np-body-text">We connect you with our lending partners for approval and terms.</p>
                </div>
                <div className="np-box">
                  <div className="np-box-title">Step 3</div>
                  <p className="np-body-text">Work begins. You fly with new avionics while making affordable payments.</p>
                </div>
              </div>

              <div className="np-pull-quote">
                &ldquo;Upgrade now, pay over time &mdash; keep your aircraft and your capital working.&rdquo;
              </div>

            </div>

            <div className="np-col-divider" />

            {/* RIGHT — Contact */}
            <div style={{ padding: '0 2px' }}>
              <span className="np-kicker">Get a Quote</span>
              <h3 className="np-headline-md" style={{ textDecoration: 'none' }}>Contact RWAS</h3>
              <hr className="np-rule" />
              <p className="np-body-text" style={{ marginBottom: '10px' }}>
                Use the Jerry popup in the navigation for financing questions, or contact us directly and we&rsquo;ll help scope the project and connect you with our team for a formal quote.
              </p>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Call Us</div>
                <p className="np-body-text">
                  <a href="tel:+16052998178" style={{ color: '#1a1a1a', textDecoration: 'underline', textUnderlineOffset: '2px' }}>(605) 299-8178</a>
                </p>
              </div>

              <div className="np-box" style={{ marginBottom: '10px' }}>
                <div className="np-box-title">Browse Products</div>
                <div className="np-box-row"><a href="/collections/garmin-avionics"><span>Garmin Avionics</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/rigging-tools"><span>Papa-Alpha Tools</span><span className="np-box-pg">&rarr;</span></a></div>
                <div className="np-box-row"><a href="/collections/on-sale"><span>On Sale</span><span className="np-box-pg">&rarr;</span></a></div>
              </div>

              <div className="np-photo-box" style={{ marginTop: '10px' }}>
                <div className="np-photo-area">
                  <img src="/newspaper/images/r182_panel.jpg" alt="Garmin G3X cockpit" />
                </div>
                <div className="np-photo-cap">
                  Finance a full glass cockpit upgrade &mdash; Garmin G3X Touch installation by RWAS.
                </div>
              </div>
            </div>

          </div>
        </div>

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
