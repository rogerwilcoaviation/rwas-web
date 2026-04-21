import { Button } from '@/components/shared/ui/button';
import { ShopifyCollectionProduct, isQuoteCollection } from '@/lib/shopify';
import Image from 'next/image';
import Link from 'next/link';

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default function ProductCard({
  product,
  collectionHandle,
}: {
  product: ShopifyCollectionProduct;
  collectionHandle: string;
}) {
  const quoteOnly = isQuoteCollection(collectionHandle);
  const price = formatPrice(
    product.priceRange.minVariantPrice.amount,
    product.priceRange.minVariantPrice.currencyCode
  );
  const productUrl = `/products/${encodeURIComponent(product.handle)}`;
  const quoteUrl = `https://www.rogerwilcoaviation.com/pages/contact?product=${encodeURIComponent(product.title)}`;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={productUrl} className="group block">
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
      </Link>
      <div className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">
            {quoteOnly ? 'Quote-request item' : 'Shopify product'}
          </p>
          <h3 className="mt-2 line-clamp-3 text-xl font-bold leading-snug text-[#111111]">
            {product.title}
          </h3>
          <p className="mt-3 text-sm text-black/60">From {price}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-[#111111] text-[#f5f3ef] hover:bg-black">
            <Link href={productUrl}>View product</Link>
          </Button>
          <Button
            asChild
            variant="outlinePrimary"
            className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10"
          >
            <Link href={quoteOnly ? quoteUrl : productUrl}>
              {quoteOnly ? 'Request quote' : 'Add to cart'}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
