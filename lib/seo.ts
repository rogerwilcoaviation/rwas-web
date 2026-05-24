export function stripHtml(input = '') {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactText(input = '') {
  return stripHtml(input)
    .replace(/Click here for Garmin's Buy\s*&\s*Save rebate form\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateMeta(input: string, max = 155) {
  const clean = compactText(input);
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

function isThinMeta(input = '') {
  const clean = compactText(input);
  if (clean.length < 70) return true;
  return /passion for functionality and presentation/i.test(clean);
}

export function collectionMetaDescription(collection: {
  title: string;
  description?: string | null;
  handle?: string | null;
}) {
  const description = compactText(collection.description || '');
  if (!isThinMeta(description)) return truncateMeta(description);

  const title = compactText(collection.title);
  const handle = collection.handle || '';
  if (handle.includes('papa-alpha')) {
    return truncateMeta(
      'Shop RWAS-built Papa-Alpha rigging tools for Piper PA-28, PA-30, PA-31, and PA-36 aircraft. Precision reference tools ship from Sioux Falls, SD.',
    );
  }
  if (handle.includes('garmin')) {
    return truncateMeta(
      `Browse ${title} from Roger Wilco Aviation Services, an authorized Garmin dealer and FAA Part 145 repair station in Sioux Falls, SD.`,
    );
  }
  if (handle.includes('sale')) {
    return truncateMeta(
      'Browse current RWAS sale items, Garmin pilot gear, avionics accessories, and shop-supported aviation products from Sioux Falls, SD.',
    );
  }
  return truncateMeta(
    `Browse ${title} from Roger Wilco Aviation Services, including avionics, aircraft tools, pilot gear, and shop-supported aviation products.`,
  );
}

export function productMetaDescription(product: {
  title: string;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  variants?: Array<{ sku?: string | null }> | null;
}) {
  const description = compactText(product.description || '');
  const title = compactText(product.title);
  const vendor = compactText(product.vendor || 'Garmin');
  const type = compactText(product.productType || 'aviation product');
  const sku = product.variants?.find((variant) => variant.sku)?.sku;
  const skuText = sku ? ` SKU ${sku}.` : '';
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const modelMismatch =
    normalizedTitle.includes('gea 110') && normalizedDescription.includes('gea™ 24');

  if (!isThinMeta(description) && !modelMismatch) return truncateMeta(description);

  return truncateMeta(
    `${title} from ${vendor}, available through RWAS in Sioux Falls, SD. ${type} support from an FAA Part 145 repair station and authorized Garmin dealer.${skuText}`,
  );
}

export function productSeoTitle(title: string, productType?: string | null) {
  const clean = compactText(title);
  const suffix = ' | RWAS';
  const typedTitle =
    clean.length < 20 && productType ? `${clean} ${compactText(productType)}` : clean;
  const max = 60 - suffix.length;
  if (typedTitle.length <= max) return `${typedTitle}${suffix}`;
  const clipped = typedTitle.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 28 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…${suffix}`;
}

export function collectionSeoTitle(title: string) {
  const clean = compactText(title);
  const suffix = ' | RWAS';
  const max = 60 - suffix.length;
  if (clean.length <= max) return `${clean}${suffix}`;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 28 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…${suffix}`;
}
