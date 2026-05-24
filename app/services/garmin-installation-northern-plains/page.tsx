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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/garmin-installation-northern-plains';

export const metadata = {
  title: { absolute: 'Garmin Avionics Installation - South Dakota, Nebraska, Iowa | RWAS' },
  description:
    'Garmin avionics installation from RWAS, a certified Garmin dealer and FAA Part 145 repair station at KYKN in Yankton, SD. G3X Touch, GTN Xi, GFC 500, ADS-B, panel fabrication, and quote support for the Northern Plains.',
  alternates: { canonical: pageUrl },
};

export default function GarminInstallationNorthernPlainsPage() {
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
                name: 'Garmin Avionics Installation in the Northern Plains',
                serviceType: 'Garmin avionics installation',
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
                  'Garmin avionics installation, panel planning, aircraft review, and quote support from Roger Wilco Aviation Services, a certified Garmin dealer and FAA Part 145 repair station at Chan Gurney Municipal Airport in Yankton, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Garmin avionics installation services',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'G3X Touch Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GTN 650Xi and GTN 750Xi Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GFC 500 Autopilot Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'ADS-B Out Compliance' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'GI 275 and G5 Instrument Installation' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Panel Fabrication' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Shop Capabilities', item: 'https://www.rogerwilcoaviation.com/shop-capabilities' },
                  { '@type': 'ListItem', position: 3, name: 'Garmin Avionics Installation', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="garmin-install-hero">
          <span className="bs-kicker">Certified Garmin Dealer &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; avionics installation for the Northern Plains &mdash;</span>
          <h1 id="garmin-install-hero" className="bs-headline bs-headline--hero">
            Garmin avionics installation,
            <br />
            <em>without the ferry-flight runaround.</em>
          </h1>
          <p className="bs-subhead">
            G3X Touch &middot; GTN Xi &middot; GFC 500 &middot; GI 275 &middot; G5 &middot; ADS-B Out &middot; panel fabrication
          </p>
          <div className="bs-byline">
            Chan Gurney Municipal (KYKN) &middot; Yankton, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Regional Installation Center</span>
              <h2 className="bs-headline bs-headline--section">A Garmin shop for aircraft owners between the big-city markets.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services gives Northern Plains aircraft owners a certified Garmin dealer and FAA-certificated repair station at Chan Gurney Municipal Airport in Yankton, South Dakota. Instead of ferrying a piston single or light twin across multiple states for a panel upgrade, owners can work with a shop built around Garmin avionics, aircraft maintenance, panel fabrication, and return-to-service documentation under one roof.
                </p>
                <p>
                  RWAS supports Garmin installation projects for South Dakota, Nebraska, Iowa, Minnesota, and North Dakota operators, with practical quoting, aircraft review, product sourcing, fabrication, wiring, testing, and logbook documentation handled by the same team.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/r182_panel.webp"
                alt="Garmin avionics panel installation completed by RWAS in a Cessna 182RG"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Cessna 182RG Garmin panel work - installation, fabrication, and finishing coordinated through RWAS.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Installed Systems</span>
              <h2 className="bs-headline bs-headline--section">Modern Garmin panels, scoped around the airplane.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    A good avionics quote is not just a cart of boxes. RWAS starts with the aircraft, mission, existing equipment, certification path, panel space, wiring condition, antenna locations, electrical load, and owner priorities. From there, the shop can recommend a Garmin path that fits the airplane instead of forcing every aircraft into the same panel.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">G3X Touch</p>
                    <p className="bs-svc-desc">Glass-cockpit upgrades with ADAHRS, engine information, synthetic vision, and display planning.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">GTN 650Xi / GTN 750Xi</p>
                    <p className="bs-svc-desc">WAAS GPS/NAV/COMM navigator installs, panel integration, and database-ready flight-deck workflow.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/gfc-500-autopilot-installation">GFC 500 Autopilot</Link></p>
                    <p className="bs-svc-desc">Retrofit autopilot planning for eligible aircraft, including servo, control, and integration review.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">GI 275, G5, GTX, GMA, and ADS-B</p>
                    <p className="bs-svc-desc">Instrument, transponder, audio-panel, and ADS-B Out compliance work.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Panel fabrication</p>
                    <p className="bs-svc-desc">In-house CAD, fiber laser cutting, powder coating, and UV printing support for clean installations.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Quote Process</span>
              <h2 className="bs-headline bs-headline--section">Start with the mission, then build the equipment list.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  For a useful Garmin quote, RWAS needs the aircraft make and model, N-number, current panel photos, equipment list, desired capabilities, and any known maintenance or electrical issues. A simple GPS replacement, an autopilot install, and a full glass-panel conversion are very different projects even when the product names overlap.
                </p>
                <p>
                  Owners can sketch a starting point in the panel planner, browse Garmin collections for product context, or send the shop a direct quote request. RWAS will still review eligibility, certification path, lead time, aircraft downtime, and fabrication needs before work begins.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=garmin-installation">
                  Request a Garmin quote
                </Link>
                <Link className="bs-cta-secondary" href="/panel-planner">
                  Build a panel concept
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/g3x_garmin.webp"
                alt="Garmin G3X Touch avionics display"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 02">
                Garmin equipment selection is only one part of the project; installation planning controls the outcome.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Repair-Station Discipline</span>
              <h2 className="bs-headline bs-headline--section">Avionics work tied back to airworthiness.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  RWAS is not only a reseller. The shop operates as an FAA Part 145 repair station with airframe, instrument, radio, NDT, and fabrication capability. That matters when a Garmin installation exposes aging wiring, a panel structure problem, a required placard, a weight-and-balance update, or a maintenance finding that has to be resolved before the aircraft leaves.
                </p>
                <p>
                  The goal is a finished aircraft that works as a system: legal, documented, readable, serviceable, and matched to how the owner actually flies.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Start the Conversation</span>
              <h2 className="bs-headline bs-headline--section">Send the airplane, the mission, and the must-haves.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  If you are comparing Garmin options, include your home airport, typical trips, IFR/VFR use, current panel photos, must-have equipment, and ideal downtime window. RWAS will respond with the next practical step instead of a generic brochure answer.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=quote&source=garmin-installation-northern-plains">
                  Start Garmin installation request
                </Link>
                <Link className="bs-cta-secondary" href="/collections/avionics-certified">
                  Browse Garmin avionics
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Garmin installation quick reference">
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
                Chan Gurney Municipal (KYKN)
                <br />
                Yankton, South Dakota
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Garmin Focus</span>
              <p>
                G3X Touch
                <br />
                GTN 650Xi / 750Xi
                <br />
                GFC 500
                <br />
                GI 275 / G5
                <br />
                GTX transponders
                <br />
                ADS-B Out
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Service Area</span>
              <p>
                South Dakota
                <br />
                Nebraska
                <br />
                Iowa
                <br />
                Minnesota
                <br />
                North Dakota
                <br />
                Northern Plains
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Bring to Quote</span>
              <p>
                Aircraft make/model
                <br />
                N-number
                <br />
                Current panel photos
                <br />
                Equipment wish list
                <br />
                Mission profile
                <br />
                Downtime target
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; avionics desk &mdash;</span>
              <h4>Planning a Garmin panel?</h4>
              <p>Send aircraft photos and the mission. RWAS will scope the path.</p>
              <a className="cta" href="/contact?reason=quote&source=garmin-install-card">
                Start quote
              </a>
              <div className="footnote">Eligibility and installation data are reviewed before scheduling.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
