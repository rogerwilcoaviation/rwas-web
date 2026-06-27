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

const pageUrl = 'https://www.rogerwilcoaviation.com/services/fiber-laser-fabrication';
const videoUrl = 'https://www.rogerwilcoaviation.com/videos/fabrication/rwas-laser-steel-16x9-quote-pause-20260627.mp4';
const posterUrl = 'https://www.rogerwilcoaviation.com/videos/fabrication/rwas-laser-steel-16x9-20260626-poster.jpg';
const socialImageUrl = 'https://www.rogerwilcoaviation.com/images/social/rwas-laser-steel-1x1-20260626.jpg';

export const metadata = {
  title: { absolute: 'Aircraft Fiber Laser Fabrication - Panel Cutting, Welding, UV Print | RWAS' },
  description:
    'Aircraft fiber laser fabrication in the Northern Plains: panel cutting, laser welding, powder coating, UV printing, CAD/CNC workflow, and sheet metal support.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Aircraft Fiber Laser Fabrication - Panel Cutting, Welding, UV Print | RWAS',
    description:
      'See RWAS in-house aircraft fabrication capability: fiber laser cutting, panel work, marking, finishing, and repair-station workflow.',
    url: pageUrl,
    images: [socialImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aircraft Fiber Laser Fabrication - RWAS',
    description:
      'See RWAS in-house aircraft fabrication capability: fiber laser cutting, panel work, marking, finishing, and repair-station workflow.',
    images: [socialImageUrl],
  },
};

export default function FiberLaserFabricationPage() {
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
                name: 'Aircraft Fiber Laser Fabrication',
                serviceType: 'Aircraft fabrication',
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
                  'In-house aircraft fabrication support from Roger Wilco Aviation Services, including fiber laser cutting, laser welding, aircraft panel fabrication, sheet metal support, powder coating, UV printing, and CAD/CNC workflow.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Aircraft fabrication capabilities',
                  itemListElement: [
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fiber Laser Cutting' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fiber Laser Welding' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Aircraft Panel Fabrication' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sheet Metal Repair Support' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Powder Coating' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'UV Printing' } },
                    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'CAD and CNC Fabrication Support' } },
                  ],
                },
              },
              {
                '@type': 'VideoObject',
                '@id': `${pageUrl}#fabrication-video`,
                name: 'RWAS Aircraft Fabrication and Shop Capability Reel',
                description:
                  'A Roger Wilco Aviation Services shop reel showing in-house fabrication, laser work, aircraft support, and repair-station capabilities.',
                thumbnailUrl: posterUrl,
                uploadDate: '2026-06-26',
                duration: 'PT39S',
                contentUrl: videoUrl,
                embedUrl: `${pageUrl}#fabrication-video`,
                publisher: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://www.rogerwilcoaviation.com/services' },
                  { '@type': 'ListItem', position: 3, name: 'Aircraft Fiber Laser Fabrication', item: pageUrl },
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
        <figure className="fabrication-video fabrication-video--feature" aria-labelledby="fabrication-video-title">
          <div className="fabrication-video__frame" id="fabrication-video">
            <video
              className="fabrication-video__media"
              autoPlay
              muted
              loop
              preload="auto"
              poster="/videos/fabrication/rwas-laser-steel-16x9-20260626-poster.jpg"
              playsInline
              aria-label="RWAS laser fabrication video"
            >
              <source src="/videos/fabrication/rwas-laser-steel-16x9-quote-pause-20260627.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <figcaption className="fabrication-video__caption" id="fabrication-video-title">
            <span>RWAS capability reel</span>
            <strong>Fiber laser cutting, aircraft panel workflow, fabrication, finishing, and shop support under one roof.</strong>
          </figcaption>
        </figure>

        <section className="hero-headline-group" aria-labelledby="laser-hero">
          <span className="bs-kicker">Fabrication &amp; Manufacturing &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; cut, marked, finished, and reviewed in-house &mdash;</span>
          <h1 id="laser-hero" className="bs-headline bs-headline--hero">
            Aircraft fiber laser fabrication,
            <br />
            <em>built into the repair-station workflow.</em>
          </h1>
          <p className="bs-subhead">
            Fiber laser cutting &middot; laser welding &middot; panel fabrication &middot; powder coating &middot; UV printing &middot; CAD/CNC support
          </p>
          <div className="bs-byline">
            RWAS Avionics Desk &middot; Serving aircraft owners and shops across the Northern Plains
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">In-House Fabrication</span>
              <h2 className="bs-headline bs-headline--section">Precision metal work without losing the aircraft context.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services uses in-house fiber laser cutting and welding to support aircraft panel work, sheet metal projects, brackets, tooling, and short-run aviation parts that need clean edges, repeatable geometry, and fast iteration. The advantage is not just the machine. It is having the machine inside the same shop that understands avionics clearances, structural judgment, logbook documentation, placards, and return-to-service requirements.
                </p>
                <p>
                  RWAS can take a project from aircraft review and CAD layout through cutting, finishing, marking, and installation planning. That shortens the loop for owners who need panel modernization, replacement metal, custom brackets, or a manufactured tool that has to survive normal hangar use.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/laser_cutter.webp"
                alt="Fiber laser cutting equipment in the RWAS shop"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                RWAS fiber laser cutting capability - used for panel, tooling, and fabrication support in the Northern Plains.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Panel Workflow</span>
              <h2 className="bs-headline bs-headline--section">From panel concept to cut metal.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Aircraft panel work starts before the laser ever runs. RWAS reviews the aircraft, instrument layout, equipment stack, structural constraints, wiring path, placards, and applicable installation data. Once the concept is ready, the shop can move from CAD to cut metal without handing the project to an outside vendor that has never seen the airplane.
                </p>
                <p>
                  Owners planning a Garmin upgrade can use the panel planner as an early conversation tool, then have RWAS review the actual aircraft and project scope before fabrication begins.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/panel-planner">
                  Start with the panel planner
                </Link>
                <Link className="bs-cta-secondary" href="/contact?reason=service&source=fiber-laser-panel">
                  Ask about panel fabrication
                </Link>
              </p>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Capabilities</span>
              <h2 className="bs-headline bs-headline--section">Cut, weld, finish, mark, and iterate.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    The fiber laser supports precise work in thin-gauge metals used in aircraft and tooling projects. RWAS pairs that with CAD/CNC workflow, powder coating, UV printing, and CO2 engraving so the finished part is not just shaped correctly, but readable, durable, and ready for a professional aircraft environment.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name">Fiber Laser Cutting</p>
                    <p className="bs-svc-desc">Repeatable cut geometry for panels, brackets, fixtures, and short-run shop parts.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Fiber Laser Welding</p>
                    <p className="bs-svc-desc">Precision joining support where material, geometry, and approved data make it appropriate.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Aircraft Panel Fabrication</p>
                    <p className="bs-svc-desc">Panel blanks, instrument openings, avionics layouts, placard areas, and fit checks.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">Powder Coating &amp; UV Printing</p>
                    <p className="bs-svc-desc">Finished panels and tools with durable color, labeling, and reference markings.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name">CAD/CNC Fabrication Support</p>
                    <p className="bs-svc-desc">Digital layout, repeatable manufacturing files, CNC routing, and production support.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/n5171s_panel.webp"
                alt="Custom aircraft panel fabricated, powder coated, and printed by RWAS"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 02">
                Custom panel work - precision cut, finished, and marked for a professional cockpit installation.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Aircraft Judgment</span>
              <h2 className="bs-headline bs-headline--section">A fast laser still needs a valid aircraft path.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Fabrication for aircraft is not the same as hobby cutting. RWAS reviews eligibility, installation data, structure, clearances, equipment requirements, placards, and documentation before treating a fabricated item as aircraft work. Some projects can be handled as shop support or tooling; others require approved data, STC/AML compatibility, coordination with an IA, or a different path entirely.
                </p>
                <p>
                  That discipline is the point. The shop can move quickly, but it will not turn an aircraft project into a loose piece of metal with no regulatory story behind it.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Start a Fabrication Request</span>
              <h2 className="bs-headline bs-headline--section">Send the aircraft, the part, and the constraint.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful fabrication requests include the aircraft make and model, N-number if aircraft-specific, photos of the panel or part, dimensions, material if known, the desired finish or marking, and the maintenance or installation reason behind the work. If the project ties into a Garmin installation, structural repair, or Papa-Alpha tooling question, include that context up front.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=fiber-laser-fabrication">
                  Request fabrication support
                </Link>
                <Link className="bs-cta-secondary" href="/shop-capabilities#fabrication">
                  View all fabrication capabilities
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Fabrication quick reference">
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
                RWAS Avionics Desk
                <br />
                the Northern Plains
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Fabrication Stack</span>
              <p>
                Fiber laser cutting
                <br />
                Fiber laser welding
                <br />
                CAD/CNC workflow
                <br />
                Powder coating
                <br />
                UV printing
                <br />
                CO2 engraving
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Good Fit</span>
              <p>
                Panel modernization
                <br />
                Instrument cutouts
                <br />
                Custom brackets
                <br />
                Sheet metal support
                <br />
                Tooling and fixtures
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
                Fabrication support
              </p>
            </Specimen>

            <div className="jerry-card">
              <span className="bs-script-accent">&mdash; fabrication desk &mdash;</span>
              <h4>Have a panel or part in mind?</h4>
              <p>Send photos, dimensions, aircraft context, and the desired finish.</p>
              <a className="cta" href="/contact?reason=service&source=fiber-laser-card">
                Start request
              </a>
              <div className="footnote">Aircraft work is reviewed before metal is cut.</div>
            </div>
          </aside>
        </div>
      </main>

      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
