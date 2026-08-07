import CollectionCard from '@/components/shopify/CollectionCard';
import PartFinder, {
  type PartFinderProduct,
} from '@/components/shopify/PartFinder';
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
import { genPageMetadata } from '@/app/seo';

export const metadata = genPageMetadata({
  title: 'Aviation Parts, Garmin Avionics & Piper Tools | RWAS',
  description:
    'Browse RWAS certified and experimental avionics, pilot gear, Garmin watches and accessories, dealer-install items, service parts, and Papa-Alpha tools.',
  canonical: 'https://www.rogerwilcoaviation.com/collections',
});

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
    href: '/services/gfc-500-autopilot-installation',
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
      skus: product.variants
        .map((variant) => variant.sku || '')
        .filter(Boolean),
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
        <Specimen variant="flat">
          <div className="border-l-4 border-black pl-5">
            <p className="bs-kicker">Plan a Garmin AXIS panel</p>
            <h2 className="bs-headline" style={{ marginTop: 4 }}>
              AXIS Build-A-System Planner
            </h2>
            <p className="bs-body" style={{ marginTop: 8, maxWidth: 820 }}>
              Follow Garmin&rsquo;s certified or experimental build sequence,
              choose hardware, see the running retail total, and submit the
              system to RWAS for compatibility review and special pricing.
            </p>
            <div
              style={{
                width: '100%',
                maxWidth: 900,
                aspectRatio: '16 / 9',
                marginTop: 18,
                overflow: 'hidden',
                border: '1px solid #111318',
                background: '#000',
              }}
            >
              <iframe
                src="https://www.youtube.com/embed/FDOAZaxjL-I?si=2Hn1VYL0ROfB3OqX"
                title="Garmin AXIS Build-A-System video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                loading="lazy"
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <div
              style={{
                marginTop: 18,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/axis-system-planner/certified"
                className="bs-cta-primary"
              >
                AXIS System for Certified
              </Link>
              <Link
                href="/axis-system-planner/experimental"
                className="bs-cta-secondary"
              >
                AXIS System for Experimental
              </Link>
            </div>
          </div>
        </Specimen>

        <Specimen variant="flat">
          <div style={{ marginBottom: 20 }}>
            <p className="bs-kicker">Featured collections</p>
            <p className="bs-body" style={{ marginTop: 4 }}>
              Each card links into a live collection page with current prices,
              availability, and inventory.
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
              <h2 className="bs-headline" style={{ marginTop: 4 }}>
                Collections could not load
              </h2>
              <p className="bs-body" style={{ marginTop: 8 }}>
                Collection data did not return just now. Try again shortly, or
                reach out and we can pull a part by number.
              </p>
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Link href="/shop-capabilities" className="bs-cta-primary">
                  Shop capabilities
                </Link>
                <Link href="/about" className="bs-cta-secondary">
                  Contact RWAS
                </Link>
              </div>
            </div>
          )}
        </Specimen>

        <section className="hero-headline-group">
          <p className="bs-kicker">Live collections</p>
          <h1 className="bs-headline bs-headline--hero">
            Browse every RWAS collection in one place.
          </h1>
          <p className="bs-subhead">
            Certified retail and experimental avionics, pilot gear, Garmin
            watches and accessories, dealer-install hardware, service parts, and
            Papa-Alpha tools &mdash; all live with real product data behind
            them.
          </p>
          <p className="bs-byline">RWAS Avionics Desk &middot; KYKN, Yankton</p>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/collections/avionics-certified"
              className="bs-cta-primary"
            >
              Certified &amp; experimental avionics
            </Link>
            <Link
              href="/collections/papa-alpha-tools"
              className="bs-cta-secondary"
            >
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
            <h2 className="bs-headline" style={{ marginTop: 4 }}>
              Products pilots search first
            </h2>
            <p className="bs-body" style={{ marginTop: 8 }}>
              Direct links to high-intent Papa-Alpha and Garmin pages, so buyers
              and crawlers can reach core products without using the part
              finder.
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
                  <span className="bs-body block" style={{ marginTop: 6 }}>
                    {item.text}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Specimen>

        {finderProducts.length ? (
          <Specimen variant="flat">
            <PartFinder products={finderProducts} scopeLabel="RWAS catalog" />
            <div className="mt-5">
              <Link href="/product-index" className="bs-cta-secondary">
                Browse the complete product index
              </Link>
            </div>
          </Specimen>
        ) : null}
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
