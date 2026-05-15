import CollectionCard from '@/components/shopify/CollectionCard';
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
import { getFeaturedCollections, getPartFinderProducts } from '@/lib/shopify';
import Link from 'next/link';

export const metadata = {
  title: 'RWAS Collections',
  description:
    'Browse RWAS Garmin collections by buyer type: certified avionics, experimental avionics, pilot gear, lifestyle Garmin, service parts, Papa-Alpha tools, and sale inventory.',
};

export default async function CollectionsPage() {
  let collections: Awaited<ReturnType<typeof getFeaturedCollections>> = [];
  let finderProducts: PartFinderProduct[] = [];

  try {
    collections = await getFeaturedCollections();
  } catch {
    collections = [];
  }

  try {
    const products = await getPartFinderProducts();
    finderProducts = products.map((product) => ({
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
      skus: product.variants.map((variant) => variant.sku || '').filter(Boolean),
    }));
  } catch {
    finderProducts = [];
  }

  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Live collections</p>
          <p className="bs-script-accent">&mdash; pulled straight from Shopify &mdash;</p>
          <h1 className="bs-headline bs-headline--hero">Browse every RWAS collection in one place.</h1>
          <p className="bs-subhead">
            Certified and experimental avionics, pilot gear, lifestyle Garmin, service parts, Papa-Alpha tools, and sale inventory &mdash; all live with real product data behind them.
          </p>
          <p className="bs-byline">RWAS Avionics Desk &middot; Yankton, SD &middot; KYKN</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/collections/avionics-certified" className="bs-cta-primary">
              Start with certified retail
            </Link>
            <Link href="/collections/papa-alpha-tools" className="bs-cta-secondary">
              See Papa-Alpha tools
            </Link>
            <Link href="/aircraft-for-sale" className="bs-cta-secondary">
              Aircraft 4 Sale
            </Link>
          </div>
        </section>

        {finderProducts.length ? (
          <Specimen variant="flat">
            <PartFinder products={finderProducts} scopeLabel="RWAS catalog" />
          </Specimen>
        ) : null}

        <Specimen variant="flat">
          <div style={{ marginBottom: 20 }}>
            <p className="bs-kicker">Featured collections</p>
            <p className="bs-body" style={{ marginTop: 4 }}>
              Each card links into a live collection page. Prices, availability, and inventory mirror Shopify.
            </p>
          </div>

          {collections.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          ) : (
            <div>
              <p className="bs-kicker">Temporarily unavailable</p>
              <h2 className="bs-headline" style={{ marginTop: 4 }}>Collections could not load</h2>
              <p className="bs-body" style={{ marginTop: 8 }}>
                Shopify collection data did not return just now. Try again shortly, or reach out and we can pull a part by number.
              </p>
              <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/shop-capabilities" className="bs-cta-primary">Shop capabilities</Link>
                <Link href="/about" className="bs-cta-secondary">Contact RWAS</Link>
              </div>
            </div>
          )}
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
