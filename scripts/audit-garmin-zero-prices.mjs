#!/usr/bin/env node

import fs from 'node:fs';

const envPath =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token =
  process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || '2026-01';
if (!domain || !token) {
  throw new Error(`Missing Shopify Admin credentials in ${envPath}`);
}

async function graphql(query, variables = {}) {
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
    const payload = await response.json();
    const throttled =
      response.status === 429 ||
      payload.errors?.some((error) =>
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
    if (!response.ok || payload.errors?.length) {
      throw new Error(JSON.stringify(payload.errors || payload));
    }
    return payload.data;
  }
  throw new Error('Shopify Admin throttling retries exhausted');
}

const products = [];
let after = null;
do {
  const data = await graphql(
    `
      query ActiveGarminZeroPriceAudit($after: String) {
        products(
          first: 100
          after: $after
          query: "status:active vendor:Garmin"
          sortKey: TITLE
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            title
            handle
            productType
            tags
            descriptionHtml
            collections(first: 50) {
              nodes {
                handle
                title
              }
            }
            variants(first: 100) {
              nodes {
                sku
                price
              }
            }
          }
        }
      }
    `,
    { after },
  );
  products.push(...data.products.nodes);
  after = data.products.pageInfo.hasNextPage
    ? data.products.pageInfo.endCursor
    : null;
} while (after);

const zeroPriceProducts = products
  .map((product) => ({
    ...product,
    variants: product.variants.nodes.filter(
      (variant) => Number(variant.price) === 0,
    ),
    collections: product.collections.nodes,
  }))
  .filter((product) => product.variants.length > 0);

process.stdout.write(
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      activeGarminProducts: products.length,
      zeroPriceProductCount: zeroPriceProducts.length,
      zeroPriceVariantCount: zeroPriceProducts.reduce(
        (count, product) => count + product.variants.length,
        0,
      ),
      products: zeroPriceProducts,
    },
    null,
    2,
  )}\n`,
);
