#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const PRICE_AUTHORITY_PATH =
  process.env.RWAS_GARMIN_PRICE_AUTHORITY ||
  '/Users/rwas/.openclaw/cache/garmin-pricing/latest.json';

const EXPERIMENTAL_PRODUCT_TYPE = 'Avionics — Experimental';
const DEALER_INSTALL_PRODUCT_TYPE = 'Garmin Dealer Install';
const RETAIL_COLLECTION_HANDLE = 'avionics-certified';
const EXPERIMENTAL_COLLECTION_HANDLE = 'avionics-experimental';
const LEGACY_EXPERIMENTAL_COLLECTION_HANDLE = 'retail-experimental';
const DEALER_INSTALL_COLLECTION_HANDLE = 'garmin-dealer-install';
const ACCESSORIES_COLLECTION_HANDLE = 'garmin-avionics-accessories';
const CERTIFIED_COLLECTION_HANDLE = 'garmin-avionics';

// Exact Garmin part numbers are authoritative. Display names alone are unsafe:
// GDU 450/460/470 model names appear in multiple certification contexts, while
// Garmin assigns the unit-only SKUs below to its experimental product line.
const EXPERIMENTAL_SKUS = new Set([
  '010-01056-00',
  '010-01057-00',
  '010-01485-01',
  '010-01765-00',
  '011-02347-00',
  '011-02348-00',
  'K00-00512-10',
  'K00-00513-10',
  'K00-00514-10',
  'K10-00016-13',
  'K10-00016-14',
]);

const SENSOR_INSTALL_POLICY = {
  family: 'engine-airframe-lrus',
  subcategory: 'engine-indication-systems',
  description:
    'Garmin engine sensor kit for certified TXi, G3X Touch Certified, and GI 275 EIS installations. Aircraft eligibility, sensor compatibility, and required supporting parts must be confirmed by RWAS before installation.',
};

const DEALER_INSTALL_POLICIES = new Map([
  [
    '010-02305-00',
    {
      family: 'g3x-touch-suite',
      subcategory: 'g3x-touch-suite',
      description:
        'Garmin LRU kit for certified G3X Touch installations. Aircraft eligibility, system configuration, approval basis, and required supporting parts must be confirmed by RWAS before installation.',
    },
  ],
  ['K00-01299-10', SENSOR_INSTALL_POLICY],
  ['K00-01300-10', SENSOR_INSTALL_POLICY],
  ['K00-01301-10', SENSOR_INSTALL_POLICY],
  ['K00-01302-10', SENSOR_INSTALL_POLICY],
  ['K00-01303-10', SENSOR_INSTALL_POLICY],
  ['K00-01304-10', SENSOR_INSTALL_POLICY],
  ['K00-01305-10', SENSOR_INSTALL_POLICY],
  ['K00-01306-10', SENSOR_INSTALL_POLICY],
]);

const MANAGED_SKUS = new Set([
  ...EXPERIMENTAL_SKUS,
  ...DEALER_INSTALL_POLICIES.keys(),
]);

const EXPERIMENTAL_REQUIRED_TAGS = [
  'garmin',
  'experimental-retail',
  'otc-eligible',
];
const EXPERIMENTAL_CONFLICTING_TAGS = new Set([
  'garmin-dealer-only',
  'install-by-rwas',
  'otc-disabled',
  'stock-check-required',
]);
const DEALER_INSTALL_REQUIRED_TAGS = [
  'garmin',
  'garmin-dealer-only',
  'install-by-rwas',
  'otc-disabled',
  'stock-check-required',
];
const DEALER_INSTALL_CONFLICTING_TAGS = new Set([
  'experimental-retail',
  'otc-eligible',
  'garmin-retail-policy-2026',
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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeExperimentalTags(tags) {
  const kept = tags.filter(
    (tag) => !EXPERIMENTAL_CONFLICTING_TAGS.has(tag.toLowerCase()),
  );
  const existing = new Set(kept.map((tag) => tag.toLowerCase()));
  for (const tag of EXPERIMENTAL_REQUIRED_TAGS) {
    if (!existing.has(tag.toLowerCase())) kept.push(tag);
  }
  return kept;
}

function normalizeDealerInstallTags(tags, policy) {
  const kept = tags.filter((tag) => {
    const normalized = tag.toLowerCase();
    return (
      !DEALER_INSTALL_CONFLICTING_TAGS.has(normalized) &&
      !normalized.startsWith('garmin-category:') &&
      !normalized.startsWith('garmin-family:') &&
      !normalized.startsWith('garmin-subcategory:')
    );
  });
  const required = [
    ...DEALER_INSTALL_REQUIRED_TAGS,
    'garmin-category:garmin-dealer-install',
    `garmin-family:${policy.family}`,
    `garmin-subcategory:${policy.subcategory}`,
  ];
  const existing = new Set(kept.map((tag) => tag.toLowerCase()));
  for (const tag of required) {
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

function dealerInstallDescription(product, sku, policy) {
  return `<p>${escapeHtml(product.title)}</p><p>Garmin part number <strong>${escapeHtml(sku)}</strong>.</p><p>${escapeHtml(policy.description)}</p>`;
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
        nodes {
          id
          handle
          title
          ruleSet {
            appliedDisjunctively
            rules { column relation condition }
          }
        }
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

async function getProductsForQuery(query) {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query ManagedExperimentalProducts($query: String!, $after: String) {
        products(first: 100, after: $after, query: $query, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            productType
            tags
            descriptionHtml
            collections(first: 50) { nodes { id handle } }
            variants(first: 100) { nodes { id sku price } }
          }
        }
      }`,
      { query, after: cursor },
    );
    products.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return products;
}

async function getManagedProducts() {
  const skuQuery = [...MANAGED_SKUS].map((sku) => `sku:${sku}`).join(' OR ');
  const [experimentalProducts, knownSkuProducts] = await Promise.all([
    getProductsForQuery(`product_type:"${EXPERIMENTAL_PRODUCT_TYPE}"`),
    getProductsForQuery(skuQuery),
  ]);
  const productsById = new Map(
    [...experimentalProducts, ...knownSkuProducts].map((product) => [
      product.id,
      product,
    ]),
  );
  return [...productsById.values()];
}

function managedSkuForProduct(product) {
  const managed = product.variants.nodes
    .map((variant) => variant.sku)
    .filter((sku) => MANAGED_SKUS.has(sku));
  if (managed.length > 1) return { state: 'ambiguous-managed-skus', sku: null };
  if (managed.length === 1) return { state: 'managed', sku: managed[0] };
  if (product.productType === EXPERIMENTAL_PRODUCT_TYPE) {
    return {
      state: 'unclassified-experimental-sku',
      sku: product.variants.nodes[0]?.sku || null,
    };
  }
  return { state: 'unmanaged', sku: null };
}

function buildAudit(products, priceAuthority) {
  return products.map((product) => {
    const managed = managedSkuForProduct(product);
    if (managed.state !== 'managed') {
      return {
        title: product.title,
        handle: product.handle,
        sku: managed.sku,
        status: product.status,
        state: managed.state,
      };
    }

    const sku = managed.sku;
    const classification = EXPERIMENTAL_SKUS.has(sku)
      ? 'experimental'
      : 'certified-dealer-install';
    const policy = DEALER_INSTALL_POLICIES.get(sku);
    const expectedProductType =
      classification === 'experimental'
        ? EXPERIMENTAL_PRODUCT_TYPE
        : DEALER_INSTALL_PRODUCT_TYPE;
    const nextTags =
      classification === 'experimental'
        ? normalizeExperimentalTags(product.tags)
        : normalizeDealerInstallTags(product.tags, policy);
    const expectedHandle = retailSafeHandle(product.handle);
    const expectedDescription =
      classification === 'experimental'
        ? product.descriptionHtml
        : dealerInstallDescription(product, sku, policy);
    const requiredCollections =
      classification === 'experimental'
        ? [RETAIL_COLLECTION_HANDLE, EXPERIMENTAL_COLLECTION_HANDLE]
        : [DEALER_INSTALL_COLLECTION_HANDLE, ACCESSORIES_COLLECTION_HANDLE];
    const prohibitedCollections =
      classification === 'experimental'
        ? [LEGACY_EXPERIMENTAL_COLLECTION_HANDLE, CERTIFIED_COLLECTION_HANDLE]
        : [
            RETAIL_COLLECTION_HANDLE,
            EXPERIMENTAL_COLLECTION_HANDLE,
            LEGACY_EXPERIMENTAL_COLLECTION_HANDLE,
            CERTIFIED_COLLECTION_HANDLE,
          ];
    const currentCollectionHandles = new Set(
      product.collections.nodes.map((collection) => collection.handle),
    );
    const missingCollections = requiredCollections.filter(
      (handle) => !currentCollectionHandles.has(handle),
    );
    const prohibitedPresentCollections = prohibitedCollections.filter(
      (handle) => currentCollectionHandles.has(handle),
    );
    const variantChecks = product.variants.nodes.map((variant) => {
      const currentPrice = money(variant.price);
      const authority = variant.sku
        ? priceAuthority.rows[variant.sku]
        : undefined;
      const expectedPrice =
        classification === 'experimental' && authority?.list_price
          ? money(authority.list_price)
          : currentPrice;
      return {
        variantId: variant.id,
        sku: variant.sku || null,
        currentPrice,
        expectedPrice,
        priceSource:
          classification === 'experimental' && authority?.list_price
            ? 'garmin-price-authority'
            : 'shopify-current-price',
        positivePrice:
          Number.isFinite(Number(currentPrice)) && Number(currentPrice) > 0,
        priceChange: currentPrice !== expectedPrice,
      };
    });
    const changes = {
      productType: product.productType !== expectedProductType,
      handle: product.handle !== expectedHandle,
      tags: !sameTags(product.tags, nextTags),
      description: product.descriptionHtml !== expectedDescription,
      retailPrices: variantChecks.some((variant) => variant.priceChange),
      addCollections: missingCollections.length > 0,
      removeCollections: prohibitedPresentCollections.length > 0,
    };

    return {
      productId: product.id,
      title: product.title,
      handle: product.handle,
      expectedHandle,
      sku,
      classification,
      status: product.status,
      state: variantChecks.every((variant) => variant.positivePrice)
        ? Object.values(changes).some(Boolean)
          ? 'changes-required'
          : 'verified'
        : 'missing-price',
      currentProductType: product.productType,
      expectedProductType,
      currentTags: product.tags,
      nextTags,
      expectedDescription,
      missingCollections,
      prohibitedPresentCollections,
      variants: variantChecks,
      changes,
    };
  });
}

async function updateProduct(record) {
  const product = { id: record.productId };
  if (record.changes.productType) {
    product.productType = record.expectedProductType;
  }
  if (record.changes.tags) product.tags = record.nextTags;
  if (record.changes.description) {
    product.descriptionHtml = record.expectedDescription;
  }
  if (record.changes.handle) {
    product.handle = record.expectedHandle;
    product.redirectNewHandle = true;
  }
  const result = await shopifyGraphql(
    `mutation ReconcileExperimentalProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle productType }
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
    `mutation AddManagedProductToCollection($id: ID!, $productIds: [ID!]!) {
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

async function removeFromCollection(record, collection) {
  const result = await shopifyGraphql(
    `mutation RemoveManagedProductFromCollection($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,
    { id: collection.id, productIds: [record.productId] },
  );
  const errors = result.collectionRemoveProducts.userErrors.filter(
    (error) =>
      !(
        collection.ruleSet &&
        error.message
          .toLowerCase()
          .includes("can't manually remove products from a smart collection")
      ),
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function applyAudit(records, collections) {
  const actionable = records.filter(
    (record) => record.state === 'changes-required',
  );
  for (const record of actionable) {
    if (
      record.changes.productType ||
      record.changes.tags ||
      record.changes.description ||
      record.changes.handle
    ) {
      await updateProduct(record);
    }
    if (record.changes.retailPrices) await updateVariantPrices(record);
    for (const handle of record.missingCollections) {
      if (!collections[handle].ruleSet) {
        await addToCollection(record, collections[handle]);
      }
    }
    for (const handle of record.prohibitedPresentCollections) {
      await removeFromCollection(record, collections[handle]);
    }
  }
  return actionable.length;
}

function publicRecord(record) {
  const {
    productId: _productId,
    currentTags: _currentTags,
    nextTags: _nextTags,
    expectedDescription: _expectedDescription,
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

function onlySmartCollectionChanges(record, collections) {
  if (record.state !== 'changes-required') return false;
  const nonCollectionChange = Object.entries(record.changes).some(
    ([key, changed]) =>
      changed && !['addCollections', 'removeCollections'].includes(key),
  );
  if (nonCollectionChange) return false;
  return [
    ...record.missingCollections,
    ...record.prohibitedPresentCollections,
  ].every((handle) => collections[handle]?.ruleSet);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const priceAuthority = JSON.parse(
    fs.readFileSync(PRICE_AUTHORITY_PATH, 'utf8'),
  );
  const collectionHandles = [
    RETAIL_COLLECTION_HANDLE,
    EXPERIMENTAL_COLLECTION_HANDLE,
    LEGACY_EXPERIMENTAL_COLLECTION_HANDLE,
    DEALER_INSTALL_COLLECTION_HANDLE,
    ACCESSORIES_COLLECTION_HANDLE,
    CERTIFIED_COLLECTION_HANDLE,
  ];
  const collectionEntries = await Promise.all(
    collectionHandles.map(async (handle) => [
      handle,
      await findCollection(handle),
    ]),
  );
  const collections = Object.fromEntries(collectionEntries);
  const products = await getManagedProducts();
  if (!products.length) throw new Error('No managed products found');

  const before = buildAudit(products, priceAuthority);
  const blockers = before.filter((record) =>
    [
      'ambiguous-managed-skus',
      'missing-price',
      'unclassified-experimental-sku',
      'unmanaged',
    ].includes(record.state),
  );
  if (blockers.length) {
    throw new Error(
      `Unsafe experimental catalog state: ${blockers
        .map((record) => `${record.handle}:${record.state}`)
        .join(', ')}`,
    );
  }

  let productsChanged = 0;
  if (apply) productsChanged = await applyAudit(before, collections);
  let after = before;
  let failedVerification = before.filter(
    (record) => record.state !== 'verified',
  );
  if (apply) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      after = buildAudit(await getManagedProducts(), priceAuthority);
      failedVerification = after.filter(
        (record) => record.state !== 'verified',
      );
      if (!failedVerification.length) break;
      if (
        !failedVerification.every((record) =>
          onlySmartCollectionChanges(record, collections),
        )
      ) {
        break;
      }
      await delay(3000);
    }
  }

  const output = {
    mode: apply ? 'apply' : 'dry-run',
    priceAuthority: {
      source: priceAuthority.source,
      modified: priceAuthority.modified,
      sha256: priceAuthority.sha256,
    },
    auditedProductCount: after.length,
    experimentalProductCount: after.filter(
      (record) => record.classification === 'experimental',
    ).length,
    dealerInstallProductCount: after.filter(
      (record) => record.classification === 'certified-dealer-install',
    ).length,
    productsChanged,
    results: after.map(publicRecord),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (apply && failedVerification.length) {
    throw new Error(
      `Post-apply verification failed: ${failedVerification
        .map((record) => `${record.handle}:${record.state}`)
        .join(', ')}`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(
    `Experimental collection reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
