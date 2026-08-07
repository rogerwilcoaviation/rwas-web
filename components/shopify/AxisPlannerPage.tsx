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
        <AxisBuildPlanner kind={kind} />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
