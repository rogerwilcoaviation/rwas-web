import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COLLECTION_REDIRECTS: Record<string, string> = {
  '/contact.html': '/contact',
  '/newspaper/index.html': '/',
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

const LEGACY_GONE_PATHS = new Set([
  // Legacy indexed Shopify page with no current public-site equivalent.
  '/pages/script-rwas',
]);

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/\/$/, '');
  if (LEGACY_GONE_PATHS.has(pathname)) {
    return new NextResponse('Gone', {
      status: 410,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, noarchive',
      },
    });
  }

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
  matcher: ['/dashboard/:path*', '/collections/:path*', '/pages/:path*'],
};
