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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/ads-b-installation';

export const metadata = {
  title: { absolute: 'ADS-B Out Installation - South Dakota, Nebraska, Iowa | RWAS' },
  description:
    'ADS-B Out installation in Sioux Falls, SD: Garmin transponder upgrades, GPS source review, antenna planning, configuration, testing, and paperwork.',
  alternates: { canonical: pageUrl },
};

export default function AdsBInstallationPage() {
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
                name: 'ADS-B Out Installation',
                serviceType: 'Avionics installation',
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
                  'ADS-B Out installation, transponder upgrade planning, antenna review, GPS source review, configuration, testing, and documentation support from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'ADS-B installation workflow',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft and Mission Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transponder Upgrade Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GPS Position Source Review' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Antenna and Wiring Planning' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Configuration and Compliance Documentation' } },
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
                  { '@type': 'ListItem', position: 4, name: 'ADS-B Out Installation', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="adsb-hero">
          <span className="bs-kicker">Certified Garmin Dealer &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; transponder and ADS-B Out compliance planning &mdash;</span>
          <h1 id="adsb-hero" className="bs-headline bs-headline--hero">
            ADS-B Out installation
            <br />
            <em>without treating compliance like a parts order.</em>
          </h1>
          <p className="bs-subhead">
            Transponder upgrades &middot; GPS source review &middot; antenna planning &middot; configuration &middot; FAR 91.227 documentation
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Compliance Work</span>
              <h2 className="bs-headline bs-headline--section">ADS-B Out has to work as a system.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  ADS-B Out compliance is more than installing a transponder. The aircraft needs an approved position source, correct configuration, antenna and wiring decisions that fit the airframe, and paperwork that makes the upgrade understandable after the airplane leaves the shop.
                </p>
                <p>
                  RWAS plans ADS-B Out and transponder work from a certified Garmin dealer and FAA Part 145 repair-station environment. That lets the conversation cover the whole aircraft: existing equipment, panel space, navigator compatibility, electrical condition, antenna locations, future Garmin upgrades, and the owner&apos;s actual mission.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/g3x_garmin.webp"
                alt="Garmin avionics display and panel equipment used in integrated aircraft avionics planning"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Transponder and ADS-B decisions often connect to the rest of the panel, especially when a navigator, display, or autopilot upgrade is also planned.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Upgrade Planning</span>
              <h2 className="bs-headline bs-headline--section">Choose the route before buying the box.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    Some aircraft only need a focused ADS-B Out correction. Others are better served by a transponder upgrade that is planned alongside a GTN Xi navigator, G3X Touch display, G5, GI 275, or autopilot project. RWAS helps sort the short-term compliance need from the long-term panel plan.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Existing equipment review</p>
                    <p className="bs-svc-desc">Identify the current transponder, encoder, GPS source, antennas, and wiring condition before recommending a path.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Garmin GTX planning</p>
                    <p className="bs-svc-desc">Review Garmin transponder options in the context of the aircraft, navigator, display, and ADS-B Out requirement.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Antenna and wiring plan</p>
                    <p className="bs-svc-desc">Plan location, routing, access, and installation details instead of assuming old wiring is still the right answer.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Configuration and validation</p>
                    <p className="bs-svc-desc">Configure the system, complete functional checks, and document the work for future maintenance.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Quote Prep</span>
              <h2 className="bs-headline bs-headline--section">Send enough detail to avoid a fake quote.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful ADS-B quote requests include aircraft make/model, N-number, current transponder model, current navigator or GPS source, panel photos, antenna location photos if available, and whether the owner is planning any other Garmin work during the same downtime window.
                </p>
                <p>
                  If the airplane has an intermittent transponder, failing altitude reporting, or a known ADS-B performance report issue, include that history with the request. A compliance fix and a clean installation quote are different jobs.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=ads-b-installation">
                  Request ADS-B quote
                </Link>
                <Link className="bs-cta-secondary" href="/services/garmin-installation-northern-plains">
                  Garmin installation overview
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Related Work</span>
              <h2 className="bs-headline bs-headline--section">ADS-B is often the smallest part of the panel decision.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Owners sometimes use an ADS-B project as the entry point for a broader panel refresh. RWAS can help compare a focused compliance job against a staged Garmin plan that also addresses navigator, display, audio panel, autopilot, and fabrication needs.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/services/gfc-500-autopilot-installation">
                  GFC 500 autopilot planning
                </Link>
                <Link className="bs-cta-secondary" href="/panel-planner">
                  Build a panel concept
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="ADS-B installation quick reference">
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
                Current transponder
                <br />
                Current GPS source
                <br />
                Panel photos
                <br />
                Known ADS-B report issues
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Common Pairings</span>
              <p>
                GTX transponder
                <br />
                GTN 650Xi / 750Xi
                <br />
                G3X Touch
                <br />
                G5 / GI 275
                <br />
                GFC 500
                <br />
                Panel fabrication
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; avionics desk &mdash;</span>
              <h4>Need ADS-B help?</h4>
              <p>Send the current transponder, GPS source, panel photos, and what problem you are trying to solve.</p>
              <a className="cta" href="/contact?reason=quote&source=adsb-card">
                Start quote
              </a>
              <div className="footnote">Compliance starts with the installed system, not the catalog page.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
