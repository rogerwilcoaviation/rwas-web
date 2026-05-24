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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/g3x-touch-installation';

export const metadata = {
  title: { absolute: 'Garmin G3X Touch Installation - Northern Plains | RWAS' },
  description:
    'Garmin G3X Touch installation planning from RWAS, a certified Garmin dealer and FAA Part 145 repair station at Hangar 3 in Sioux Falls, SD. Glass panel design, EIS, ADAHRS, Connext, panel fabrication, and documentation support.',
  alternates: { canonical: pageUrl },
};

export default function G3xTouchInstallationPage() {
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
                name: 'Garmin G3X Touch Installation',
                serviceType: 'Glass cockpit installation',
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
                  'Garmin G3X Touch installation planning, panel design, ADAHRS and EIS integration, Connext workflow review, fabrication support, testing, and documentation from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'G3X Touch installation workflow',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft and Mission Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Glass Panel Layout Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'ADAHRS and EIS Integration Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Panel Fabrication Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Configuration, Testing, and Documentation' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Garmin Installation', item: 'https://www.rogerwilcoaviation.com/services/garmin-installation-northern-plains' },
                  { '@type': 'ListItem', position: 3, name: 'G3X Touch Installation', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="g3x-hero">
          <span className="bs-kicker">Certified Garmin Dealer &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; glass cockpit planning for piston aircraft &mdash;</span>
          <h1 id="g3x-hero" className="bs-headline bs-headline--hero">
            Garmin G3X Touch installation,
            <br />
            <em>planned as a complete aircraft system.</em>
          </h1>
          <p className="bs-subhead">
            Display layout &middot; ADAHRS &middot; EIS &middot; navigator integration &middot; Connext workflow &middot; panel fabrication
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Glass Panel Work</span>
              <h2 className="bs-headline bs-headline--section">A G3X Touch project is bigger than the display.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Garmin G3X Touch can become the center of a modern piston-aircraft panel: flight display, engine information, synthetic vision, connectivity, navigator integration, and a cleaner operating workflow. The value comes from how the system is planned, installed, configured, and documented around the actual airplane.
                </p>
                <p>
                  RWAS plans G3X Touch installations from a certified Garmin dealer and FAA Part 145 repair-station environment. The work can include panel layout, ADAHRS planning, EIS sensor and wiring review, navigator and transponder integration, Connext workflow, panel fabrication, software configuration, functional testing, and return-to-service documentation.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/g3x_garmin.webp"
                alt="Garmin G3X Touch display used for aircraft glass cockpit planning"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                G3X Touch work connects display layout, engine data, flight instruments, connectivity, and the aircraft panel itself.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">System Planning</span>
              <h2 className="bs-headline bs-headline--section">The quote has to start with the mission.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    A useful G3X Touch quote starts with what the aircraft needs to do. IFR trips, engine-monitoring goals, autopilot plans, navigator choices, future resale, and panel space all change the right answer. RWAS uses that context to separate a clean staged upgrade from an overbuilt wish list.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Panel layout review</p>
                    <p className="bs-svc-desc">Plan display size, radio stack, standby instruments, breakers, switches, labels, and pilot workflow before fabrication.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">ADAHRS and EIS planning</p>
                    <p className="bs-svc-desc">Review attitude, air data, magnetometer, engine sensor, and wiring requirements for the aircraft configuration.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Navigator and autopilot integration</p>
                    <p className="bs-svc-desc">Coordinate G3X Touch with GTN Xi navigators, GFC 500 autopilot planning, transponder, audio, and standby instruments.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Connectivity and data workflow</p>
                    <p className="bs-svc-desc">Plan Connext, Garmin Pilot, flyGarmin, data logging, and maintenance visibility as part of the panel conversation.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Fabrication</span>
              <h2 className="bs-headline bs-headline--section">The best avionics plan still has to fit the airplane.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  G3X Touch projects often require new panel metal, placards, paint or powder coat, labels, and a layout that respects structure, clearances, wiring access, and future serviceability. RWAS supports this with in-house CAD, fiber laser cutting, powder coating, UV printing, and aircraft maintenance review.
                </p>
                <p>
                  That matters when an owner wants the finished panel to look clean and remain maintainable years later. A good panel is not only attractive; it is readable, serviceable, documented, and legal.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/services/fiber-laser-fabrication">
                  Panel fabrication support
                </Link>
                <Link className="bs-cta-secondary" href="/panel-planner">
                  Build a panel concept
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Quote Prep</span>
              <h2 className="bs-headline bs-headline--section">Send the current panel, not just the shopping list.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful G3X Touch quote requests include aircraft make/model, N-number, serial number if available, current panel photos, engine details, current navigator and transponder, current autopilot, desired IFR/VFR mission, engine-monitoring goals, and whether the owner wants a staged upgrade or one larger downtime window.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=g3x-touch-installation">
                  Request G3X Touch quote
                </Link>
                <Link className="bs-cta-secondary" href="/services/garmin-installation-northern-plains">
                  Garmin installation overview
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="G3X Touch quick reference">
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
                  href="mailto:avionics@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  avionics@rwas.team
                </a>
                <br />
                Hangar 3, 3701 N. Aviation Avenue
                <br />
                Sioux Falls, South Dakota 57104
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Quote Inputs</span>
              <p>
                Aircraft make/model
                <br />
                N-number
                <br />
                Engine configuration
                <br />
                Current panel photos
                <br />
                Current navigator
                <br />
                Desired mission
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Common Pairings</span>
              <p>
                GTN 650Xi / 750Xi
                <br />
                GFC 500
                <br />
                GTX transponder
                <br />
                GMA audio panel
                <br />
                GI 275 / G5
                <br />
                Panel fabrication
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; avionics desk &mdash;</span>
              <h4>Planning a glass panel?</h4>
              <p>Send the aircraft, panel photos, mission, and what you want the new panel to make easier.</p>
              <a className="cta" href="/contact?reason=quote&source=g3x-card">
                Start quote
              </a>
              <div className="footnote">Layout, eligibility, fabrication, and wiring come before the final equipment list.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
