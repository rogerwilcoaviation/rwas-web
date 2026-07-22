#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const PRICE_AUTHORITY_PATH =
  process.env.RWAS_GARMIN_PRICE_AUTHORITY ||
  '/Users/rwas/.openclaw/cache/garmin-pricing/latest.json';
const EXPERIMENTAL_PRODUCT_TYPE = 'Avionics — Experimental';
const RETAIL_COLLECTION_HANDLE = 'avionics-certified';
const EXPERIMENTAL_COLLECTION_HANDLE = 'avionics-experimental';

const REQUIRED_TAGS = ['garmin', 'experimental-retail', 'otc-eligible'];
const CONFLICTING_TAGS = new Set([
  'garmin-dealer-only',
  'install-by-rwas',
  'otc-disabled',
  'stock-check-required',
]);

function loadEnv(path) {
  const contents = fs.readFileSync(path, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}

function money(value) {
  return Number(value).toFixed(2);
}

function retailSafeHandle(handle) {
  return handle
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function normalizeTags(tags) {
  const kept = tags.filter((tag) => !CONFLICTING_TAGS.has(tag.toLowerCase()));
  const existing = new Set(kept.map((tag) => tag.toLowerCase()));
  for (const tag of REQUIRED_TAGS) {
    if (!existing.has(tag.toLowerCase())) kept.push(tag);
  }
  return kept;
}

function sameTags(left, right) {
  const normalize = (tags) =>
    [...tags]
      .map((tag) => tag.toLowerCase())
      .sort()
      .join('\n');
  return normalize(left) === normalize(right);
}

async function shopifyGraphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  if (!domain || !token) {
    throw new Error(
      `Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN in ${SHOPIFY_ENV_PATH}`,
    );
  }

  const response = await fetch(
    `https://${domain}/admin/api/${version}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!response.ok) {
    throw new Error(`Shopify Admin API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors));
  return payload.data;
}

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function findCollection(handle) {
  const data = await shopifyGraphql(
    `query CollectionByHandle($query: String!) {
      collections(first: 10, query: $query) {
        nodes { id handle title }
      }
    }`,
    { query: `handle:${handle}` },
  );
  const collection = data.collections.nodes.find(
    (node) => node.handle === handle,
  );
  if (!collection) throw new Error(`Missing Shopify collection: ${handle}`);
  return collection;
}

async function getExperimentalProducts() {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query ExperimentalProducts($query: String!, $after: String) {
        products(first: 100, after: $after, query: $query, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            productType
            tags
            collections(first: 50) { nodes { id handle } }
            variants(first: 100) { nodes { id sku price } }
          }
        }
      }`,
      {
        query: `product_type:"${EXPERIMENTAL_PRODUCT_TYPE}"`,
        after: cursor,
      },
    );
    products.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);

  return products.filter(
    (product) => product.productType === EXPERIMENTAL_PRODUCT_TYPE,
  );
}

function buildAudit(products, priceAuthority, collections) {
  return products.map((product) => {
    if (product.status !== 'ACTIVE') {
      return {
        title: product.title,
        handle: product.handle,
        status: product.status,
        state: 'inactive',
      };
    }
    if (!product.variants.nodes.length) {
      return {
        title: product.title,
        handle: product.handle,
        status: product.status,
        state: 'missing-variant',
      };
    }

    const nextTags = normalizeTags(product.tags);
    const expectedHandle = retailSafeHandle(product.handle);
    const currentTagNames = new Set(
      product.tags.map((tag) => tag.toLowerCase()),
    );
    const nextTagNames = new Set(nextTags.map((tag) => tag.toLowerCase()));
    const variantChecks = product.variants.nodes.map((variant) => {
      const currentPrice = money(variant.price);
      const authority = variant.sku
        ? priceAuthority.rows[variant.sku]
        : undefined;
      const expectedPrice = authority?.list_price
        ? money(authority.list_price)
        : currentPrice;
      return {
        variantId: variant.id,
        sku: variant.sku || null,
        currentPrice,
        expectedPrice,
        priceSource: authority?.list_price
          ? 'garmin-price-authority'
          : 'shopify-retail-price',
        positivePrice:
          Number.isFinite(Number(currentPrice)) && Number(currentPrice) > 0,
        priceChange: currentPrice !== expectedPrice,
      };
    });
    const currentCollectionHandles = new Set(
      product.collections.nodes.map((collection) => collection.handle),
    );
    const missingCollections = [
      RETAIL_COLLECTION_HANDLE,
      EXPERIMENTAL_COLLECTION_HANDLE,
    ].filter((handle) => !currentCollectionHandles.has(handle));
    const changes = {
      handle: product.handle !== expectedHandle,
      tags: !sameTags(product.tags, nextTags),
      retailPrices: variantChecks.some((variant) => variant.priceChange),
      collections: missingCollections.length > 0,
    };

    return {
      productId: product.id,
      title: product.title,
      handle: product.handle,
      expectedHandle,
      status: product.status,
      state: variantChecks.every((variant) => variant.positivePrice)
        ? Object.values(changes).some(Boolean)
          ? 'changes-required'
          : 'verified'
        : 'missing-retail-price',
      currentTags: product.tags,
      nextTags,
      addedTags: nextTags.filter(
        (tag) => !currentTagNames.has(tag.toLowerCase()),
      ),
      removedTags: product.tags.filter(
        (tag) => !nextTagNames.has(tag.toLowerCase()),
      ),
      missingCollections,
      variants: variantChecks,
      changes,
    };
  });
}

async function updateProduct(record) {
  const product = { id: record.productId };
  if (record.changes.tags) product.tags = record.nextTags;
  if (record.changes.handle) {
    product.handle = record.expectedHandle;
    product.redirectNewHandle = true;
  }
  const result = await shopifyGraphql(
    `mutation ReconcileExperimentalProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle }
        userErrors { field message }
      }
    }`,
    { product },
  );
  assertNoUserErrors(result, 'productUpdate');
}

async function updateVariantPrices(record) {
  const variants = record.variants
    .filter((variant) => variant.priceChange)
    .map((variant) => ({
      id: variant.variantId,
      price: variant.expectedPrice,
    }));
  if (!variants.length) return;

  const result = await shopifyGraphql(
    `mutation ReconcileExperimentalPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku price }
        userErrors { field message }
      }
    }`,
    { productId: record.productId, variants },
  );
  assertNoUserErrors(result, 'productVariantsBulkUpdate');
}

async function addToCollection(record, collection) {
  const result = await shopifyGraphql(
    `mutation AddExperimentalToCollection($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,
    { id: collection.id, productIds: [record.productId] },
  );
  const errors = result.collectionAddProducts.userErrors.filter(
    (error) => !error.message.toLowerCase().includes('already exists'),
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function applyAudit(records, collections) {
  const actionable = records.filter(
    (record) => record.state === 'changes-required',
  );
  for (const record of actionable) {
    if (record.changes.tags || record.changes.handle) {
      await updateProduct(record);
    }
    if (record.changes.retailPrices) await updateVariantPrices(record);
    for (const handle of record.missingCollections) {
      await addToCollection(record, collections[handle]);
    }
  }
  return actionable.length;
}

function publicRecord(record) {
  const {
    productId: _productId,
    currentTags: _currentTags,
    nextTags: _nextTags,
    variants,
    ...safe
  } = record;
  return {
    ...safe,
    variants: variants?.map(
      ({ variantId: _variantId, priceChange, ...variant }) => ({
        ...variant,
        priceChange,
      }),
    ),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const priceAuthority = JSON.parse(
    fs.readFileSync(PRICE_AUTHORITY_PATH, 'utf8'),
  );
  const retailCollection = await findCollection(RETAIL_COLLECTION_HANDLE);
  const experimentalCollection = await findCollection(
    EXPERIMENTAL_COLLECTION_HANDLE,
  );
  const collections = {
    [RETAIL_COLLECTION_HANDLE]: retailCollection,
    [EXPERIMENTAL_COLLECTION_HANDLE]: experimentalCollection,
  };
  const products = await getExperimentalProducts();
  if (!products.length) {
    throw new Error(`No products found for ${EXPERIMENTAL_PRODUCT_TYPE}`);
  }

  const before = buildAudit(products, priceAuthority, collections);
  const blockers = before.filter((record) =>
    ['missing-variant', 'missing-retail-price'].includes(record.state),
  );
  if (blockers.length) {
    throw new Error(
      `Unsafe experimental catalog state: ${blockers.map((record) => `${record.handle}:${record.state}`).join(', ')}`,
    );
  }

  let productsChanged = 0;
  if (apply) productsChanged = await applyAudit(before, collections);
  const afterProducts = apply ? await getExperimentalProducts() : products;
  const after = buildAudit(afterProducts, priceAuthority, collections);
  const failedVerification = after.filter(
    (record) => !['verified', 'inactive'].includes(record.state),
  );

  const output = {
    mode: apply ? 'apply' : 'dry-run',
    productType: EXPERIMENTAL_PRODUCT_TYPE,
    priceAuthority: {
      source: priceAuthority.source,
      modified: priceAuthority.modified,
      sha256: priceAuthority.sha256,
    },
    activeProductCount: after.filter((record) => record.status === 'ACTIVE')
      .length,
    productsChanged,
    results: after.map(publicRecord),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (apply && failedVerification.length) {
    throw new Error(
      `Post-apply verification failed: ${failedVerification.map((record) => `${record.handle}:${record.state}`).join(', ')}`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(
    `Experimental retail reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
