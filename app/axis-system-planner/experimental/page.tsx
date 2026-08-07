import { genPageMetadata } from '@/app/seo';
import AxisPlannerPage from '@/components/shopify/AxisPlannerPage';

export const metadata = genPageMetadata({
  title: 'Garmin AXIS Experimental System Planner | RWAS',
  description:
    'Build a Garmin AXIS system for an experimental aircraft, calculate hardware retail pricing, and submit it to RWAS for review and special pricing.',
  canonical:
    'https://www.rogerwilcoaviation.com/axis-system-planner/experimental',
});

export default function ExperimentalAxisPlanner() {
  return <AxisPlannerPage kind="experimental" />;
}
