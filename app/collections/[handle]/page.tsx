import type { Metadata } from 'next';
import CollectionProductBrowser from '@/components/shopify/CollectionProductBrowser';
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
import { serviceLinksForCollection } from '@/lib/service-links';

const FALLBACK_COLLECTION_HANDLES = [
  'avionics-certified',
  'avionics-experimental',
  'pilot-gear',
  'watches-accessories',
  'garmin-dealer-install',
  'on-sale',
  'papa-alpha-tools',
];

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
  const relatedServiceLinks = serviceLinksForCollection(collection.handle, collection.title);
  const canonicalUrl = `https://www.rogerwilcoaviation.com/collections/${encodeURIComponent(collection.handle)}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.rogerwilcoaviation.com/' },
      { '@type': 'ListItem', position: 2, name: 'Collections', item: 'https://www.rogerwilcoaviation.com/collections' },
      { '@type': 'ListItem', position: 3, name: collection.title, item: canonicalUrl },
    ],
  };
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
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
          <p className="bs-byline">RWAS Avionics Desk &middot; Hangar 3 &middot; Sioux Falls, SD</p>
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
            <p className="bs-script-accent">&mdash; from Sioux Falls to wherever you fly &mdash;</p>
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

        {relatedServiceLinks.length ? (
          <Specimen variant="flat" as="section">
            <p className="bs-kicker">Shop-supported services</p>
            <h2 className="bs-headline" style={{ marginTop: 6, marginBottom: 12 }}>
              Need the work behind the part?
            </h2>
            <ul className="bs-svc-list">
              {relatedServiceLinks.map((service) => (
                <li key={service.href} className="bs-svc">
                  <p className="bs-svc-name">
                    <Link href={service.href}>{service.label}</Link>
                  </p>
                  <p className="bs-svc-desc">{service.description}</p>
                </li>
              ))}
            </ul>
          </Specimen>
        ) : null}

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
            <CollectionProductBrowser
              products={indexableProducts}
              collectionTitle={collection.title}
              collectionHandle={collection.handle}
              quoteOnly={quoteOnly}
            />
          ) : (
            <p className="bs-body">No products in this collection yet.</p>
          )}
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
