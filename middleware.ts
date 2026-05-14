import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COLLECTION_REDIRECTS: Record<string, string> = {
  '/collections/garmin-avionics': '/collections/avionics-certified',
  '/collections/garmin-avionics-certified-retail': '/collections/avionics-certified',
  '/collections/garmin-avionics-accessories': '/collections/garmin-dealer-install',
  '/collections/garmin-database-cards': '/collections/avionics-certified',
  '/collections/garmin-traffic-weather-receivers': '/collections/avionics-certified',
  '/collections/garmin-portable-gps-wearables': '/collections/pilot-gear',
  '/collections/garmin-watches': '/collections/watches-accessories',
  '/collections/garmin-inreach-communicators': '/collections/pilot-gear',
  '/collections/garmin-products': '/collections',
  '/collections/retail-experimental': '/collections/avionics-experimental',
  '/collections/rigging-tools': '/collections/papa-alpha-tools',
  '/collections/garmin-marine': '/collections',
  '/collections/garmin-cycling-fitness': '/collections',
  '/collections/garmin-golf': '/collections',
  '/collections/garmin-outdoor-dog-tracking': '/collections',
};

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/\/$/, '');
  const target = COLLECTION_REDIRECTS[pathname];
  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = '';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/collections/:path*'],
};
