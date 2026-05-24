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
import Link from 'next/link';

const pageUrl = 'https://www.rogerwilcoaviation.com/services/aircraft-maintenance-sioux-falls';

export const metadata = {
  title: { absolute: 'Aircraft Maintenance & Annual Inspections - Sioux Falls, SD | RWAS' },
  description:
    'Aircraft maintenance, annual inspections, 100-hour inspections, pre-buy support, AOG service, and logbook documentation from FAA Part 145 repair station RWSR491E at Hangar 3 in Sioux Falls, SD.',
  alternates: { canonical: pageUrl },
};

export default function AircraftMaintenanceSiouxFallsPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Service',
                '@id': `${pageUrl}#service`,
                name: 'Aircraft maintenance and annual inspections in Sioux Falls, SD',
                serviceType: 'Aircraft maintenance',
                url: pageUrl,
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                areaServed: [
                  { '@type': 'State', name: 'South Dakota' },
                  { '@type': 'State', name: 'Nebraska' },
                  { '@type': 'State', name: 'Iowa' },
                  { '@type': 'State', name: 'Minnesota' },
                  { '@type': 'State', name: 'North Dakota' },
                ],
                description:
                  'Aircraft maintenance, annual inspections, 100-hour inspections, pre-buy support, AOG service, propeller balancing, aircraft weight certification, and logbook documentation from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Aircraft maintenance services',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Annual Inspections' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: '100-Hour Inspections' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Condition and Pre-Buy Inspections' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'AOG Go-Van Service' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Propeller Balancing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Weight Certification' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Shop Capabilities', item: 'https://www.rogerwilcoaviation.com/shop-capabilities' },
                  { '@type': 'ListItem', position: 3, name: 'Aircraft Maintenance Sioux Falls', item: pageUrl },
                ],
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
        <section className="hero-headline-group" aria-labelledby="maintenance-hero">
          <span className="bs-kicker">FAA Part 145 Repair Station &middot; Certificate #RWSR491E</span>
          <span className="bs-script-accent">&mdash; aircraft maintenance in Sioux Falls &mdash;</span>
          <h1 id="maintenance-hero" className="bs-headline bs-headline--hero">
            Aircraft maintenance and annual inspections,
            <br />
            <em>documented like the airplane depends on it.</em>
          </h1>
          <p className="bs-subhead">
            Annuals &middot; 100-hour inspections &middot; pre-buy support &middot; AOG service &middot; prop balancing &middot; weight certification
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Maintenance Desk</span>
              <h2 className="bs-headline bs-headline--section">A Part 145 shop for the work owners cannot treat casually.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services provides aircraft maintenance from Hangar 3 in Sioux Falls, South Dakota. The shop supports general aviation, corporate, commercial, light sport, and experimental owners who need inspections, discrepancies, troubleshooting, and documentation handled in a controlled repair-station environment.
                </p>
                <p>
                  RWAS is not just a place to park the airplane during an annual. The value is in the process: careful discrepancy review, clear communication before costs run away, parts and records traceability, logbook entries that still make sense later, and the ability to coordinate airframe, avionics, NDT, and fabrication issues when a simple inspection turns into real aircraft work.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/images/blog/repair-station-vs-ap-mechanic-corporate-hangar-2.jpg"
                alt="Aircraft in a maintenance hangar representing RWAS repair-station maintenance work"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Repair-station maintenance is a quality system, not just a mechanic with a flashlight.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Core Maintenance</span>
              <h2 className="bs-headline bs-headline--section">Inspections, discrepancies, and return-to-service work.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    The right maintenance path depends on how the aircraft is operated, what the records show, what the manufacturer requires, and what the inspection finds. RWAS scopes each job around the aircraft rather than using the same checklist conversation for every owner.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Annual inspections</p>
                    <p className="bs-svc-desc">FAR 43 Appendix D inspection flow, discrepancy review, owner communication, and return-to-service documentation.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">100-hour inspections</p>
                    <p className="bs-svc-desc">Inspection support for aircraft operated for hire where the 100-hour requirement applies.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Condition and pre-buy inspections</p>
                    <p className="bs-svc-desc">Records review, physical inspection, and findings that help owners make decisions before money changes hands.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">AOG Go-Van service</p>
                    <p className="bs-svc-desc">Practical response for aircraft-on-ground situations when the issue and location make mobile support appropriate.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Propeller balancing and weight certification</p>
                    <p className="bs-svc-desc">Support for vibration issues, aircraft weighing, and documentation needs up to the shop capability limits.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Why Part 145 Matters</span>
              <h2 className="bs-headline bs-headline--section">The system catches what memory misses.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  An individual mechanic can be excellent. A repair station adds something different: procedures, inspection authority, controlled records, tooling expectations, traceability, and a certificate holder accountable for the system. That difference matters when the work involves avionics, structural questions, NDT findings, major repairs, recurring inspections, or sale-driven pre-buy decisions.
                </p>
                <p>
                  RWAS operates under FAA Repair Station Certificate RWSR491E with limited airframe, instrument, radio, and NDT inspection/testing capability. That structure gives owners a maintenance path designed to produce work that is inspectable, documented, and usable at the next annual, the next sale, or the next squawk.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/blog/repair-station-vs-ap-mechanic-what-aircraft-owners-should-know-20260414">
                  Read the repair-station explainer
                </Link>
                <Link className="bs-cta-secondary" href="/shop-capabilities">
                  View capability list
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Before You Schedule</span>
              <h2 className="bs-headline bs-headline--section">Send records early, not after the airplane is apart.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Good maintenance planning starts with context. For inspections, pre-buy work, troubleshooting, or AOG support, send the aircraft make and model, N-number, current location, tach and total time, last annual or inspection date, known squawks, logbook photos, AD/service-bulletin concerns, and any deadline that matters.
                </p>
                <p>
                  RWAS will tell you what can be scoped from records, what needs hands-on inspection, and where the project may need avionics, NDT, fabrication, or parts coordination before the aircraft can return to service.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=aircraft-maintenance-sioux-falls">
                  Request maintenance scheduling
                </Link>
                <Link className="bs-cta-secondary" href="/services/ndt-inspection">
                  NDT inspection support
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Aircraft maintenance quick reference">
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
                <a
                  href="mailto:service@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  service@rwas.team
                </a>
                <br />
                Hangar 3, 3701 N. Aviation Avenue
                <br />
                Sioux Falls, South Dakota 57104
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Maintenance Work</span>
              <p>
                Annual inspections
                <br />
                100-hour inspections
                <br />
                Pre-buy support
                <br />
                Condition inspections
                <br />
                AOG support
                <br />
                Troubleshooting
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Bring to Request</span>
              <p>
                N-number
                <br />
                Aircraft make/model
                <br />
                Tach and total time
                <br />
                Last inspection date
                <br />
                Known squawks
                <br />
                Logbook photos
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Repair Station</span>
              <p>
                FAA Part 145
                <br />
                Certificate #RWSR491E
                <br />
                Limited Airframe
                <br />
                Limited Instrument
                <br />
                Limited Radio
                <br />
                NDT Inspection &amp; Testing
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; maintenance desk &mdash;</span>
              <h4>Need an annual or pre-buy?</h4>
              <p>Send the N-number, records, timing, and the decision you need to make.</p>
              <a className="cta" href="/contact?reason=service&source=maintenance-card">
                Start request
              </a>
              <div className="footnote">Records sent early make the first shop conversation useful.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
