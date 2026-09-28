#!/usr/bin/env node
import fs from 'node:fs';

const ENV = '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const HANDLE = 'papa-alpha-pa-28-pa-32-shared-shop-rigging-tool-package';
const TITLE = 'Papa-Alpha PA-28 / PA-32 Shared Shop Rigging Tool Package';
const SKU = 'RWAS-PA28-PA32-SHOP-17';
const PRICE = '3499.99';
const TYPE = 'Papa-Alpha Tools';
const VENDOR = 'RWAS';
const PUBS = new Set(['Online Store', 'Roger Wilco Aviation Services (RWAS)']);
const COMPONENTS = [
  ['KT-06', 1],
  ['R-04', 1],
  ['R-05', 1],
  ['R-06', 1],
  ['R-08', 1],
  ['BC-04', 2],
  ['BC-05', 2],
  ['BC-06', 2],
  ['BC-07', 2],
];
const CONTENTS = [
  ['R-03', 1, 'PA-28/PA-32 rudder reference tool #3'],
  ['R-04', 1, 'PA-28 rudder reference tool #4'],
  ['R-05', 1, 'PA-28 rudder reference tool #5'],
  ['R-06', 1, 'PA-28 rudder reference tool #6'],
  ['R-08', 1, 'PA-32RT rudder reference tool #8'],
  ['BC-03', 2, 'PA-28/PA-32 bell crank reference tool #3 — functional pair'],
  ['BC-04', 2, 'PA-28/PA-32 bell crank reference tool #4 — functional pair'],
  ['BC-05', 2, 'PA-28/PA-32 bell crank reference tool #5 — functional pair'],
  ['BC-06', 2, 'PA-28 bell crank reference tool #6 — functional pair'],
  ['BC-07', 2, 'PA-28 bell crank reference tool #7 — functional pair'],
  ['S-05', 1, 'PA-28/PA-32 stabilator rigging tool #5'],
  [
    'AF-01 (Shopify SKU 13-26179)',
    1,
    'PA-28/PA-32 aileron and flap rigging tool',
  ],
];
const BOMS = new Map([
  ['KT-06', 'R-03, 2× BC-03, S-05, AF-01'],
  ['KT-07', 'R-04, 2× BC-06, S-05, AF-01'],
  ['KT-08', 'R-04, 2× BC-04, S-05, AF-01'],
  ['KT-09', 'R-05, 2× BC-04, S-05, AF-01'],
  ['KT-11', 'R-04, 2× BC-05, S-05, AF-01'],
  ['KT-12', 'R-06, 2× BC-07, S-05, AF-01'],
  ['KT-18', 'R-03, 2× BC-04, S-05, AF-01'],
  ['KT-19', 'R-03, 2× BC-05, S-05, AF-01'],
  ['KT-20', 'R-08, 2× BC-03, S-05, AF-01'],
]);
const MEDIA = [
  [
    'https://cdn.shopify.com/s/files/1/0763/1306/7739/files/Rudder_Tool_2.jpg?v=1762350984',
    'Included Papa-Alpha rudder reference tool family — representative existing component photo',
  ],
  [
    'https://cdn.shopify.com/s/files/1/0763/1306/7739/files/Stab_Rigging.jpg?v=1762350984',
    'Included S-05 stabilator rigging tool family — existing component photo',
  ],
  [
    'https://cdn.shopify.com/s/files/1/0763/1306/7739/files/Bellcrank_5.jpg?v=1762350984',
    'Included Papa-Alpha bell crank reference tool family — representative existing component photo',
  ],
  [
    'https://cdn.shopify.com/s/files/1/0763/1306/7739/files/Aileron_Flap_AF_01.jpg?v=1760457131',
    'Included AF-01 aileron and flap rigging tool — existing component photo',
  ],
];
const TAGS = [
  'category-rigging-tool',
  'family-rigging-kit',
  'otc-eligible',
  'papa-alpha',
  'Rigging Tool',
  'rwas-custom-bundle',
];

for (const raw of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const s = raw.trim();
  if (!s || s.startsWith('#') || !s.includes('=')) continue;
  const i = s.indexOf('=');
  if (!process.env[s.slice(0, i).trim()])
    process.env[s.slice(0, i).trim()] = s
      .slice(i + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
}
const domain = process.env.SHOPIFY_STORE_DOMAIN,
  token =
    process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN,
  version = process.env.SHOPIFY_API_VERSION || '2026-01';
if (!domain || !token) throw Error('Missing Shopify Admin API configuration');
async function gql(query, variables = {}) {
  const r = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const p = await r.json();
  if (!r.ok || p.errors?.length) throw Error(JSON.stringify(p.errors || p));
  return p.data;
}
function check(data, key) {
  const e = data[key]?.userErrors || data[key]?.mediaUserErrors || [];
  if (e.length) throw Error(`${key}: ${JSON.stringify(e)}`);
}
function esc(v) {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function canonHtml(v) {
  return String(v).replace(/>\s+</g, '><').trim();
}
function trs(rows) {
  return rows
    .map((c) => `<tr>${c.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
    .join('');
}
function chart() {
  const s = fs.readFileSync(
      new URL('../data/papaAlphaRiggingChart.ts', import.meta.url),
      'utf8',
    ),
    m = s.match(
      /PAPA_ALPHA_RIGGING_CHART_ROWS[^=]*=\s*(\[[\s\S]*?\])\s+as const;/,
    );
  if (!m) throw Error('Cannot parse Papa-Alpha chart');
  return JSON.parse(m[1]).filter(
    (r) =>
      (r.model.startsWith('PA-28') || r.model.startsWith('PA-32')) &&
      BOMS.has(r.kit),
  );
}
function tools(r) {
  const sn = r.serials.replaceAll(' ', '');
  if (r.model === 'PA-28-161 Warrior III' && sn === '2842001thru2842420')
    return 'CONFLICT: Main chart says BC-04; KT-07 BOM says 2× BC-06. Package includes both pairs. Verify with Papa-Alpha before aircraft-specific use.';
  if (r.model === 'PA-28-161 Warrior III' && sn === '2816110thru2816119')
    return 'CONFLICT: Main chart says BC-06; KT-08 BOM says 2× BC-04. Package includes both pairs. Verify with Papa-Alpha before aircraft-specific use.';
  return BOMS.get(r.kit);
}
function description() {
  const coverage = chart().map((r) => [
    r.model,
    r.serials.replace(/\s+/g, ' '),
    r.kit,
    tools(r),
  ]);
  return `<h2>One shared PA-28 / PA-32 shop tooling package</h2>
<p>This RWAS-custom assembled package combines the documented Papa-Alpha tooling used across the PA-28 and PA-32 model and serial ranges listed below. It is one shared shop set for sequential use—not duplicate tooling for every aircraft and not a claim that one set supports simultaneous jobs.</p>
<p><strong>Important:</strong> Confirm the exact aircraft model and serial number against the chart before use. This package is not a new Papa-Alpha manufacturer kit number, does not claim every PA-28/PA-32 ever produced, and is not a substitute for the applicable Piper maintenance data or other general rigging equipment the maintenance procedure requires. “Piper,” aircraft model names, and trademarks are used descriptively only; no endorsement is implied.</p>
<h2>Complete kit contents — 12 component SKUs / 17 physical tools</h2><div style="overflow-x:auto"><table><thead><tr><th>Component part number</th><th>Qty.</th><th>Purpose</th></tr></thead><tbody>${trs(CONTENTS)}</tbody></table></div>
<p><small>Fulfillment uses one KT-06 base kit plus the listed unique additions. KT-06 supplies R-03, two BC-03, S-05, and AF-01; those components are not added a second time. AF-02 is not included.</small></p>
<h2>Aircraft model, serial range, and applicable component chart</h2><p>The kit references represented are KT-06, KT-07, KT-08, KT-09, KT-11, KT-12, KT-18, KT-19, and KT-20. Bell crank entries are functional pairs.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Aircraft model</th><th>Serial number range</th><th>Kit reference</th><th>Applicable component PNs</th></tr></thead><tbody>${trs(coverage)}</tbody></table></div>
<h3>Warrior III source-chart notice</h3><p>The current Papa-Alpha chart has two unresolved Warrior III inconsistencies: the Main sheet lists BC-04 for serials 2842001–2842420 while the KT-07 BOM lists BC-06, and the Main sheet lists BC-06 for serials 2816110–2816119 while the KT-08 BOM lists BC-04. This package includes both BC-04 and BC-06 pairs, but the aircraft-specific mapping still requires model/serial verification and manufacturer confirmation.</p>`;
}

async function state() {
  const d = await gql(
    `query S($q:String!){products(first:20,query:$q){nodes{id handle title descriptionHtml status vendor productType tags onlineStoreUrl media(first:20){nodes{id alt status preview{image{url}}}} variants(first:10){nodes{id sku price compareAtPrice inventoryPolicy inventoryQuantity availableForSale sellableOnlineQuantity requiresComponents inventoryItem{id tracked} productVariantComponents(first:20){nodes{id quantity productVariant{id sku product{id handle}}}}}} resourcePublicationsV2(first:30){nodes{isPublished publication{id name}}} collections(first:20){nodes{id handle}}}} byHandle:productByHandle(handle:"papa-alpha-pa-28-pa-32-shared-shop-rigging-tool-package"){id handle title descriptionHtml status vendor productType tags onlineStoreUrl media(first:20){nodes{id alt status preview{image{url}}}} variants(first:10){nodes{id sku price compareAtPrice inventoryPolicy inventoryQuantity availableForSale sellableOnlineQuantity requiresComponents inventoryItem{id tracked} productVariantComponents(first:20){nodes{id quantity productVariant{id sku product{id handle}}}}}} resourcePublicationsV2(first:30){nodes{isPublished publication{id name}}} collections(first:20){nodes{id handle}}} componentProducts:collectionByHandle(handle:"papa-alpha-tools"){products(first:100){nodes{id handle variants(first:100){nodes{id sku price inventoryPolicy inventoryQuantity inventoryItem{id tracked}}}}}} publications(first:30){nodes{id name}}}`,
    { q: `sku:${SKU}` },
  );
  const matches = new Map(d.products.nodes.map((p) => [p.id, p]));
  if (d.byHandle) matches.set(d.byHandle.id, d.byHandle);
  if (matches.size > 1) throw Error('Duplicate custom package products found');
  const cv = new Map();
  for (const p of d.componentProducts.products.nodes)
    for (const v of p.variants.nodes)
      if (COMPONENTS.some(([s]) => s === v.sku))
        cv.set(v.sku, { ...v, product: p });
  for (const [s] of COMPONENTS)
    if (!cv.has(s)) throw Error(`Missing component ${s}`);
  return {
    product: [...matches.values()][0] || null,
    cv,
    publications: d.publications.nodes,
  };
}
function audit(s) {
  const p = s.product,
    v = p?.variants.nodes[0],
    changes = [];
  if (!p) changes.push('create');
  else {
    if (
      p.handle !== HANDLE ||
      p.title !== TITLE ||
      canonHtml(p.descriptionHtml) !== canonHtml(description()) ||
      p.status !== 'ACTIVE' ||
      p.vendor !== VENDOR ||
      p.productType !== TYPE ||
      JSON.stringify([...p.tags].sort()) !== JSON.stringify([...TAGS].sort())
    )
      changes.push('product');
    if (v?.sku !== SKU || v?.price !== PRICE || v?.compareAtPrice !== null)
      changes.push('variant');
    const a = (v?.productVariantComponents.nodes || [])
      .map((n) => [n.productVariant.sku, n.quantity])
      .sort();
    if (
      !v?.requiresComponents ||
      JSON.stringify(a) !== JSON.stringify([...COMPONENTS].sort())
    )
      changes.push('components');
    if (!p.collections.nodes.some((n) => n.handle === 'papa-alpha-tools'))
      changes.push('collection');
    const pubs = new Set(
      p.resourcePublicationsV2.nodes
        .filter((n) => n.isPublished)
        .map((n) => n.publication.name),
    );
    if ([...PUBS].some((n) => !pubs.has(n))) changes.push('publications');
    if (p.media.nodes.length < MEDIA.length) changes.push('media');
  }
  return {
    changes,
    product: p
      ? {
          id: p.id,
          handle: p.handle,
          title: p.title,
          status: p.status,
          onlineStoreUrl: p.onlineStoreUrl,
        }
      : null,
    variant: v
      ? {
          id: v.id,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          requiresComponents: v.requiresComponents,
          inventoryPolicy: v.inventoryPolicy,
          inventoryQuantity: v.inventoryQuantity,
          sellableOnlineQuantity: v.sellableOnlineQuantity,
          availableForSale: v.availableForSale,
          tracked: v.inventoryItem.tracked,
        }
      : null,
    components: [...s.cv].map(([sku, x]) => ({
      sku,
      quantity: COMPONENTS.find(([z]) => z === sku)[1],
      variantId: x.id,
      tracked: x.inventoryItem.tracked,
      inventoryPolicy: x.inventoryPolicy,
      inventoryQuantity: x.inventoryQuantity,
    })),
    descriptionEvidence: {
      contentRows: CONTENTS.length,
      physicalTools: CONTENTS.reduce((n, [, q]) => n + q, 0),
      coverageRows: chart().length,
    },
  };
}
async function create() {
  const d = await gql(
    `mutation C($p:ProductCreateInput!){productCreate(product:$p){product{id handle variants(first:5){nodes{id inventoryItem{id}}}} userErrors{field message}}}`,
    {
      p: {
        title: TITLE,
        handle: HANDLE,
        descriptionHtml: description(),
        status: 'DRAFT',
        vendor: VENDOR,
        productType: TYPE,
        tags: TAGS,
      },
    },
  );
  check(d, 'productCreate');
  return d.productCreate.product;
}
async function product(id, status) {
  const d = await gql(
    `mutation U($p:ProductUpdateInput!){productUpdate(product:$p){product{id} userErrors{field message}}}`,
    {
      p: {
        id,
        title: TITLE,
        handle: HANDLE,
        descriptionHtml: description(),
        status,
        vendor: VENDOR,
        productType: TYPE,
        tags: TAGS,
      },
    },
  );
  check(d, 'productUpdate');
}
async function variant(pid, v, iid) {
  let d = await gql(
    `mutation V($p:ID!,$v:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$p,variants:$v){productVariants{id price compareAtPrice} userErrors{field message}}}`,
    { p: pid, v: [{ id: v, price: PRICE, compareAtPrice: null }] },
  );
  check(d, 'productVariantsBulkUpdate');
  d = await gql(
    `mutation I($id:ID!,$i:InventoryItemInput!){inventoryItemUpdate(id:$id,input:$i){inventoryItem{id sku} userErrors{field message}}}`,
    { id: iid, i: { sku: SKU } },
  );
  check(d, 'inventoryItemUpdate');
}
async function components(vid, s) {
  const old =
      s.product?.variants.nodes[0]?.productVariantComponents.nodes || [],
    input = {
      parentProductVariantId: vid,
      removeAllProductVariantRelationships: old.length > 0,
      productVariantRelationshipsToCreate: COMPONENTS.map(
        ([sku, quantity]) => ({ id: s.cv.get(sku).id, quantity }),
      ),
      priceInput: { calculation: 'FIXED', price: PRICE },
    };
  const d = await gql(
    `mutation R($i:[ProductVariantRelationshipUpdateInput!]!){productVariantRelationshipBulkUpdate(input:$i){parentProductVariants{id requiresComponents} userErrors{code field message}}}`,
    { i: [input] },
  );
  check(d, 'productVariantRelationshipBulkUpdate');
}
async function media(id) {
  const d = await gql(
    `mutation M($id:ID!,$m:[CreateMediaInput!]!){productCreateMedia(productId:$id,media:$m){media{id status alt} mediaUserErrors{field message}}}`,
    {
      id,
      m: MEDIA.map(([originalSource, alt]) => ({
        mediaContentType: 'IMAGE',
        originalSource,
        alt,
      })),
    },
  );
  check(d, 'productCreateMedia');
}
async function publish(id, pubs) {
  const chosen = pubs.filter((p) => PUBS.has(p.name));
  if (chosen.length !== PUBS.size)
    throw Error('Required publication unavailable');
  const d = await gql(
    `mutation P($id:ID!,$i:[PublicationInput!]!){publishablePublish(id:$id,input:$i){userErrors{field message}}}`,
    { id, i: chosen.map((p) => ({ publicationId: p.id })) },
  );
  check(d, 'publishablePublish');
}
async function apply(s) {
  let p = s.product;
  if (!p) p = await create();
  else await product(p.id, 'DRAFT');
  const v = p.variants.nodes[0];
  await variant(p.id, v.id, v.inventoryItem.id);
  await components(v.id, s);
  if (!s.product || s.product.media.nodes.length < MEDIA.length)
    await media(p.id);
  await product(p.id, 'ACTIVE');
  await publish(p.id, s.publications);
}
const applyMode = process.argv.includes('--apply'),
  beforeState = await state(),
  before = audit(beforeState);
if (applyMode && before.changes.length) await apply(beforeState);
const after = applyMode ? audit(await state()) : null;
process.stdout.write(
  `${JSON.stringify({ mode: applyMode ? 'apply' : 'dry-run', before, after }, null, 2)}\n`,
);
if (after?.changes.length) process.exitCode = 1;
