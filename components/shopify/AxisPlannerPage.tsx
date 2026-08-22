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
import { AXIS_ITEMS } from '@/lib/axis-planner-data';
import { getSkuMedia } from '@/lib/shopify';
import Link from 'next/link';

export default async function AxisPlannerPage({ kind }: { kind: AxisPlannerKind }) {
  const certified = kind === 'certified';
  const productMedia = await getSkuMedia(
    AXIS_ITEMS[kind].map((item) => item.sku),
    kind,
  );
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">AXIS Build-A-System Planner</p>
          <h1 className="bs-headline bs-headline--hero">
            AXIS System for {certified ? 'Certified' : 'Experimental'} Aircraft
          </h1>
          <p className="bs-subhead">
            Build a preliminary Garmin AXIS hardware package in the same logical
            order as the official Build-A-System Guide, see the running retail
            total, then send it to RWAS for compatibility review and special
            pricing.
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
        <AxisBuildPlanner kind={kind} productMedia={productMedia} />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
