export function normalizePartText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Only formatting separators collapse; significant SKU punctuation stays distinct. */
export function compactPartNumber(value: string) {
  return value.toLowerCase().replace(/[-\s]/g, '');
}

export function matchesPartSearch({
  query,
  haystack,
  skus,
}: {
  query: string;
  haystack: string;
  skus: string[];
}) {
  const terms = normalizePartText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  const compactQuery = compactPartNumber(query);
  const exactSku =
    /\d/.test(compactQuery) &&
    skus.some((sku) => compactPartNumber(sku) === compactQuery);
  return exactSku || terms.every((term) => haystack.includes(term));
}
