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
  vendor?: string;
  productType?: string;
  images?: ShopifyImage[];
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

export type ShopifyPartFinderProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  featuredImage?: ShopifyImage | null;
  priceRange: {
    minVariantPrice: Money;
  };
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

type ShopifyImageConnection = {
  edges: Array<{ node: ShopifyImage }>;
};

type ShopifyCollectionProductQueryNode = Omit<
  ShopifyCollectionProduct,
  'images' | 'variants'
> & {
  images?: ShopifyImageConnection;
  variants: { edges: Array<{ node: ShopifyVariant }> };
};

const SHOP_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN || 'm06wpv-na.myshopify.com';
const STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';

const FEATURED_COLLECTION_HANDLES = [
  'avionics-certified',
  'avionics-experimental',
  'pilot-gear',
  'watches-accessories',
  'garmin-dealer-install',
  'papa-alpha-tools',
  'on-sale',
] as const;

export const PRIORITY_PRODUCT_HANDLES = [
  'd2-mach-2-47-mm-titanium-oxford-brown-leather-band',
  'd2-mach-2-51-mm-carbon-gray-dlc-titanium-vented-titanium-bracelet',
  'd2-mach-2-pro-51-mm-carbon-gray-dlc-titanium-chestnut-leather-band',
] as const;

export const FALLBACK_PRODUCT_HANDLES = [
  ...PRIORITY_PRODUCT_HANDLES,
  'garmin-g5-dg-hsi-stcd-for-certified-aircraft-with-lpm',
  'garmin-g5-primary-electronic-attitude-display-stcd-for-certified-aircraft-with-lpm',
  'garmin-gea-71b-enhanced',
  'garmin-gfc-500-digital-autopilot',
] as const;

export function isSeoSafeProductHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(handle);
}

const PAPA_ALPHA_SYNTHETIC: ShopifyCollectionSummary = {
  id: 'synthetic:papa-alpha-tools',
  handle: 'papa-alpha-tools',
  title: 'Papa-Alpha Tools',
  description: 'RWAS-built rigging tools for Piper Papa-Alpha airframes. Priced OTC — ships same day.',
  image: {
    url: '/newspaper/images/papa_alpha_kit_collection.jpg',
    altText: 'Papa-Alpha precision rigging tool kit for Piper airframes',
  },
};

const PRODUCT_TYPE_COLLECTIONS: Record<
  string,
  { title: string; productType: string }
> = {
  'avionics-certified': {
    title: 'Avionics Certified Retail',
    productType: 'Avionics — Certified',
  },
  'avionics-experimental': {
    title: 'Avionics Experimental',
    productType: 'Avionics — Experimental',
  },
  'pilot-gear': {
    title: 'Pilot Gear',
    productType: 'Pilot Gear',
  },
  'watches-accessories': {
    title: 'Watches & Accessories',
    productType: 'Watches & Accessories',
  },
  'garmin-dealer-install': {
    title: 'Garmin Dealer Install',
    productType: 'Garmin Dealer Install',
  },
  'papa-alpha-tools': {
    title: 'Papa-Alpha Tools',
    productType: 'Papa-Alpha Tools',
  },
};

function productTypeCollectionSummary(handle: string): ShopifyCollectionSummary | null {
  const meta = PRODUCT_TYPE_COLLECTIONS[handle];
  if (!meta) return null;
  return {
    id: `product-type:${handle}`,
    handle,
    title: meta.title,
    description: descriptionForCollection(handle, ''),
    image: imageForCollection(handle, null),
  };
}

function isFallbackProductImage(image?: ShopifyImage | null): boolean {
  const haystack = `${image?.url || ''} ${image?.altText || ''}`.toLowerCase();
  return (
    haystack.includes('garmin-no-product-image-available') ||
    haystack.includes('no product image available') ||
    haystack.includes('no-product-image') ||
    haystack.includes('product image placeholder')
  );
}

function productImagePriority(product: Pick<ShopifyCollectionProduct, 'featuredImage'>): number {
  if (!product.featuredImage?.url) return 2;
  return isFallbackProductImage(product.featuredImage) ? 1 : 0;
}

function sortProductsByImagePriority<T extends ShopifyCollectionProduct>(products: T[]): T[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const imageRank = productImagePriority(a.product) - productImagePriority(b.product);
      return imageRank || a.index - b.index;
    })
    .map(({ product }) => product);
}

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
      first: 40, // safety margin: Shopify `handle:` query prefix-matches
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
    description: descriptionForCollection(node.handle, node.description),
    image: imageForCollection(node.handle, node.image),
  }));

  const byHandle = new Map<string, ShopifyCollectionSummary>(
    shopifyFeatured.map((collection) => [collection.handle, collection])
  );
  for (const handle of FEATURED_COLLECTION_HANDLES) {
    if (!byHandle.has(handle)) {
      const fallback = productTypeCollectionSummary(handle);
      if (fallback) byHandle.set(handle, fallback);
    }
  }

  return FEATURED_COLLECTION_HANDLES.map((handle) => byHandle.get(handle)).filter(
    Boolean
  ) as ShopifyCollectionSummary[];
}

export async function getCollectionByHandle(handle: string): Promise<ShopifyCollectionDetail | null> {
  type CollectionQueryResult = {
    collection: {
      id: string;
      title: string;
      handle: string;
      description: string;
      image?: ShopifyImage | null;
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: ShopifyCollectionProductQueryNode }>;
      };
    } | null;
  };

  const products: ShopifyCollectionProduct[] = [];
  let collectionMeta: Omit<ShopifyCollectionDetail, 'products'> | null = null;
  let cursor: string | null = null;

  do {
    const data = await shopifyFetch<CollectionQueryResult>(
      `#graphql
        query CollectionByHandle($handle: String!, $after: String) {
          collection(handle: $handle) {
            id
            title
            handle
            description
            image {
              url
              altText
            }
            products(first: 250, after: $after, sortKey: BEST_SELLING) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
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
                  images(first: 3) {
                    edges {
                      node {
                        url
                        altText
                      }
                    }
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
      { handle, after: cursor }
    );

    if (!data.collection) {
      const fallback = productTypeCollectionSummary(handle);
      const productType = PRODUCT_TYPE_COLLECTIONS[handle]?.productType;
      if (!fallback || !productType) return null;
      return {
        ...fallback,
        products: await getProductsByProductType(productType),
      };
    }

    collectionMeta ??= {
      id: data.collection.id,
      title: displayTitleForCollection(data.collection.handle, data.collection.title),
      handle: data.collection.handle,
      description: descriptionForCollection(data.collection.handle, data.collection.description),
      image: imageForCollection(data.collection.handle, data.collection.image),
    };

    products.push(
      ...data.collection.products.edges.map((edge) => ({
        ...edge.node,
        images: edge.node.images?.edges.map((imageEdge) => imageEdge.node) ?? [],
        variants: mapVariants(edge.node.variants.edges),
      }))
    );
    cursor = data.collection.products.pageInfo.hasNextPage
      ? data.collection.products.pageInfo.endCursor
      : null;
  } while (cursor);

  return {
    ...collectionMeta,
    products: sortProductsByImagePriority(products),
  };
}

export async function getSeoProductHandles(): Promise<string[]> {
  const collections = await getFeaturedCollections();
  const results = await Promise.allSettled(
    collections.map((collection) => getCollectionByHandle(collection.handle))
  );
  const handles = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value
      ? result.value.products.map((product) => product.handle)
      : []
  );

  return Array.from(new Set([...PRIORITY_PRODUCT_HANDLES, ...handles]))
    .filter(isSeoSafeProductHandle);
}

export async function getPartFinderProducts(limit = 2000): Promise<ShopifyPartFinderProduct[]> {
  const all: ShopifyPartFinderProduct[] = [];
  let cursor: string | null = null;

  do {
    const data = await shopifyFetch<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{
          cursor: string;
          node: ShopifyPartFinderProduct & { variants: { edges: Array<{ node: ShopifyVariant }> } };
        }>;
      };
    }>(
      `#graphql
        query PartFinderProducts($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: TITLE) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
              node {
                id
                title
                handle
                description
                vendor
                productType
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
      { first: Math.min(250, limit - all.length), after: cursor }
    );

    all.push(
      ...data.products.edges.map((edge) => ({
        ...edge.node,
        variants: mapVariants(edge.node.variants.edges),
      }))
    );
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor && all.length < limit);

  return all;
}

export async function getProductsByTag(tag: string, limit = 48): Promise<ShopifyCollectionProduct[]> {
  const data = await shopifyFetch<{
    products: {
      edges: Array<{
        node: ShopifyCollectionProductQueryNode;
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
              images(first: 3) {
                edges {
                  node {
                    url
                    altText
                  }
                }
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
    images: edge.node.images?.edges.map((imageEdge) => imageEdge.node) ?? [],
    variants: mapVariants(edge.node.variants.edges),
  }));
}

export async function getProductsByProductType(
  productType: string,
  limit = 1000
): Promise<ShopifyCollectionProduct[]> {
  const products: ShopifyCollectionProduct[] = [];
  let cursor: string | null = null;

  do {
    const data = await shopifyFetch<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{
          node: ShopifyCollectionProductQueryNode;
        }>;
      };
    }>(
      `#graphql
        query ProductsByProductType($first: Int!, $after: String, $query: String!) {
          products(first: $first, after: $after, query: $query, sortKey: TITLE) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                description
                availableForSale
                vendor
                productType
                tags
                featuredImage {
                  url
                  altText
                }
                images(first: 3) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
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
      {
        first: Math.min(250, limit - products.length),
        after: cursor,
        query: `product_type:"${productType}"`,
      }
    );

    products.push(
      ...data.products.edges.map((edge) => ({
        ...edge.node,
        images: edge.node.images?.edges.map((imageEdge) => imageEdge.node) ?? [],
        variants: mapVariants(edge.node.variants.edges),
      }))
    );
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor && products.length < limit);

  return sortProductsByImagePriority(products);
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

export async function getProductHandles(limit = 3000): Promise<string[]> {
  const handles: string[] = [];
  let cursor: string | null = null;

  do {
    const data = await shopifyFetch<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: { handle: string } }>;
      };
    }>(
      `#graphql
        query ProductHandles($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                handle
              }
            }
          }
        }
      `,
      { first: Math.min(250, limit - handles.length), after: cursor }
    );

    handles.push(...data.products.edges.map((edge) => edge.node.handle));
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor && handles.length < limit);

  return handles;
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
  // Every catalog collection EXCEPT certified avionics gets
  // an Add-to-Cart button on the PDP. Collection grids do NOT render
  // Add-to-cart — that's enforced separately in ProductCard.
  return (
    handle === 'avionics-experimental' ||
    handle === 'pilot-gear' ||
    handle === 'watches-accessories' ||
    handle === 'garmin-dealer-install' ||
    handle === 'on-sale' ||
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
 * Display-title override for Shopify collections. Lets rwas-web present
 * a cleaner name to customers without touching Shopify's collection title.
 *
 * Current overrides: none. Shopify collection titles already match the
 * Phase 3 structure.
 */
export function displayTitleForCollection(handle: string, shopifyTitle: string): string {
  return shopifyTitle;
}

const COLLECTION_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'avionics-certified':
    'Retail-certified Garmin avionics supported by Roger Wilco Aviation Services, including navigators, displays, autopilots, transponders, audio panels, LRUs, and related installation products.',
  'avionics-experimental':
    'Garmin avionics and related components for experimental, LSA, and builder-supported installations, including G3X Touch and compatible accessories.',
  'pilot-gear':
    'Portable Garmin aviation gear for pilots, including aera portable GPS units, inReach communicators, and cockpit-ready wearables.',
  'watches-accessories':
    'Garmin watches, bands, wearable accessories, and aviation-ready smartwatches supported through the RWAS storefront.',
  'garmin-dealer-install':
    'Garmin dealer-install hardware, service parts, cable assemblies, install kits, batteries, documentation, and replacement components used in shop-supported avionics work.',
  'papa-alpha-tools':
    'RWAS-built Papa-Alpha rigging tools for Piper airframes, including reference tools and kits built for practical shop-floor use.',
  'on-sale':
    'Current RWAS sale items, including Garmin pilot gear, avionics accessories, and shop-supported aviation products.',
};

function isPlaceholderCollectionDescription(description: string): boolean {
  const clean = description.trim();
  return (
    !clean ||
    /^browse this rwas collection\.?$/i.test(clean) ||
    /passion for functionality and presentation/i.test(clean)
  );
}

export function descriptionForCollection(handle: string, shopifyDescription: string): string {
  if (isPlaceholderCollectionDescription(shopifyDescription)) {
    return COLLECTION_DESCRIPTION_OVERRIDES[handle] || shopifyDescription;
  }

  return shopifyDescription;
}

export function imageForCollection(
  handle: string,
  shopifyImage?: ShopifyImage | null
): ShopifyImage | null | undefined {
  const fallbackByHandle: Record<string, ShopifyImage> = {
    'avionics-certified': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Redefining_Smooth_ad7c40ee-efc6-4cb2-bcc8-67b2140557d4.png?v=1754905863',
      altText: 'Certified Garmin avionics supported by Roger Wilco Aviation Services',
    },
    'avionics-experimental': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Redefining_Smooth_cdc37a0b-a976-4c50-93e4-59d3c68337c1.png?v=1754906168',
      altText: 'Experimental and LSA Garmin avionics supported by Roger Wilco Aviation Services',
    },
    'pilot-gear': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Redefining_Smooth.png?v=1754905659',
      altText: 'Pilot gear and aviation wearables from Garmin',
    },
    'watches-accessories': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Redefining_Smooth.png?v=1754905659',
      altText: 'Garmin watches and accessories',
    },
    'garmin-dealer-install': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Redefining_Smooth_4e9bffcf-996a-4c71-a9d6-6763db1e597f.png?v=1754921983',
      altText: 'Garmin dealer install hardware, service parts, and cable assemblies',
    },
    'papa-alpha-tools': {
      url: '/newspaper/images/papa_alpha_kit_collection.jpg',
      altText: 'Papa-Alpha precision rigging tool kit for Piper airframes',
    },
    'on-sale': {
      url: 'https://cdn.shopify.com/s/files/1/0763/1306/7739/collections/Garmin_Sales_Banner.png?v=1763254366',
      altText: 'Current Garmin sale inventory supported by RWAS',
    },
  };
  return shopifyImage || fallbackByHandle[handle];
}

export function isQuoteCollection(handle: string) {
  return handle === 'avionics-certified';
}

export function isQuoteProduct(product: {
  variants?: Array<{ price: { amount: string } }>;
  productType?: string;
}) {
  const minPrice = product.variants?.[0]?.price?.amount ?? '0';
  return Number(minPrice) === 0 || product.productType === 'Certified';
}
