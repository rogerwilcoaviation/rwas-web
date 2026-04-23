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
import LoanCalc from '../components/LoanCalc';

export const metadata = {
  title: 'Avionics Financing — Roger Wilco Aviation Services',
  description:
    'Finance your Garmin avionics upgrade or major maintenance project. Payment estimator and flexible terms. FAA Part 145 Repair Station RWSR491E at Chan Gurney Municipal (KYKN), Yankton, SD.',
};

export default function FinancingPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/financing" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="financing-hero">
          <span className="bs-kicker">Avionics &amp; Maintenance Financing</span>
          <span className="bs-script-accent">&mdash; keep your capital flying &mdash;</span>
          <h1 id="financing-hero" className="bs-headline bs-headline--hero">
            Don&rsquo;t tie up your capital&nbsp;&mdash;
            <br />
            <em>finance your upgrade.</em>
          </h1>
          <p className="bs-subhead">
            Affordable lending with reasonable terms &middot; Spread avionics and maintenance project costs across flexible monthly payments.
          </p>
          <div className="bs-byline">
            Garmin upgrades &middot; Panel fabrication &middot; Major maintenance &middot; AOG &amp; pre-buy work
          </div>
        </section>

        {/* ── TWO-COLUMN GRID ───────────────────────────────────────── */}
        <div className="about-grid">
          {/* MAIN COLUMN ---------------------------------------------- */}
          <div className="about-main">
            {/* Payment Estimator */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Payment Estimator</span>
              <h2 className="bs-headline bs-headline--section">Run the Numbers</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Use the calculator below to estimate monthly payments for your avionics installation or maintenance project. Adjust the loan amount, interest rate, and term to find a payment plan that works for your budget.
                </p>
              </div>
              <LoanCalc />
            </Specimen>

            {/* What Can Be Financed */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">What We&rsquo;ll Finance</span>
              <h2 className="bs-headline bs-headline--section">Eligible Projects</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Garmin G3X Touch Suite</p>
                    <p className="bs-svc-desc">Full glass cockpit with ADAHRS, EIS, and synthetic vision</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">GTN 650Xi / 750Xi</p>
                    <p className="bs-svc-desc">GPS/NAV/COMM with WAAS LPV approaches</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">GFC 500 Autopilot</p>
                    <p className="bs-svc-desc">Retrofit digital autopilot with GPSS steering</p>
                  </li>
                </ul>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">ADS-B Out Upgrades</p>
                    <p className="bs-svc-desc">FAR 91.227 compliant installations</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Panel Upgrades</p>
                    <p className="bs-svc-desc">Custom fabrication and installation</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Major Maintenance</p>
                    <p className="bs-svc-desc">Annuals, overhauls, and structural work</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            {/* How It Works */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">How It Works</span>
              <h2 className="bs-headline bs-headline--section">Three Steps to Upgrade</h2>
              <hr className="section-rule" />
              <div className="bs-steps">
                <div className="bs-step">
                  <div className="bs-step__label">Step 1</div>
                  <div className="bs-step__n">01</div>
                  <p>Talk to Captain Jerry or call us to scope your project and get a quote.</p>
                </div>
                <div className="bs-step">
                  <div className="bs-step__label">Step 2</div>
                  <div className="bs-step__n">02</div>
                  <p>We connect you with our lending partners for approval and terms.</p>
                </div>
                <div className="bs-step">
                  <div className="bs-step__label">Step 3</div>
                  <div className="bs-step__n">03</div>
                  <p>Work begins. You fly with new avionics while making affordable payments.</p>
                </div>
              </div>
              <div className="bs-pullquote">
                Upgrade now, pay over time &mdash; keep your aircraft and your capital working.
              </div>
            </Specimen>
          </div>

          {/* RAIL ----------------------------------------------------- */}
          <aside className="about-rail" aria-label="Get a quote &amp; contact">
            <Specimen as="section">
              <span className="bs-kicker">Get a Quote</span>
              <p>
                Use the Jerry popup in the navigation for financing questions, or contact us directly and we&rsquo;ll help scope the project and connect you with our lending partners for a formal quote.
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Call Us</span>
              <p>
                <a
                  href="tel:+16052998178"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  (605) 299-8178
                </a>
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Email</span>
              <p>
                <a
                  href="mailto:avionics@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  avionics@rwas.team
                </a>
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Browse Products</span>
              <ul>
                <li>
                  <a href="/collections/garmin-avionics">Garmin Avionics</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/collections/papa-alpha-tools">Papa-Alpha Tools</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/collections/on-sale">On Sale</a>
                  <span className="arr">&rarr;</span>
                </li>
                <li>
                  <a href="/shop-capabilities">Shop Capabilities</a>
                  <span className="arr">&rarr;</span>
                </li>
              </ul>
            </Specimen>

            {/* Ask Jerry CTA */}
            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; on duty 24/7 &mdash;</span>
              <h4>Talk to Captain Jerry</h4>
              <p>Financing questions &amp; project scoping</p>
              <a className="cta" href="#ask-jerry">
                Ask Jerry
              </a>
              <div className="footnote">AI-powered intake &middot; Available 24/7</div>
            </div>

            {/* Hero panel photo */}
            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/newspaper/images/r182_panel.jpg"
                alt="Full Garmin G500TXi Suite installation in a Cessna 182RG"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Cessna 182RG &mdash; full Garmin G500TXi Suite installation by RWAS.
              </Specimen.Caption>
            </Specimen>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
