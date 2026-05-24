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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/rotax-repair';

export const metadata = {
  title: { absolute: 'Rotax Aircraft Engine Maintenance - Northern Plains | RWAS' },
  description:
    'Rotax aircraft engine maintenance support from RWAS at KYKN in Yankton, SD. Light sport and experimental aircraft maintenance, inspections, troubleshooting, documentation, and quote support for the Northern Plains.',
  alternates: { canonical: pageUrl },
};

export default function RotaxRepairPage() {
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
                name: 'Rotax Aircraft Engine Maintenance',
                serviceType: 'Aircraft engine maintenance',
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
                  'Rotax aircraft engine maintenance support, inspection coordination, troubleshooting, and documentation from Roger Wilco Aviation Services at Chan Gurney Municipal Airport in Yankton, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Rotax maintenance support',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Rotax Engine Inspection Support' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Light Sport Aircraft Maintenance' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Condition Inspection Support' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Engine Troubleshooting' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Maintenance Documentation Review' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Shop Capabilities', item: 'https://www.rogerwilcoaviation.com/shop-capabilities' },
                  { '@type': 'ListItem', position: 3, name: 'Rotax Aircraft Engine Maintenance', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="rotax-hero">
          <span className="bs-kicker">Light Sport &amp; Experimental Aircraft &middot; Northern Plains Maintenance</span>
          <span className="bs-script-accent">&mdash; Rotax engine support with repair-station discipline &mdash;</span>
          <h1 id="rotax-hero" className="bs-headline bs-headline--hero">
            Rotax aircraft engine maintenance,
            <br />
            <em>handled like aircraft work.</em>
          </h1>
          <p className="bs-subhead">
            912 &middot; 914 &middot; 915 iS &middot; 916 iS &middot; light sport &middot; experimental &middot; inspection and troubleshooting support
          </p>
          <div className="bs-byline">
            Chan Gurney Municipal (KYKN) &middot; Yankton, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Rotax Support</span>
              <h2 className="bs-headline bs-headline--section">A practical maintenance path for modern light aircraft engines.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Rotax engines have become a serious part of the light sport, experimental, and modern piston-aircraft conversation. The 912 and 914 families built the foundation, while the 915 iS and 916 iS brought turbocharged and fuel-injected capability to aircraft that do not fit the old Lycoming-or-Continental-only mental model.
                </p>
                <p>
                  Roger Wilco Aviation Services supports owners who need Rotax maintenance help without treating the engine as an oddity. The work still starts with the aircraft, the engine logbooks, the operating history, the maintenance manuals, and the question the owner is trying to answer.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">When Owners Call</span>
              <h2 className="bs-headline bs-headline--section">Inspection, troubleshooting, and maintenance planning.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    Rotax requests usually arrive with a specific concern: an inspection interval, a starting or running issue, a service bulletin question, a pre-buy finding, an aircraft that has sat too long, or a logbook history that needs to be understood before the next flight. RWAS can help scope the work, identify the correct data path, and determine whether the aircraft should come to the shop.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Engine condition and inspection support</p>
                    <p className="bs-svc-desc">Review of aircraft/engine history, maintenance status, intervals, and owner concerns.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Troubleshooting</p>
                    <p className="bs-svc-desc">Starting, idle, charging, sensor, cooling, fuel, and operational complaints scoped around the specific installation.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Light sport and experimental aircraft</p>
                    <p className="bs-svc-desc">Maintenance support for aircraft where the engine, airframe, and documentation path must be reviewed together.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Service bulletin and logbook review</p>
                    <p className="bs-svc-desc">Help understanding what has been done, what is due, and what documentation is missing.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/images/blog/repair-station-vs-ap-mechanic-corporate-hangar-1.jpg"
                alt="Aircraft maintenance hangar representing RWAS repair-station workflow"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Rotax work is still aircraft work: manuals, logbooks, inspection scope, and documentation matter.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Documentation</span>
              <h2 className="bs-headline bs-headline--section">The paperwork has to make sense after the airplane leaves.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Rotax-powered aircraft often sit at the intersection of engine-specific maintenance requirements, airframe-specific instructions, experimental or light-sport operating limitations, and owner-maintained records. RWAS approaches that as a documentation problem as much as a mechanical one.
                </p>
                <p>
                  Owners should send engine model, serial number if available, aircraft make and model, hours, recent maintenance, symptoms, and logbook photos before the first visit. That lets the shop review the likely path before turning the appointment into guesswork.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Start a Rotax Request</span>
              <h2 className="bs-headline bs-headline--section">Send the engine, aircraft, symptoms, and records.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Include the aircraft make/model, engine model, N-number if applicable, engine hours, last inspection, recent maintenance, symptoms, photos, and any service bulletin or manual reference that triggered the question. If the aircraft is experimental or light sport, include the operating limitations and any relevant maintenance-authority details.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=rotax-repair">
                  Request Rotax maintenance support
                </Link>
                <Link className="bs-cta-secondary" href="/shop-capabilities">
                  View all shop capabilities
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Rotax maintenance quick reference">
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
                Chan Gurney Municipal (KYKN)
                <br />
                Yankton, South Dakota
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Common Engines</span>
              <p>
                Rotax 912
                <br />
                Rotax 914
                <br />
                Rotax 915 iS
                <br />
                Rotax 916 iS
                <br />
                Installation-specific review required
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Bring to Request</span>
              <p>
                Engine model
                <br />
                Engine hours
                <br />
                Aircraft make/model
                <br />
                Logbook photos
                <br />
                Symptoms
                <br />
                Service-bulletin references
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; maintenance desk &mdash;</span>
              <h4>Have a Rotax question?</h4>
              <p>Send the engine model, aircraft, hours, symptoms, and records.</p>
              <a className="cta" href="/contact?reason=service&source=rotax-card">
                Start request
              </a>
              <div className="footnote">Manuals and logbook context help avoid bad assumptions.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
