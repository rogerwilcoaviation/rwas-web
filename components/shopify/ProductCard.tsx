import { Button } from '@/components/shared/ui/button';
import {
  ShopifyCollectionProduct,
  isOtcCollection,
  isOtcEligible,
  isQuoteCollection,
} from '@/lib/shopify';
import Image from 'next/image';
import {
  isShopifyPlaceholderImage,
  productImageAlt,
  productImageUrl,
} from '@/lib/product-image';
import Link from 'next/link';

function formatPrice(amount: string, currencyCode: string) {
  const numericAmount = Number(amount);
  const hasCents = Math.round(numericAmount * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export default function ProductCard({
  product,
  collectionHandle,
}: {
  product: ShopifyCollectionProduct;
  collectionHandle: string;
}) {
  const quoteOnly = isQuoteCollection(collectionHandle);
  // Collection grids NEVER show Add-to-cart per product direction
  // (2026-04-21 PM). The buy button lives only on the PDP, where the gate
  // in app/products/[handle]/page.tsx still consults isOtcCollection /
  // isOtcEligible. Keeping the imports here so re-enabling on the grid is
  // a one-line change if the policy reverses.
  void isOtcCollection;
  void isOtcEligible;
  const otcEligible = false;
  const dealerOnly =
    quoteOnly ||
    product.tags?.some((tag) => tag.toLowerCase() === 'garmin-dealer-only') ||
    Number(product.priceRange.minVariantPrice.amount) === 0;
  const price = dealerOnly
    ? null
    : formatPrice(
        product.priceRange.minVariantPrice.amount,
        product.priceRange.minVariantPrice.currencyCode,
      );
  const productUrl = `/products/${encodeURIComponent(product.handle)}`;
  const quoteUrl = `/contact?reason=quote&product=${encodeURIComponent(
    product.title,
  )}`;

  const addToCartHref = null;

  // Secondary CTA: collection grid cards intentionally show NO secondary
  // button. Quote-only (`garmin-avionics`, the Dealer-Only collection) used
  // to surface a 'Request quote' button — removed per user direction
  // 2026-04-21 PM ("Remove 'request a quote' from the front facing page").
  // Add-to-cart remains gated off site-wide via the hardcoded
  // `otcEligible = false` above. Dealer-install products still get a direct
  // package-pricing contact path instead of a dead-end product card.
  let secondaryCta: { label: string; href: string } | null = null;
  if (dealerOnly) {
    secondaryCta = { label: 'Contact us for package pricing', href: quoteUrl };
  }
  if (addToCartHref) {
    secondaryCta = { label: 'Add to cart', href: addToCartHref };
  }

  const badgeLabel = quoteOnly
    ? 'Quote-request item'
    : otcEligible
      ? 'In stock \u00b7 OTC'
      : null;
  const displayImage =
    product.images?.find(
      (image) => !isShopifyPlaceholderImage(image.url, image.altText),
    ) ??
    product.variants
      ?.map((variant) => variant.image)
      .find(
        (image) =>
          image?.url && !isShopifyPlaceholderImage(image.url, image.altText),
      ) ??
    product.featuredImage;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={productUrl} className="group block">
        <div className="relative aspect-[4/3] bg-[#f5f3ef]">
          {displayImage ? (
            <Image
              src={productImageUrl(
                displayImage.url,
                600,
                displayImage.altText || product.title,
                product.handle,
              )}
              alt={productImageAlt(
                displayImage.url,
                displayImage.altText,
                product.title,
              )}
              fill
              className="object-contain p-6 transition duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
              unoptimized
            />
          ) : null}
        </div>
      </Link>
      <div className="space-y-4 p-6">
        <div>
          {badgeLabel ? (
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-900">
              {badgeLabel}
            </p>
          ) : null}
          <h3
            className={`${badgeLabel ? 'mt-2 ' : ''}line-clamp-3 text-xl font-bold leading-snug text-[#111111]`}
          >
            {product.title}
          </h3>
          {price ? (
            <p className="mt-3 text-sm text-black/60">From {price}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-[#111111] text-[#f5f3ef] hover:bg-black"
          >
            <Link href={productUrl}>View product</Link>
          </Button>
          {secondaryCta ? (
            <Button
              asChild
              variant="outlinePrimary"
              className="border-[#C49A2A] text-[#111111] hover:bg-[#C49A2A]/10"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
