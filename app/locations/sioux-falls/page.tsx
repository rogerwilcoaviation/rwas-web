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

const pageUrl = 'https://www.rogerwilcoaviation.com/locations/sioux-falls';

export const metadata = {
  title: { absolute: 'Aircraft Maintenance & Avionics Shop - Sioux Falls, SD | RWAS' },
  description:
    'Roger Wilco Aviation Services is an FAA Part 145 repair station at Hangar 3, 3701 N. Aviation Avenue, Sioux Falls, SD, supporting Garmin avionics, maintenance, NDT, fabrication, and aircraft pre-buy inspections.',
  alternates: { canonical: pageUrl },
};

export default function SiouxFallsLocationPage() {
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Place',
                '@id': `${pageUrl}#place`,
                name: 'Roger Wilco Aviation Services - Sioux Falls',
                url: pageUrl,
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: 'Hangar 3, 3701 N. Aviation Avenue',
                  addressLocality: 'Sioux Falls',
                  addressRegion: 'SD',
                  postalCode: '57104',
                  addressCountry: 'US',
                },
              },
              {
                '@type': 'LocalBusiness',
                '@id': 'https://www.rogerwilcoaviation.com#organization',
                name: 'Roger Wilco Aviation Services',
                url: 'https://www.rogerwilcoaviation.com',
                telephone: '+1-605-299-8178',
                email: 'avionics@rwas.team',
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: 'Hangar 3, 3701 N. Aviation Avenue',
                  addressLocality: 'Sioux Falls',
                  addressRegion: 'SD',
                  postalCode: '57104',
                  addressCountry: 'US',
                },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Locations', item: pageUrl },
                  { '@type': 'ListItem', position: 3, name: 'Sioux Falls', item: pageUrl },
                ],
              },
            ],
          }),
        }}
      />

      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/about" />
      <CredentialsBar />
      <BulletinBar />

      <main className="bs-stage">
        <section className="hero-headline-group" aria-labelledby="sioux-falls-hero">
          <span className="bs-kicker">Sioux Falls Location &middot; FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; Hangar 3 dispatch desk &mdash;</span>
          <h1 id="sioux-falls-hero" className="bs-headline bs-headline--hero">
            Aircraft maintenance and Garmin avionics,
            <br />
            <em>based in Sioux Falls, South Dakota.</em>
          </h1>
          <p className="bs-subhead">
            Garmin installation &middot; annual inspections &middot; NDT &middot; fabrication &middot; Papa-Alpha tools &middot; pre-buy support
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD 57104 &middot; (605) 299-8178
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Regional Shop</span>
              <h2 className="bs-headline bs-headline--section">A Northern Plains repair station for aircraft owners who need the whole job handled.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services operates from Hangar 3 at 3701 N. Aviation Avenue in Sioux Falls, South Dakota. The shop is built for aircraft owners who need avionics, airframe, powerplant, NDT, fabrication, and documentation coordinated by one accountable team instead of scattered across disconnected vendors.
                </p>
                <p>
                  RWAS supports owners across South Dakota, Nebraska, Iowa, Minnesota, North Dakota, Wyoming, and Montana with FAA Part 145 repair-station discipline, Garmin dealer access, in-house panel fabrication, and practical aircraft-maintenance judgment.
                </p>
              </div>
            </Specimen>

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/r182_panel.webp"
                alt="Garmin avionics panel installation supported by RWAS in Sioux Falls"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Garmin panel work, fabrication, and return-to-service documentation coordinated from the RWAS Sioux Falls shop.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">What Owners Come Here For</span>
              <h2 className="bs-headline bs-headline--section">Commercial-intent services with a real address behind them.</h2>
              <hr className="section-rule" />
              <div className="bs-split">
                <div className="bs-body">
                  <p>
                    The Sioux Falls location page exists for pilots and aircraft owners searching locally for the exact work RWAS performs. It connects location intent to the deeper service pages where each capability is explained in detail.
                  </p>
                </div>
                <ul className="bs-svc-list">
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/garmin-installation-northern-plains">Garmin avionics installation</Link></p>
                    <p className="bs-svc-desc">G3X Touch, GTN Xi, GFC 500, ADS-B, GI 275, G5, panel planning, and installation documentation.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/aircraft-maintenance-sioux-falls">Aircraft maintenance and annual inspections</Link></p>
                    <p className="bs-svc-desc">Annuals, 100-hour inspections, pre-buy support, AOG coordination, prop balancing, and weight certification.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/ndt-inspection">Aircraft NDT inspection</Link></p>
                    <p className="bs-svc-desc">Eddy current, dye penetrant, magnetic particle, ultrasound, visual, and Rockwell hardness testing.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/fiber-laser-fabrication">Fiber laser fabrication</Link></p>
                    <p className="bs-svc-desc">Panel cutting, laser welding, powder coating, UV printing, bracket work, and aircraft fabrication support.</p>
                  </li>
                  <li className="bs-svc">
                    <p className="bs-svc-name"><Link href="/services/papa-alpha-tools">Papa-Alpha Piper rigging tools</Link></p>
                    <p className="bs-svc-desc">RWAS-built rigging reference tools for PA-series Piper aircraft, manufactured and shipped from the shop.</p>
                  </li>
                </ul>
              </div>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Before You Fly or Ship Anything</span>
              <h2 className="bs-headline bs-headline--section">Call the shop with the aircraft, mission, and records.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  For service planning, include the aircraft make and model, N-number, current location, known squawks, photos, logbook context, desired downtime window, and the decision you are trying to make. RWAS can then route the request to avionics, maintenance, NDT, fabrication, or pre-buy support without starting from a generic intake.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=sioux-falls-location">
                  Contact the Sioux Falls shop
                </Link>
                <Link className="bs-cta-secondary" href="/shop-capabilities">
                  View shop capabilities
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="Sioux Falls location quick reference">
            <Specimen as="section">
              <span className="bs-kicker">Shop Address</span>
              <p>
                Hangar 3
                <br />
                3701 N. Aviation Avenue
                <br />
                Sioux Falls, South Dakota 57104
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Phone</span>
              <p>
                <a
                  href="tel:+16052998178"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  (605) 299-8178
                </a>
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Email</span>
              <p>
                <a
                  href="mailto:service@rwas.team"
                  style={{ color: 'var(--ink-900)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  service@rwas.team
                </a>
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
                Wyoming
                <br />
                Montana
              </p>
            </Specimen>
          </aside>
        </div>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
