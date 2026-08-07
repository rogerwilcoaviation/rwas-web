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

async function cartRequest(method, body) {
  const response = await fetch(`${BASE_URL}/api/cart`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function cartEligibleProduct(handle, expectedProductType) {
  const data = await storefrontGraphql(
    `query CartSmokeProduct($handle: String!) {
      product(handle: $handle) {
        title
        handle
        productType
        variants(first: 1) { nodes { id } }
      }
    }`,
    { handle },
  );
  const product = data.product;
  const merchandiseId = product?.variants?.nodes?.[0]?.id;
  if (!product || !merchandiseId) {
    throw new Error(`Missing cart smoke product: ${handle}`);
  }
  if (product.productType !== expectedProductType) {
    throw new Error(
      `${handle} has product type ${product.productType}; expected ${expectedProductType}`,
    );
  }

  const created = await cartRequest('POST', { merchandiseId, quantity: 1 });
  if (created.status !== 200 || !created.body.cart) {
    throw new Error(
      `${handle} cart create failed with HTTP ${created.status}: ${created.body.error || 'missing cart'}`,
    );
  }
  const cart = created.body.cart;
  try {
    if (
      cart.totalQuantity !== 1 ||
      new URL(cart.checkoutUrl).hostname !== 'checkout.rogerwilcoaviation.com'
    ) {
      throw new Error(`${handle} returned an invalid checkout cart`);
    }
  } finally {
    const lineIds = cart.lines.map((line) => line.id);
    const cleanup = await cartRequest('DELETE', { cartId: cart.id, lineIds });
    if (cleanup.status !== 200 || cleanup.body.cart?.totalQuantity !== 0) {
      throw new Error(`${handle} smoke cart cleanup failed`);
    }
  }
}

async function dealerInstallCartBlocked() {
  const data = await storefrontGraphql(`query DealerCartSmokeProduct {
    products(first: 1, query: "product_type:'Garmin Dealer Install'", sortKey: ID) {
      nodes {
        handle
        productType
        variants(first: 1) { nodes { id } }
      }
    }
  }`);
  const product = data.products.nodes[0];
  const merchandiseId = product?.variants?.nodes?.[0]?.id;
  if (!product || !merchandiseId) {
    throw new Error('Missing dealer-install cart smoke product');
  }
  const result = await cartRequest('POST', { merchandiseId, quantity: 1 });
  if (
    result.status !== 400 ||
    !/non-OTC Garmin avionics.*Garmin Dealer Install/i.test(
      result.body.error || '',
    )
  ) {
    throw new Error(
      `Dealer-install cart gate failed with HTTP ${result.status}`,
    );
  }
}

async function unapprovedCertifiedCartBlocked() {
  let cursor = null;
  let product = null;
  do {
    const data = await storefrontGraphql(
      `query RestrictedCertifiedCartSmoke($after: String) {
        products(first: 100, after: $after, query: "product_type:'Avionics — Certified'", sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            handle
            productType
            tags
            variants(first: 1) { nodes { id } }
          }
        }
      }`,
      { after: cursor },
    );
    product = data.products.nodes.find((candidate) => {
      const tags = new Set(
        candidate.tags.map((tag) => tag.trim().toLowerCase()),
      );
      return (
        !tags.has('otc-eligible') &&
        (tags.has('otc-disabled') || tags.has('stock-check-required'))
      );
    });
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (!product && cursor);

  const merchandiseId = product?.variants?.nodes?.[0]?.id;
  if (!product || !merchandiseId) {
    throw new Error('Missing restricted certified cart smoke product');
  }
  const result = await cartRequest('POST', { merchandiseId, quantity: 1 });
  if (
    result.status !== 400 ||
    !/non-OTC Garmin avionics.*Avionics — Certified/i.test(
      result.body.error || '',
    )
  ) {
    throw new Error(
      `Restricted certified cart gate failed with HTTP ${result.status}`,
    );
  }
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

const [retail, certifiedRetailCount] = await Promise.all([
  collectionPageCount('avionics-certified'),
  countCertifiedRetailProducts(),
]);
if (retail.count < certifiedRetailCount) {
  throw new Error(
    `Retail renders ${retail.count} products but Shopify exposes at least ${certifiedRetailCount} approved certified products`,
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
  '$6,995',
  'Add to Cart',
  'For package and special pricing please contact us',
  'Service area We come to you',
]) {
  if (!k10.includes(requiredText)) {
    throw new Error(`K10-00280-51 page is missing: ${requiredText}`);
  }
}

const gdu450 = await renderedPage('/products/g3x-touch-display-gdu-450');
for (const requiredText of [
  'Avionics — Experimental',
  '$4,350',
  'Add to Cart',
]) {
  if (!gdu450.includes(requiredText)) {
    throw new Error(`GDU 450 page is missing: ${requiredText}`);
  }
}

const gdl82 = await renderedPage('/products/garmin-gdl-82-ads-b-out-datalink');
for (const requiredText of [
  'Garmin GDL 82 ADS-B Out Datalink',
  '$2,475',
  'Add to Cart',
  'For package and special pricing please contact us',
  'Service area We come to you',
  '5–8 weeks',
]) {
  if (!gdl82.includes(requiredText)) {
    throw new Error(`GDL 82 page is missing: ${requiredText}`);
  }
}
if (/Installs at.{0,160}(KFSD|Sioux Falls|KYKN|Yankton)/i.test(k10)) {
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

await dealerInstallCartBlocked();
await unapprovedCertifiedCartBlocked();
await cartEligibleProduct(
  'garmin-dual-g5-ai-hsi-kit-k10-00280-51',
  'Avionics — Certified',
);
await cartEligibleProduct(
  'g3x-touch-display-gdu-450',
  'Avionics — Experimental',
);
await cartEligibleProduct(
  'garmin-gdl-82-ads-b-out-datalink',
  'Avionics — Certified',
);

process.stdout.write(
  `${JSON.stringify(
    {
      baseUrl: BASE_URL,
      collections: results,
      retailCount: retail.count,
      minimumApprovedCertifiedCount: certifiedRetailCount,
      customerLabelsVerified: true,
      retailPricingMessageVerified: true,
      k10ProductCopyVerified: true,
      gdl82ProductCopyVerified: true,
      cartEligibilityVerified: true,
      restrictedCertifiedCartVerified: true,
    },
    null,
    2,
  )}\n`,
);
