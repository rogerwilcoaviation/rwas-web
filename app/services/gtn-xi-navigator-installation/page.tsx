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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/gtn-xi-navigator-installation';

export const metadata = {
  title: { absolute: 'Garmin GTN 650Xi / 750Xi Installation - Northern Plains | RWAS' },
  description:
    'Garmin GTN 650Xi and GTN 750Xi installation in Sioux Falls, SD: WAAS navigator integration, antennas, panel work, testing, and documentation.',
  alternates: { canonical: pageUrl },
};

export default function GtnXiNavigatorInstallationPage() {
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
                name: 'Garmin GTN Xi Navigator Installation',
                serviceType: 'GPS/NAV/COMM navigator installation',
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
                  'Garmin GTN 650Xi and GTN 750Xi navigator installation planning, WAAS GPS/NAV/COMM integration, antenna and wiring review, autopilot and display integration, configuration, testing, and documentation from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'GTN Xi navigator installation workflow',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft and Mission Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GTN 650Xi / 750Xi Selection Support' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Antenna and Wiring Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Autopilot and Display Integration Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Configuration, Testing, and Documentation' } },
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
                  { '@type': 'ListItem', position: 4, name: 'GTN Xi Navigator Installation', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="gtn-hero">
          <span className="bs-kicker">Certified Garmin Dealer &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; IFR navigator installation and panel integration &mdash;</span>
          <h1 id="gtn-hero" className="bs-headline bs-headline--hero">
            Garmin GTN 650Xi and 750Xi installation,
            <br />
            <em>planned around the panel it has to live in.</em>
          </h1>
          <p className="bs-subhead">
            WAAS GPS/NAV/COMM &middot; LPV approach capability &middot; antenna planning &middot; autopilot integration &middot; documentation
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Navigator Upgrade</span>
              <h2 className="bs-headline bs-headline--section">The GTN Xi is the routing brain of many Garmin panels.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Garmin GTN 650Xi and GTN 750Xi navigators can anchor a modern IFR panel with WAAS GPS, NAV/COMM capability, flight-plan management, LPV approach capability, and integration with displays, transponders, audio panels, and autopilots. The equipment choice matters, but the installation plan matters more.
                </p>
                <p>
                  RWAS plans GTN Xi installations from a certified Garmin dealer and FAA Part 145 repair-station environment. That lets the shop review the current panel, existing wiring and antennas, navigator compatibility, autopilot path, display integration, database workflow, and return-to-service documentation before the aircraft is opened up.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/r182_panel.webp"
                alt="Garmin avionics panel installation with navigator and display integration"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Navigator work is rarely isolated: it affects the display, autopilot, audio panel, antenna plan, and pilot workflow.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Integration Plan</span>
              <h2 className="bs-headline bs-headline--section">A navigator install should not create the next panel problem.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    A GTN Xi quote should answer more than which screen size fits the stack. RWAS reviews the aircraft mission, existing avionics, IFR goals, autopilot plans, antenna condition, wiring access, and future Garmin upgrade path so the navigator supports the airplane instead of becoming an expensive bottleneck.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">650Xi versus 750Xi planning</p>
                    <p className="bs-svc-desc">Compare panel space, workflow, display needs, budget, and downstream integration before choosing the navigator.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Antenna and wiring review</p>
                    <p className="bs-svc-desc">Plan GPS/NAV/COMM antenna work, cable condition, routing, access, and installation detail before downtime starts.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Autopilot and display integration</p>
                    <p className="bs-svc-desc">Coordinate the GTN Xi with GFC 500, G3X Touch, GI 275, G5, transponder, and audio-panel decisions.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Configuration and documentation</p>
                    <p className="bs-svc-desc">Configure, test, document, and return the aircraft to service with future troubleshooting in mind.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Quote Prep</span>
              <h2 className="bs-headline bs-headline--section">Bring the mission, the panel, and the future plan.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful GTN Xi quote requests include aircraft make/model, N-number, current radio stack, current GPS/NAV/COMM equipment, current transponder and audio panel, autopilot status, panel photos, IFR mission, and whether a G3X Touch, GFC 500, ADS-B, or panel fabrication project is also being considered.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=gtn-xi-installation">
                  Request GTN Xi quote
                </Link>
                <Link className="bs-cta-secondary" href="/panel-planner">
                  Build a panel concept
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Related Garmin Work</span>
              <h2 className="bs-headline bs-headline--section">The navigator often decides the rest of the upgrade path.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  A GTN Xi can be a focused IFR navigator upgrade, or it can be the first piece of a broader Garmin panel. RWAS can help decide whether to stage the work or bundle it with display, autopilot, transponder, audio, and fabrication changes.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/services/g3x-touch-installation">
                  G3X Touch installation
                </Link>
                <Link className="bs-cta-secondary" href="/services/gfc-500-autopilot-installation">
                  GFC 500 autopilot planning
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="GTN Xi navigator quick reference">
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
                Current radio stack
                <br />
                Current GPS/NAV/COMM
                <br />
                Autopilot status
                <br />
                Panel photos
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Common Pairings</span>
              <p>
                G3X Touch
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
              <h4>Planning an IFR navigator?</h4>
              <p>Send the current stack, panel photos, IFR mission, and any future autopilot or glass-panel plans.</p>
              <a className="cta" href="/contact?reason=quote&source=gtn-card">
                Start quote
              </a>
              <div className="footnote">A clean navigator install should support the next upgrade, not block it.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
