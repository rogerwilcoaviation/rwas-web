// Price display is separate from authorization to purchase or install.
// Approved rows bind the audit product, variant and SKU to a verified public list price.
export function verifiedQuoteRetailPrice(product, policy) {
  if (String(product.vendor || '').toLowerCase() !== 'garmin') return null;
  if (product.variants?.length !== 1) return null;
  const variant = product.variants[0];
  const entry = policy.products.find(
    (row) =>
      row.productId === product.id &&
      row.handle === product.handle &&
      row.variantId === variant.id &&
      row.sku === variant.sku,
  );
  if (
    !entry ||
    variant.price?.currencyCode !== entry.currencyCode ||
    !Number.isFinite(Number(entry.amount)) ||
    Number(entry.amount) <= 0 ||
    Number(variant.price.amount) !== Number(entry.amount)
  ) return null;
  return { amount: entry.amount, currencyCode: entry.currencyCode };
}
