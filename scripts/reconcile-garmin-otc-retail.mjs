#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const PRICE_AUTHORITY_PATH =
  process.env.RWAS_GARMIN_PRICE_AUTHORITY ||
  '/Users/rwas/.openclaw/cache/garmin-pricing/latest.json';
const RETAIL_COLLECTION_HANDLE = 'avionics-certified';

const OTC_RETAIL_PRODUCTS = [
  { sku: '010-02232-51', family: 'GNC 355' },
  { sku: '010-01822-50', family: 'GPS 175' },
  { sku: '010-01823-50', family: 'GNX 375' },
  { sku: 'K10-00280-01', family: 'G5 Certified' },
  { sku: 'K10-00280-21', family: 'G5 Certified' },
  { sku: 'K10-00280-31', family: 'G5 Certified' },
  { sku: 'K10-00280-51', family: 'G5 Certified' },
  { sku: '010-02203-00', family: 'GAD 13' },
  { sku: '010-02203-K0', family: 'GAD 13 / GTP 59 kit' },
  { sku: '010-01074-70', family: 'GAP 26' },
  { sku: '010-01074-71', family: 'GAP 26' },
  { sku: '010-02325-00', family: 'GI 275 Base' },
  { sku: '010-02325-10', family: 'GI 275 Base' },
  { sku: '010-02325-20', family: 'GI 275 Base' },
  { sku: 'K10-00202-00', family: 'Garmin AOA System' },
  { sku: 'K10-00202-10', family: 'Garmin AOA System' },
  { sku: 'K10-00202-20', family: 'Garmin AOA System' },
  { sku: '010-01287-00', family: 'GI 260 AOA' },
  { sku: 'K10-00276-05', family: 'GTX 335 with WAAS kit' },
  { sku: '010-01083-01', family: 'GTX 325' },
  { sku: '010-01319-02', family: 'GMA 345' },
  { sku: '010-01319-13', family: 'GMA 342' },
  { sku: '010-02480-01', family: 'GTR 205' },
  { sku: '010-01788-00', family: 'GMU 11' },
  { sku: '010-01788-01', family: 'GMU 11' },
];

const CATALOG_GAPS = [
  {
    family: 'GDL 82',
    reason: 'No current saleable primary-unit SKU with retail-price evidence',
  },
  {
    family: 'GNC 215',
    reason: 'No current saleable primary-unit SKU with retail-price evidence',
  },
  {
    family: 'GSB 15',
    reason: 'No current saleable primary-unit SKU with retail-price evidence',
  },
];

const REQUIRED_TAGS = ['garmin', 'garmin-retail-policy-2026', 'otc-eligible'];
const CONFLICTING_TAGS = new Set([
  'garmin-dealer-only',
  'install-by-rwas',
  'otc-disabled',
  'stock-check-required',
]);

const DUAL_G5_DESCRIPTION = `
<p><strong>Garmin Dual G5 AI/HSI Kit for certificated aircraft</strong> is a complete certified dual-display package for an electronic attitude indicator and HSI configuration.</p>
<p><strong>Retail price:</strong> The current Garmin retail price is shown on this page. For package and special pricing please contact us.</p>
<p><strong>Garmin kit part number:</strong> K10-00280-51</p>
<h3>Flight displays</h3>
<ul>
  <li>2 × certified G5 installation kits with lightning protection modules — K10-00280-11</li>
  <li>2 × G5 backup batteries — included with the G5 assemblies</li>
</ul>
<h3>Sensors</h3>
<ul>
  <li>1 × GMU 11 magnetometer, FAA-PMA — 010-01788-01</li>
  <li>1 × GMU 11 installation kit — 011-04349-90</li>
  <li>1 × GTP 59 outside-air-temperature probe — 011-00978-00</li>
  <li>1 × GPS antenna, BNC — 010-12444-10</li>
</ul>
<h3>Interfaces and connectors</h3>
<ul>
  <li>1 × GAD 13 adapter, FAA-PMA — 010-02203-00</li>
  <li>1 × 9-pin connector kit with CAN terminator, PMA — 011-03002-10</li>
  <li>1 × GAD 29D ARINC 429 adapter, FAA-PMA — 010-01172-21</li>
  <li>1 × GAD 29 connector kit — 011-03271-00</li>
</ul>
<h3>Registration and media</h3>
<ul>
  <li>1 × G5 STC product registration / permission letter — 010-12493-20</li>
  <li>1 × G5 microSD card — 010-12493-30</li>
</ul>
<h3>Ordering and installation</h3>
<p>This is a <strong>special-order equipment package</strong>. RWAS receives the package from Garmin and then ships it to you. We confirm Garmin availability and estimated transit time after ordering.</p>
<p>This listing is for <strong>equipment only</strong>; installation is not included. Installation in a certificated aircraft must be completed and returned to service by appropriately authorized personnel using Garmin-approved data and confirming STC/AML eligibility.</p>
`.trim();

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

  for (let attempt = 0; attempt < 8; attempt += 1) {
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
    if (response.status === 429) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** attempt, 15000)),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Shopify Admin API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload.errors?.length) {
      const throttled = payload.errors.some((error) =>
        String(error.message || error)
          .toLowerCase()
          .includes('throttled'),
      );
      if (throttled) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * 2 ** attempt, 15000)),
        );
        continue;
      }
      throw new Error(JSON.stringify(payload.errors));
    }
    return payload.data;
  }
  throw new Error('Shopify Admin throttling retries exhausted');
}

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function findCollection() {
  const data = await shopifyGraphql(
    `query RetailCollection($query: String!) {
      collections(first: 10, query: $query) {
        nodes { id handle title }
      }
    }`,
    { query: `handle:${RETAIL_COLLECTION_HANDLE}` },
  );
  const collection = data.collections.nodes.find(
    (node) => node.handle === RETAIL_COLLECTION_HANDLE,
  );
  if (!collection) {
    throw new Error(`Missing Shopify collection: ${RETAIL_COLLECTION_HANDLE}`);
  }
  return collection;
}

async function findSku(sku) {
  const data = await shopifyGraphql(
    `query ProductBySku($query: String!) {
      products(first: 20, query: $query) {
        nodes {
          id
          title
          handle
          productType
          status
          tags
          descriptionHtml
          collections(first: 50) { nodes { id handle } }
          variants(first: 100) {
            nodes { id sku price }
          }
        }
      }
    }`,
    { query: `sku:${sku}` },
  );

  const matches = [];
  for (const product of data.products.nodes) {
    for (const variant of product.variants.nodes) {
      if (variant.sku === sku) matches.push({ product, variant });
    }
  }
  return matches;
}

async function buildAudit(priceAuthority, collection) {
  const records = [];
  for (const policy of OTC_RETAIL_PRODUCTS) {
    const authority = priceAuthority.rows[policy.sku];
    if (!authority || !Number.isFinite(Number(authority.list_price))) {
      records.push({
        ...policy,
        state: 'missing-price-authority',
      });
      continue;
    }

    const matches = await findSku(policy.sku);
    if (matches.length !== 1) {
      records.push({
        ...policy,
        expectedPrice: money(authority.list_price),
        state:
          matches.length === 0 ? 'missing-storefront-product' : 'ambiguous-sku',
        matchCount: matches.length,
      });
      continue;
    }

    const { product, variant } = matches[0];
    const nextTags = normalizeTags(product.tags);
    const currentTagNames = new Set(
      product.tags.map((tag) => tag.toLowerCase()),
    );
    const nextTagNames = new Set(nextTags.map((tag) => tag.toLowerCase()));
    const addedTags = nextTags.filter(
      (tag) => !currentTagNames.has(tag.toLowerCase()),
    );
    const removedTags = product.tags.filter(
      (tag) => !nextTagNames.has(tag.toLowerCase()),
    );
    const inRetailCollection = product.collections.nodes.some(
      (node) => node.id === collection.id,
    );
    const expectedPrice = money(authority.list_price);
    const changes = {
      productType: product.productType !== 'Avionics — Certified',
      tags: !sameTags(product.tags, nextTags),
      retailPrice: money(variant.price) !== expectedPrice,
      retailCollection: !inRetailCollection,
      description:
        policy.sku === 'K10-00280-51' &&
        product.descriptionHtml.trim() !== DUAL_G5_DESCRIPTION,
    };

    records.push({
      ...policy,
      state: Object.values(changes).some(Boolean)
        ? 'changes-required'
        : 'verified',
      productId: product.id,
      variantId: variant.id,
      handle: product.handle,
      title: product.title,
      currentPrice: money(variant.price),
      expectedPrice,
      currentProductType: product.productType,
      inRetailCollection,
      currentTags: product.tags,
      nextTags,
      addedTags,
      removedTags,
      changes,
    });
  }
  return records;
}

async function updateProduct(record) {
  const product = {
    id: record.productId,
    productType: 'Avionics — Certified',
    tags: record.nextTags,
  };
  if (record.sku === 'K10-00280-51') {
    product.descriptionHtml = DUAL_G5_DESCRIPTION;
  }

  const result = await shopifyGraphql(
    `mutation ReconcileOtcProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle }
        userErrors { field message }
      }
    }`,
    { product },
  );
  assertNoUserErrors(result, 'productUpdate');
}

async function updateVariantPrice(record) {
  const result = await shopifyGraphql(
    `mutation ReconcileOtcPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku price }
        userErrors { field message }
      }
    }`,
    {
      productId: record.productId,
      variants: [{ id: record.variantId, price: record.expectedPrice }],
    },
  );
  assertNoUserErrors(result, 'productVariantsBulkUpdate');
}

async function addToCollection(record, collection) {
  const result = await shopifyGraphql(
    `mutation AddOtcProductToRetail($id: ID!, $productIds: [ID!]!) {
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

async function applyAudit(records, collection) {
  const actionable = records.filter(
    (record) => record.state === 'changes-required',
  );
  for (const record of actionable) {
    if (
      record.changes.productType ||
      record.changes.tags ||
      record.changes.description
    ) {
      await updateProduct(record);
    }
    if (record.changes.retailPrice) await updateVariantPrice(record);
    if (record.changes.retailCollection) {
      await addToCollection(record, collection);
    }
  }
  return actionable.length;
}

function publicRecord(record) {
  const {
    productId: _productId,
    variantId: _variantId,
    currentTags: _currentTags,
    nextTags: _nextTags,
    ...safe
  } = record;
  return safe;
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);

  const priceAuthority = JSON.parse(
    fs.readFileSync(PRICE_AUTHORITY_PATH, 'utf8'),
  );
  const collection = await findCollection();
  const before = await buildAudit(priceAuthority, collection);
  const blockers = before.filter((record) =>
    ['missing-price-authority', 'ambiguous-sku'].includes(record.state),
  );
  if (blockers.length) {
    throw new Error(
      `Unsafe catalog state: ${blockers.map((record) => `${record.sku}:${record.state}`).join(', ')}`,
    );
  }

  let mutationsApplied = 0;
  if (apply) mutationsApplied = await applyAudit(before, collection);
  const after = apply ? await buildAudit(priceAuthority, collection) : before;
  const failedVerification = after.filter(
    (record) =>
      !['verified', 'missing-storefront-product'].includes(record.state),
  );

  const output = {
    mode: apply ? 'apply' : 'dry-run',
    priceAuthority: {
      source: priceAuthority.source,
      modified: priceAuthority.modified,
      sha256: priceAuthority.sha256,
    },
    retailCollection: {
      handle: collection.handle,
      title: collection.title,
    },
    policySkuCount: OTC_RETAIL_PRODUCTS.length,
    mutationsApplied,
    results: after.map(publicRecord),
    catalogGaps: CATALOG_GAPS,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (apply && failedVerification.length) {
    throw new Error(
      `Post-apply verification failed: ${failedVerification.map((record) => `${record.sku}:${record.state}`).join(', ')}`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`Garmin OTC reconciliation failed: ${error.message}\n`);
  process.exitCode = 1;
});
