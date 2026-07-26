#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

const COLLECTION_POLICY = {
  sale: 'on-sale',
  rigging: 'rigging-tools',
  deleted: new Set([
    'retail-experimental',
    'garmin-avionics-certified-retail',
    'aircraft-management',
    'lifestyle-garmin',
    'parts-service',
  ]),
};

const PRODUCT_MEDIA_POLICY = new Map([
  [
    'gps-175',
    {
      fingerprint: 'cf-lg-f1b9f3e6-d24c-43c2-aac2-3bf1c773e4f0',
      source:
        'https://res.garmin.com/en/products/010-01822-01/g/cf-lg-f1b9f3e6-d24c-43c2-aac2-3bf1c773e4f0.png',
      alt: 'Garmin GPS 175 GPS navigator',
    },
  ],
  [
    'gtn-625xi-gps-mfd',
    {
      fingerprint: 'cf-lg-9d37047b-b90a-4765-9092-934788ae7abf',
      source:
        'https://res.garmin.com/en/products/010-01997-01/g/cf-lg-9d37047b-b90a-4765-9092-934788ae7abf.jpg',
      alt: 'Garmin GTN 625Xi GPS/MFD',
    },
  ],
  [
    'gtn-635xi-gps-comm-mfd',
    {
      fingerprint: 'cf-lg-d1f7a794-59bb-4173-93fe-b305a8df179e',
      source:
        'https://res.garmin.com/en/products/010-01998-01/g/cf-lg-d1f7a794-59bb-4173-93fe-b305a8df179e.jpg',
      alt: 'Garmin GTN 635Xi GPS/COMM/MFD',
    },
  ],
]);

const REQUIRED_SKUS = new Map([
  ['pa-28-32-34-44-aileron-and-flap-rigging-tool-1', ['13-26179', '13-26180']],
  ['gsb-15', ['010-02201-11']],
]);

function loadEnv(path) {
  for (const rawLine of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
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

async function shopifyGraphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  if (!domain || !token) {
    throw new Error(`Missing Shopify Admin credentials in ${SHOPIFY_ENV_PATH}`);
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
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(JSON.stringify(payload.errors || payload));
  }
  return payload.data;
}

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function getState() {
  const handles = [...PRODUCT_MEDIA_POLICY.keys(), ...REQUIRED_SKUS.keys()];
  return shopifyGraphql(
    `query StoreCleanupAudit($productQuery: String!) {
      collections(first: 100) {
        nodes {
          id
          handle
          title
          descriptionHtml
          productsCount { count }
          products(first: 100) {
            nodes {
              id
              title
              handle
              variants(first: 50) {
                nodes { sku compareAtPrice }
              }
            }
          }
        }
      }
      products(first: 20, query: $productQuery) {
        nodes {
          id
          title
          handle
          variants(first: 50) { nodes { sku inventoryQuantity } }
          media(first: 50) {
            nodes {
              id
              alt
              status
              ... on MediaImage { image { url } }
            }
          }
        }
      }
    }`,
    { productQuery: handles.map((handle) => `handle:${handle}`).join(' OR ') },
  );
}

function audit(state) {
  const collections = new Map(
    state.collections.nodes.map((collection) => [
      collection.handle,
      collection,
    ]),
  );
  const products = new Map(
    state.products.nodes.map((product) => [product.handle, product]),
  );
  const failures = [];
  const sale = collections.get(COLLECTION_POLICY.sale);
  const rigging = collections.get(COLLECTION_POLICY.rigging);
  if (!sale) failures.push('missing on-sale collection');
  if (!rigging) failures.push('missing rigging-tools collection');
  if (rigging && rigging.title !== 'Papa-Alpha Rigging Tools') {
    failures.push(`rigging-tools title is ${JSON.stringify(rigging.title)}`);
  }
  for (const handle of COLLECTION_POLICY.deleted) {
    if (collections.has(handle))
      failures.push(`obsolete collection remains: ${handle}`);
  }

  const nonSaleProducts = (sale?.products.nodes || []).filter((product) =>
    product.variants.nodes.every((variant) => !variant.compareAtPrice),
  );
  const mediaPlans = [];
  for (const [handle, policy] of PRODUCT_MEDIA_POLICY) {
    const product = products.get(handle);
    if (!product) {
      failures.push(`missing media-managed product: ${handle}`);
      continue;
    }
    const correct = product.media.nodes.filter((media) =>
      media.image?.url.includes(policy.fingerprint),
    );
    const alreadyExact =
      product.media.nodes.length === 1 && correct.length === 1;
    mediaPlans.push({
      productId: product.id,
      handle,
      title: product.title,
      currentMedia: product.media.nodes.map((media) => ({
        id: media.id,
        alt: media.alt,
        status: media.status,
        url: media.image?.url || null,
      })),
      keepFileId: correct[0]?.id || null,
      expectedSource: policy.source,
      expectedAlt: policy.alt,
      changeRequired: !alreadyExact,
    });
  }

  for (const [handle, expectedSkus] of REQUIRED_SKUS) {
    const product = products.get(handle);
    if (!product) {
      failures.push(`missing SKU-managed product: ${handle}`);
      continue;
    }
    const actualSkus = new Set(
      product.variants.nodes.map((variant) => variant.sku),
    );
    for (const sku of expectedSkus) {
      if (!actualSkus.has(sku))
        failures.push(`${handle} is missing SKU ${sku}`);
    }
    if (product.variants.nodes.some((variant) => !variant.sku)) {
      failures.push(`${handle} still has a blank SKU`);
    }
  }

  return {
    failures,
    saleCollectionId: sale?.id || null,
    saleDescription: sale?.descriptionHtml || null,
    saleProductCount: sale?.productsCount.count || 0,
    nonSaleProducts: nonSaleProducts.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
    })),
    mediaPlans,
  };
}

async function removeNonSaleProducts(plan) {
  if (!plan.nonSaleProducts.length) return;
  const result = await shopifyGraphql(
    `mutation RemoveNonSaleProducts($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,
    {
      id: plan.saleCollectionId,
      productIds: plan.nonSaleProducts.map((product) => product.id),
    },
  );
  assertNoUserErrors(result, 'collectionRemoveProducts');
}

async function reconcileMedia(mediaPlan) {
  if (!mediaPlan.changeRequired) return;
  const file = mediaPlan.keepFileId
    ? { id: mediaPlan.keepFileId, alt: mediaPlan.expectedAlt }
    : {
        originalSource: mediaPlan.expectedSource,
        alt: mediaPlan.expectedAlt,
        contentType: 'IMAGE',
      };
  const result = await shopifyGraphql(
    `mutation ReconcileProductMedia($identifier: ProductSetIdentifiers!, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product { id handle media(first: 10) { nodes { id alt status } } }
        userErrors { code field message }
      }
    }`,
    { identifier: { id: mediaPlan.productId }, input: { files: [file] } },
  );
  assertNoUserErrors(result, 'productSet');
}

function verificationFailures(plan) {
  const failures = [...plan.failures];
  if (plan.nonSaleProducts.length) {
    failures.push(
      `${plan.nonSaleProducts.length} non-sale products remain in On Sale`,
    );
  }
  for (const media of plan.mediaPlans) {
    if (media.changeRequired)
      failures.push(`${media.handle} media is not exact`);
  }
  return failures;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyAfterApply() {
  let plan = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt) await delay(3000);
    plan = audit(await getState());
    if (!verificationFailures(plan).length) return plan;
  }
  return plan;
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const before = audit(await getState());
  let after = null;
  if (apply) {
    if (before.failures.length) {
      throw new Error(`Precondition failures: ${before.failures.join('; ')}`);
    }
    await removeNonSaleProducts(before);
    for (const mediaPlan of before.mediaPlans) {
      await reconcileMedia(mediaPlan);
    }
    after = await verifyAfterApply();
    const failures = verificationFailures(after);
    if (failures.length) {
      throw new Error(
        `Store cleanup verification failed: ${failures.join('; ')}`,
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before, after }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Shopify store cleanup failed: ${error.message}\n`);
  process.exitCode = 1;
});
