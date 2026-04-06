import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import ProductCard from '@/components/shopify/ProductCard';
import { Button } from '@/components/shared/ui/button';
import { getCollectionByHandle, getFeaturedCollections, isQuoteCollection } from '@/lib/shopify';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  try {
    const collections = await getFeaturedCollections();
    return collections.map((collection) => ({ handle: collection.handle }));
  } catch {
    return [];
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
  const collection = await getCollectionByHandle(handle);

  if (!collection) notFound();

  const quoteOnly = isQuoteCollection(collection.handle);

  return (
    <>
      <Header />
      <main className="bg-[#f5f3ef] pt-28 text-[#111111]">
        <section className="border-b border-black/10">
          <div className="container-wide px-6 py-16 lg:px-10 lg:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
              Collection
            </p>
            <h1 className="mt-4 max-w-5xl text-5xl font-black tracking-tight sm:text-6xl">
              {collection.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-black/70">
              {collection.description || 'Live product listing from the Shopify Storefront API.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                <Link href="/collections">Back to collections</Link>
              </Button>
              <Button asChild variant="outlinePrimary" className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10">
                <Link href={quoteOnly ? 'https://rogerwilcoaviation.com/pages/contact' : 'https://rogerwilcoaviation.com/cart'}>
                  {quoteOnly ? 'Request a quote' : 'Open cart'}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container-wide px-6 py-16 lg:px-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Products</h2>
              <p className="mt-2 text-black/65">
                {quoteOnly
                  ? 'These are install-only or quote-driven items. Use the request-quote CTA to start the conversation.'
                  : 'These products are browsable directly from live Shopify data.'}
              </p>
            </div>
            <p className="text-sm uppercase tracking-[0.24em] text-primary-700">
              {collection.products.length} items shown
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {collection.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                collectionHandle={collection.handle}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
