// Public discovery stays separate from sellerRequest and its bearer sessions.
export const LEGACY_AIRCRAFT_API = 'https://sale-api.rogerwilcoaviation.com';
export const PUBLIC_SELLER_AIRCRAFT_API = '/api/aircraft-sale';

// Replacement builds start without the retired placeholder catalogue. Keep the
// default off so an unchanged baseline build retains its original discovery.
export function replaceLegacyAircraftCatalog() {
  try {
    // Next replaces this exact public-env expression at build time. Plain
    // browser bundles without the flag retain baseline behaviour.
    return process.env.NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG === 'true';
  } catch {
    return false;
  }
}

/** @param {MarketplaceListing[]} listings @param {boolean} [replaceLegacy] */
export function marketplaceInitialListings(
  listings,
  replaceLegacy = replaceLegacyAircraftCatalog(),
) {
  return replaceLegacy
    ? listings.filter((listing) => listing.source === 'seller')
    : listings;
}

/** @typedef {'legacy' | 'seller'} ListingSource */
/**
 * @typedef {object} MarketplaceListing
 * @property {string} id
 * @property {ListingSource} source
 * @property {string} [status]
 * @property {string} [title]
 * @property {string} [listingType]
 * @property {string} [category]
 * @property {string} [currency]
 * @property {string} [priceMode]
 * @property {string} [transactionType]
 * @property {string} [make]
 * @property {string} [model]
 * @property {string | number} [year]
 * @property {string} [nNumber]
 * @property {string | number} [price]
 * @property {string} [sellerLocation]
 * @property {string | number} [totalTime]
 * @property {string | number} [engineTime]
 * @property {Array<{ key: string }>} [photos]
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** @param {unknown} value @returns {value is string} */
const isText = (value) => typeof value === 'string';

/** @param {unknown} value @returns {value is string | number} */
const isScalar = (value) =>
  isText(value) || (typeof value === 'number' && Number.isFinite(value));

/**
 * Project the two public browse contracts to card fields. Never spread a
 * response object: owner IDs, contact details, review fields and private
 * logbook object keys do not belong in the discovery grid.
 *
 * Seller /browse can return pending during bounded acceptance publication.
 * Membership in that anonymous public endpoint is the publication check;
 * owner /listings and authenticated /listing responses must never feed this.
 * @param {unknown} payload
 * @param {ListingSource} source
 * @returns {MarketplaceListing[]}
 */
export function publicMarketplaceListings(payload, source) {
  if (!['legacy', 'seller'].includes(source)) return [];
  if (!isRecord(payload) || !Array.isArray(payload.listings)) return [];
  const listings = [];
  const seen = new Set();
  for (const value of payload.listings) {
    if (!isRecord(value) || !isText(value.id) || !value.id.trim()) continue;
    const status = value.status;
    const publicStatus =
      status === 'active' ||
      status === 'sold' ||
      (source === 'legacy' && status === undefined) ||
      (source === 'seller' && status === 'pending');
    if (!publicStatus || seen.has(value.id)) continue;
    seen.add(value.id);
    /** @type {MarketplaceListing} */
    const listing = { id: value.id, source };
    if (isText(status)) listing.status = status;
    for (const key of ['make', 'model', 'nNumber', 'sellerLocation','title','listingType','category','currency','priceMode','transactionType']) {
      if (isText(value[key])) listing[key] = value[key];
    }
    for (const key of ['year', 'price', 'totalTime', 'engineTime']) {
      if (isScalar(value[key])) listing[key] = value[key];
    }
    if (Array.isArray(value.photos)) {
      listing.photos = value.photos
        .filter(
          (photo) =>
            isRecord(photo) &&
            isText(photo.key) &&
            photo.key.trim() &&
            (source === 'seller'
              ? photo.category === 'photos'
              : photo.category === undefined || photo.category === 'photos') &&
            ((source === 'legacy' && photo.type === undefined) ||
              ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
                photo.type,
              )) &&
            (photo.contentType === undefined ||
              (isText(photo.contentType) &&
                photo.contentType.startsWith('image/'))),
        )
        .map((photo) => ({ key: photo.key }));
    }
    listings.push(listing);
  }
  return listings;
}

/** @param {MarketplaceListing} listing */
export function marketplaceListingKey(listing) {
  return listing.source + ':' + listing.id;
}

/** @param {MarketplaceListing} listing */
export function marketplaceListingHref(listing) {
  const id = encodeURIComponent(listing.id);
  return listing.source === 'seller'
    ? PUBLIC_SELLER_AIRCRAFT_API + '/listing/' + id
    : '/aircraft-for-sale/' + id;
}

/** @param {MarketplaceListing} listing */
export function marketplaceListingPhoto(listing) {
  const key = listing.photos?.[0]?.key;
  if (!key) return { src: null, srcSet: undefined };
  const base =
    (listing.source === 'seller'
      ? PUBLIC_SELLER_AIRCRAFT_API
      : LEGACY_AIRCRAFT_API) +
    '/files/' +
    encodeURIComponent(key);
  // Only the legacy worker supports resize variants. Seller R2 media is raw.
  return listing.source === 'seller'
    ? { src: base, srcSet: undefined }
    : {
        src: base + '?w=800&q=80',
        srcSet:
          base +
          '?w=600&q=80 600w, ' +
          base +
          '?w=800&q=80 800w, ' +
          base +
          '?w=1200&q=80 1200w',
      };
}

/**
 * Refresh each source independently. A legacy outage preserves the original
 * public server snapshot. Seller errors contribute nothing, so a previous
 * bounded publication cannot survive a failed refresh as a cached fallback.
 * IDs are qualified by source; identical IDs cannot rewrite legacy links.
 * @param {typeof fetch} fetcher
 * @param {MarketplaceListing[]} [fallback]
 * @param {boolean} [replaceLegacy]
 * @returns {Promise<MarketplaceListing[]>}
 */
export async function refreshPublicMarketplaceListings(
  fetcher,
  fallback = [],
  replaceLegacy = replaceLegacyAircraftCatalog(),
) {
  const legacyFallback = publicMarketplaceListings(
    { listings: fallback.filter((listing) => listing.source === 'legacy') },
    'legacy',
  );
  const sources = replaceLegacy
    ? /** @type {const} */ (['seller'])
    : /** @type {const} */ (['legacy', 'seller']);
  const results = await Promise.all(
    sources.map(async (source) => {
      const api =
        source === 'legacy' ? LEGACY_AIRCRAFT_API : PUBLIC_SELLER_AIRCRAFT_API;
      try {
        const response = await fetcher(api + '/browse?include=sold', {
          cache: 'no-store',
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Public browse unavailable.');
        const data = await response.json();
        if (!isRecord(data) || !Array.isArray(data.listings))
          throw new Error('Invalid public browse response.');
        return publicMarketplaceListings(data, source);
      } catch {
        return source === 'legacy' ? legacyFallback : [];
      }
    }),
  );
  return results.flat();
}
