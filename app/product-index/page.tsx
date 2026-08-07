import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BroadsheetFooter,
  BroadsheetLayout,
  BroadsheetNav,
  BulletinBar,
  CredentialsBar,
  Dateline,
  Masthead,
  Specimen,
} from '@/components/shared/broadsheet';
import {
  getPartFinderProducts,
  getSeoProductHandles,
  isSeoSafeProductHandle,
} from '@/lib/shopify';

export const metadata: Metadata = {
  title: { absolute: 'Complete Aviation Product Index | RWAS' },
  description:
    'Browse the complete RWAS aviation catalog alphabetically, including avionics, pilot gear, watches, accessories, and shop tools.',
  alternates: {
    canonical: 'https://www.rogerwilcoaviation.com/product-index',
  },
};

export default async function ProductIndexPage() {
  let products: Array<{ id: string; title: string; handle: string }> = [];
  try {
    const [finderProducts, handles] = await Promise.all([
      getPartFinderProducts(),
      getSeoProductHandles(),
    ]);
    const productsByHandle = new Map(
      finderProducts.map((product) => [product.handle, product]),
    );
    products = handles.filter(isSeoSafeProductHandle).map((handle) => {
      const product = productsByHandle.get(handle);
      return {
        id: product?.id || `catalog:${handle}`,
        title:
          product?.title ||
          handle
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
        handle,
      };
    });
  } catch {
    products = [];
  }

  const sortedProducts = [...products].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/collections" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">Complete catalog</p>
          <h1 className="bs-headline bs-headline--hero">Product Index</h1>
          <p className="bs-subhead">
            Every current RWAS catalog item in one alphabetical directory. Open
            a product for pricing, availability, purchase eligibility, or
            package-pricing guidance.
          </p>
          <p className="bs-byline">
            {sortedProducts.length.toLocaleString('en-US')} products · RWAS
            Avionics Desk · KYKN, Yankton
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/collections" className="bs-cta-primary">
              Browse collections and filters
            </Link>
            <Link href="/contact?reason=quote" className="bs-cta-secondary">
              Request help finding a part
            </Link>
          </div>
        </section>

        <Specimen variant="flat">
          {sortedProducts.length ? (
            <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {sortedProducts.map((product) => (
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
          ) : (
            <p className="bs-body">
              The product index is temporarily unavailable. Browse collections
              or contact RWAS with a part number.
            </p>
          )}
        </Specimen>
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
