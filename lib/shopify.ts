type Money = {
  amount: string;
  currencyCode: string;
};

export type ShopifyFeaturedProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  featuredImage?: {
    url: string;
    altText: string | null;
  } | null;
  priceRange: {
    minVariantPrice: Money;
  };
};

type ShopifyResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const SHOP_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN || 'm06wpv-na.myshopify.com';
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';

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
