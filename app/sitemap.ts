import { MetadataRoute } from 'next';
import { siteConfig } from '@/data/config/site.settings';
import blogData from '../public/blog-articles.json';
import { getFeaturedCollections, getProductHandles } from '@/lib/shopify';

export const dynamic = 'force-static';

type Priority = 1.0 | 0.9 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3;
type Freq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface StaticRoute {
  path: string;
  priority: Priority;
  changeFrequency: Freq;
}

// Only indexable, user-facing pages. Excludes internal tools (dashboard,
// status, help, security), cart/checkout paths, and utility pages.
const STATIC_ROUTES: StaticRoute[] = [
  { path: '',                  priority: 1.0, changeFrequency: 'weekly'  },
  { path: 'about',             priority: 0.9, changeFrequency: 'monthly' },
  { path: 'shop-capabilities', priority: 0.9, changeFrequency: 'monthly' },
  { path: 'panel-planner',     priority: 0.9, changeFrequency: 'monthly' },
  { path: 'aircraft-for-sale', priority: 0.8, changeFrequency: 'daily'   },
  { path: 'garmin/',            priority: 0.8, changeFrequency: 'weekly'  },
  { path: 'financing',         priority: 0.7, changeFrequency: 'monthly' },
  { path: 'blog',              priority: 0.7, changeFrequency: 'weekly'  },
  { path: 'privacy',           priority: 0.3, changeFrequency: 'yearly'  },
  { path: 'terms',             priority: 0.3, changeFrequency: 'yearly'  },
  { path: 'cookies',           priority: 0.3, changeFrequency: 'yearly'  },
];

interface Article {
  id: string;
  status?: string;
  date?: string;
}

interface SaleListing {
  id?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
}

async function getAircraftListingEntries(siteUrl: string, today: string): Promise<MetadataRoute.Sitemap> {
  try {
    const response = await fetch('https://sale-api.rogerwilcoaviation.com/browse', {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { listings?: SaleListing[] };
    return (data.listings || [])
      .filter((listing) => listing.id && (!listing.status || listing.status === 'active'))
      .map((listing) => ({
        url: `${siteUrl}/aircraft-for-sale/${encodeURIComponent(listing.id as string)}`,
        lastModified: listing.updatedAt || listing.createdAt || today,
        changeFrequency: 'daily' as Freq,
        priority: 0.7 as Priority,
      }));
  } catch {
    return [];
  }
}

async function getShopEntries(siteUrl: string, today: string): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  try {
    const collections = await getFeaturedCollections();
    entries.push(
      {
        url: `${siteUrl}/collections`,
        lastModified: today,
        changeFrequency: 'weekly' as Freq,
        priority: 0.7 as Priority,
      },
      ...collections.map((collection) => ({
        url: `${siteUrl}/collections/${collection.handle}`,
        lastModified: today,
        changeFrequency: 'weekly' as Freq,
        priority: 0.7 as Priority,
      })),
    );
  } catch {
    entries.push({
      url: `${siteUrl}/collections`,
      lastModified: today,
      changeFrequency: 'weekly' as Freq,
      priority: 0.7 as Priority,
    });
  }

  try {
    const productHandles = await getProductHandles(150);
    entries.push(
      ...productHandles.map((handle) => ({
        url: `${siteUrl}/products/${handle}`,
        lastModified: today,
        changeFrequency: 'weekly' as Freq,
        priority: 0.6 as Priority,
      })),
    );
  } catch {
    // Keep sitemap generation resilient if Shopify is temporarily unavailable.
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteConfig.siteUrl.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];

  // Static routes
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: r.path ? `${siteUrl}/${r.path}` : `${siteUrl}/`,
    lastModified: today,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Blog articles (only published ones, at their real slug URLs)
  const articles: Article[] = (blogData as { articles?: Article[] }).articles || [];
  const articleEntries: MetadataRoute.Sitemap = articles
    .filter((a) => a.status === 'published' && a.id)
    .map((a) => ({
      url: `${siteUrl}/blog/${a.id}`,
      lastModified: a.date || today,
      changeFrequency: 'yearly' as Freq,
      priority: 0.6 as Priority,
    }));

  const [aircraftEntries, shopEntries] = await Promise.all([
    getAircraftListingEntries(siteUrl, today),
    getShopEntries(siteUrl, today),
  ]);

  return [...staticEntries, ...articleEntries, ...aircraftEntries, ...shopEntries];
}
