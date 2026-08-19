import { genPageMetadata } from '@/app/seo';
import AxisPlannerPage from '@/components/shopify/AxisPlannerPage';

export const metadata = genPageMetadata({
  title: 'Garmin AXIS Certified Aircraft System Planner | RWAS',
  description:
    'Plan a Garmin AXIS system for a certified aircraft, estimate hardware list pricing, and request an RWAS equipment and installation quote.',
  canonical: 'https://www.rogerwilcoaviation.com/axis-system-planner/certified',
});

export default function CertifiedAxisPlanner() {
  return <AxisPlannerPage kind="certified" />;
}
