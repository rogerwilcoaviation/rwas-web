import type { Metadata } from 'next';
import ProductCard from '@/components/shopify/ProductCard';
import PartFinder, { type PartFinderProduct } from '@/components/shopify/PartFinder';
import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
  Specimen,
} from '@/components/shared/broadsheet';
import {
  getCollectionByHandle,
  getFeaturedCollections,
  isQuoteCollection,
  isSeoSafeProductHandle,
} from '@/lib/shopify';
import Link from 'next/link';
import { collectionMetaDescription, collectionSeoTitle, truncateMeta } from '@/lib/seo';

const FALLBACK_COLLECTION_HANDLES = [
  'garmin-avionics',
  'garmin-avionics-certified-retail',
  'garmin-avionics-accessories',
  'garmin-database-cards',
  'garmin-traffic-weather-receivers',
  'garmin-portable-gps-wearables',
  'garmin-watches',
  'garmin-inreach-communicators',
  'garmin-marine',
  'garmin-cycling-fitness',
  'garmin-golf',
  'garmin-outdoor-dog-tracking',
  'garmin-products',
  'retail-experimental',
  'on-sale',
  'papa-alpha-tools',
];

function labelFromGarminTag(tags: string[] | undefined, prefix: string) {
  const tag = tags?.find((value) => value.startsWith(prefix));
  if (!tag) return null;
  return tag
    .slice(prefix.length)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function productSubcategory(product: { tags?: string[] }) {
  return (
    labelFromGarminTag(product.tags, 'garmin-family:') ||
    labelFromGarminTag(product.tags, 'garmin-subcategory:') ||
    'General'
  );
}

function groupProductsBySubcategory<T extends { tags?: string[] }>(products: T[]) {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const label = productSubcategory(product);
    groups.set(label, [...(groups.get(label) || []), product]);
  }
  return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export async function generateStaticParams() {
  try {
    const collections = await getFeaturedCollections();
    const handles = new Set([
      ...collections.map((collection) => collection.handle),
      ...FALLBACK_COLLECTION_HANDLES,
    ]);
    return Array.from(handles).map((handle) => ({ handle }));
  } catch {
    return FALLBACK_COLLECTION_HANDLES.map((handle) => ({ handle }));
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;

  try {
    const collection = await getCollectionByHandle(handle);

    if (!collection) {
      return { title: 'Collection not found' };
    }

    const title = collectionSeoTitle(collection.title);
    const description = collectionMetaDescription(collection);
    const url = `https://www.rogerwilcoaviation.com/collections/${encodeURIComponent(collection.handle)}`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        url,
        title,
        description,
        images: collection.image?.url ? [{ url: collection.image.url, alt: collection.image.altText || collection.title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: collection.image?.url ? [collection.image.url] : undefined,
      },
    };
  } catch {
    return { title: 'Collection not found' };
  }
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let collection: Awaited<ReturnType<typeof getCollectionByHandle>> = null;
  try {
    collection = await getCollectionByHandle(handle);
  } catch {
    collection = null;
  }

  if (!collection) {
    return (
      <BroadsheetLayout>
        <Dateline />
        <Masthead />
        <BroadsheetNav activeHref={`/collections/${handle}`} />
        <CredentialsBar />
        <BulletinBar />
        <main className="bs-stage">
          <section className="hero-headline-group">
            <p className="bs-kicker">Collection</p>
            <p className="bs-script-accent">&mdash; temporarily unavailable &mdash;</p>
            <h1 className="bs-headline bs-headline--hero">Collection Not Found</h1>
            <p className="bs-subhead">
              We could not load this collection from Shopify right now. Please try again shortly.
            </p>
          </section>
          <Specimen variant="flat">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/collections" className="bs-cta-primary">Back to collections</Link>
              <Link href="/shop-capabilities" className="bs-cta-secondary">Shop capabilities</Link>
            </div>
          </Specimen>
        </main>
        <BroadsheetFooter />
      </BroadsheetLayout>
    );
  }

  const indexableProducts = collection.products.filter((product) =>
    isSeoSafeProductHandle(product.handle)
  );
  const finderProducts: PartFinderProduct[] = indexableProducts.map((product) => ({
    id: product.id,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    productType: product.productType,
    description: product.description,
    tags: product.tags,
    featuredImage: product.featuredImage,
    price: product.priceRange.minVariantPrice.amount,
    currencyCode: product.priceRange.minVariantPrice.currencyCode,
    skus: (product.variants || []).map((variant) => variant.sku || '').filter(Boolean),
  }));
  const quoteOnly = isQuoteCollection(collection.handle);
  const subcategoryGroups = groupProductsBySubcategory(indexableProducts);
  const canonicalUrl = `https://www.rogerwilcoaviation.com/collections/${encodeURIComponent(collection.handle)}`;
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${canonicalUrl}#itemlist`,
    name: collection.title,
    description: truncateMeta(collection.description || collection.title, 500),
    url: canonicalUrl,
    numberOfItems: indexableProducts.length,
    itemListElement: indexableProducts.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://www.rogerwilcoaviation.com/products/${encodeURIComponent(product.handle)}`,
      name: product.title,
    })),
  };

  return (
    <BroadsheetLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref={`/collections/${collection.handle}`} />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Collection &middot; {indexableProducts.length} items</p>
          <p className="bs-script-accent">&mdash; browse live inventory &mdash;</p>
          <h1 className="bs-headline bs-headline--hero">{collection.title}</h1>
          <p className="bs-subhead">
            {collection.description || 'Live product listing from the Shopify Storefront API.'}
          </p>
          <p className="bs-byline">RWAS Avionics Desk &middot; Yankton, SD &middot; KYKN</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/collections" className="bs-cta-secondary">Back to collections</Link>
            <Link
              href={quoteOnly ? '/shop-capabilities' : '/cart'}
              className="bs-cta-primary"
            >
              {quoteOnly ? 'Request a quote' : 'Open cart'}
            </Link>
          </div>
        </section>

        {finderProducts.length ? (
          <Specimen variant="flat">
            <PartFinder products={finderProducts} scopeLabel={collection.title} />
          </Specimen>
        ) : null}

        {collection.handle === 'papa-alpha-tools' && (
          <Specimen variant="flat">
            <p className="bs-kicker">Worldwide delivery</p>
            <p className="bs-script-accent">&mdash; from Yankton to wherever you fly &mdash;</p>
            <h2 className="bs-headline" style={{ marginTop: 6, marginBottom: 12 }}>
              We sell internationally all over the world.
            </h2>
            <p className="bs-body">
              Crafted with CAD, CNC routing, and fiber laser cutting of aircraft-grade aluminum,
              powder coated, and UV printed for reduced weight, durability, and precision.
            </p>
            <p className="bs-byline" style={{ marginTop: 16, fontStyle: 'italic' }}>
              Made by professional mechanics for professional mechanics.
            </p>
          </Specimen>
        )}

        <Specimen variant="flat">
          <div style={{ marginBottom: 20 }}>
            <p className="bs-kicker">Products</p>
            <p className="bs-body" style={{ marginTop: 4 }}>
              {quoteOnly
                ? 'These are install-only or quote-driven items. Use the request-quote CTA to start the conversation.'
                : 'These products are browsable directly from live Shopify data.'}
            </p>
          </div>

          {indexableProducts.length ? (
            <div style={{ display: 'grid', gap: 32 }}>
              {subcategoryGroups.map(([subcategory, products], index) => {
                const sectionId = `subcategory-${subcategory.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                const defaultOpen = subcategoryGroups.length <= 3 || index < 2;
                const productGrid = (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        collectionHandle={collection.handle}
                      />
                    ))}
                  </div>
                );

                if (subcategoryGroups.length <= 1) {
                  return (
                    <section key={subcategory} aria-labelledby={sectionId}>
                      {productGrid}
                    </section>
                  );
                }

                return (
                  <details
                    key={subcategory}
                    open={defaultOpen}
                    className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4 shadow-sm"
                  >
                    <summary className="cursor-pointer list-none rounded-[1rem] px-2 py-1 transition hover:bg-[#f5f3ef]">
                      <span className="flex flex-wrap items-baseline justify-between gap-3">
                        <span>
                          <span className="bs-kicker block">Subcategory &middot; {products.length} item{products.length === 1 ? '' : 's'}</span>
                          <span
                            id={sectionId}
                            className="bs-headline block"
                            style={{ marginTop: 4, marginBottom: 0 }}
                          >
                            {subcategory}
                          </span>
                        </span>
                        <span className="text-sm font-semibold uppercase tracking-[0.22em] text-black/50">
                          Tap to open / close
                        </span>
                      </span>
                    </summary>
                    <div className="mt-5">
                      {productGrid}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <p className="bs-body">No products in this collection yet.</p>
          )}
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
