#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

const CONTACT_MESSAGE = 'For package and special pricing please contact us.';
const PILOT_GEAR_TYPE = 'Pilot Gear';
const EXPERIMENTAL_TYPE = 'Avionics — Experimental';
const COLLECTION_HANDLES = [
  'pilot-gear',
  'avionics-certified',
  'avionics-experimental',
  'garmin-avionics',
];

// Garmin's current public product pages list every one of these physical USB
// trainer products at $60. No installation is required.
const PC_TRAINER_PRICES = new Map([
  ['010-12675-10', 60],
  ['010-12675-05', 60],
  ['010-12675-22', 60],
  ['010-12675-18', 60],
  ['010-12675-02', 60],
  ['010-12675-24', 60],
  ['010-12675-09', 60],
  ['010-12675-14', 60],
  ['010-12675-12', 60],
  ['010-12675-15', 60],
  ['010-12675-23', 60],
  ['010-12675-08', 60],
  ['010-12675-06', 60],
]);

// These legacy records are converted to Garmin's current exact experimental
// part numbers and current public list prices.
const CURRENT_EXPERIMENTAL_REPLACEMENTS = new Map([
  [
    '010-01318-00',
    {
      sku: '010-01318-01',
      title: 'Garmin GMA 245 Audio Panel',
      handle: 'garmin-gma-245',
      price: 1950,
      summary:
        'Bluetooth-enabled audio panel for experimental and light sport aircraft.',
    },
  ],
  [
    '010-01087-41',
    {
      sku: '010-01087-21',
      title: 'Garmin GTR 200B COMM Radio',
      handle: 'garmin-gtr-200b',
      price: 1960,
      summary:
        'Panel-mount COMM radio with Bluetooth connectivity for experimental and light sport aircraft.',
    },
  ],
]);

const EXISTING_EXPERIMENTAL_UPDATES = new Map([
  [
    '010-01471-01',
    {
      title: 'Garmin GMA 245R Remote Audio Panel',
      handle: 'garmin-gma-245r',
      price: 1800,
      summary:
        'Remote-mount Bluetooth audio panel for experimental and light sport aircraft.',
    },
  ],
]);

const EXPECTED_ARCHIVE_IDENTITIES = new Set([
  '010-01037-A3|enablement-coupon-gts-processor-tcas-i-to-tcas-ii',
  '0001|garmin-avionics-design-studio-by-rwas',
  '|garmin-gea-71b-enhanced',
  '010-00860-00|gdl-88-internal-waas-unit-only',
  '010-00859-30|gdl®-88',
  '010-00861-30|gdl®-88-diversity',
  '010-00862-30|gdl®-88-diversity-with-internal-waas',
  '010-00860-30|gdl®-88-with-internal-waas',
  '010-00859-E0|gdl®-88h-for-rotorcraft',
  '010-00862-E0|gdl®-88h-diversity-with-internal-waas',
  '010-00860-E0|gdl®-88h-with-internal-waas',
  '010-00861-E0|gdl®-88hd-diversity',
  '010-00667-10|gdu-370',
  '010-01219-A1|gdu-700l-g600-txi-gray-ahrs-standard',
  '010-01219-13|gdu-700l-eis-txi-gray-standard',
  '010-01218-13|gdu-700p-eis-txi-gray-standard',
  '|gfc-500-digital-autopilot-package',
  '|gfc-600-digital-autopilot',
  '010-01471-11|gma-245r-mkr-standard-pma',
  '010-01319-00|garmin-gma345-unit-only-010-01319-00',
  '010-01319-20|garmin-gma345-unit-only-010-01319-20',
  '010-01471-00|gma™-245r-unit-only',
  '010-01319-21|garmin-gma-345-010-01319-21',
  '010-01214-41|gtx-335',
  'K00-01491-02|garmin-kit-gdu-1250a-cirrus-sr2x-g1000-nxi-upgrade-k00-01491-02',
  'K00-01491-01|garmin-kit-gdu-1050a-cirrus-sr2x-g1000-nxi-upgrade-k00-01491-01',
  '010-02105-00|lru-kit-g500h-txi-gsu-75h',
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

function firstVariant(product) {
  if (product.variants.nodes.length !== 1) {
    throw new Error(
      `${product.handle} has ${product.variants.nodes.length} variants; expected exactly one`,
    );
  }
  return product.variants.nodes[0];
}

function safeHandle(handle) {
  return handle
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function normalizeTags(tags, required) {
  const conflicts = new Set([
    'garmin-dealer-only',
    'install-by-rwas',
    'otc-disabled',
    'stock-check-required',
    'garmin-retail-policy-2026',
  ]);
  const next = tags.filter((tag) => !conflicts.has(tag.toLowerCase()));
  const existing = new Set(next.map((tag) => tag.toLowerCase()));
  for (const tag of required) {
    if (!existing.has(tag.toLowerCase())) next.push(tag);
  }
  return next;
}

function sameTags(left, right) {
  const sorted = (tags) =>
    [...tags]
      .map((tag) => tag.toLowerCase())
      .sort()
      .join('\n');
  return sorted(left) === sorted(right);
}

function trainerDescription(product, sku) {
  return `<p>${product.title}</p><p>Garmin part number <strong>${sku}</strong>. This PC trainer is supplied on a preloaded USB memory drive for desktop training and familiarization. No aircraft installation is required.</p><p><strong>${CONTACT_MESSAGE}</strong></p>`;
}

function experimentalDescription(config, sku) {
  return `<p>${config.summary}</p><p>Garmin part number <strong>${sku}</strong>. This experimental-avionics product may be purchased over the counter. Confirm aircraft compatibility and any installation requirements before use.</p><p><strong>${CONTACT_MESSAGE}</strong></p>`;
}

async function getProducts(query = 'vendor:Garmin') {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query ZeroPriceCleanupProducts($query: String!, $after: String) {
        products(first: 100, after: $after, query: $query, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            vendor
            productType
            tags
            descriptionHtml
            collections(first: 50) { nodes { id handle } }
            variants(first: 20) { nodes { id sku price } }
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

async function getCollections() {
  const data = await shopifyGraphql(`query ZeroPriceCleanupCollections {
    collections(first: 250) {
      nodes { id handle title ruleSet { appliedDisjunctively } }
    }
  }`);
  return new Map(
    data.collections.nodes
      .filter((collection) => COLLECTION_HANDLES.includes(collection.handle))
      .map((collection) => [collection.handle, collection]),
  );
}

function makePlan(products, collections) {
  const active = products.filter((product) => product.status === 'ACTIVE');
  const zeroPrice = active.filter((product) =>
    product.variants.nodes.some((variant) => Number(variant.price) === 0),
  );
  const actions = [];

  const knownZeroSkus = new Set([
    ...PC_TRAINER_PRICES.keys(),
    ...CURRENT_EXPERIMENTAL_REPLACEMENTS.keys(),
  ]);
  const unexpectedZero = zeroPrice.filter((product) => {
    const variant = firstVariant(product);
    return (
      !knownZeroSkus.has(variant.sku || '') &&
      !EXPECTED_ARCHIVE_IDENTITIES.has(`${variant.sku || ''}|${product.handle}`)
    );
  });
  if (unexpectedZero.length) {
    throw new Error(
      `Unexpected active zero-price Garmin products: ${unexpectedZero
        .map(
          (product) => `${firstVariant(product).sku || ''}|${product.handle}`,
        )
        .join(', ')}`,
    );
  }

  for (const [sku, price] of PC_TRAINER_PRICES) {
    const matches = active.filter((product) =>
      product.variants.nodes.some((variant) => variant.sku === sku),
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one active PC Trainer ${sku}; found ${matches.length}`,
      );
    }
    const product = matches[0];
    const variant = firstVariant(product);
    actions.push({
      kind: 'retail-pc-trainer',
      product,
      variant,
      productUpdate: {
        productType: PILOT_GEAR_TYPE,
        tags: normalizeTags(product.tags, [
          'garmin',
          'pilot-gear',
          'otc-eligible',
        ]),
        handle: safeHandle(product.handle),
        redirectNewHandle: true,
        descriptionHtml: trainerDescription(product, sku),
      },
      variantUpdate: { id: variant.id, price },
      addCollections: ['pilot-gear'],
      removeCollections: ['garmin-avionics'],
    });
  }

  for (const [legacySku, replacement] of CURRENT_EXPERIMENTAL_REPLACEMENTS) {
    const matches = active.filter((product) =>
      product.variants.nodes.some((variant) =>
        [legacySku, replacement.sku].includes(variant.sku),
      ),
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one active ${legacySku}/${replacement.sku}; found ${matches.length}`,
      );
    }
    const product = matches[0];
    const variant = firstVariant(product);
    actions.push({
      kind: 'current-experimental-replacement',
      product,
      variant,
      productUpdate: {
        title: replacement.title,
        handle: replacement.handle,
        redirectNewHandle: true,
        productType: EXPERIMENTAL_TYPE,
        tags: normalizeTags(product.tags, [
          'garmin',
          'experimental-retail',
          'otc-eligible',
        ]),
        descriptionHtml: experimentalDescription(replacement, replacement.sku),
      },
      variantUpdate: {
        id: variant.id,
        ...(variant.sku === replacement.sku ? {} : { sku: replacement.sku }),
        price: replacement.price,
      },
      addCollections: ['avionics-certified', 'avionics-experimental'],
      removeCollections: ['garmin-avionics'],
    });
  }

  for (const identity of EXPECTED_ARCHIVE_IDENTITIES) {
    const expectedHandle = identity.slice(identity.indexOf('|') + 1);
    const matches = products.filter((product) => {
      if (product.handle !== expectedHandle) return false;
      const variant = firstVariant(product);
      return `${variant.sku || ''}|${product.handle}` === identity;
    });
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one archive record ${identity}; found ${matches.length}`,
      );
    }
    const product = matches[0];
    actions.push({
      kind: 'archive-obsolete-or-service-record',
      product,
      variant: firstVariant(product),
      productUpdate: { status: 'ARCHIVED' },
      variantUpdate: null,
      addCollections: [],
      removeCollections: [],
    });
  }

  for (const [sku, config] of EXISTING_EXPERIMENTAL_UPDATES) {
    const matches = active.filter((product) =>
      product.variants.nodes.some((variant) => variant.sku === sku),
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one active ${sku}; found ${matches.length}`,
      );
    }
    const product = matches[0];
    const variant = firstVariant(product);
    actions.push({
      kind: 'reclassify-current-experimental',
      product,
      variant,
      productUpdate: {
        title: config.title,
        handle: config.handle,
        redirectNewHandle: true,
        productType: EXPERIMENTAL_TYPE,
        tags: normalizeTags(product.tags, [
          'garmin',
          'experimental-retail',
          'otc-eligible',
        ]),
        descriptionHtml: experimentalDescription(config, sku),
      },
      variantUpdate: { id: variant.id, price: config.price },
      addCollections: ['avionics-certified', 'avionics-experimental'],
      removeCollections: ['garmin-avionics'],
    });
  }

  return actions.filter((action) => actionNeedsChange(action, collections));
}

function actionNeedsChange(action, collections) {
  const product = action.product;
  const productUpdate = action.productUpdate;
  for (const field of [
    'status',
    'title',
    'handle',
    'productType',
    'descriptionHtml',
  ]) {
    if (
      Object.hasOwn(productUpdate, field) &&
      productUpdate[field] !== product[field]
    ) {
      return true;
    }
  }
  if (productUpdate.tags && !sameTags(productUpdate.tags, product.tags)) {
    return true;
  }

  if (action.variantUpdate) {
    if (
      action.variantUpdate.sku &&
      action.variantUpdate.sku !== action.variant.sku
    ) {
      return true;
    }
    if (
      Object.hasOwn(action.variantUpdate, 'price') &&
      Number(action.variantUpdate.price) !== Number(action.variant.price)
    ) {
      return true;
    }
  }

  const memberships = new Set(
    product.collections.nodes.map((collection) => collection.handle),
  );
  if (
    action.addCollections.some(
      (handle) => !collections.get(handle)?.ruleSet && !memberships.has(handle),
    )
  ) {
    return true;
  }
  if (
    action.removeCollections.some(
      (handle) => !collections.get(handle)?.ruleSet && memberships.has(handle),
    )
  ) {
    return true;
  }
  return false;
}

function publicAction(action) {
  return {
    kind: action.kind,
    title: action.product.title,
    handle: action.product.handle,
    sku: action.variant.sku || null,
    currentPrice: action.variant.price,
    nextStatus: action.productUpdate.status || action.product.status,
    nextTitle: action.productUpdate.title || action.product.title,
    nextHandle: action.productUpdate.handle || action.product.handle,
    nextProductType:
      action.productUpdate.productType || action.product.productType,
    nextSku: action.variantUpdate?.sku || action.variant.sku || null,
    nextPrice: action.variantUpdate?.price ?? action.variant.price,
    addCollections: action.addCollections,
    removeCollections: action.removeCollections,
  };
}

async function updateProduct(action) {
  const product = { id: action.product.id, ...action.productUpdate };
  if (product.tags && sameTags(product.tags, action.product.tags)) {
    delete product.tags;
  }
  if (product.handle === action.product.handle) {
    delete product.handle;
    delete product.redirectNewHandle;
  }
  const result = await shopifyGraphql(
    `mutation ApplyZeroPriceProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle status productType }
        userErrors { field message }
      }
    }`,
    { product },
  );
  assertNoUserErrors(result, 'productUpdate');
}

async function updateVariant(action) {
  if (!action.variantUpdate) return;
  const { sku, ...variant } = action.variantUpdate;
  if (sku) variant.inventoryItem = { sku };
  const result = await shopifyGraphql(
    `mutation ApplyZeroPriceVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku price }
        userErrors { field message }
      }
    }`,
    { productId: action.product.id, variants: [variant] },
  );
  assertNoUserErrors(result, 'productVariantsBulkUpdate');
}

async function mutateCollection(action, collection, operation) {
  if (!collection || collection.ruleSet) return;
  const field =
    operation === 'add' ? 'collectionAddProducts' : 'collectionRemoveProducts';
  const mutation =
    operation === 'add'
      ? `mutation AddZeroPriceProduct($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }`
      : `mutation RemoveZeroPriceProduct($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }`;
  const result = await shopifyGraphql(mutation, {
    id: collection.id,
    productIds: [action.product.id],
  });
  const errors = result[field].userErrors.filter((error) => {
    const message = error.message.toLowerCase();
    return operation === 'add'
      ? !message.includes('already exists')
      : !message.includes('not exist');
  });
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function applyActions(actions, collections) {
  for (const [index, action] of actions.entries()) {
    await updateProduct(action);
    await updateVariant(action);
    for (const handle of action.removeCollections) {
      await mutateCollection(action, collections.get(handle), 'remove');
    }
    for (const handle of action.addCollections) {
      await mutateCollection(action, collections.get(handle), 'add');
    }
    if ((index + 1) % 10 === 0) {
      process.stderr.write(
        `Applied ${index + 1}/${actions.length} cleanup actions\n`,
      );
    }
  }
}

async function verifyAfterApply() {
  const products = await getProducts('status:active vendor:Garmin');
  const zeroPrice = products.filter((product) =>
    product.variants.nodes.some((variant) => Number(variant.price) === 0),
  );
  const expectedCurrentSkus = new Set([
    ...PC_TRAINER_PRICES.keys(),
    ...[...CURRENT_EXPERIMENTAL_REPLACEMENTS.values()].map(
      (value) => value.sku,
    ),
    ...EXISTING_EXPERIMENTAL_UPDATES.keys(),
  ]);
  const verified = products.filter((product) =>
    product.variants.nodes.some((variant) =>
      expectedCurrentSkus.has(variant.sku),
    ),
  );
  const failures = [];
  if (zeroPrice.length) {
    failures.push(
      `active zero-price products: ${zeroPrice.map((product) => product.handle).join(', ')}`,
    );
  }
  for (const sku of expectedCurrentSkus) {
    const matches = verified.filter((product) =>
      product.variants.nodes.some((variant) => variant.sku === sku),
    );
    if (matches.length !== 1)
      failures.push(`${sku} active matches=${matches.length}`);
  }
  return {
    activeGarminProducts: products.length,
    activeZeroPriceProducts: zeroPrice.length,
    verifiedCurrentProducts: verified.length,
    failures,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const [products, collections] = await Promise.all([
    getProducts('vendor:Garmin'),
    getCollections(),
  ]);
  const actions = makePlan(products, collections);
  let verification = null;
  if (apply) {
    await applyActions(actions, collections);
    verification = await verifyAfterApply();
    if (verification.failures.length) {
      throw new Error(
        `Post-apply verification failed: ${verification.failures.join('; ')}`,
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        actionCount: actions.length,
        counts: Object.fromEntries(
          [...new Set(actions.map((action) => action.kind))].map((kind) => [
            kind,
            actions.filter((action) => action.kind === kind).length,
          ]),
        ),
        actions: actions.map(publicAction),
        verification,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Garmin zero-price cleanup failed: ${error.message}\n`);
  process.exitCode = 1;
});
