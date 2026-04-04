import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/shared/ui/button';
import { getFeaturedProducts } from '@/lib/shopify';
import { ArrowRight, Gauge, Radar, ShieldCheck, Wrench } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import JerryHero from '@/app/components/JerryHero';

const serviceCards = [
  {
    title: 'Garmin avionics sales & integration',
    description:
      'Certified and experimental Garmin products, practical upgrade guidance, and support that starts with the mission instead of the brochure.',
    icon: Gauge,
  },
  {
    title: 'Nondestructive testing',
    description:
      'Clean, professional NDT support for aircraft operators who need real answers and a shop that respects downtime.',
    icon: Radar,
  },
  {
    title: 'Fabrication & problem solving',
    description:
      'From panel work to custom shop solutions, RWAS is built around making useful things work in the real world.',
    icon: Wrench,
  },
];

const trustPoints = [
  'Real aviation shop voice instead of generic marketing fluff',
  'Headless storefront foundation connected to the live Shopify catalog',
  'Built to support products, quote-driven installs, and future chatbot workflows',
];

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default async function Page() {
  const products = await getFeaturedProducts(4);

  return (
    <>
      <Header className="mb-4" />

      <main className="bg-[#f5f3ef] text-[#111111]">
        <section className="relative overflow-hidden border-b border-black/10 pt-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,154,42,0.22),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(17,17,17,0.08),transparent_28%)]" />
          <div className="container-wide relative grid gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-24">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-700">
                <ShieldCheck className="h-4 w-4" />
                Phase 1 homepage build — Shopify-connected foundation
              </div>

              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-[#111111] sm:text-6xl lg:text-7xl">
                Aircraft support that looks sharp, sells cleanly, and actually makes sense.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-black/75 sm:text-xl">
                Roger Wilco Aviation Services combines Garmin avionics expertise,
                shop capability, and a real product catalog into a faster, cleaner
                web experience built for pilots, owners, and operators.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button size="xl" asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                  <Link href="https://rogerwilcoaviation.com/collections/all">
                    Browse the catalog <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="xl"
                  variant="outlinePrimary"
                  asChild
                  className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10"
                >
                  <Link href="https://rogerwilcoaviation.com/pages/contact">
                    Talk to the shop
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm leading-6 text-black/75 shadow-sm"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            {/* Captain Jerry hero widget */}
            <JerryHero />
          </div>
        </section>

        <section id="services" className="container-wide px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
              Core capabilities
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">
              Built for aviation work, not template theater.
            </h2>
            <p className="mt-4 text-lg leading-8 text-black/70">
              This first pass positions RWAS around the three things that matter:
              avionics capability, technical credibility, and a storefront that can
              support both products and quote-driven projects.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {serviceCards.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/15 text-primary-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-2xl font-bold">{title}</h3>
                <p className="mt-4 text-base leading-7 text-black/70">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="featured-products" className="border-y border-black/10 bg-white/70">
          <div className="container-wide px-6 py-20 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
                  Live from Shopify
                </p>
                <h2 className="mt-4 text-4xl font-black tracking-tight">
                  Featured products pulled from the Storefront API.
                </h2>
                <p className="mt-4 text-lg leading-8 text-black/70">
                  The homepage is already talking to the live Shopify catalog, so this
                  rebuild starts with real inventory instead of fake brochure data.
                </p>
              </div>

              <Button asChild size="xl" className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                <Link href="https://rogerwilcoaviation.com/collections/all">
                  View full catalog
                </Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`https://rogerwilcoaviation.com/products/${product.handle}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-[#f5f3ef]">
                    {product.featuredImage ? (
                      <Image
                        src={product.featuredImage.url}
                        alt={product.featuredImage.altText || product.title}
                        fill
                        className="object-contain p-6 transition duration-300 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">
                      Shopify product
                    </p>
                    <h3 className="line-clamp-3 text-xl font-bold leading-snug text-[#111111]">
                      {product.title}
                    </h3>
                    <p className="text-sm text-black/60">
                      From{' '}
                      {formatPrice(
                        product.priceRange.minVariantPrice.amount,
                        product.priceRange.minVariantPrice.currencyCode
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="why-rwas" className="container-wide grid gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div className="rounded-[2rem] border border-black/10 bg-[#111111] p-8 text-[#f5f3ef] shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-500/80">
              Why this matters
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
              A better front door for the same real shop.
            </h2>
            <p className="mt-4 text-base leading-8 text-white/75">
              The old site proved the business. This new build gives it room to breathe:
              proper marketing pages, product browsing, quote flows, and eventually a
              Jerry-backed chatbot without forcing everything through Liquid templates.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                title: 'Headless foundation',
                body: 'Next.js gives RWAS full control over the homepage, service pages, product storytelling, and future quote capture flows.',
              },
              {
                title: 'Shopify retained for commerce',
                body: 'Catalog, inventory, checkout, and products stay in Shopify where they belong. The frontend simply stops looking like a hostage negotiation.',
              },
              {
                title: 'Brand-first UI',
                body: 'Tailwind is now keyed to RWAS black, gold, and warm off-white so the site feels like an aviation brand instead of a recycled fintech starter.',
              },
              {
                title: 'Built for Phase 2',
                body: 'This codebase is ready for collection pages, service detail pages, a real contact flow, and Cloudflare deployment once you want to keep pushing.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-[#111111]">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-black/70">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="border-t border-black/10 bg-[#111111]">
          <div className="container-wide flex flex-col gap-8 px-6 py-20 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-2xl text-[#f5f3ef]">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-500/80">
                Next move
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
                The homepage is live in code. Now we can keep building the real thing.
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/75">
                Phase 1 now has a rebranded homepage, live Shopify product pull, and a clean base repo for the rest of RWDEV.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button size="xl" asChild className="bg-[#C49A2A] text-[#111111] hover:bg-[#d8b55a]">
                <Link href="https://rogerwilcoaviation.com/pages/contact">
                  Contact RWAS
                </Link>
              </Button>
              <Button size="xl" variant="outlinePrimary" asChild className="border-[#C49A2A] text-[#f5f3ef] hover:bg-white/10">
                <Link href="https://github.com/rogerwilcoaviation/rwas-web">
                  View repo
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer className="mt-0" />
    </>
  );
}
