import { genPageMetadata } from '@/app/seo';
import AxisPlannerPage from '@/components/shopify/AxisPlannerPage';

export const metadata = genPageMetadata({
  title: 'Garmin AXIS Certified System Planner | RWAS',
  description:
    'Build a preliminary Garmin AXIS system for a certified aircraft, calculate hardware retail pricing, and submit the package to RWAS for review and special pricing.',
  canonical: 'https://www.rogerwilcoaviation.com/axis-system-planner/certified',
});

export default function CertifiedAxisPlanner() {
  return <AxisPlannerPage kind="certified" />;
}
