import Link from 'next/link';
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

const pageUrl = 'https://www.rogerwilcoaviation.com/services';

const serviceGroups = [
  {
    label: 'Avionics installation',
    services: [
      {
        name: 'Garmin avionics installation',
        href: '/services/garmin-installation-northern-plains',
        description: 'Northern Plains Garmin dealer support for G3X Touch, GTN Xi, GFC 500, ADS-B, GI 275, G5, panel fabrication, and quote planning.',
      },
      {
        name: 'G3X Touch installation',
        href: '/services/g3x-touch-installation',
        description: 'Glass-panel planning, EIS, ADAHRS, Connext workflow, fabrication, configuration, and documentation support.',
      },
      {
        name: 'GTN Xi navigator installation',
        href: '/services/gtn-xi-navigator-installation',
        description: 'GTN 650Xi and GTN 750Xi WAAS navigator installs, antenna planning, panel integration, testing, and logbook documentation.',
      },
      {
        name: 'GFC 500 autopilot installation',
        href: '/services/gfc-500-autopilot-installation',
        description: 'Eligibility review, quote planning, servo and control placement, integration review, installation, and return-to-service documentation.',
      },
      {
        name: 'ADS-B installation',
        href: '/services/ads-b-installation',
        description: 'ADS-B Out compliance planning, Garmin transponder upgrades, GPS source review, antenna planning, configuration, and documentation.',
      },
    ],
  },
  {
    label: 'Maintenance, inspection, and buyer support',
    services: [
      {
        name: 'Aircraft maintenance in Sioux Falls',
        href: '/services/aircraft-maintenance-sioux-falls',
        description: 'Annual inspections, 100-hour inspections, AOG coordination, prop balancing, aircraft weighing, and repair-station paperwork.',
      },
      {
        name: 'Pre-buy inspection',
        href: '/services/pre-buy-inspection',
        description: 'Logbook review, physical condition checks, avionics review, NDT coordination, and practical buyer decision support.',
      },
      {
        name: 'Aircraft NDT inspection',
        href: '/services/ndt-inspection',
        description: 'Eddy current, dye penetrant, magnetic particle, ultrasound, visual, and Rockwell hardness testing with FAA documentation support.',
      },
      {
        name: 'Rotax repair support',
        href: '/services/rotax-repair',
        description: 'Rotax aircraft engine maintenance support, inspection planning, troubleshooting, and documentation review.',
      },
    ],
  },
  {
    label: 'Fabrication and RWAS-built products',
    services: [
      {
        name: 'Fiber laser fabrication',
        href: '/services/fiber-laser-fabrication',
        description: 'Aircraft panel cutting, laser welding, powder coating, UV printing, bracket work, and precision shop fabrication.',
      },
      {
        name: 'Papa-Alpha Piper rigging tools',
        href: '/services/papa-alpha-tools',
        description: 'RWAS-designed Piper rigging reference tools for PA-series aircraft, built for practical flight-control setup work.',
      },
    ],
  },
];

const allServices = serviceGroups.flatMap((group) => group.services);

export const metadata = {
  title: { absolute: 'Aircraft Services - Avionics, Maintenance, NDT & Fabrication | RWAS' },
  description:
    'Explore RWAS aircraft services from FAA Part 145 repair station RWSR491E at Hangar 3 in Sioux Falls, SD: Garmin avionics installation, annual inspections, NDT, fabrication, Rotax support, pre-buy inspections, and Papa-Alpha tools.',
  alternates: { canonical: pageUrl },
};

export default function ServicesPage() {
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
                name: 'Aircraft Services from Roger Wilco Aviation Services',
                serviceType: 'Aircraft maintenance, avionics installation, NDT inspection, and fabrication',
                url: pageUrl,
                provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
                areaServed: [
                  { '@type': 'State', name: 'South Dakota' },
                  { '@type': 'State', name: 'Nebraska' },
                  { '@type': 'State', name: 'Iowa' },
                  { '@type': 'State', name: 'Minnesota' },
                  { '@type': 'State', name: 'North Dakota' },
                  { '@type': 'State', name: 'Wyoming' },
                  { '@type': 'State', name: 'Montana' },
                ],
                description:
                  'FAA Part 145 aircraft services from Roger Wilco Aviation Services at Hangar 3 in Sioux Falls, South Dakota, including Garmin avionics installation, maintenance, NDT inspection, fabrication, Rotax support, and pre-buy inspections.',
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'RWAS aircraft service catalog',
                  itemListElement: serviceGroups.map((group) => ({
                    '@type': 'OfferCatalog',
                    name: group.label,
                    itemListElement: group.services.map((service) => ({
                      '@type': 'Offer',
                      url: `https://www.rogerwilcoaviation.com${service.href}`,
                      itemOffered: {
                        '@type': 'Service',
                        name: service.name,
                        description: service.description,
                      },
                    })),
                  })),
                },
              },
              {
                '@type': 'ItemList',
                '@id': `${pageUrl}#service-list`,
                name: 'RWAS aircraft service pages',
                itemListElement: allServices.map((service, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: service.name,
                  url: `https://www.rogerwilcoaviation.com${service.href}`,
                })),
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${pageUrl}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
                  { '@type': 'ListItem', position: 2, name: 'Services', item: pageUrl },
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
        <section className="hero-headline-group" aria-labelledby="services-hero">
          <span className="bs-kicker">FAA Part 145 Repair Station #RWSR491E</span>
          <span className="bs-script-accent">&mdash; Sioux Falls aircraft services desk &mdash;</span>
          <h1 id="services-hero" className="bs-headline bs-headline--hero">
            Aircraft services for owners who need
            <br />
            <em>the whole job handled.</em>
          </h1>
          <p className="bs-subhead">
            Garmin avionics &middot; aircraft maintenance &middot; NDT inspection &middot; fabrication &middot; Rotax support &middot; pre-buy inspections
          </p>
          <div className="bs-byline">
            Hangar 3 &middot; 3701 N. Aviation Avenue &middot; Sioux Falls, SD 57104 &middot; Serving the Northern Plains
          </div>
        </section>

        <div className="about-grid">
          <div className="about-main">
            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Service Directory</span>
              <h2 className="bs-headline bs-headline--section">One accountable shop for avionics, airworthiness, inspection, and fabrication.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Roger Wilco Aviation Services is a working FAA Part 145 repair station at Hangar 3 in Sioux Falls, South Dakota. This page is the front desk for the shop's crawlable service pages: Garmin installation, aircraft maintenance, NDT, fabrication, Rotax support, pre-buy inspections, and RWAS-built Papa-Alpha tools.
                </p>
                <p>
                  If you already know the system or service you need, choose the matching page below. If you are still deciding, send the aircraft, mission, location, photos, and logbook context through the contact form and the shop can route the request.
                </p>
              </div>
            </Specimen>

            {serviceGroups.map((group) => (
              <Specimen key={group.label} variant="hero" as="section">
                <span className="bs-kicker">{group.label}</span>
                <h2 className="bs-headline bs-headline--section">{group.label}</h2>
                <hr className="section-rule" />
                <ul className="bs-svc-list">
                  {group.services.map((service) => (
                    <li key={service.href} className="bs-svc">
                      <p className="bs-svc-name">
                        <Link href={service.href}>{service.name}</Link>
                      </p>
                      <p className="bs-svc-desc">{service.description}</p>
                    </li>
                  ))}
                </ul>
              </Specimen>
            ))}

            <Specimen variant="hero" as="figure" className="about-fig">
              <Specimen.Image
                src="/newspaper/images/r182_panel.webp"
                alt="Garmin avionics panel work supported by Roger Wilco Aviation Services"
                width={800}
                height={525}
                loading="lazy"
                decoding="async"
              />
              <Specimen.CaptionRule />
              <Specimen.Caption numeral="FIG. 01">
                Service work at RWAS often blends avionics, fabrication, maintenance review, and documentation into one coordinated project.
              </Specimen.Caption>
            </Specimen>

            <Specimen variant="hero" as="section">
              <span className="bs-kicker">Start Here</span>
              <h2 className="bs-headline bs-headline--section">Give the shop enough context to route the request correctly.</h2>
              <hr className="section-rule" />
              <div className="bs-body">
                <p>
                  Useful first contact details include aircraft make and model, N-number, current airport, desired work, known squawks, panel or damage photos, logbook notes, preferred schedule, and whether the aircraft can fly to Sioux Falls.
                </p>
              </div>
              <p>
                <Link className="bs-cta-primary" href="/contact?reason=service&source=services-hub">
                  Contact the service desk
                </Link>
                <Link className="bs-cta-secondary" href="/locations/sioux-falls">
                  View the Sioux Falls location
                </Link>
                <Link className="bs-cta-secondary" href="/shop-capabilities">
                  Read shop capabilities
                </Link>
              </p>
            </Specimen>
          </div>

          <aside className="about-rail" aria-label="RWAS service quick reference">
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
              </p>
            </Specimen>

            <Specimen as="section">
              <span className="bs-kicker">Core Credentials</span>
              <p>
                FAA Part 145 Repair Station
                <br />
                Certificate RWSR491E
                <br />
                Certified Garmin Dealer
                <br />
                AEA Member
                <br />
                NBAA Member
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
