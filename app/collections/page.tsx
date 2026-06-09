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
    'Browse RWAS certified avionics, experimental avionics, pilot gear, Garmin install items, Papa-Alpha tools, service parts, and sale inventory.',
};

const POPULAR_PRODUCT_LINKS = [
  {
    href: '/products/rigging-kit',
    label: 'Papa-Alpha Rigging Kit',
    text: 'KT-01 through KT-23 kit selector and kit contents.',
  },
  {
    href: '/products/rudder-rigging-tool',
    label: 'Rudder Rigging Tool',
    text: 'Papa-Alpha rudder reference tools by Piper model.',
  },
  {
    href: '/products/stabilator-rigging-tool',
    label: 'Stabilator Rigging Tool',
    text: 'Piper stabilator rigging fixtures and applicability.',
  },
  {
    href: '/products/bell-crank-rigging-tool',
    label: 'Bell Crank Rigging Tool',
    text: 'Bell-crank reference tools for supported PA-series aircraft.',
  },
  {
    href: '/products/pa-28-32-34-44-aileron-and-flap-rigging-tool-1',
    label: 'Aileron and Flap Rigging Tool',
    text: 'Aileron/flap rigging reference for PA-28/32/34/44 airframes.',
  },
  {
    href: '/products/garmin-gfc-500-digital-autopilot',
    label: 'Garmin GFC 500 Autopilot',
    text: 'Autopilot hardware context before installation planning.',
  },
  {
    href: '/products/garmin-g5-primary-electronic-attitude-display-stcd-for-certified-aircraft-with-lpm',
    label: 'Garmin G5 Attitude Display',
    text: 'Certified G5 display context for panel upgrade scoping.',
  },
  {
    href: '/products/garmin-g5-dg-hsi-stcd-for-certified-aircraft-with-lpm',
    label: 'Garmin G5 DG / HSI',
    text: 'Certified G5 HSI/DG option for Garmin panel planning.',
  },
] as const;

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
          <p className="bs-byline">RWAS Avionics Desk &middot; Hangar 3 &middot; Sioux Falls, SD</p>
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

        <Specimen variant="flat">
          <div style={{ marginBottom: 20 }}>
            <p className="bs-kicker">Popular starting points</p>
            <h2 className="bs-headline" style={{ marginTop: 4 }}>Products pilots search first</h2>
            <p className="bs-body" style={{ marginTop: 8 }}>
              Direct links to high-intent Papa-Alpha and Garmin pages, so buyers and crawlers can reach core products without using the part finder.
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {POPULAR_PRODUCT_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block h-full border-l-4 border-black bg-white px-4 py-3 text-black transition hover:bg-neutral-100"
                >
                  <span className="bs-kicker block">{item.label}</span>
                  <span className="bs-body block" style={{ marginTop: 6 }}>{item.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Specimen>

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
