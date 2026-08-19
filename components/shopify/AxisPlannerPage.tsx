import AxisBuildPlanner from '@/components/shopify/AxisBuildPlanner';
import {
  BroadsheetFooter,
  BroadsheetLayout,
  BroadsheetNav,
  BulletinBar,
  CredentialsBar,
  Dateline,
  Masthead,
} from '@/components/shared/broadsheet';
import type { AxisPlannerKind } from '@/lib/axis-planner-data';
import Link from 'next/link';

export default function AxisPlannerPage({ kind }: { kind: AxisPlannerKind }) {
  const certified = kind === 'certified';
  const pageUrl = `https://www.rogerwilcoaviation.com/axis-system-planner/${kind}`;
  const pageName = `Garmin AXIS ${certified ? 'Certified' : 'Experimental'} Aircraft System Planner`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['WebPage', 'WebApplication'],
        '@id': `${pageUrl}#planner`,
        url: pageUrl,
        name: pageName,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        isPartOf: { '@id': 'https://www.rogerwilcoaviation.com#website' },
        provider: { '@id': 'https://www.rogerwilcoaviation.com#organization' },
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
            name: 'Garmin AXIS System Planner',
            item: 'https://www.rogerwilcoaviation.com/axis-system-planner',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: certified ? 'Certified Aircraft' : 'Experimental Aircraft',
            item: pageUrl,
          },
        ],
      },
    ],
  };
  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Garmin AXIS System Planner</p>
          <h1 className="bs-headline bs-headline--hero">
            AXIS System for {certified ? 'Certified' : 'Experimental'} Aircraft
          </h1>
          <p className="bs-subhead">
            Build a preliminary Garmin AXIS hardware package in the same logical
            order as the official Build-A-System Guide, see the estimated
            hardware list-price total, then send it to RWAS for compatibility
            review and an equipment and installation quote.
          </p>
          <p className="bs-byline">
            RWAS Avionics Desk · Garmin Authorized Dealer · FAA Repair Station
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/collections" className="bs-cta-secondary">
              Back to collections
            </Link>
            <Link
              href={
                certified
                  ? '/axis-system-planner/experimental'
                  : '/axis-system-planner/certified'
              }
              className="bs-cta-secondary"
            >
              Switch to {certified ? 'Experimental' : 'Certified'}
            </Link>
          </div>
        </section>
        <p className="bs-body mb-6 border-l-4 border-black bg-[#f2ecde] p-4">
          This is preliminary hardware planning—not an approved configuration or
          installed quote. The planner surfaces advisories but does not perform
          full compatibility validation.
        </p>
        <AxisBuildPlanner kind={kind} />
        <section
          className="mt-8 grid gap-6 md:grid-cols-2"
          aria-label="Garmin AXIS accessory planning"
        >
          <article className="border-2 border-black bg-white p-5">
            <h2 className="bs-section-head">Garmin GI 260 AOA planning</h2>
            <p className="bs-body mt-3">
              Complete GI 260 AOA packages include an indicator, GAP 26 probe
              and required air-data hardware. Because AXIS can display AOA with
              compatible sensors, RWAS reviews duplicate components, aircraft
              eligibility, approved data, voltage and probe heating.
            </p>
          </article>
          <article className="border-2 border-black bg-white p-5">
            <h2 className="bs-section-head">Garmin GSB 15 USB charging</h2>
            <p className="bs-body mt-3">
              The GSB 15 USB-A/USB-C rear-input charging port is optional panel
              equipment. RWAS confirms aircraft voltage, circuit protection,
              connectors, available panel space and installation details.
            </p>
          </article>
        </section>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
