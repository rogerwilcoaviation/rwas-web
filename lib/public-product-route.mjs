/** Valid handles can have a public product page. */
export function isPublicProductHandle(handle) {
  return /^[a-z0-9][a-z0-9-]*$/.test(handle);
}

// A customer-reserved, sold one-off should remain directly accessible without
// being promoted in discovery. Do not infer this from inventory availability.
const DISCOVERY_EXCLUDED_HANDLES = new Set(['fcbt-1-prototype']);

export function isDiscoverableProductHandle(handle) {
  return (
    isPublicProductHandle(handle) && !DISCOVERY_EXCLUDED_HANDLES.has(handle)
  );
}
