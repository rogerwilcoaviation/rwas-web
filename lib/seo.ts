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
    .replace(/(\S)(?=Garmin part number\b)/gi, '$1 ')
    .replace(/(\S)(?=This is a dealer-only\b)/gi, '$1 ')
    .replace(/([.!?])(?=[A-Z])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize punctuation spacing in copy imported from Shopify. */
export function formatCatalogCopy(input = '') {
  return input
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part
            .replace(/,(?=[A-Za-z])/g, ', ')
            .replace(/([.!?])(?=[A-Z])/g, '$1 ')
            .replace(/\b(SKU:\s*[^,]+),(?=[A-Z])/g, '$1, ')
            .replace(/\s+/g, ' '),
    )
    .join('')
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
      'Shop RWAS-built Papa-Alpha rigging tools for Piper PA-28, PA-30, PA-31, and PA-36 aircraft. Precision reference tools ship from Yankton, SD.',
    );
  }
  if (handle.includes('garmin')) {
    return truncateMeta(
      `Browse ${title} from Roger Wilco Aviation Services, an authorized Garmin dealer and FAA Part 145 repair station at KYKN in Yankton.`,
    );
  }
  if (handle.includes('sale')) {
    return truncateMeta(
      'Browse current RWAS sale items, Garmin pilot gear, avionics accessories, and shop-supported aviation products from Yankton, South Dakota.',
    );
  }
  return truncateMeta(
    `Browse ${title} from Roger Wilco Aviation Services, including avionics, aircraft tools, pilot gear, and shop-supported aviation products.`,
  );
}

/**
 * Imported Garmin catalog copy often reads "<title> Garmin part number X.
 * Catalog description: <title again>. ..." -- drop the repeated title so the
 * meta description spends its characters on new information.
 */
export function dropRepeatedCatalogTitle(description: string, title: string) {
  const marker = /Catalog description:\s*/i;
  const match = marker.exec(description);
  if (!match) return description;
  const target = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!target) return description;
  const rest = description.slice(match.index + match[0].length);
  let matched = 0;
  let i = 0;
  for (; i < rest.length && matched < target.length; i++) {
    const c = rest[i].toLowerCase();
    if (!/[a-z0-9]/.test(c)) continue;
    if (c !== target[matched]) return description;
    matched++;
  }
  if (matched < target.length) return description;
  const tail = rest.slice(i).replace(/^[\s.,;:]+/, '');
  return `${description.slice(0, match.index).trimEnd()} ${tail}`.trim();
}

export function productMetaDescription(product: {
  title: string;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  variants?: Array<{ sku?: string | null }> | null;
}) {
  const title = compactText(product.title);
  const description = dropRepeatedCatalogTitle(
    compactText(product.description || ''),
    title,
  );
  const vendor = compactText(product.vendor || 'Garmin');
  const type = compactText(product.productType || 'aviation product');
  const sku = product.variants?.find((variant) => variant.sku)?.sku;
  const skuText = sku ? ` SKU ${sku}.` : '';
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const modelMismatch =
    normalizedTitle.includes('gea 110') &&
    normalizedDescription.includes('gea™ 24');

  if (!isThinMeta(description) && !modelMismatch)
    return truncateMeta(description);

  return truncateMeta(
    `${title} from ${vendor}, available through RWAS at KYKN in Yankton. ${type} support from an FAA Part 145 repair station and authorized Garmin dealer.${skuText}`,
  );
}

function trimDanglingClip(input: string) {
  let out = input.trimEnd();
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out
      .replace(/[\s,;:/&+\u2013\u2014-]+$/u, '')
      .replace(/\s+(?:and|with|for|the|of|or|in|to|a|an)$/i, '')
      .trimEnd();
  }
  return out;
}

export function productSeoTitle(
  title: string,
  productType?: string | null,
  identifier?: string | null,
) {
  const clean = compactText(title);
  const suffix = ' | RWAS';
  const cleanIdentifier = compactText(identifier || '');
  const identifierSuffix = cleanIdentifier ? ` — ${cleanIdentifier}` : '';
  const titleMax = 60 - suffix.length;
  const withIdentifierMax = titleMax - identifierSuffix.length;
  const extended =
    clean.length < 20 && productType
      ? `${clean} ${compactText(productType)}`
      : clean;
  // Pad short titles with the product type only when the result still fits;
  // a clipped type fragment ("Watches &") reads worse than the bare title.
  const typedTitle =
    extended.length > withIdentifierMax && clean.length <= withIdentifierMax
      ? clean
      : extended;
  if (identifierSuffix && typedTitle.length > withIdentifierMax) {
    const clipped = typedTitle.slice(0, withIdentifierMax);
    const lastSpace = clipped.lastIndexOf(' ');
    const cleanClip = trimDanglingClip(
      lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped,
    );
    return `${cleanClip}${identifierSuffix}${suffix}`;
  }
  if (typedTitle.length <= withIdentifierMax)
    return `${typedTitle}${identifierSuffix}${suffix}`;
  const clipped = typedTitle.slice(0, titleMax);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${trimDanglingClip(
    lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped,
  )}${suffix}`;
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
