import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import ProductVariantSelector from '@/components/shopify/ProductVariantSelector';
import { Button } from '@/components/shared/ui/button';
import { getProductByHandle, getProductHandles } from '@/lib/shopify';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export async function generateStaticParams() {
  const handles = await getProductHandles(120);
  return handles.map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) return { title: 'Product not found' };

  return {
    title: `${product.title} | RWAS Products`,
    description: product.description || `View ${product.title} from Roger Wilco Aviation Services.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) notFound();

  const primaryPrice = product.variants[0]?.price;

  return (
    <>
      <Header />
      <main className="bg-[#f5f3ef] pt-28 text-[#111111]">
        <section className="border-b border-black/10">
          <div className="container-wide px-6 py-16 lg:px-10 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-primary-700">
                    Product detail
                  </p>
                  <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                    {product.title}
                  </h1>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-black/60">
                    {product.vendor ? <span>Vendor: {product.vendor}</span> : null}
                    {product.productType ? <span>Type: {product.productType}</span> : null}
                    {primaryPrice ? (
                      <span>
                        From {formatPrice(primaryPrice.amount, primaryPrice.currencyCode)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {product.images.map((image, index) => (
                    <div
                      key={`${image.url}-${index}`}
                      className={`relative overflow-hidden rounded-[1.5rem] border border-black/10 bg-white ${index === 0 ? 'sm:col-span-2' : ''}`}
                    >
                      <div className={`${index === 0 ? 'aspect-[16/10]' : 'aspect-square'} relative`}>
                        <Image
                          src={image.url}
                          alt={image.altText || product.title}
                          fill
                          className="object-contain p-6"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-bold">Description</h2>
                  <p className="mt-4 whitespace-pre-line leading-8 text-black/70">
                    {product.description || 'No description provided.'}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-bold">Options & specs</h2>
                  <div className="mt-4 space-y-4">
                    {product.options.map((option) => (
                      <div key={option.name}>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">
                          {option.name}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-black/65">
                          {option.values.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <ProductVariantSelector product={product} />

                <div className="flex flex-wrap gap-4">
                  <Button asChild variant="outlinePrimary" className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10">
                    <Link href="/collections">Back to collections</Link>
                  </Button>
                  <Button asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
                    <Link href="/cart">View cart</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
