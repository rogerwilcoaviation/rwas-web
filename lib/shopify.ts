type Money = {
  amount: string;
  currencyCode: string;
};

export type ShopifyImage = {
  url: string;
  altText: string | null;
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
};

export type ShopifyCollectionDetail = ShopifyCollectionSummary & {
  products: ShopifyCollectionProduct[];
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

async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>) {
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
      products: { edges: Array<{ node: ShopifyCollectionProduct }> };
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
    products: data.collection.products.edges.map((edge) => edge.node),
  };
}

export function isQuoteCollection(handle: string) {
  return handle === 'garmin-avionics';
}
