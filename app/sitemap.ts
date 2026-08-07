import { MetadataRoute } from 'next';
import { siteConfig } from '@/data/config/site.settings';
import blogData from '../public/blog-articles.json';
import { getFeaturedCollections, getSeoProductHandles } from '@/lib/shopify';

export const dynamic = 'force-static';

// Only indexable, user-facing pages. Excludes internal tools (dashboard,
// status, help, security), cart/checkout paths, and utility pages.
const STATIC_ROUTES = [
  '',
  'about',
  'locations/yankton',
  'shop-capabilities',
  'garmin',
  'services',
  'services/ndt-inspection',
  'services/papa-alpha-tools',
  'services/fiber-laser-fabrication',
  'services/garmin-installation-northern-plains',
  'services/rotax-repair',
  'services/aircraft-maintenance',
  'services/pre-buy-inspection',
  'services/gfc-500-autopilot-installation',
  'services/ads-b-installation',
  'services/g3x-touch-installation',
  'services/gtn-xi-navigator-installation',
  'panel-planner',
  'axis-system-planner/certified',
  'axis-system-planner/experimental',
  'aircraft-for-sale',
  'financing',
  'blog',
  'contact',
  'privacy',
  'terms',
  'cookies',
];

interface Article {
  id: string;
  status?: string;
  date?: string;
  updated_at?: string;
}

interface SaleListing {
  id?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
}

async function getAircraftListingEntries(
  siteUrl: string,
): Promise<MetadataRoute.Sitemap> {
  try {
    const response = await fetch(
      'https://sale-api.rogerwilcoaviation.com/browse?include=sold',
      {
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { listings?: SaleListing[] };
    return (data.listings || [])
      .filter(
        (listing) =>
          listing.id &&
          (!listing.status ||
            listing.status === 'active' ||
            listing.status === 'sold'),
      )
      .map((listing) => ({
        url: `${siteUrl}/aircraft-for-sale/${encodeURIComponent(listing.id as string)}`,
        ...(listing.updatedAt || listing.createdAt
          ? { lastModified: listing.updatedAt || listing.createdAt }
          : {}),
      }));
  } catch {
    return [];
  }
}

async function getShopEntries(siteUrl: string): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  try {
    const collections = await getFeaturedCollections();
    entries.push(
      {
        url: `${siteUrl}/collections`,
      },
      ...collections.map((collection) => ({
        url: `${siteUrl}/collections/${collection.handle}`,
      })),
    );
  } catch {
    entries.push({
      url: `${siteUrl}/collections`,
    });
  }

  try {
    const productHandles = await getSeoProductHandles();
    entries.push(
      ...productHandles.map((handle) => ({
        url: `${siteUrl}/products/${handle}`,
      })),
    );
  } catch {
    // Keep sitemap generation resilient if Shopify is temporarily unavailable.
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteConfig.siteUrl.replace(/\/$/, '');

  // Static routes
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: path ? `${siteUrl}/${path}` : `${siteUrl}/`,
  }));

  // Blog articles (only published ones, at their real slug URLs)
  const articles: Article[] =
    (blogData as { articles?: Article[] }).articles || [];
  const articleEntries: MetadataRoute.Sitemap = articles
    .filter((a) => a.status === 'published' && a.id)
    .map((a) => ({
      url: `${siteUrl}/blog/${a.id}`,
      ...(a.updated_at || a.date
        ? { lastModified: a.updated_at || a.date }
        : {}),
    }));

  const [aircraftEntries, shopEntries] = await Promise.all([
    getAircraftListingEntries(siteUrl),
    getShopEntries(siteUrl),
  ]);

  return [
    ...staticEntries,
    ...articleEntries,
    ...aircraftEntries,
    ...shopEntries,
  ];
}
