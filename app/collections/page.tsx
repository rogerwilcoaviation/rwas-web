import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import CollectionCard from '@/components/shopify/CollectionCard';
import { Button } from '@/components/shared/ui/button';
import { getFeaturedCollections } from '@/lib/shopify';
import Link from 'next/link';

export const metadata = {
  title: 'RWAS Collections',
  description: 'Browse Garmin avionics, Papa-Alpha tools, and RWAS sale collections.',
};

export default async function CollectionsPage() {
  let collections: Awaited<ReturnType<typeof getFeaturedCollections>> = [];

  try {
    collections = await getFeaturedCollections();
  } catch {
    collections = [];
  }

  return (
    <>
      <Header />
      <main className="bg-[#f5f3ef] pt-28 text-[#111111]">
        <section className="border-b border-black/10">
          <div className="container-wide px-6 py-16 lg:px-10 lg:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
              Live collections
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-tight sm:text-6xl">
              Browse RWAS collections pulled directly from Shopify.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-black/70">
              Garmin certified and experimental avionics, accessories, Papa-Alpha tools, and sale inventory all live here with real product data behind them.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                <Link href="/collections/garmin-avionics">Start with Garmin</Link>
              </Button>
              <Button asChild variant="outlinePrimary" className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10">
                <Link href="/collections/rigging-tools">See Papa-Alpha tools</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container-wide px-6 py-16 lg:px-10">
          {collections.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold">Collections temporarily unavailable</h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-black/70">
                Shopify collection data could not be loaded right now. Please try again shortly or contact us if you need help finding a product.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                  <Link href="/contact">Contact us</Link>
                </Button>
                <Button asChild variant="outlinePrimary" className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10">
                  <Link href="/shop-capabilities">Shop capabilities</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
