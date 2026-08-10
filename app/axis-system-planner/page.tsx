import {
  BroadsheetFooter,
  BroadsheetLayout,
  BroadsheetNav,
  BulletinBar,
  CredentialsBar,
  Dateline,
  Masthead,
} from '@/components/shared/broadsheet';
import { genPageMetadata } from '@/app/seo';
import AxisPlannerAttributedLink from '@/components/shopify/AxisPlannerAttributedLink';
import Link from 'next/link';
import { Suspense } from 'react';

const pageUrl = 'https://www.rogerwilcoaviation.com/axis-system-planner';

export const metadata = genPageMetadata({
  title: 'AXIS System Builder | RWAS',
  description:
    'Choose the Garmin AXIS certified or experimental system builder, or open the separate visual Panel Layout Planner.',
  canonical: pageUrl,
});

export default function AxisSystemPlannerLanding() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/axis-system-planner" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">AXIS System Builder</p>
          <h1 className="bs-headline bs-headline--hero">
            Choose the right AXIS planning path.
          </h1>
          <p className="bs-subhead">
            Start with Garmin&rsquo;s AXIS equipment builder for a preliminary
            hardware plan, or use the separate visual Panel Layout Planner to
            explore how equipment could fit in your panel.
          </p>
        </section>
        <section className="grid gap-6 md:grid-cols-2">
          <article className="border-4 border-black bg-white p-6">
            <p className="bs-kicker">Equipment planning</p>
            <h2 className="bs-section-head mt-2">AXIS System Builder</h2>
            <p className="bs-body mt-3">
              Compare certified and experimental equipment, quantities, and
              Garmin July 2026 guide pricing. The result is preliminary hardware
              planning for RWAS review—not an approved configuration or
              installed quote.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Suspense
                fallback={
                  <Link
                    href="/axis-system-planner/certified?source=axis-landing"
                    className="bs-cta-primary"
                  >
                    Certified aircraft
                  </Link>
                }
              >
                <AxisPlannerAttributedLink
                  href="/axis-system-planner/certified"
                  defaultSource="axis-landing"
                  className="bs-cta-primary"
                >
                  Certified aircraft
                </AxisPlannerAttributedLink>
              </Suspense>
              <Suspense
                fallback={
                  <Link
                    href="/axis-system-planner/experimental?source=axis-landing"
                    className="bs-cta-secondary"
                  >
                    Experimental aircraft
                  </Link>
                }
              >
                <AxisPlannerAttributedLink
                  href="/axis-system-planner/experimental"
                  defaultSource="axis-landing"
                  className="bs-cta-secondary"
                >
                  Experimental aircraft
                </AxisPlannerAttributedLink>
              </Suspense>
            </div>
          </article>
          <article className="border-2 border-black bg-[#f2ecde] p-6">
            <p className="bs-kicker">Visual layout planning</p>
            <h2 className="bs-section-head mt-2">Panel Layout Planner</h2>
            <p className="bs-body mt-3">
              Sketch a visual Garmin panel concept with the existing RWAS
              customer Panel Planner. It remains a separate tool focused on
              layout and finish ideas.
            </p>
            <Suspense
              fallback={
                <Link
                  href="/panel-planner?source=panel-layout-cross-link"
                  className="bs-cta-secondary mt-5 inline-flex"
                >
                  Open Panel Layout Planner
                </Link>
              }
            >
              <AxisPlannerAttributedLink
                href="/panel-planner"
                defaultSource="panel-layout-cross-link"
                className="bs-cta-secondary mt-5 inline-flex"
              >
                Open Panel Layout Planner
              </AxisPlannerAttributedLink>
            </Suspense>
          </article>
        </section>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
