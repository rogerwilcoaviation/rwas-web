#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

const CONTACT_LINE =
  '<p><strong>For package and special pricing please contact us.</strong></p>';

const PRODUCT_POLICY = [
  {
    handle: 'd2-air-x10',
    sku: '010-02173-41',
    title: 'D2™ Air (Black)',
    listPrice: '499.00',
    authority:
      'Garmin SKU 010-02173-41 product page and 2020 D2 Air launch MSRP',
    descriptionIdentity: {
      from: /D2™ Air X10 \(Black\)/g,
      to: 'D2™ Air (Black)',
    },
    sourceDescription: 'D2™ Air.',
  },
  {
    handle: 'd2-air-x10-ivory',
    sku: '010-02496-03',
    title: 'D2™ Air X10 (Ivory)',
    listPrice: '549.99',
    authority:
      'Garmin SKU 010-02496-03 product page and 2022 D2 Air X10 launch MSRP',
    sourceDescription: 'D2™ Air X10 (Ivory).',
  },
  {
    handle: 'kit-g5-for-certificated-aircraft-w-lpm-dual-ai-dg',
    sku: 'K10-00280-01/K10-00280-31',
    title: 'Garmin G5 Stack w/LPM (AI & HSI)',
    listPrice: '7190.00',
    authority:
      'Garmin July 18, 2026 pricing guide: K10-00280-01 $3,095 plus K10-00280-31 $4,095',
    sourceDescription:
      'G5 for Certificated Aircraft, Standard Kit (Attitude) plus G5 for Certificated Aircraft, HSI w/GAD 29D Kit.',
  },
  {
    handle: 'gsb-15',
    sku: '010-02201-11',
    title: 'GSB™ 15',
    listPrice: '350.00',
    authority:
      'Garmin July 18, 2026 pricing guide: 010-02201-11 list price $350',
    sourceDescription: 'GSB™ 15, Dual USB Type-A, Side Power Input, Standard.',
  },
];

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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function shopifyGraphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  if (!domain || !token) {
    throw new Error(`Missing Shopify Admin credentials in ${SHOPIFY_ENV_PATH}`);
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
    const payload = await response.json();
    const throttled =
      response.status === 429 ||
      payload.errors?.some((error) =>
        String(error.message || error)
          .toLowerCase()
          .includes('throttled'),
      );
    if (throttled) {
      await delay(Math.min(1000 * 2 ** attempt, 15000));
      continue;
    }
    if (!response.ok || payload.errors?.length) {
      throw new Error(JSON.stringify(payload.errors || payload));
    }
    return payload.data;
  }
  throw new Error('Shopify Admin throttling retries exhausted');
}

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

function formatListPrice(price) {
  return Number(price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function reconcileDescription(descriptionHtml, policy) {
  let html = descriptionHtml || '';
  if (policy.descriptionIdentity) {
    html = html.replace(
      policy.descriptionIdentity.from,
      policy.descriptionIdentity.to,
    );
  }
  html = html.replace(
    /Garmin source description:[^<]*\./,
    `Garmin source description: ${policy.sourceDescription}`,
  );

  const listPriceLine = `<li><strong>Garmin list price:</strong> $${formatListPrice(policy.listPrice)}</li>`;
  if (/<li>\s*<strong>Garmin list price:<\/strong>[^<]*<\/li>/i.test(html)) {
    html = html.replace(
      /<li>\s*<strong>Garmin list price:<\/strong>[^<]*<\/li>/i,
      listPriceLine,
    );
  } else {
    html = html.replace('</ul>', `  ${listPriceLine}\n</ul>`);
  }
  if (!html.includes(CONTACT_LINE)) html = `${html}\n${CONTACT_LINE}`;
  return html;
}

function canonicalHtml(html) {
  return String(html || '')
    .replace(/>\s+</g, '><')
    .trim();
}

async function getProduct(handle) {
  const data = await shopifyGraphql(
    `query FormerSaleProduct($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        status
        descriptionHtml
        collections(first: 20) { nodes { handle title } }
        variants(first: 10) {
          nodes { id sku price compareAtPrice }
        }
      }
    }`,
    { handle },
  );
  return data.productByHandle;
}

function buildPlan(product, policy) {
  if (!product) throw new Error(`Missing product: ${policy.handle}`);
  const variants = product.variants.nodes;
  if (variants.length !== 1) {
    throw new Error(
      `${policy.handle} expected one variant, found ${variants.length}`,
    );
  }
  const variant = variants[0];
  if (variant.sku !== policy.sku) {
    throw new Error(
      `${policy.handle} expected SKU ${policy.sku}, found ${variant.sku || '(blank)'}`,
    );
  }
  const expectedDescriptionHtml = reconcileDescription(
    product.descriptionHtml,
    policy,
  );
  const descriptionChangeRequired =
    canonicalHtml(product.descriptionHtml) !==
    canonicalHtml(expectedDescriptionHtml);
  return {
    productId: product.id,
    variantId: variant.id,
    handle: product.handle,
    status: product.status,
    sku: variant.sku,
    authority: policy.authority,
    title: { current: product.title, expected: policy.title },
    price: { current: variant.price, expected: policy.listPrice },
    compareAtPrice: { current: variant.compareAtPrice, expected: null },
    descriptionChangeRequired,
    expectedDescriptionHtml,
    collections: product.collections.nodes.map((collection) => ({
      handle: collection.handle,
      title: collection.title,
    })),
    changeRequired:
      product.title !== policy.title ||
      variant.price !== policy.listPrice ||
      variant.compareAtPrice !== null ||
      descriptionChangeRequired,
  };
}

async function audit(policies) {
  const plans = [];
  for (const policy of policies) {
    plans.push(buildPlan(await getProduct(policy.handle), policy));
  }
  return plans;
}

async function applyPlan(plan) {
  if (!plan.changeRequired) return;
  if (
    plan.title.current !== plan.title.expected ||
    plan.descriptionChangeRequired
  ) {
    const result = await shopifyGraphql(
      `mutation UpdateFormerSaleProduct($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id handle title }
          userErrors { field message }
        }
      }`,
      {
        product: {
          id: plan.productId,
          title: plan.title.expected,
          descriptionHtml: plan.expectedDescriptionHtml,
        },
      },
    );
    assertNoUserErrors(result, 'productUpdate');
  }

  if (
    plan.price.current !== plan.price.expected ||
    plan.compareAtPrice.current !== null
  ) {
    const result = await shopifyGraphql(
      `mutation UpdateFormerSalePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id sku price compareAtPrice }
          userErrors { field message }
        }
      }`,
      {
        productId: plan.productId,
        variants: [
          {
            id: plan.variantId,
            price: plan.price.expected,
            compareAtPrice: null,
          },
        ],
      },
    );
    assertNoUserErrors(result, 'productVariantsBulkUpdate');
  }
}

async function verifyAfterApply(policies) {
  let plans = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt) await delay(2500);
    plans = await audit(policies);
    if (plans.every((plan) => !plan.changeRequired)) return plans;
  }
  return plans;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const requestedHandle = process.argv
    .find((argument) => argument.startsWith('--handle='))
    ?.slice('--handle='.length);
  const policies = requestedHandle
    ? PRODUCT_POLICY.filter((policy) => policy.handle === requestedHandle)
    : PRODUCT_POLICY;
  if (requestedHandle && policies.length === 0) {
    throw new Error(`Unknown policy handle: ${requestedHandle}`);
  }
  loadEnv(SHOPIFY_ENV_PATH);
  const before = await audit(policies);
  let after = null;
  if (apply) {
    for (const plan of before) await applyPlan(plan);
    after = await verifyAfterApply(policies);
    const failures = after.filter((plan) => plan.changeRequired);
    if (failures.length) {
      throw new Error(
        `List-price verification failed: ${failures.map((plan) => plan.handle).join(', ')}`,
      );
    }
  }
  const summarize = (plans) =>
    plans?.map(({ expectedDescriptionHtml: _html, ...plan }) => plan) || null;
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        before: summarize(before),
        after: summarize(after),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `Former On Sale list-price reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
