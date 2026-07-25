#!/usr/bin/env node

import fs from 'node:fs';

const envPath =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || '2026-01';
if (!domain || !token) throw new Error(`Missing Shopify credentials in ${envPath}`);

async function graphql(query, variables = {}) {
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

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function amount(value) {
  return Number(value.replace(/[$,]/g, ''));
}

let after = null;
const products = [];
do {
  const data = await graphql(
    `query($after:String){products(first:250,after:$after,query:"status:active vendor:Garmin"){pageInfo{hasNextPage endCursor}nodes{id handle title productType descriptionHtml variants(first:100){nodes{sku price}}}}}`,
    { after },
  );
  products.push(...data.products.nodes);
  after = data.products.pageInfo.hasNextPage
    ? data.products.pageInfo.endCursor
    : null;
} while (after);

const mismatches = [];
const noStatedListPrice = [];
for (const product of products) {
  const text = plainText(product.descriptionHtml || '');
  const match = text.match(
    /Garmin\s+list\s+price\s*:\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (!match) {
    noStatedListPrice.push({
      handle: product.handle,
      sku: product.variants.nodes[0]?.sku || '',
      shopifyPrice: product.variants.nodes[0]?.price || '',
      template: /Price shown is Garmin list price unless a current Garmin promotion applies/i.test(
        text,
      )
        ? 'promotion-template'
        : 'no-stated-list-price',
      productType: product.productType,
      title: product.title,
    });
    continue;
  }
  const statedListPrice = amount(match[1]);
  for (const variant of product.variants.nodes) {
    const shopifyPrice = Number(variant.price);
    if (shopifyPrice !== statedListPrice) {
      mismatches.push({
        handle: product.handle,
        sku: variant.sku,
        shopifyPrice,
        statedListPrice,
        delta: shopifyPrice - statedListPrice,
        productType: product.productType,
        title: product.title,
      });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'active Shopify products queried by vendor:Garmin',
  activeGarminProducts: products.length,
  mismatches,
  noStatedListPrice,
  counts: {
    mismatches: mismatches.length,
    noStatedListPrice: noStatedListPrice.length,
    promotionTemplate: noStatedListPrice.filter(
      (product) => product.template === 'promotion-template',
    ).length,
  },
};

const outputPath =
  process.env.RWAS_GARMIN_PRICE_AUDIT_OUTPUT ||
  'reports/garmin-list-price-audit-2026-07-25.json';
fs.mkdirSync(new URL('.', `file://${process.cwd()}/${outputPath}`).pathname, {
  recursive: true,
});
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, noStatedListPrice: undefined }, null, 2));
