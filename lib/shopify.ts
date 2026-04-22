type Money = {
  amount: string;
  currencyCode: string;
};

export type ShopifyImage = {
  url: string;
  altText: string | null;
};

export type ShopifySelectedOption = {
  name: string;
  value: string;
};

export type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable?: number | null;
  sku?: string | null;
  selectedOptions: ShopifySelectedOption[];
  price: Money;
  compareAtPrice?: Money | null;
  image?: ShopifyImage | null;
};

export type ShopifyFeaturedProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage?: ShopifyImage | null;
  priceRange: {
    minVariantPrice: Money;
  };
};

export type ShopifyCollectionSummary = {
  id: string;
  title: string;
  handle: string;
  description: string;
  image?: ShopifyImage | null;
};

export type ShopifyCollectionProduct = ShopifyFeaturedProduct & {
  availableForSale?: boolean;
  tags?: string[];
  variants?: ShopifyVariant[];
};

export type ShopifyCollectionDetail = ShopifyCollectionSummary & {
  products: ShopifyCollectionProduct[];
};

export type ShopifyProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  tags: string[];
  vendor?: string;
  productType?: string;
  featuredImage?: ShopifyImage | null;
  images: ShopifyImage[];
  options: Array<{ name: string; values: string[] }>;
  variants: ShopifyVariant[];
  /** Handles of every collection this product belongs to — used by PDP gating
   *  to apply collection-level OTC overrides (see isOtcCollection). */
  collections: string[];
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
      handle: string;
      featuredImage?: ShopifyImage | null;
    };
    price: Money;
    selectedOptions: ShopifySelectedOption[];
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
  };
  lines: ShopifyCartLine[];
};

type ShopifyResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const SHOP_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN || 'm06wpv-na.myshopify.com';
const STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';

const FEATURED_COLLECTION_HANDLES = [
  'garmin-avionics',
  'garmin-avionics-certified-retail',
  'garmin-avionics-accessories',
  'garmin-watches',
  'retail-experimental',
  'on-sale',
] as const;

const PAPA_ALPHA_SYNTHETIC: ShopifyCollectionSummary = {
  id: 'synthetic:papa-alpha-tools',
  handle: 'papa-alpha-tools',
  title: 'Papa-Alpha Tools',
  description: 'RWAS-built rigging tools for Piper Papa-Alpha airframes. Priced OTC — ships same day.',
  image: null,
};

export async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>) {
  if (!STOREFRONT_TOKEN) {
    throw new Error('SHOPIFY_STOREFRONT_ACCESS_TOKEN is not configured.');
  }

  const response = await fetch(
    `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify Storefront API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  return payload.data as T;
}

function mapVariants(edges: Array<{ node: ShopifyVariant }>) {
  return edges.map((edge) => edge.node);
}


// ---- Checkout host rewrite (2026-04-22) ----
// Shopify stamps `shop.primaryDomain` into `checkoutUrl`. After the 2026-04-22
// primary-domain flip to www.rogerwilcoaviation.com, the raw URL points at
// Cloudflare Pages (Next.js), which has no /cart/c/<token> route and 404s.
// Rewrite to the myshopify host so the hosted checkout session resolves.
// The "Return to store" link inside the hosted checkout still reads primary
// domain (www), so no continuity loss for the shopper.
function rewriteCheckoutHost(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace('www.rogerwilcoaviation.com', 'm06wpv-na.myshopify.com');
}

function mapCart(cart: any): ShopifyCart {
  return {
    id: cart.id,
    checkoutUrl: rewriteCheckoutHost(cart.checkoutUrl),
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: cart.lines.edges.map((edge: any) => edge.node),
  };
}

export async function getFeaturedProducts(limit = 4): Promise<ShopifyFeaturedProduct[]> {
  const data = await shopifyFetch<{
    products: { edges: Array<{ node: ShopifyFeaturedProduct }> };
  }>(
    `#graphql
      query FeaturedProducts($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              description
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `,
    { first: limit }
  );

  return data.products.edges.map((edge) => edge.node);
}

export async function getFeaturedCollections(): Promise<ShopifyCollectionSummary[]> {
  const data = await shopifyFetch<{
    collections: { edges: Array<{ node: ShopifyCollectionSummary }> };
  }>(
    `#graphql
      query FeaturedCollections($first: Int!, $query: String!) {
        collections(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              description
              image {
                url
                altText
              }
            }
          }
        }
      }
    `,
    {
      first: 20, // safety margin: Shopify `handle:` query prefix-matches
      query: FEATURED_COLLECTION_HANDLES.map((handle) => `handle:${handle}`).join(' OR '),
    }
  );

  const collectionsByHandle = new Map(
    data.collections.edges.map((edge) => [edge.node.handle, edge.node])
  );

  const shopifyFeatured = (FEATURED_COLLECTION_HANDLES.map((handle) =>
    collectionsByHandle.get(handle)
  ).filter(Boolean) as ShopifyCollectionSummary[]).map((node) => ({
    ...node,
    title: displayTitleForCollection(node.handle, node.title),
  }));

  // Papa-Alpha Tools isn't a real Shopify collection; synthesize from tag=papa-alpha.
  return [...shopifyFeatured, PAPA_ALPHA_SYNTHETIC];
}

export async function getCollectionByHandle(handle: string): Promise<ShopifyCollectionDetail | null> {
  if (handle === 'papa-alpha-tools') {
    const products = await getProductsByTag('papa-alpha');
    return {
      ...PAPA_ALPHA_SYNTHETIC,
      products,
    };
  }

  const data = await shopifyFetch<{
    collection: {
      id: string;
      title: string;
      handle: string;
      description: string;
      image?: ShopifyImage | null;
      products: { edges: Array<{ node: ShopifyCollectionProduct & { variants: { edges: Array<{ node: ShopifyVariant }> } } }> };
    } | null;
  }>(
    `#graphql
      query CollectionByHandle($handle: String!) {
        collection(handle: $handle) {
          id
          title
          handle
          description
          image {
            url
            altText
          }
          products(first: 48, sortKey: BEST_SELLING) {
            edges {
              node {
                id
                title
                handle
                description
                availableForSale
                tags
                featuredImage {
                  url
                  altText
                }
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                variants(first: 20) {
                  edges {
                    node {
                      id
                      title
                      availableForSale
                      quantityAvailable
                      sku
                      selectedOptions {
                        name
                        value
                      }
                      price {
                        amount
                        currencyCode
                      }
                      compareAtPrice {
                        amount
                        currencyCode
                      }
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { handle }
  );

  if (!data.collection) return null;

  return {
    id: data.collection.id,
    title: displayTitleForCollection(data.collection.handle, data.collection.title),
    handle: data.collection.handle,
    description: data.collection.description,
    image: data.collection.image,
    products: data.collection.products.edges.map((edge) => ({
      ...edge.node,
      variants: mapVariants(edge.node.variants.edges),
    })),
  };
}

export async function getProductsByTag(tag: string, limit = 48): Promise<ShopifyCollectionProduct[]> {
  const data = await shopifyFetch<{
    products: {
      edges: Array<{
        node: ShopifyCollectionProduct & {
          variants: { edges: Array<{ node: ShopifyVariant }> };
        };
      }>;
    };
  }>(
    `#graphql
      query ProductsByTag($first: Int!, $query: String!) {
        products(first: $first, query: $query, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
              description
              availableForSale
              tags
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    quantityAvailable
                    sku
                    selectedOptions {
                      name
                      value
                    }
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { first: limit, query: `tag:${tag}` }
  );

  return data.products.edges.map((edge) => ({
    ...edge.node,
    variants: mapVariants(edge.node.variants.edges),
  }));
}

export async function getProductByHandle(handle: string): Promise<ShopifyProductDetail | null> {
  const data = await shopifyFetch<{
    product: {
      id: string;
      title: string;
      handle: string;
      description: string;
      descriptionHtml: string;
      availableForSale: boolean;
      tags: string[];
      vendor?: string;
      productType?: string;
      featuredImage?: ShopifyImage | null;
      images: { edges: Array<{ node: ShopifyImage }> };
      options: Array<{ name: string; values: string[] }>;
      variants: { edges: Array<{ node: ShopifyVariant }> };
      collections: { edges: Array<{ node: { handle: string } }> };
    } | null;
  }>(
    `#graphql
      query ProductByHandle($handle: String!) {
        product(handle: $handle) {
          id
          title
          handle
          description
          descriptionHtml
          availableForSale
          tags
          vendor
          productType
          featuredImage {
            url
            altText
          }
          images(first: 20) {
            edges {
              node {
                url
                altText
              }
            }
          }
          options {
            name
            values
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
                sku
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                image {
                  url
                  altText
                }
              }
            }
          }
          collections(first: 20) {
            edges {
              node {
                handle
              }
            }
          }
        }
      }
    `,
    { handle }
  );

  if (!data.product) return null;

  return {
    id: data.product.id,
    title: data.product.title,
    handle: data.product.handle,
    description: data.product.description,
    descriptionHtml: data.product.descriptionHtml,
    availableForSale: data.product.availableForSale,
    tags: data.product.tags,
    vendor: data.product.vendor,
    productType: data.product.productType,
    featuredImage: data.product.featuredImage,
    images: data.product.images.edges.map((edge) => edge.node),
    options: data.product.options,
    variants: mapVariants(data.product.variants.edges),
    collections: data.product.collections.edges.map((edge) => edge.node.handle),
  };
}

export async function getProductHandles(limit = 150): Promise<string[]> {
  const data = await shopifyFetch<{
    products: { edges: Array<{ node: { handle: string } }> };
  }>(
    `#graphql
      query ProductHandles($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              handle
            }
          }
        }
      }
    `,
    { first: limit }
  );

  return data.products.edges.map((edge) => edge.node.handle);
}

export async function createCart(merchandiseId: string, quantity = 1) {
  const data = await shopifyFetch<{
    cartCreate: { cart: any; userErrors: Array<{ message: string }> };
  }>(
    `#graphql
      mutation CartCreate($merchandiseId: ID!, $quantity: Int!) {
        cartCreate(input: { lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }] }) {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
            }
            lines(first: 20) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price { amount currencyCode }
                      selectedOptions { name value }
                      product {
                        title
                        handle
                        featuredImage { url altText }
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            message
          }
        }
      }
    `,
    { merchandiseId, quantity }
  );

  if (data.cartCreate.userErrors.length) {
    throw new Error(data.cartCreate.userErrors.map((e) => e.message).join('; '));
  }

  return mapCart(data.cartCreate.cart);
}

export async function addCartLine(cartId: string, merchandiseId: string, quantity = 1) {
  const data = await shopifyFetch<{
    cartLinesAdd: { cart: any; userErrors: Array<{ message: string }> };
  }>(
    `#graphql
      mutation CartLinesAdd($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) {
        cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }]) {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
            }
            lines(first: 20) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price { amount currencyCode }
                      selectedOptions { name value }
                      product {
                        title
                        handle
                        featuredImage { url altText }
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            message
          }
        }
      }
    `,
    { cartId, merchandiseId, quantity }
  );

  if (data.cartLinesAdd.userErrors.length) {
    throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join('; '));
  }

  return mapCart(data.cartLinesAdd.cart);
}

export async function getCart(cartId: string) {
  const data = await shopifyFetch<{
    cart: any | null;
  }>(
    `#graphql
      query GetCart($cartId: ID!) {
        cart(id: $cartId) {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    selectedOptions { name value }
                    product {
                      title
                      handle
                      featuredImage { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { cartId }
  );

  if (!data.cart) return null;
  return mapCart(data.cart);
}

/**
 * OTC (Over-The-Counter) add-to-cart gating.
 *
 * Design rule (MEMORY.md :: RWAS OTC gating 2026-04-20):
 *   - `otc-eligible` tag  => add-to-cart allowed (Papa-Alpha rigging tools).
 *   - `otc-disabled` or `stock-check-required` tag => quote/call for stock (Garmin).
 *
 * Papa-Alpha Tools collection products all carry `otc-eligible`, so the whole
 * collection lights up the Add to cart button.
 */
/**
 * Collection-level OTC allowlist.
 *
 * Some collections are entirely OTC-eligible regardless of per-product tags
 * (e.g., Garmin Watches are MAP-priced and ship direct from Garmin, so the
 * whole collection gets Add-to-cart). Products in these collections still
 * respect an explicit `otc-disabled` opt-out tag.
 *
 * Keep separate from `isQuoteCollection` (which does the opposite — forces
 * quote-only even when a product would otherwise be OTC).
 */
export function isOtcCollection(handle: string): boolean {
  // Collection-level OTC for the PDP buy box (2026-04-21 PM revision).
  // Every catalog collection EXCEPT the quote-only "Garmin Avionics for
  // Certified Aircraft (RWAS Install Only)" (handle: garmin-avionics) gets
  // an Add-to-Cart button on the PDP. Collection grids do NOT render
  // Add-to-cart — that's enforced separately in ProductCard.
  return (
    handle === 'garmin-avionics-certified-retail' ||
    handle === 'retail-experimental' ||
    handle === 'garmin-avionics-accessories' ||
    handle === 'garmin-watches' ||
    handle === 'papa-alpha-tools'
  );
}

export function isOtcEligible(product: { tags?: string[] } | null | undefined): boolean {
  // Per-product OTC gate (re-enabled 2026-04-21 PM). Used by the PDP gate
  // for products that don't sit in an isOtcCollection (e.g., Papa-Alpha
  // Tools, since the papa-alpha-tools collection is synthetic in rwas-web
  // and won't appear in a product's Shopify collections list).
  const tags = product?.tags ?? [];
  if (tags.includes('otc-disabled')) return false;
  if (tags.includes('stock-check-required')) return false;
  return tags.includes('otc-eligible');
}

/**
 * Extract the numeric variant ID from a Storefront GID like
 * `gid://shopify/ProductVariant/50123456789`, for use in Shopify's classic
 * cart permalink: `/cart/<variantId>:<qty>`.
 *
 * The /cart* route is still proxied to Shopify via the shopify-proxy Worker,
 * so a cart permalink GET is the simplest zero-JS add-to-cart that works
 * today (before a Next.js cart context is built out for headless).
 */
export function variantNumericId(gid?: string | null): string | null {
  if (!gid) return null;
  const m = gid.match(/(\d+)$/);
  return m ? m[1] : null;
}

export function cartPermalink(variantGid?: string | null, quantity = 1): string | null {
  const id = variantNumericId(variantGid);
  if (!id) return null;
  return `/cart/${id}:${Math.max(1, Math.floor(quantity))}`;
}

/**
 * Display-title override for Shopify collections. Lets rwas-web present
 * a cleaner name to customers without touching Shopify's collection title.
 *
 * Current overrides:
 *   - garmin-avionics: Shopify has "Garmin Avionics for Certified Aircraft
 *     (RWAS Install Only)". Rendered as "Garmin Avionics — Dealer Only".
 *     Rationale: shorter, clearer positioning — this collection is
 *     dealer-only (quote-only, no Add-to-cart) per 2026-04-21 PM direction.
 */
export function displayTitleForCollection(handle: string, shopifyTitle: string): string {
  if (handle === 'garmin-avionics') return 'Garmin Avionics \u2014 Dealer Only';
  return shopifyTitle;
}

export function isQuoteCollection(handle: string) {
  return handle === 'garmin-avionics';
}

export function isQuoteProduct(product: {
  variants?: Array<{ price: { amount: string } }>;
  productType?: string;
}) {
  const minPrice = product.variants?.[0]?.price?.amount ?? '0';
  return Number(minPrice) === 0 || product.productType === 'Certified';
}
