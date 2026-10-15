/** A Storefront-published product gets a public PDP, sitemap entry, and search entry. */
export function isPublicProductHandle(handle) {
  return /^[a-z0-9][a-z0-9-]*$/.test(handle);
}
