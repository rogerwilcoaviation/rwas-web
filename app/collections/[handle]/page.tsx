import ProductCard from '@/components/shopify/ProductCard';
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
import { getCollectionByHandle, getFeaturedCollections, isQuoteCollection } from '@/lib/shopify';
import Link from 'next/link';

const FALLBACK_COLLECTION_HANDLES = [
  'on-sale',
  'garmin-avionics-certified-retail',
  'garmin-avionics-accessories',
  'retail-experimental',
  'rigging-tools',
];

export async function generateStaticParams() {
  try {
    const collections = await getFeaturedCollections();
    return collections.map((collection) => ({ handle: collection.handle }));
  } catch {
    return FALLBACK_COLLECTION_HANDLES.map((handle) => ({ handle }));
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  try {
    const collection = await getCollectionByHandle(handle);

    if (!collection) {
      return { title: 'Collection not found' };
    }

    return {
      title: `${collection.title} | RWAS Collections`,
      description: collection.description || `Browse ${collection.title} at Roger Wilco Aviation Services.`,
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

  const quoteOnly = isQuoteCollection(collection.handle);

  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref={`/collections/${collection.handle}`} />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Collection &middot; {collection.products.length} items</p>
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

        <Specimen variant="flat">
          <div style={{ marginBottom: 20 }}>
            <p className="bs-kicker">Products</p>
            <p className="bs-body" style={{ marginTop: 4 }}>
              {quoteOnly
                ? 'These are install-only or quote-driven items. Use the request-quote CTA to start the conversation.'
                : 'These products are browsable directly from live Shopify data.'}
            </p>
          </div>

          {collection.products.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {collection.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  collectionHandle={collection.handle}
                />
              ))}
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
