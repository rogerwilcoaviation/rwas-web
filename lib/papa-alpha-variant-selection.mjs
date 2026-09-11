// Honor an explicit Papa-Alpha product link without changing any purchase gates.
export function papaAlphaVariantFromSearch(productTitle, variants, search) {
  if (!/^Papa[- ]Alpha\b/i.test(productTitle || '')) return null;
  const requested = new URLSearchParams(search).getAll('variant');
  if (requested.length !== 1 || !/^\d{1,20}$/.test(requested[0])) return null;
  const id = `gid://shopify/ProductVariant/${requested[0]}`;
  return variants.some((variant) => variant.id === id) ? id : null;
}
