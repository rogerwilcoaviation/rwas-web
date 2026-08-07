import type { Metadata } from 'next';
import CollectionProductBrowser from '@/components/shopify/CollectionProductBrowser';
import PartFinder, {
  type PartFinderProduct,
} from '@/components/shopify/PartFinder';
import { PapaAlphaLaunchFrame } from '@/components/shared/PapaAlphaLaunchFrame';
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
import { redirect } from 'next/navigation';
import {
  collectionMetaDescription,
  collectionSeoTitle,
  truncateMeta,
} from '@/lib/seo';
import { serviceLinksForCollection } from '@/lib/service-links';
import { isShopifyPlaceholderImage } from '@/lib/product-image';

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

    const title =
      collection.handle === 'papa-alpha-tools'
        ? 'Shop Piper Rigging Tools — Papa-Alpha | RWAS'
        : collectionSeoTitle(collection.title);
    const description = collectionMetaDescription(collection);
    const url = `https://www.rogerwilcoaviation.com/collections/${encodeURIComponent(collection.handle)}`;
    const imageUrl =
      collection.image?.url ||
      'https://www.rogerwilcoaviation.com/og-default.jpg';
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        url,
        title,
        description,
        images: [
          {
            url: imageUrl,
            alt: collection.image?.altText || collection.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
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

  if (handle === 'avionics-experimental') {
    redirect('/collections/avionics-certified');
  }

  let collection: Awaited<ReturnType<typeof getCollectionByHandle>> = null;
  try {
    collection = await getCollectionByHandle(handle);
    if (collection && handle === 'avionics-certified') {
      const experimentalCollection = await getCollectionByHandle(
        'avionics-experimental',
      );
      if (experimentalCollection) {
        const productsByHandle = new Map(
          [...collection.products, ...experimentalCollection.products].map(
            (product) => [product.handle, product],
          ),
        );
        collection = {
          ...collection,
          products: Array.from(productsByHandle.values()),
        };
      }
    }
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
            <p className="bs-script-accent">
              &mdash; temporarily unavailable &mdash;
            </p>
            <h1 className="bs-headline bs-headline--hero">
              Collection Not Found
            </h1>
            <p className="bs-subhead">
              We could not load this collection right now. Please try again
              shortly.
            </p>
          </section>
          <Specimen variant="flat">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/collections" className="bs-cta-primary">
                Back to collections
              </Link>
              <Link href="/shop-capabilities" className="bs-cta-secondary">
                Shop capabilities
              </Link>
            </div>
          </Specimen>
        </main>
        <BroadsheetFooter />
      </BroadsheetLayout>
    );
  }

  const unsafeProducts = collection.products.filter(
    (product) => !isSeoSafeProductHandle(product.handle),
  );
  if (unsafeProducts.length) {
    throw new Error(
      `Collection ${collection.handle} contains non-ASCII Shopify handles: ${unsafeProducts
        .slice(0, 10)
        .map((product) => product.handle)
        .join(', ')}`,
    );
  }
  const indexableProducts = collection.products;
  const finderProducts: PartFinderProduct[] = indexableProducts.map(
    (product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.productType,
      skus: (product.variants || [])
        .map((variant) => variant.sku || '')
        .filter(Boolean),
    }),
  );
  const browserProducts = indexableProducts.map((product) => {
    const displayImage =
      product.images?.find(
        (image) => !isShopifyPlaceholderImage(image.url, image.altText),
      ) ??
      product.variants
        ?.map((variant) => variant.image)
        .find(
          (image) =>
            image?.url && !isShopifyPlaceholderImage(image.url, image.altText),
        ) ??
      product.featuredImage;
    const firstVariant = product.variants?.[0];
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      featuredImage: displayImage,
      variants: firstVariant
        ? [
            {
              id: firstVariant.id,
              sku: firstVariant.sku,
              availableForSale: firstVariant.availableForSale,
            },
          ]
        : [],
      priceRange: product.priceRange,
    };
  });
  const quoteOnly = isQuoteCollection(collection.handle);
  const relatedServiceLinks = serviceLinksForCollection(
    collection.handle,
    collection.title,
  );
  const canonicalUrl = `https://www.rogerwilcoaviation.com/collections/${encodeURIComponent(collection.handle)}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.rogerwilcoaviation.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Collections',
        item: 'https://www.rogerwilcoaviation.com/collections',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: collection.title,
        item: canonicalUrl,
      },
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
          <p className="bs-kicker">
            Collection &middot; {indexableProducts.length} items
          </p>
          <p className="bs-script-accent">
            &mdash; browse live inventory &mdash;
          </p>
          <h1 className="bs-headline bs-headline--hero">{collection.title}</h1>
          <p className="bs-subhead">
            {collection.description ||
              'Current products, availability, and purchase options from RWAS.'}
          </p>
          <p className="bs-byline">
            {collection.handle === 'avionics-certified'
              ? 'Certified retail · Experimental avionics · Accessories'
              : 'RWAS Avionics Desk · KYKN, Yankton'}
          </p>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/collections" className="bs-cta-secondary">
              Back to collections
            </Link>
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
            <PartFinder
              products={finderProducts}
              scopeLabel={collection.title}
            />
          </Specimen>
        ) : null}

        {collection.handle === 'papa-alpha-tools' && (
          <>
            <Specimen variant="flat">
              <p className="bs-kicker">Launch video</p>
              <p className="bs-script-accent">
                &mdash; complete Piper rigging kits &mdash;
              </p>
              <PapaAlphaLaunchFrame />
            </Specimen>

            <Specimen variant="flat">
              <p className="bs-kicker">Worldwide delivery</p>
              <p className="bs-script-accent">
                &mdash; from the RWAS shop to wherever you fly &mdash;
              </p>
              <h2
                className="bs-headline"
                style={{ marginTop: 6, marginBottom: 12 }}
              >
                We sell internationally all over the world.
              </h2>
              <p className="bs-body">
                Crafted with CAD, CNC routing, and fiber laser cutting of
                aircraft-grade aluminum, powder coated, and UV printed for
                reduced weight, durability, and precision.
              </p>
              <p
                className="bs-byline"
                style={{ marginTop: 16, fontStyle: 'italic' }}
              >
                Made by professional mechanics for professional mechanics.
              </p>
            </Specimen>
          </>
        )}

        {relatedServiceLinks.length ? (
          <Specimen variant="flat" as="section">
            <p className="bs-kicker">Shop-supported services</p>
            <h2
              className="bs-headline"
              style={{ marginTop: 6, marginBottom: 12 }}
            >
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
                : collection.handle === 'avionics-certified'
                  ? 'Choose Experimental Products, Certified Retail, or Accessories below. Current retail prices are shown; contact RWAS for package and special pricing.'
                  : 'Browse current products, availability, and purchase options below.'}
            </p>
          </div>

          {indexableProducts.length ? (
            <CollectionProductBrowser
              products={browserProducts}
              collectionTitle={collection.title}
              collectionHandle={collection.handle}
              quoteOnly={quoteOnly}
            />
          ) : (
            <p className="bs-body">No products in this collection yet.</p>
          )}

          {indexableProducts.length > 24 ? (
            <details className="mt-10 rounded-xl border border-black/15 bg-[#f8f4e8] p-5">
              <summary className="cursor-pointer font-bold text-[#111111]">
                Complete product index (
                {indexableProducts.length.toLocaleString('en-US')})
              </summary>
              <p className="bs-body mt-3">
                Browse every item in this collection alphabetically. This index
                remains usable when filtering scripts are unavailable.
              </p>
              <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[...indexableProducts]
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/products/${encodeURIComponent(product.handle)}`}
                        className="underline decoration-black/30 underline-offset-2 hover:decoration-[#C49A2A]"
                      >
                        {product.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
