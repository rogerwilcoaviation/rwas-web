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
  title: 'Shop Capabilities — Avionics, A&P, NDT',
  description:
    'Full-spectrum aircraft maintenance: Garmin installations, A&P airframe & powerplant, NDT inspection, sheet metal fabrication, fiber laser cutting. FAA Part 145 Repair Station RWSR491E at Chan Gurney Municipal (KYKN), Yankton, SD.',
};

export default function ShopCapabilitiesPage() {
  return (
    <BroadsheetLayout>
      {/* Schema.org Service catalog (preserved verbatim from prior build) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Service',
                '@id': 'https://www.rogerwilcoaviation.com/shop-capabilities#garmin',
                name: 'Garmin Avionics Installation',
                serviceType: 'Avionics Installation',
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                areaServed: [
                  { '@type': 'State', name: 'South Dakota' },
                  { '@type': 'State', name: 'Nebraska' },
                  { '@type': 'State', name: 'Iowa' },
                  { '@type': 'State', name: 'Minnesota' },
                  { '@type': 'State', name: 'North Dakota' },
                ],
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Garmin Avionics',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'G3X Touch Suite Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GTN 650Xi / 750Xi Navigator Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GFC 500 Autopilot Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'ADS-B Out Compliance' } },
                  ],
                },
              },
              {
                '@type': 'Service',
                '@id': 'https://www.rogerwilcoaviation.com/shop-capabilities#airframe-powerplant',
                name: 'Airframe & Powerplant Maintenance',
                serviceType: 'Aircraft Maintenance',
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                description:
                  'Comprehensive airframe and powerplant services for GA, corporate, and commercial operators. All work performed by certificated mechanics with full logbook documentation.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Airframe & Powerplant',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Annual Inspections', description: 'Per FAR 43 with discrepancy reports' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Condition & Pre-Buy Inspections' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: '100-Hour Inspections', description: 'Part 91 and Part 135' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'AOG Go-Van Service' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Propeller Balancing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Weight Certification', description: 'Up to 30,000 lbs' } },
                  ],
                },
              },
              {
                '@type': 'Service',
                '@id': 'https://www.rogerwilcoaviation.com/shop-capabilities#ndt',
                name: 'Non-Destructive Testing & Inspection',
                serviceType: 'NDT Inspection',
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                description:
                  'Level 3 NDT services with FAA Form 8130-3 return to service and Airworthiness Directive compliance.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'NDT Methods',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Eddy Current Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Dye Penetrant Testing', description: 'Per ASTM E1417' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Magnetic Particle Inspection' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Ultrasound Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Visual Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Rockwell Hardness Testing' } },
                  ],
                },
              },
              {
                '@type': 'Service',
                '@id': 'https://www.rogerwilcoaviation.com/shop-capabilities#fabrication',
                name: 'Fabrication & Manufacturing',
                serviceType: 'Aircraft Fabrication',
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                description:
                  'In-house CNC machining, fiber laser cutting, and fabrication capabilities for aircraft panels, structural components, and precision tooling.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Fabrication Capabilities',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'CNC Router Fabrication' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fiber Laser Cutting & Welding' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Panel Fabrication' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sheet Metal Repair & Replacement' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Multi-Color Powder Coating' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'UV Printing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'CO2 Laser Engraving' } },
                  ],
                },
              },
            ],
          }),
        }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/shop-capabilities" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        {/* ── HERO HEADLINE ─────────────────────────────────────────── */}
        <section className="hero-headline-group" aria-labelledby="caps-hero">
          <span className="bs-kicker">FAA Part 145 Repair Station &middot; Certificate #RWSR491E</span>
          <span className="bs-script-accent">&mdash; Northern Plains shop floor &mdash;</span>
          <h1 id="caps-hero" className="bs-headline bs-headline--hero">
            Full-spectrum aircraft maintenance,
            <br />
            <em>avionics &amp; fabrication.</em>
          </h1>
          <p className="bs-subhead">
            Limited Airframe &middot; Limited Instrument &middot; Limited Radio &middot; NDT Inspection &amp; Testing
          </p>
          <div className="bs-byline">
            Chan Gurney Municipal (KYKN) &middot; Yankton, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        {/* ── TWO-COLUMN GRID ───────────────────────────────────────── */}
        <div className="about-grid">
          {/* MAIN COLUMN ---------------------------------------------- */}
          <div className="about-main">
            {/* Garmin Avionics */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Garmin Avionics Installations</span>
              <h2 className="bs-headline bs-headline--section">Certified Garmin Dealer</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    Certified Garmin dealer and installation center. Full glass cockpit upgrades including the G3X Touch suite with ADAHRS, EIS, and synthetic vision &mdash; plus navigator, autopilot, and ADS-B retrofits across the piston, turboprop, and experimental fleet.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name"><a href="/collections/garmin-avionics">G3X Touch Suite</a></p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><a href="/collections/garmin-avionics">GTN 650Xi / 750Xi</a></p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><a href="/collections/garmin-avionics">GFC 500 Autopilot</a></p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><a href="/collections/garmin-avionics">ADS-B Out Compliance</a></p>
                  </li>
                </ul>
              </div>
            </Specimen>

            {/* Airframe & Powerplant */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Airframe &amp; Powerplant</span>
              <h2 className="bs-headline bs-headline--section">A&amp;P Maintenance</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    Comprehensive airframe and powerplant services for GA, corporate, and commercial operators. All work performed by certificated mechanics with full logbook documentation and FAA Form 8130-3 return to service when applicable.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Annual Inspections</p>
                    <p className="bs-svc-desc">Per FAR 43 with discrepancy reports</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Condition &amp; Pre-Buy Inspections</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">100-Hour Inspections</p>
                    <p className="bs-svc-desc">Part 91 and Part 135</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">AOG &ldquo;Go-Van&rdquo; Service</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Propeller Balancing</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Aircraft Weight Certification</p>
                    <p className="bs-svc-desc">Up to 30,000 lbs</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            {/* NDT */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Non-Destructive Testing</span>
              <h2 className="bs-headline bs-headline--section">NDT Inspection &amp; Testing</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    Level 3 NDT services with FAA Form 8130-3 return to service and Airworthiness Directive compliance. Full range of inspection methods for structural integrity verification across metallic airframe, engine, and propeller components.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Eddy Current Testing</p>
                    <p className="bs-svc-desc">Subsurface crack and corrosion detection</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Dye Penetrant Testing</p>
                    <p className="bs-svc-desc">Surface crack detection per ASTM E1417</p>
                  </li>
                  <li className="bs-svc"><p className="bs-svc-name">Magnetic Particle Inspection</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Ultrasound Testing</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Visual Testing</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Rockwell Hardness Testing</p></li>
                </ul>
              </div>
            </Specimen>

            {/* Fabrication */}
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Fabrication &amp; Manufacturing</span>
              <h2 className="bs-headline bs-headline--section">In-House Precision</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    In-house CNC machining, laser cutting, and fabrication capabilities for aircraft panels, structural components, and precision tooling. Home of Papa-Alpha rigging reference tools for the Piper fleet.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc"><p className="bs-svc-name">CNC Router Fabrication</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Fiber Laser Cutting &amp; Welding</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Aircraft Panel Fabrication</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Sheet Metal Repair &amp; Replacement</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Multi-Color Powder Coating</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">UV Printing</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">CO2 Laser Engraving</p></li>
                  <li className="bs-svc"><p className="bs-svc-name">Computer Aided Design (CAD)</p></li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><a href="/collections/papa-alpha-tools">Papa-Alpha Reference Tools</a></p>
                    <p className="bs-svc-desc">Precision Piper rigging tools &mdash; designed and manufactured in-house</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            {/* FIG. 01 — Laser cutter */}
            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.jpg"
                alt="Fiber laser cutting in the RWAS shop"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Fiber laser &mdash; precision cutting &amp; welding, in-house at RWAS.
              </Specimen.Caption>
            </Specimen>
          </div>

          {/* RAIL ----------------------------------------------------- */}
          <aside className="about-rail" aria-label="Schedule service &amp; credentials">
            <Specimen as="section">
              <span className="bs-kicker">Schedule Service</span>
              <p>
                Ready to schedule an inspection, get an avionics quote, or discuss a project? Use the Jerry popup in the navigation or contact our team directly.
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Quick Contact</span>
              <p>
                <a
                  href="tel:+16052998178"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  (605) 299-8178
                </a>
                <br />
                Chan Gurney Municipal (KYKN)
                <br />
                Yankton, South Dakota
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Certifications</span>
              <p>
                FAA Part 145 Repair Station
                <br />
                Certificate #RWSR491E
                <br />
                Limited Airframe
                <br />
                Limited Instrument
                <br />
                Limited Radio
                <br />
                NDT Level 3
                <br />
                NBAA Member &middot; AEA Member
              </p>
            </Specimen>

            {/* Ask Jerry CTA */}
            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; on duty 24/7 &mdash;</span>
              <h4>Talk to Captain Jerry</h4>
              <p>Project scoping &amp; scheduling</p>
              <a className="cta" href="#ask-jerry">
                Ask Jerry
              </a>
              <div className="footnote">AI-powered intake &middot; Available 24/7</div>
            </div>

            {/* R182 panel photo */}
            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/newspaper/images/r182_panel.jpg"
                alt="Full Garmin G500TXi Suite installation in a Cessna 182RG"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 02">
                Cessna 182RG &mdash; full Garmin G500TXi Suite installation by RWAS.
              </Specimen.Caption>
            </Specimen>

            {/* Papa-Alpha kit photo */}
            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/newspaper/images/papa_alpha_kit.jpg"
                alt="Papa-Alpha rigging reference tools"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 03">
                Papa-Alpha rigging reference tools &mdash; manufactured in-house.
              </Specimen.Caption>
            </Specimen>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
