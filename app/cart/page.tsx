import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import CartClient from '@/components/shopify/CartClient';

export const metadata = {
  title: 'RWAS Cart',
  description: 'Review your RWAS Shopify cart and continue to checkout.',
};

export default function CartPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f5f3ef] pt-28 text-[#111111]">
        <section className="border-b border-black/10">
          <div className="container-wide px-6 py-16 lg:px-10 lg:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
              Cart
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
              Review your selected products.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-black/70">
              This lightweight cart uses Shopify&apos;s cart API and hands off cleanly to Shopify checkout.
            </p>
          </div>
        </section>

        <section className="container-wide px-6 py-16 lg:px-10">
          <CartClient />
        </section>
      </main>
      <Footer />
    </>
  );
}
