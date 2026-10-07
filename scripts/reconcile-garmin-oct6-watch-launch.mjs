#!/usr/bin/env node

import fs from 'node:fs';

const ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const APPLY = process.argv.includes('--apply');
const WATCH_COLLECTIONS = ['garmin-watches', 'watches-accessories'];
const PUBLICATIONS = ['Online Store', 'Roger Wilco Aviation Services (RWAS)'];

const PRODUCTS = [
  {
    sku: '010-04799-00',
    title: 'Garmin Enduro™ 4 – 51 mm, Titanium with Black ComfortFit Band',
    handle: 'garmin-enduro-4-51-mm-titanium-black-comfortfit-band-010-04799-00',
    price: '899.99',
    family: 'enduro-4',
    subcategory: 'outdoor-watches',
    image: 'https://res.garmin.com/en/products/010-04799-00/v/cf-lg.jpg',
    source: 'https://www.garmin.com/en-US/p/2032078/pn/010-04799-00/',
    summary:
      'Ultraperformance GPS smartwatch with solar charging, advanced training and performance tools, built-in mapping and an LED flashlight.',
    specs: [
      '51 × 51 × 15.7 mm titanium-bezel case',
      '1.4-inch sunlight-visible MIP display, 280 × 280 pixels',
      'Power Sapphire™ lens and 10 ATM water rating',
      'Up to 36 days in smartwatch mode or up to 90 days with solar',
      'ComfortFit fabric band; 66 g total weight',
    ],
    fulfillment:
      'Available to order. Inventory and fulfillment timing are confirmed after purchase; no local-stock claim is made.',
  },
  {
    sku: '010-04148-00',
    title:
      'Garmin Approach® S72 – 47 mm, Carbon Gray/Red DLC Titanium Bezel with Black ComfortFit Band',
    handle: 'garmin-approach-s72-47-mm-carbon-gray-red-black-010-04148-00',
    price: '799.99',
    family: 'approach-s72',
    subcategory: 'golf-watches',
    image: 'https://res.garmin.com/en/products/010-04148-00/v/cf-lg.jpg',
    source: 'https://www.garmin.com/en-US/p/1937117/pn/010-04148-00/',
    summary:
      'Premium 47 mm golf smartwatch with an AMOLED display, 43,000+ preloaded courses, golf biometric data, aerial imagery, and built-in speaker and microphone.',
    specs: [
      '47 × 47 × 13.5 mm titanium-bezel case',
      '1.4-inch AMOLED touchscreen, 454 × 454 pixels',
      'Sapphire crystal and 5 ATM water rating',
      'Up to 16 days in smartwatch mode or up to 20 hours in golf activity mode',
      'Black ComfortFit fabric band; 48 g total weight',
    ],
    fulfillment:
      'Available to order. Garmin dealer availability was not stated on the current product page; fulfillment timing will be confirmed after purchase.',
  },
  {
    sku: '010-04148-01',
    title:
      'Garmin Approach® S72 – 47 mm, Silver/Citron Titanium Bezel with Fog Gray/Citron ComfortFit Band',
    handle: 'garmin-approach-s72-47-mm-silver-citron-fog-gray-010-04148-01',
    price: '799.99',
    family: 'approach-s72',
    subcategory: 'golf-watches',
    image: 'https://res.garmin.com/en/products/010-04148-01/v/cf-lg.jpg',
    source: 'https://www.garmin.com/en-US/p/1937117/pn/010-04148-01/',
    summary:
      'Premium 47 mm golf smartwatch with an AMOLED display, 43,000+ preloaded courses, golf biometric data, aerial imagery, and built-in speaker and microphone.',
    specs: [
      '47 × 47 × 13.5 mm titanium-bezel case',
      '1.4-inch AMOLED touchscreen, 454 × 454 pixels',
      'Sapphire crystal and 5 ATM water rating',
      'Up to 16 days in smartwatch mode or up to 20 hours in golf activity mode',
      'Fog Gray/Citron ComfortFit fabric band; 48 g total weight',
    ],
    fulfillment:
      'Available to order. Inventory and fulfillment timing are confirmed after purchase; no local-stock claim is made.',
  },
  {
    sku: '010-04147-00',
    title:
      'Garmin Approach® S72 – 43 mm, Carbon Gray/Heritage Bronze Titanium Bezel with Pebble Gray ComfortFit Band',
    handle:
      'garmin-approach-s72-43-mm-carbon-gray-bronze-pebble-gray-010-04147-00',
    price: '799.99',
    family: 'approach-s72',
    subcategory: 'golf-watches',
    image: 'https://res.garmin.com/en/products/010-04147-00/v/cf-lg.jpg',
    source: 'https://www.garmin.com/en-US/p/1937140/pn/010-04147-00/',
    summary:
      'Premium smaller-size golf smartwatch with an AMOLED display, 43,000+ preloaded courses, golf biometric data, and built-in speaker and microphone.',
    specs: [
      '43 mm titanium-bezel case with sapphire crystal',
      'AMOLED touchscreen and 5 ATM water rating',
      'Up to 10 days in smartwatch mode',
      'Pebble Gray ComfortFit fabric band',
      'Garmin golf mapping, biometric and training features',
    ],
    fulfillment:
      'Preorder/available to order. Garmin dealer ETA was November 20, 2026 when verified; ships when available and timing may change.',
  },
  {
    sku: '010-04147-01',
    title:
      'Garmin Approach® S72 – 43 mm, Soft Gold/Blush Pink Titanium Bezel with French Gray/Blush Pink ComfortFit Band',
    handle: 'garmin-approach-s72-43-mm-soft-gold-blush-pink-010-04147-01',
    price: '799.99',
    family: 'approach-s72',
    subcategory: 'golf-watches',
    image: 'https://res.garmin.com/en/products/010-04147-01/v/cf-lg.jpg',
    source: 'https://www.garmin.com/en-US/p/1937140/pn/010-04147-01/',
    summary:
      'Premium smaller-size golf smartwatch with an AMOLED display, 43,000+ preloaded courses, golf biometric data, and built-in speaker and microphone.',
    specs: [
      '43 mm titanium-bezel case with sapphire crystal',
      'AMOLED touchscreen and 5 ATM water rating',
      'Up to 10 days in smartwatch mode',
      'French Gray/Blush Pink ComfortFit fabric band',
      'Garmin golf mapping, biometric and training features',
    ],
    fulfillment:
      'Preorder/available to order. Garmin dealer ETA was November 20, 2026 when verified; ships when available and timing may change.',
  },
];

function loadEnv() {
  for (const raw of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function graphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  if (!domain || !token) throw new Error('Missing Shopify Admin credentials');
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
  if (!response.ok || payload.errors?.length)
    throw new Error(JSON.stringify(payload.errors || payload));
  return payload.data;
}

function assertNoErrors(data, field) {
  const node = data[field];
  const errors = node?.userErrors || node?.mediaUserErrors || [];
  if (errors.length) throw new Error(`${field}: ${JSON.stringify(errors)}`);
}

function tagsFor(item) {
  return [
    'garmin',
    'Garmin Accessories',
    'category-smartwatch',
    `family-${item.family}`,
    'garmin-category:watches-accessories',
    'garmin-family:garmin-watches',
    `garmin-subcategory:${item.subcategory}`,
    'otc-disabled',
    'portable-garmin',
    'stock-check-required',
  ];
}

function description(item) {
  const specs = item.specs.map((spec) => `<li>${spec}</li>`).join('\n');
  return `<h2>${item.title}</h2><p><strong>Garmin part number:</strong> ${item.sku}</p><p>${item.summary}</p><h3>Key specifications</h3><ul>\n${specs}\n</ul><p><strong>Fulfillment:</strong> ${item.fulfillment}</p><p><strong>Price:</strong> Garmin current U.S. list price. Ordinary coupon eligibility is excluded.</p><p><small>Product details and imagery: Garmin U.S. product information, verified October 6, 2026. <a href="${item.source}">View the manufacturer product page</a>.</small></p>`;
}

async function state() {
  const [collections, publications] = await Promise.all([
    graphql(
      'query { collections(first: 250) { nodes { id handle ruleSet { appliedDisjunctively } } } }',
    ),
    graphql('query { publications(first: 50) { nodes { id name } } }'),
  ]);
  const byHandle = new Map();
  const bySku = new Map();
  for (const item of PRODUCTS) {
    const data = await graphql(
      `
        query WatchState($query: String!) {
          products(first: 20, query: $query) {
            nodes {
              id
              title
              handle
              status
              vendor
              productType
              tags
              descriptionHtml
              onlineStoreUrl
              variants(first: 10) {
                nodes {
                  id
                  sku
                  price
                  inventoryPolicy
                  inventoryItem {
                    id
                    sku
                    tracked
                    requiresShipping
                  }
                }
              }
              media(first: 10) {
                nodes {
                  ... on MediaImage {
                    id
                    alt
                    status
                    image {
                      url
                    }
                  }
                }
              }
              collections(first: 20) {
                nodes {
                  id
                  handle
                }
              }
              resourcePublications(first: 20) {
                nodes {
                  isPublished
                  publication {
                    id
                    name
                  }
                }
              }
              metafield(namespace: "custom", key: "part_number") {
                id
                value
              }
            }
          }
        }
      `,
      { query: `handle:${item.handle} OR sku:${item.sku}` },
    );
    for (const product of data.products.nodes) {
      byHandle.set(product.handle, product);
      for (const variant of product.variants.nodes)
        if (variant.sku) bySku.set(variant.sku, product);
    }
  }
  return {
    collections: new Map(
      collections.collections.nodes.map((node) => [node.handle, node]),
    ),
    publications: publications.publications.nodes.filter((node) =>
      PUBLICATIONS.includes(node.name),
    ),
    byHandle,
    bySku,
  };
}

function audit(current) {
  return PRODUCTS.map((item) => {
    const product = current.byHandle.get(item.handle);
    const skuOwner = current.bySku.get(item.sku);
    if (skuOwner && skuOwner.handle !== item.handle)
      throw new Error(
        `Duplicate SKU blocker: ${item.sku} already belongs to ${skuOwner.handle}`,
      );
    const variant = product?.variants.nodes[0];
    const changes = [];
    if (!product) changes.push('create');
    else {
      if (
        product.title !== item.title ||
        product.vendor !== 'Garmin' ||
        product.productType !== 'Watches & Accessories' ||
        product.status !== 'ACTIVE' ||
        product.descriptionHtml !== description(item) ||
        JSON.stringify([...product.tags].sort()) !==
          JSON.stringify(tagsFor(item).sort())
      )
        changes.push('product');
      if (
        !variant ||
        variant.sku !== item.sku ||
        Number(variant.price) !== Number(item.price) ||
        variant.inventoryPolicy !== 'CONTINUE' ||
        variant.inventoryItem.tracked ||
        !variant.inventoryItem.requiresShipping
      )
        changes.push('variant');
      if (
        WATCH_COLLECTIONS.some(
          (handle) =>
            !product.collections.nodes.some((node) => node.handle === handle),
        )
      )
        changes.push('collection');
      if (!product.media.nodes.some((node) => node.image?.url))
        changes.push('media');
      if (product.metafield?.value !== item.sku) changes.push('metafield');
      if (
        current.publications.some(
          (pub) =>
            !product.resourcePublications.nodes.some(
              (rp) => rp.isPublished && rp.publication.id === pub.id,
            ),
        )
      )
        changes.push('publication');
    }
    return { ...item, product, variant, changes };
  });
}

async function createDraft(record) {
  const data = await graphql(
    'mutation($product:ProductCreateInput!){productCreate(product:$product){product{id handle variants(first:5){nodes{id inventoryItem{id}}}} userErrors{field message}}}',
    {
      product: {
        title: record.title,
        handle: record.handle,
        vendor: 'Garmin',
        productType: 'Watches & Accessories',
        tags: tagsFor(record),
        descriptionHtml: description(record),
        status: 'DRAFT',
      },
    },
  );
  assertNoErrors(data, 'productCreate');
  return data.productCreate.product;
}

async function updateProduct(record, id, status = 'ACTIVE') {
  const data = await graphql(
    'mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id} userErrors{field message}}}',
    {
      product: {
        id,
        title: record.title,
        vendor: 'Garmin',
        productType: 'Watches & Accessories',
        tags: tagsFor(record),
        descriptionHtml: description(record),
        status,
      },
    },
  );
  assertNoErrors(data, 'productUpdate');
}

async function updateVariant(productId, variantId, record) {
  const data = await graphql(
    'mutation($productId:ID!,$variants:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$productId,variants:$variants){productVariants{id price inventoryPolicy} userErrors{field message}}}',
    {
      productId,
      variants: [
        { id: variantId, price: record.price, inventoryPolicy: 'CONTINUE' },
      ],
    },
  );
  assertNoErrors(data, 'productVariantsBulkUpdate');
}

async function updateInventoryItem(id, sku) {
  const data = await graphql(
    'mutation($id:ID!,$input:InventoryItemInput!){inventoryItemUpdate(id:$id,input:$input){inventoryItem{id sku tracked requiresShipping} userErrors{field message}}}',
    { id, input: { sku, tracked: false, requiresShipping: true } },
  );
  assertNoErrors(data, 'inventoryItemUpdate');
}

async function setPartNumber(productId, sku) {
  const data = await graphql(
    'mutation($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{id namespace key value} userErrors{field message}}}',
    {
      metafields: [
        {
          ownerId: productId,
          namespace: 'custom',
          key: 'part_number',
          type: 'single_line_text_field',
          value: sku,
        },
      ],
    },
  );
  assertNoErrors(data, 'metafieldsSet');
}

async function addCollection(productId, collectionId) {
  const data = await graphql(
    'mutation($id:ID!,$productIds:[ID!]!){collectionAddProducts(id:$id,productIds:$productIds){userErrors{field message}}}',
    { id: collectionId, productIds: [productId] },
  );
  const errors = data.collectionAddProducts.userErrors.filter(
    (error) => !error.message.toLowerCase().includes('already exists'),
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function addMedia(productId, record) {
  const data = await graphql(
    'mutation($productId:ID!,$media:[CreateMediaInput!]!){productCreateMedia(productId:$productId,media:$media){media{id status} mediaUserErrors{field message}}}',
    {
      productId,
      media: [
        {
          mediaContentType: 'IMAGE',
          originalSource: record.image,
          alt: record.title,
        },
      ],
    },
  );
  assertNoErrors(data, 'productCreateMedia');
}

async function publish(productId, publications) {
  const data = await graphql(
    'mutation($id:ID!,$input:[PublicationInput!]!){publishablePublish(id:$id,input:$input){userErrors{field message}}}',
    {
      id: productId,
      input: publications.map(({ id }) => ({ publicationId: id })),
    },
  );
  assertNoErrors(data, 'publishablePublish');
}

async function apply(records, current) {
  for (const record of records.filter((entry) => entry.changes.length)) {
    let product = record.product;
    if (!product) product = await createDraft(record);
    const variantId = product.variants.nodes[0]?.id || record.variant?.id;
    const inventoryId =
      product.variants.nodes[0]?.inventoryItem?.id ||
      record.variant?.inventoryItem?.id;
    if (!variantId || !inventoryId)
      throw new Error(`Missing default variant for ${record.sku}`);
    await updateVariant(product.id, variantId, record);
    await updateInventoryItem(inventoryId, record.sku);
    await setPartNumber(product.id, record.sku);
    for (const handle of WATCH_COLLECTIONS) {
      const collection = current.collections.get(handle);
      if (!collection)
        throw new Error(`Required collection missing: ${handle}`);
      if (!collection.ruleSet) await addCollection(product.id, collection.id);
    }
    if (!record.product || record.changes.includes('media'))
      await addMedia(product.id, record);
    await updateProduct(record, product.id, 'ACTIVE');
    await publish(product.id, current.publications);
    process.stderr.write(`launched ${record.sku} ${record.handle}\n`);
  }
}

async function main() {
  loadEnv();
  const beforeState = await state();
  for (const handle of WATCH_COLLECTIONS)
    if (!beforeState.collections.has(handle))
      throw new Error(`Required collection missing: ${handle}`);
  if (beforeState.publications.length !== PUBLICATIONS.length)
    throw new Error('Required RWAS storefront publications missing');
  const before = audit(beforeState);
  if (APPLY) await apply(before, beforeState);
  const after = APPLY ? audit(await state()) : null;
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    total: PRODUCTS.length,
    create: before.filter((x) => x.changes.includes('create')).length,
    update: before.filter(
      (x) => x.changes.length && !x.changes.includes('create'),
    ).length,
    unchanged: before.filter((x) => !x.changes.length).length,
    pending: before
      .filter((x) => x.changes.length)
      .map((x) => ({ sku: x.sku, handle: x.handle, changes: x.changes })),
    failures:
      after
        ?.filter((x) => x.changes.length)
        .map((x) => ({ sku: x.sku, changes: x.changes })) || [],
    products: (after || before).map((x) => ({
      sku: x.sku,
      handle: x.handle,
      price: x.price,
      onlineStoreUrl: x.product?.onlineStoreUrl || null,
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.failures.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `Watch launch reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
