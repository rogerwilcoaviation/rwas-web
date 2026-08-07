#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const COLLECTION_HANDLE = 'garmin-dealer-install';
const IMAGE_URL =
  process.env.GARMIN_GENERAL_PLACEHOLDER_URL ||
  'https://www.rogerwilcoaviation.com/images/products/garmin-general-no-product-image-available.jpg';
const IMAGE_ALT =
  'Garmin catalog item — official product image pending or unavailable from Garmin';
const apply = process.argv.includes('--apply');

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = trimmed.indexOf('=');
    if (split < 1) continue;
    const key = trimmed.slice(0, split).trim();
    let value = trimmed.slice(split + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(SHOPIFY_ENV_PATH);

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
  if (!response.ok) {
    throw new Error(`Shopify Admin API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors));
  return payload.data;
}

async function getCollectionProducts() {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query DealerInstallGeneralProducts($handle: String!, $after: String) {
        collectionByHandle(handle: $handle) {
          id
          title
          products(first: 100, after: $after, sortKey: ID) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              title
              handle
              status
              tags
              images(first: 10) { nodes { id url altText } }
            }
          }
        }
      }`,
      { handle: COLLECTION_HANDLE, after: cursor },
    );
    if (!data.collectionByHandle) {
      throw new Error(`Collection not found: ${COLLECTION_HANDLE}`);
    }
    const connection = data.collectionByHandle.products;
    products.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);
  return products;
}

function isGeneral(product) {
  return !product.tags.some((tag) => tag.startsWith('garmin-subcategory:'));
}

function targetsFrom(products) {
  return products.filter(
    (product) =>
      product.status === 'ACTIVE' &&
      isGeneral(product) &&
      product.images.nodes.length === 0,
  );
}

async function addImage(product) {
  const data = await shopifyGraphql(
    `mutation AddGarminGeneralPlaceholder(
      $productId: ID!
      $media: [CreateMediaInput!]!
    ) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id status alt }
        mediaUserErrors { field message }
      }
    }`,
    {
      productId: product.id,
      media: [
        {
          mediaContentType: 'IMAGE',
          originalSource: IMAGE_URL,
          alt: IMAGE_ALT,
        },
      ],
    },
  );
  const errors = data.productCreateMedia.mediaUserErrors || [];
  if (errors.length) throw new Error(`${product.handle}: ${JSON.stringify(errors)}`);
}

const before = await getCollectionProducts();
const targets = targetsFrom(before);
console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'audit',
      collection: COLLECTION_HANDLE,
      collectionProducts: before.length,
      activeGeneralProducts: before.filter(
        (product) => product.status === 'ACTIVE' && isGeneral(product),
      ).length,
      targetCount: targets.length,
      imageUrl: IMAGE_URL,
      targets: targets.map(({ id, title, handle }) => ({ id, title, handle })),
    },
    null,
    2,
  ),
);

if (apply) {
  for (const [index, product] of targets.entries()) {
    await addImage(product);
    console.error(`[${index + 1}/${targets.length}] ${product.handle}`);
  }
  const after = await getCollectionProducts();
  const remaining = targetsFrom(after);
  const updated = after.filter((product) =>
    targets.some((target) => target.id === product.id),
  );
  const verificationFailures = updated.filter(
    (product) => product.images.nodes.length !== 1,
  );
  console.log(
    JSON.stringify(
      {
        applied: targets.length,
        remainingTargetCount: remaining.length,
        verificationFailures: verificationFailures.map((product) => ({
          handle: product.handle,
          imageCount: product.images.nodes.length,
        })),
      },
      null,
      2,
    ),
  );
  if (remaining.length || verificationFailures.length) process.exitCode = 1;
}
