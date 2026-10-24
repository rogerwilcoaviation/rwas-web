export function productSchemaExpected({
  html,
  handle,
  legacyQuoteOnlyHandles,
}) {
  const eligibility = html.match(
    /\bdata-product-snippet-eligible=["'](true|false)["']/i,
  )?.[1];
  if (eligibility) {
    return eligibility.toLowerCase() === 'true';
  }
  return !legacyQuoteOnlyHandles.has(handle);
}
