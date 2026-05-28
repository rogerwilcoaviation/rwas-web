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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/ndt-inspection';

export const metadata = {
  title: { absolute: 'Aircraft NDT Inspection - Eddy Current, Penetrant, Magnetic Particle | RWAS' },
  description:
    'Aircraft NDT inspection in Sioux Falls, SD: eddy current, dye penetrant, magnetic particle, ultrasound, visual testing, and Rockwell hardness.',
  alternates: { canonical: pageUrl },
};

export default function NdtInspectionPage() {
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
                name: 'Aircraft NDT Inspection and Testing',
                serviceType: 'Aircraft non-destructive testing',
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
                  'Aircraft non-destructive testing from Roger Wilco Aviation Services, FAA Part 145 repair station RWSR491E at Hangar 3 in Sioux Falls, South Dakota.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'NDT inspection methods',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Eddy Current Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Dye Penetrant Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Magnetic Particle Inspection' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Ultrasound Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Visual Testing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Rockwell Hardness Testing' } },
                  ],
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://www.rogerwilcoaviation.com/',
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Services',
                    item: 'https://www.rogerwilcoaviation.com/services',
                  },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: 'Aircraft NDT Inspection',
                    item: pageUrl,
                  },
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
        <section className="hero-headline-group" aria-labelledby="ndt-hero">
          <span className="bs-kicker">FAA Part 145 Repair Station &middot; Certificate #RWSR491E</span>
          <span className="bs-script-accent">&mdash; non-destructive testing &mdash;</span>
          <h1 id="ndt-hero" className="bs-headline bs-headline--hero">
            Aircraft NDT inspection,
            <br />
            <em>documented for return to service.</em>
          </h1>
          <p className="bs-subhead">
            Eddy current &middot; dye penetrant &middot; magnetic particle &middot; ultrasound &middot; visual &middot; Rockwell hardness
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD &middot; Serving SD &middot; NE &middot; IA &middot; MN &middot; ND
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Inspection Capability</span>
              <h2 className="bs-headline bs-headline--section">Find flaws without tearing the aircraft apart.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services provides aircraft non-destructive testing for owners, operators, mechanics, and shops that need a disciplined inspection path without unnecessary disassembly. NDT is used when the question is specific: is there a crack, corrosion, heat damage, material change, or other defect that cannot be answered well by a normal visual inspection alone?
                </p>
                <p>
                  From Hangar 3 in Sioux Falls, South Dakota, RWAS supports general aviation, corporate, and commercial operators across the Northern Plains. Work is handled through an FAA-certificated Part 145 repair station environment, with method selection, inspection scope, findings, and return-to-service documentation matched to the aircraft, component, maintenance manual, service bulletin, Airworthiness Directive, or approved data involved.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">NDT Methods</span>
              <h2 className="bs-headline bs-headline--section">The right test for the right material.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    A useful NDT inspection begins with the suspected failure mode. Aluminum skins, ferrous steel parts, castings, welded assemblies, engine components, and propeller-related hardware do not all ask the same question. RWAS selects the inspection method around material, geometry, access, surface condition, and the controlling maintenance instruction.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Eddy Current Testing</p>
                    <p className="bs-svc-desc">Crack and corrosion detection in conductive materials, including aluminum structures.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Dye Penetrant Testing</p>
                    <p className="bs-svc-desc">Surface-breaking defect detection on nonporous materials, including ASTM E1417-style process requirements when applicable.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Magnetic Particle Inspection</p>
                    <p className="bs-svc-desc">Surface and near-surface discontinuity checks in ferromagnetic components.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Ultrasound Testing</p>
                    <p className="bs-svc-desc">Thickness, discontinuity, or internal-condition checks where ultrasonic methods are appropriate.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Visual Testing</p>
                    <p className="bs-svc-desc">Structured visual inspection with proper access, lighting, magnification, and documentation.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Rockwell Hardness Testing</p>
                    <p className="bs-svc-desc">Material-condition support where hardness verification is part of the maintenance question.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">When Owners Call</span>
              <h2 className="bs-headline bs-headline--section">Common aircraft NDT use cases.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Aircraft owners usually do not ask for NDT because everything is normal. They ask because a mechanic found a suspect indication, an inspection note requires a deeper look, a service bulletin points to a known trouble area, or an aircraft is being evaluated before purchase. In those moments, a clean inspection report matters as much as the inspection itself.
                </p>
                <p>
                  RWAS can support crack checks around stress points, corrosion investigation, inspection of repaired or worked areas, propeller and engine-component questions, magnetic particle inspection of applicable steel parts, dye penetrant checks on accessible nonporous surfaces, and eddy current inspection where conductivity and geometry make it the right tool. If a method is not appropriate for the component or controlling data, the shop will say so before turning the inspection into an invoice.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Documentation</span>
              <h2 className="bs-headline bs-headline--section">Inspection results have to be usable later.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  The end product is not just a pass-or-fail conversation at the counter. RWAS documents the inspection method, scope, relevant references, findings, and limitations so the owner, mechanic, IA, or operator can understand what was inspected and what was not. Where applicable, work can be documented for FAA Form 8130-3 return to service and Airworthiness Directive compliance support.
                </p>
                <p>
                  For operators managing scheduled maintenance, pre-buy inspections, insurance questions, or recurring inspections, that traceability is the point. It keeps the next decision grounded in actual evidence instead of memory, guesswork, or a shop note that makes sense only to the person who wrote it.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Request an Inspection</span>
              <h2 className="bs-headline bs-headline--section">Send the aircraft, component, and reason for inspection.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  To scope an NDT inspection, include the aircraft make and model, N-number, component or area to be inspected, the reason for the inspection, and any maintenance manual, service bulletin, AD, or prior finding that triggered the request. Photos help. If the work needs to coordinate with an annual, pre-buy, avionics project, or structural repair, say that up front so the inspection can be scheduled around the larger maintenance plan.
                </p>
              </div>
              <p>
                <a className="bs-cta-primary" href="/contact?reason=service&source=ndt-inspection">
                  Request NDT inspection
                </a>
                <a className="bs-cta-secondary" href="/shop-capabilities#ndt">
                  View all shop capabilities
                </a>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="NDT quick reference">
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
              <span className="bs-kicker">Inspection Methods</span>
              <p>
                Eddy current
                <br />
                Dye penetrant
                <br />
                Magnetic particle
                <br />
                Ultrasound
                <br />
                Visual testing
                <br />
                Rockwell hardness
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

            <Specimen variant="hero" as="figure" className="about-fig about-fig--rail">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.webp"
                alt="RWAS shop equipment supporting precision aircraft fabrication and inspection work"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                RWAS shop floor - inspection, fabrication, and repair-station support under one roof.
              </Specimen.Caption>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; intake desk &mdash;</span>
              <h4>Need help scoping it?</h4>
              <p>Send the aircraft, component, and inspection trigger.</p>
              <a className="cta" href="/contact?reason=service&source=ndt-card">
                Start request
              </a>
              <div className="footnote">Photos and service-bulletin references help.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
