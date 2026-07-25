#!/usr/bin/env node

import fs from 'node:fs';

const BASE_URL =
  process.env.RWAS_PRODUCTION_URL || 'https://www.rogerwilcoaviation.com';
const ENV_PATH = process.env.RWAS_STOREFRONT_ENV_PATH || '.env.production';

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

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;|&#xb7;|&#183;/gi, '·')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

loadEnv(ENV_PATH);
const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_TOKEN;
const version = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-01';
if (!domain || !token) {
  throw new Error(`Missing Shopify Storefront credentials in ${ENV_PATH}`);
}

async function storefrontGraphql(query, variables = {}) {
  const response = await fetch(
    `https://${domain}/api/${version}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(
      JSON.stringify(payload.errors || { status: response.status }),
    );
  }
  return payload.data;
}

async function countProductType(productType) {
  let cursor = null;
  let count = 0;
  do {
    const data = await storefrontGraphql(
      `query ProductionCatalogCount($after: String, $query: String!) {
        products(first: 250, after: $after, query: $query, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes { id }
        }
      }`,
      { after: cursor, query: `product_type:"${productType}"` },
    );
    count += data.products.nodes.length;
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return count;
}

async function countCertifiedRetailProducts() {
  let cursor = null;
  let count = 0;
  do {
    const data = await storefrontGraphql(
      `query CertifiedRetailCount($after: String) {
        products(first: 250, after: $after, query: "product_type:'Avionics — Certified'", sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            tags
            variants(first: 1) { nodes { price { amount } } }
          }
        }
      }`,
      { after: cursor },
    );
    count += data.products.nodes.filter((product) => {
      const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
      const price = Number(product.variants.nodes[0]?.price?.amount || 0);
      return (
        tags.has('otc-eligible') &&
        !tags.has('otc-disabled') &&
        !tags.has('garmin-dealer-only') &&
        Number.isFinite(price) &&
        price > 0
      );
    }).length;
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return count;
}

async function renderedPage(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }
  return visibleText(await response.text());
}

async function collectionPageCount(handle) {
  const text = await renderedPage(`/collections/${handle}`);
  const match = text.match(/Collection · ([0-9,]+) items/);
  if (!match) throw new Error(`Could not read rendered count for ${handle}`);
  return { count: Number(match[1].replaceAll(',', '')), text };
}

const collections = [
  ['avionics-experimental', 'Avionics — Experimental'],
  ['watches-accessories', 'Watches & Accessories'],
  ['pilot-gear', 'Pilot Gear'],
  ['garmin-dealer-install', 'Garmin Dealer Install'],
];
const results = [];
for (const [handle, productType] of collections) {
  const [storefrontCount, page] = await Promise.all([
    countProductType(productType),
    collectionPageCount(handle),
  ]);
  if (storefrontCount !== page.count) {
    throw new Error(
      `${handle} renders ${page.count} products but Shopify exposes ${storefrontCount}`,
    );
  }
  results.push({
    handle,
    productType,
    storefrontCount,
    renderedCount: page.count,
  });
}

const [retail, certifiedRetailCount, experimentalCount] = await Promise.all([
  collectionPageCount('avionics-certified'),
  countCertifiedRetailProducts(),
  countProductType('Avionics — Experimental'),
]);
const expectedRetailCount = certifiedRetailCount + experimentalCount;
if (retail.count !== expectedRetailCount) {
  throw new Error(
    `Retail renders ${retail.count} products but Shopify exposes ${expectedRetailCount} approved products`,
  );
}
for (const requiredLabel of [
  'Experimental Avionics',
  'Installation Hardware',
  'Engine & Airframe LRUs',
]) {
  if (!retail.text.includes(requiredLabel)) {
    throw new Error(`Retail collection is missing label: ${requiredLabel}`);
  }
}
if (
  !retail.text.includes('For package and special pricing please contact us')
) {
  throw new Error('Retail collection is missing the package-pricing message');
}

const k10 = await renderedPage(
  '/products/garmin-dual-g5-ai-hsi-kit-k10-00280-51',
);
for (const requiredText of [
  'Garmin Dual G5 AI/HSI Kit for Certificated Aircraft',
  'For package and special pricing please contact us',
  'Service area We come to you',
]) {
  if (!k10.includes(requiredText)) {
    throw new Error(`K10-00280-51 page is missing: ${requiredText}`);
  }
}
if (/Installs at.{0,160}(KFSD|Sioux Falls)/i.test(k10)) {
  throw new Error('K10-00280-51 exposes the prohibited install location');
}
for (const internalLabel of [
  'Experimental Manual Review',
  'Install Hardware Fallback',
  'Engine Airframe Lrus',
]) {
  if (retail.text.includes(internalLabel)) {
    throw new Error(
      `Retail collection exposes internal label: ${internalLabel}`,
    );
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      baseUrl: BASE_URL,
      collections: results,
      retailCount: retail.count,
      expectedRetailCount,
      customerLabelsVerified: true,
      retailPricingMessageVerified: true,
      k10ProductCopyVerified: true,
    },
    null,
    2,
  )}\n`,
);
