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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/gfc-500-autopilot-installation';

export const metadata = {
  title: { absolute: 'Garmin GFC 500 Autopilot Installation - Northern Plains | RWAS' },
  description:
    'Garmin GFC 500 autopilot installation in Sioux Falls, SD: eligibility review, quote planning, integration, installation, testing, and documentation.',
  alternates: { canonical: pageUrl },
};

export default function Gfc500AutopilotInstallationPage() {
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
                name: 'Garmin GFC 500 Autopilot Installation',
                serviceType: 'Autopilot installation',
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
                  'Garmin GFC 500 autopilot installation planning, eligibility review, quote support, panel integration, and return-to-service documentation from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'GFC 500 installation workflow',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Eligibility Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Autopilot Quote Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Panel and Navigator Integration Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Servo and Wiring Installation Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Functional Testing and Documentation' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://www.rogerwilcoaviation.com/services' },
                  { '@type': 'ListItem', position: 3, name: 'Garmin Installation', item: 'https://www.rogerwilcoaviation.com/services/garmin-installation-northern-plains' },
                  { '@type': 'ListItem', position: 4, name: 'GFC 500 Autopilot Installation', item: pageUrl },
                ],
              },
            ],
          }),
        }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/services" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="gfc500-hero">
          <span className="bs-kicker">Certified Garmin Dealer &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; digital autopilot installation for eligible aircraft &mdash;</span>
          <h1 id="gfc500-hero" className="bs-headline bs-headline--hero">
            Garmin GFC 500 autopilot installation,
            <br />
            <em>planned around the actual airplane.</em>
          </h1>
          <p className="bs-subhead">
            Eligibility review &middot; quote planning &middot; servo installation &middot; navigator integration &middot; functional checks
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Autopilot Upgrade</span>
              <h2 className="bs-headline bs-headline--section">The GFC 500 is not just another box in the panel.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  The Garmin GFC 500 is a digital autopilot upgrade for eligible piston aircraft. When it is planned and installed correctly, it can bring GPSS steering, altitude hold, vertical-speed and indicated-airspeed modes, flight-level-change behavior, and coupled approach capability when paired with the right Garmin navigator and aircraft configuration.
                </p>
                <p>
                  RWAS handles GFC 500 installation planning from a certified Garmin dealer and FAA Part 145 repair-station environment. That matters because an autopilot project touches flight controls, servos, wiring, panel controls, software configuration, placards, flight manual supplements, functional checks, and return-to-service documentation.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/r182_panel.webp"
                alt="RWAS Garmin panel installation showing avionics integration work"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Autopilot work is system work: display, navigator, controls, servos, wiring, and aircraft eligibility have to line up.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Eligibility First</span>
              <h2 className="bs-headline bs-headline--section">The first question is whether the aircraft fits the approved path.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  A GFC 500 quote starts with the aircraft make, model, serial number if available, existing avionics, current autopilot or wing-leveler status, and the owner&apos;s mission. RWAS reviews eligibility, required supporting equipment, installation data, and whether the aircraft&apos;s current panel and systems make the proposed upgrade practical.
                </p>
                <p>
                  This is where many autopilot conversations go wrong. A forum thread may say the airplane is eligible, but the real installation still depends on the exact aircraft, installed equipment, configuration, and condition.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Installation Workflow</span>
              <h2 className="bs-headline bs-headline--section">From quote to functional check.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    RWAS scopes the GFC 500 as an aircraft project, not just a parts order. The goal is to define the install path before the aircraft is opened up, then document the work clearly enough that the next mechanic understands what was changed.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Aircraft and mission review</p>
                    <p className="bs-svc-desc">Confirm the model, serial/applicability context, current equipment, and what the owner expects from the autopilot.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Panel and navigator integration</p>
                    <p className="bs-svc-desc">Review how the GFC 500 will interact with displays, GTN Xi navigators, attitude sources, and existing panel layout.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Servo, wiring, and structure planning</p>
                    <p className="bs-svc-desc">Plan the physical installation around aircraft access, wire routing, brackets, clearances, and inspection requirements.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Configuration and testing</p>
                    <p className="bs-svc-desc">Software/configuration checks, ground functional tests, documentation, and return-to-service workflow.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Quote Prep</span>
              <h2 className="bs-headline bs-headline--section">Send the panel photos before asking for a number.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful GFC 500 quote requests include aircraft make/model, N-number, serial number if available, current panel photos, existing navigator and display equipment, current autopilot details, recent maintenance concerns, and desired install timing. If you are also considering a GTN Xi, G3X Touch, GI 275, G5, or panel fabrication work, say that up front so the quote can be planned as one system.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=gfc-500-autopilot">
                  Request GFC 500 quote
                </Link>
                <Link className="bs-cta-secondary" href="/panel-planner">
                  Build a panel concept
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Related Garmin Work</span>
              <h2 className="bs-headline bs-headline--section">Autopilot projects often expose the rest of the panel.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Some aircraft are good candidates for a focused autopilot install. Others make more sense as part of a phased Garmin upgrade that includes a navigator, display, audio panel, transponder, or fabricated panel. RWAS can help owners decide whether to stage the work or bundle it into a larger downtime window.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/services/garmin-installation-northern-plains">
                  Garmin installation overview
                </Link>
                <Link className="bs-cta-secondary" href="/services/fiber-laser-fabrication">
                  Panel fabrication support
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="GFC 500 quick reference">
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
                Serial number
                <br />
                Panel photos
                <br />
                Current autopilot
                <br />
                Navigator/display list
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Common Pairings</span>
              <p>
                GTN 650Xi / 750Xi
                <br />
                G3X Touch
                <br />
                GI 275
                <br />
                G5
                <br />
                GTX transponder
                <br />
                Panel fabrication
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; avionics desk &mdash;</span>
              <h4>Planning an autopilot?</h4>
              <p>Send the aircraft, current panel, and what you want the autopilot to do.</p>
              <a className="cta" href="/contact?reason=quote&source=gfc500-card">
                Start quote
              </a>
              <div className="footnote">Eligibility review comes before scheduling.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
