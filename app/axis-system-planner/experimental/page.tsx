import { genPageMetadata } from '@/app/seo';
import AxisPlannerPage from '@/components/shopify/AxisPlannerPage';

export const metadata = genPageMetadata({
  title: 'Garmin AXIS Experimental Aircraft System Planner | RWAS',
  description:
    'Plan a Garmin AXIS system for an experimental aircraft, estimate hardware list pricing, and request an RWAS equipment and installation quote.',
  image:
    'https://www.rogerwilcoaviation.com/images/blog/axis-build-planner-operating-display-20260807.jpg',
  canonical:
    'https://www.rogerwilcoaviation.com/axis-system-planner/experimental',
});

export default function ExperimentalAxisPlanner() {
  return <AxisPlannerPage kind="experimental" />;
}
