// Structural emission guard, not commercial authorization or a Google guarantee.
// Callers must supply genuine, visible offers/reviews and preserve sales policies.
// https://developers.google.com/search/docs/appearance/structured-data/product-snippet
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const number = (value) => (typeof value === 'number' || text(value)) && Number.isFinite(Number(value));
const type = (value, expected) => object(value) && [value['@type']].flat().some(t => t === expected || t === `https://schema.org/${expected}`);
const any = (value, check) => (Array.isArray(value) ? value : [value]).some(check);
const price = (value) => number(value) && Number(value) >= 0;
function offer(value) {
  if (type(value, 'AggregateOffer')) return price(value.lowPrice) && text(value.priceCurrency);
  if (!type(value, 'Offer')) return false;
  // Direct price takes precedence; do not rescue an invalid one with a nested price.
  if (value.price !== undefined) return price(value.price);
  return any(value.priceSpecification, spec => object(spec) && price(spec.price));
}
function rating(value) {
  if (!object(value)) return false;
  // Google also accepts an implied scale in percentages and fractions.
  if (text(value.ratingValue)) {
    const percent = value.ratingValue.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (percent) return Number(percent[1]) <= 100;
    const fraction = value.ratingValue.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fraction) return Number(fraction[2]) > 0 && Number(fraction[1]) <= Number(fraction[2]);
  }
  if (!number(value.ratingValue)) return false;
  const low = value.worstRating === undefined ? 1 : value.worstRating;
  const high = value.bestRating === undefined ? 5 : value.bestRating;
  return number(low) && number(high) && Number(high) > Number(low) && Number(value.ratingValue) >= Number(low) && Number(value.ratingValue) <= Number(high);
}
function review(value) {
  return type(value, 'Review') && any(value.author, author =>
    (type(author, 'Person') || type(author, 'Organization')) && text(author.name)) && rating(value.reviewRating);
}
function aggregateRating(value) {
  return type(value, 'AggregateRating') && rating(value) &&
    [value.ratingCount, value.reviewCount].some(count => number(count) && Number.isInteger(Number(count)) && Number(count) > 0);
}
export function hasProductSnippetEligibility(product) {
  return type(product, 'Product') && text(product.name) &&
    (any(product.offers, offer) || any(product.review, review) || any(product.aggregateRating, aggregateRating));
}
