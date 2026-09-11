import fs from 'node:fs';
const policy = JSON.parse(
  fs.readFileSync(
    new URL('../data/garmin-public-price-policy.json', import.meta.url),
  ),
);
const scope = new Set(
  JSON.parse(
    fs.readFileSync(
      new URL('../data/garmin-commercial-review-scope.json', import.meta.url),
    ),
  ),
);
export function approvedPublicPrice(sku) {
  const entry = policy.products.find((p) => p.sku === sku);
  return entry
    ? {
        list_price: Number(entry.publicPrice),
        priceType: 'public-price-only',
        asOf: policy.asOf,
      }
    : undefined;
}
export function assertReviewedCommercialWrites(skus) {
  const held = [...new Set(skus)].filter(
    (sku) =>
      scope.has(sku) &&
      (!approvedPublicPrice(sku) ||
        policy.products.some(
          (p) => p.sku === sku && p.canonicalIdentityReviewed,
        )),
  );
  if (held.length)
    throw new Error(
      `Commercial review hold; no writes permitted for: ${held.join(', ')}. Resolve exact identity and current eligibility/pricing before changing the approved policy.`,
    );
}
