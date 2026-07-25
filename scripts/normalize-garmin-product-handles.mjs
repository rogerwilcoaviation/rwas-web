#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const REPORT_DIR =
  process.env.RWAS_GARMIN_HANDLE_REPORT_DIR ||
  '/Users/rwas/.openclaw/workspace/reports/garmin-handle-normalization-2026-07-24';
const REQUIRED_PUBLICATION = 'Roger Wilco Aviation Services (RWAS)';
const DIRECT_PUBLIC_TYPES = new Set([
  'Avionics — Experimental',
  'Garmin Dealer Install',
  'Pilot Gear',
  'Watches & Accessories',
]);
const APPLY = process.argv.includes('--apply');
const expectedArgument = process.argv.find((argument) =>
  argument.startsWith('--expect='),
);
const EXPECTED_COUNT = expectedArgument
  ? Number(expectedArgument.slice('--expect='.length))
  : null;

function loadEnv(file) {
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
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

function firstSku(product) {
  return String(product.variants.nodes[0]?.sku || '')
    .trim()
    .toUpperCase();
}

function isSeoSafeHandle(handle) {
  return /^[a-z0-9][a-z0-9-]*$/.test(handle);
}

function normalizedHandle(handle) {
  return handle
    .replace(/[®™©℠]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 240)
    .replace(/-+$/g, '');
}

function isPublishedToRwas(product) {
  return product.resourcePublicationsV2.nodes.some(
    (entry) => entry.publication.name === REQUIRED_PUBLICATION,
  );
}

function isPublicCatalogProduct(product) {
  if (
    product.status !== 'ACTIVE' ||
    product.vendor !== 'Garmin' ||
    !isPublishedToRwas(product)
  ) {
    return false;
  }
  if (DIRECT_PUBLIC_TYPES.has(product.productType)) return true;
  if (product.productType !== 'Avionics — Certified') return false;
  const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
  const price = Number(product.variants.nodes[0]?.price || 0);
  return (
    tags.has('otc-eligible') &&
    !tags.has('otc-disabled') &&
    !tags.has('garmin-dealer-only') &&
    Number.isFinite(price) &&
    price > 0
  );
}

loadEnv(SHOPIFY_ENV_PATH);
const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token =
  process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || '2026-01';
if (!domain || !token) {
  throw new Error(`Missing Shopify Admin credentials in ${SHOPIFY_ENV_PATH}`);
}

async function shopifyGraphql(query, variables = {}) {
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
    const payload = await response.json();
    if (
      payload.errors?.some((error) =>
        String(error.message || error)
          .toLowerCase()
          .includes('throttled'),
      )
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** attempt, 15000)),
      );
      continue;
    }
    if (!response.ok || payload.errors?.length) {
      throw new Error(
        JSON.stringify(payload.errors || { status: response.status }),
      );
    }
    return payload.data;
  }
  throw new Error('Shopify Admin throttling retries exhausted');
}

async function getAllProducts() {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query GarminHandleProducts($after: String) {
        products(first: 100, after: $after, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            vendor
            productType
            tags
            resourcePublicationsV2(first: 50, onlyPublished: true) {
              nodes { publication { name } }
            }
            variants(first: 1) { nodes { sku price } }
          }
        }
      }`,
      { after: cursor },
    );
    products.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return products;
}

function buildPlan(products) {
  const allByHandle = new Map(
    products.map((product) => [product.handle, product]),
  );
  const candidates = products.filter(
    (product) =>
      isPublicCatalogProduct(product) && !isSeoSafeHandle(product.handle),
  );
  const proposedHandles = new Map();
  const blockers = [];
  const changes = candidates.map((product) => {
    const nextHandle = normalizedHandle(product.handle);
    if (!nextHandle || !isSeoSafeHandle(nextHandle)) {
      blockers.push({
        sku: firstSku(product),
        title: product.title,
        currentHandle: product.handle,
        state: 'normalization-did-not-produce-safe-handle',
      });
    }
    const currentOwner = allByHandle.get(nextHandle);
    if (currentOwner && currentOwner.id !== product.id) {
      blockers.push({
        sku: firstSku(product),
        title: product.title,
        currentHandle: product.handle,
        nextHandle,
        conflictingProductId: currentOwner.id,
        state: 'existing-handle-collision',
      });
    }
    if (proposedHandles.has(nextHandle)) {
      blockers.push({
        sku: firstSku(product),
        title: product.title,
        currentHandle: product.handle,
        nextHandle,
        conflictingProductId: proposedHandles.get(nextHandle),
        state: 'planned-handle-collision',
      });
    }
    proposedHandles.set(nextHandle, product.id);
    return {
      id: product.id,
      sku: firstSku(product),
      title: product.title,
      productType: product.productType,
      currentHandle: product.handle,
      nextHandle,
    };
  });
  return { changes, blockers };
}

async function updateHandle(record) {
  const data = await shopifyGraphql(
    `mutation NormalizeGarminProductHandle($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle }
        userErrors { field message }
      }
    }`,
    {
      product: {
        id: record.id,
        handle: record.nextHandle,
        redirectNewHandle: true,
      },
    },
  );
  const errors = data.productUpdate.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
  if (data.productUpdate.product?.handle !== record.nextHandle) {
    throw new Error(
      `Shopify did not retain exact handle ${record.nextHandle} for ${record.sku}`,
    );
  }
}

const beforeProducts = await getAllProducts();
const plan = buildPlan(beforeProducts);
if (plan.blockers.length) {
  throw new Error(`Unsafe handle plan: ${JSON.stringify(plan.blockers)}`);
}
if (EXPECTED_COUNT !== null && plan.changes.length !== EXPECTED_COUNT) {
  throw new Error(
    `Expected ${EXPECTED_COUNT} handle changes, found ${plan.changes.length}`,
  );
}

fs.mkdirSync(REPORT_DIR, { recursive: true });
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(
  REPORT_DIR,
  `${APPLY ? 'apply' : 'dry-run'}-plan-${runStamp}.json`,
);
fs.writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: APPLY ? 'apply' : 'dry-run',
      source: SHOPIFY_ENV_PATH,
      requiredPublication: REQUIRED_PUBLICATION,
      changes: plan.changes,
      blockers: plan.blockers,
    },
    null,
    2,
  )}\n`,
);

if (APPLY) {
  for (const [index, record] of plan.changes.entries()) {
    await updateHandle(record);
    if ((index + 1) % 25 === 0 || index + 1 === plan.changes.length) {
      process.stderr.write(
        `Normalized product handles ${index + 1}/${plan.changes.length}\n`,
      );
    }
  }
}

let remaining = null;
if (APPLY) {
  const afterProducts = await getAllProducts();
  const afterPlan = buildPlan(afterProducts);
  if (afterPlan.blockers.length || afterPlan.changes.length) {
    throw new Error(
      `Post-apply handle verification failed: ${JSON.stringify(afterPlan)}`,
    );
  }
  remaining = 0;
}

process.stdout.write(
  `${JSON.stringify(
    {
      mode: APPLY ? 'apply' : 'dry-run',
      allProductsAudited: beforeProducts.length,
      plannedHandleChanges: plan.changes.length,
      collisions: plan.blockers.length,
      reportPath,
      remainingUnsafePublicHandles: remaining,
      changes: plan.changes,
    },
    null,
    2,
  )}\n`,
);
