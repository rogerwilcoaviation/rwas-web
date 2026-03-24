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
  availableForSale: boolean;
  tags: string[];
  vendor?: string;
  productType?: string;
  featuredImage?: ShopifyImage | null;
  images: ShopifyImage[];
  options: Array<{ name: string; values: string[] }>;
  variants: ShopifyVariant[];
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
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';

const FEATURED_COLLECTION_HANDLES = [
  'garmin-avionics',
  'garmin-avionics-certified-retail',
  'garmin-avionics-accessories',
  'retail-experimental',
  'rigging-tools',
  'on-sale',
] as const;

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

function mapCart(cart: any): ShopifyCart {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
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
      first: FEATURED_COLLECTION_HANDLES.length,
      query: FEATURED_COLLECTION_HANDLES.map((handle) => `handle:${handle}`).join(' OR '),
    }
  );

  const collectionsByHandle = new Map(
    data.collections.edges.map((edge) => [edge.node.handle, edge.node])
  );

  return FEATURED_COLLECTION_HANDLES.map((handle) => collectionsByHandle.get(handle)).filter(
    Boolean
  ) as ShopifyCollectionSummary[];
}

export async function getCollectionByHandle(handle: string): Promise<ShopifyCollectionDetail | null> {
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
    title: data.collection.title,
    handle: data.collection.handle,
    description: data.collection.description,
    image: data.collection.image,
    products: data.collection.products.edges.map((edge) => ({
      ...edge.node,
      variants: mapVariants(edge.node.variants.edges),
    })),
  };
}

export async function getProductByHandle(handle: string): Promise<ShopifyProductDetail | null> {
  const data = await shopifyFetch<{
    product: {
      id: string;
      title: string;
      handle: string;
      description: string;
      availableForSale: boolean;
      tags: string[];
      vendor?: string;
      productType?: string;
      featuredImage?: ShopifyImage | null;
      images: { edges: Array<{ node: ShopifyImage }> };
      options: Array<{ name: string; values: string[] }>;
      variants: { edges: Array<{ node: ShopifyVariant }> };
    } | null;
  }>(
    `#graphql
      query ProductByHandle($handle: String!) {
        product(handle: $handle) {
          id
          title
          handle
          description
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
    availableForSale: data.product.availableForSale,
    tags: data.product.tags,
    vendor: data.product.vendor,
    productType: data.product.productType,
    featuredImage: data.product.featuredImage,
    images: data.product.images.edges.map((edge) => edge.node),
    options: data.product.options,
    variants: mapVariants(data.product.variants.edges),
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
