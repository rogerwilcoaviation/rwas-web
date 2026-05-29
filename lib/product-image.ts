/**
 * Shared product image URL resolver — used by the product page, collection
 * grid cards, and any other component rendering a Shopify product image.
 *
 * Two problems this solves:
 *
 *   1. Shopify's "Picture may not be exact representation" placeholders are
 *      served as multi-megabyte SVGs (Picturemaynot_2.svg = 5 MB,
 *      Picturemaynot_6.svg = 2.2 MB, Picturemaynot_7.svg = 430 KB). They are
 *      real vector + base64 content and cannot be resized via Shopify CDN
 *      query params. Substitute a 970-byte local placeholder for any image
 *      whose URL matches the bloat-placeholder pattern.
 *
 *   2. Real Shopify CDN images (cdn.shopify.com) accept `?width=N` for
 *      server-side resize. When the client also sends `Accept: image/webp`,
 *      Shopify auto-serves WebP. Adding `?width=N` cuts a typical hero from
 *      330KB to 47KB (-86%) and thumbnails to ~4KB (-99%).
 *
 * Pass the intended *displayed* width in CSS pixels. Shopify returns at the
 * requested width regardless of device DPR; for retina/HiDPI we pass a value
 * slightly larger than the displayed CSS width (e.g. width=800 for a card
 * that displays at ~360px).
 */
export function isShopifyPlaceholderImage(
  url: string | null | undefined,
  altText?: string | null
): boolean {
  const haystack = `${url || ''} ${altText || ''}`;
  return (
    /picture[_-]?may[_-]?not/i.test(haystack) ||
    /garmin-no-product-image-available/i.test(haystack) ||
    /no product image available/i.test(haystack) ||
    /no-product-image/i.test(haystack) ||
    /product image placeholder/i.test(haystack)
  );
}

export function productImageUrl(
  url: string | null | undefined,
  width: number,
  altText?: string | null
): string {
  if (!url) return '/static/no-image.svg';
  if (isShopifyPlaceholderImage(url, altText)) {
    return '/static/no-image.svg';
  }
  if (/cdn\.shopify\.com/.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}width=${width}`;
  }
  return url;
}

export function productImageAlt(
  url: string | null | undefined,
  altText: string | null | undefined,
  fallback: string
): string {
  if (altText && !isShopifyPlaceholderImage(url, altText)) return altText;
  return fallback;
}
