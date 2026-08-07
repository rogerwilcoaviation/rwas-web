#!/usr/bin/env node

import fs from 'node:fs';

const ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

const VIDEO =
  '<iframe width="560" height="315" src="https://www.youtube.com/embed/icZaA26jAKw?si=Wk9yWojXFjnuTzQv" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';

const IMAGES = [
  'https://res.garmin.com/www/aviation/80686/80686-hero-desktop.jpg',
  'https://res.garmin.com/www/aviation/80686/80686-overview-banner-product-lineup-image-desktop.jpg',
  'https://res.garmin.com/www/aviation/80686/80686-overview-spotlight-fully-integrated-system.jpg',
  'https://res.garmin.com/www/aviation/80686/80686-overview-spotlight-advanced-capabilities-and-safety.jpg',
  'https://res.garmin.com/www/aviation/80686/80686-overview-spotlight-streamlined-installation.jpg',
];

const CERTIFIED = `
1|010-04143-00|6600|AXIS 8-inch Portrait Display - GDU 80P
1|010-04145-00|6600|AXIS 8-inch Landscape Display - GDU 80L
1|010-03000-00|9600|AXIS 11.6-inch Display - GDU 116B
1|010-03001-00|18400|AXIS 11.6-inch Display with IFR GPS/COMM and Audio - GDU 116C (TSO)
1|010-03002-00|23400|AXIS 11.6-inch Display with IFR GPS/NAV/COMM and Audio - GDU 116NC (TSO)
1A|010-14469-00|200|Install Kit, GDU 80P/80L, New Install
1A|010-14469-10|100|Install Kit, GDU 80/116B, G3X Touch Upgrade
1A|010-14469-01|200|Install Kit, GDU 116B, New Install
1A|010-14469-02|400|Install Kit, GDU 116C/116NC, New Install
1A|010-14469-12|200|Install Kit, GDU 116C/116NC, G3X Touch Upgrade
1A|010-02639-00|400|GA 35S GPS/WAAS Antenna
1A|K00-01479-00|200|Printed Material Kit, GDU 80/116 Series
2|010-04557-00|4000|AXIS Certified LRU Kit with GSU 25D, GMU 11 and GTP 59
2|K11-00066-00|200|Install Kit, AXIS Certified
2|010-02003-05|10500|LRU Kit with GMU 44B, GSU 75 and GTP 59
2|K11-00019-50|650|Install Kit, GMU 44B and GSU 75
3|K10-00280-01|3095|G5 for Certificated Aircraft
3|010-02326-10|4695|GI 275 ADAHRS Kit, Class I/II
3|010-02326-20|5795|GI 275 ADAHRS +AP Kit, Class I/II
4|010-02770-11|2300|GEA 24B, Unit Only, PMA
4|011-02886-01|255|GEA 24 Connector Kit, PMA
4|010-01329-01|3710|GEA 110, Unit Only
4|011-03527-50|320|GEA 110 Connector Kit
4|011-03527-51|565|GEA 110 Sealed Connector Kit
4|011-03941-00|190|GEA 110 Install Tray
4A|K00-01010-11|1230|Engine Sensor Kit, 4-cylinder Lycoming/Continental
4A|K00-01011-11|1615|Engine Sensor Kit, 6-cylinder Lycoming/Continental
6|010-02002-05|20040|GTN 750Xi IFR GPS/NAV/COMM/MFD
6|010-01999-05|14040|GTN 650Xi IFR GPS/NAV/COMM/MFD
6|010-02232-51|8495|GNC 355 IFR GPS and COMM Radio
6|010-01823-50|9395|GNX 375 IFR GPS and ADS-B In/Out Transponder
6|010-01822-50|6250|GPS 175 IFR GPS Navigator
6|010-02481-01|5595|GNC 215 NAV/COMM Radio
6|010-02480-01|2895|GTR 205 COMM Radio
6|010-02479-00|2265|GTR 205R Remote COMM Radio
6|010-01319-03|2495|GMA 345 Audio Panel
6|010-01471-11|2550|GMA 245R PMA Remote Audio Panel
7|010-01214-01|3895|GTX 335 ADS-B Out Transponder
7|010-01215-01|3895|GTX 335R Remote ADS-B Out Transponder
7|010-01216-06|6595|GTX 345 ADS-B In/Out Transponder
7|010-01217-06|6595|GTX 345R Remote ADS-B In/Out Transponder
7|010-01561-15|1150|GDL 50R PMA Remote ADS-B Receiver
7|010-01561-55|1000|GDL 51R PMA Remote SiriusXM Receiver
7|010-01561-35|1575|GDL 52R PMA Remote SiriusXM and ADS-B Receiver
7|011-04170-00|85|GDL Remote Mount Connector Kit, PMA
7|010-12498-50|95|GA 24 TNC SiriusXM Antenna
8|006-B5211-00|2200|AXIS ChartView Enablement
8|006-B5211-01|2000|AXIS SurfaceWatch Enablement
8|006-B5211-02|8500|AXIS TAWS-B Enablement
8|010-02895-00|2145|GHA 15 PMA Height Advisor
8|011-05278-00|525|GHA 15 Connector Kit
8|011-06097-00|25|GHA 15 Install Kit
8|011-06677-00|325|GHA 15 Levelling Install Kit
8|010-02975-01|549|GCO 14 Carbon Monoxide Detector
8|010-01172-21|875|GAD 29D PMA ARINC 429 Interface Adapter
8|011-03271-00|100|GAD 29 Connector Kit
8|010-01525-11|825|GAD 27 PMA Electrical Interface Adapter
8|011-03877-01|160|GAD 27 Connector Kit
8|010-01074-71|1400|GAP 26 PMA Self-Regulating Pitot Tube
`;

const EXPERIMENTAL = `
1|010-04143-00|4140|AXIS 8-inch Portrait Display - GDU 80PX
1|010-04145-00|4140|AXIS 8-inch Landscape Display - GDU 80LX
1|010-03000-00|4980|AXIS 11.6-inch Display - GDU 116BX
1|010-03001-00|18400|AXIS 11.6-inch Display with IFR GPS/COMM and Audio - GDU 116C (TSO)
1|010-03002-00|23400|AXIS 11.6-inch Display with IFR GPS/NAV/COMM and Audio - GDU 116NC (TSO)
1A|010-14468-00|180|Install Kit, GDU 80PX/LX, New Install
1A|010-14468-10|90|Install Kit, GDU 80X/116BX, G3X Touch Upgrade
1A|010-14468-01|180|Install Kit, GDU 116BX, New Install
1A|010-14469-02|400|Install Kit, GDU 116C/116NC, New Install
1A|010-14469-12|200|Install Kit, GDU 116C/116NC, G3X Touch Upgrade
1A|010-02639-00|400|GA 35S GPS/WAAS Antenna
1A|K00-01479-00|200|Printed Material Kit, GDU 80/116 Series
2|010-04556-00|1860|AXIS X LRU Kit with GSU 25C, GMU 11 and GTP 59
2|010-04556-01|3340|AXIS X LRU Kit with GSU 25D, GMU 22 and GTP 59
2|010-01071-55|990|GSU 25C, Unit Only
2|010-01071-56|2800|GSU 25D PMA, Unit Only
2|010-01788-00|410|GMU 11, Unit Only
2A|K10-00181-00|110|GSU 25 Connector Kit
2A|011-04349-90|75|GMU 11 Install Kit
2A|011-00871-10|125|GMU 22 Install Kit
3|010-01485-01|1660|G5, Unit Only
3|010-12493-11|120|G5 Installation Kit
3|010-12493-02|280|G5 Battery Pack
3|010-02203-K0|560|GAD 13, GTP 59 and Connection Kit
3|010-02203-00|170|GAD 13 FAA-PMA, Unit Only
3|011-03002-10|70|9-pin Connector Kit with CAN Term, PMA
4|010-02770-00|975|GEA 24B, Unit Only
4|011-02886-00|215|GEA 24 Connector Kit
4|010-01329-01|3710|GEA 110, Unit Only
4|011-03527-50|320|GEA 110 Connector Kit
4|011-03527-51|565|GEA 110 Sealed Connector Kit
4|011-03941-00|190|GEA 110 Install Tray
4A|K00-00512-10|1180|Engine Sensor Kit, 4-cylinder Lycoming/Continental
4A|K00-00513-10|1440|Engine Sensor Kit, 6-cylinder Lycoming/Continental
4A|K00-00514-10|430|Engine Sensor Kit, Rotax 912UL
4A|011-05783-10|320|GPT 15G Pressure Sensor
4A|011-05783-20|320|GPT 75G Pressure Sensor
4A|494-10001-00|520|Fuel Flow Sensor, 1/4-inch Female NPT
4A|494-50005-00|195|Hall Effect RPM Sensor, Slick Magneto
4A|494-50005-01|195|Hall Effect RPM Sensor, Bendix Magneto
4A|494-70002-00|120|TIT Type K Thermocouple, 7/16-20 Bayonet
4A|494-70005-00|155|Carburetor Temperature RTD, 1/4-28
4A|909-D0000-00|75|100-amp Ammeter Shunt, +/-50 mV
5|010-01068-20|1060|GSA 28 Servo
5|010-01946-00|1370|GMC 507 Autopilot Mode Controller
5A|010-12700-00|80|GMC 507 Connector Kit
5A|010-12700-10|55|GMC 507 Install Rack
5A|011-02950-00|75|GSA 28 Connector Kit
5A|011-02950-01|200|GSA 28 Right-angle Connector Kit
5A|011-02952-01|165|GSA 28 Generic Servo Installation Kit
5A|011-02952-10|165|GSA 28 Servo Installation Kit, RV-6 Roll
5A|011-02952-11|165|GSA 28 Servo Installation Kit, RV-4/8 Pitch
5A|011-02952-12|165|GSA 28 Servo Installation Kit, RV-7/8/10 Roll
5A|011-02952-13|165|GSA 28 Servo Installation Kit, RV-9 Roll
5A|011-02952-14|165|GSA 28 Servo Installation Kit, RV-6/7/9 Pitch
5A|011-02952-15|165|GSA 28 Servo Installation Kit, RV-10 Pitch
5A|011-02952-16|650|GSA 28 Servo Installation Kit, RV-10 Yaw
6|010-02002-05|20040|GTN 750Xi IFR GPS/NAV/COMM/MFD
6|010-01999-05|14040|GTN 650Xi IFR GPS/NAV/COMM/MFD
6|010-02232-51|7750|GNC 355 IFR GPS and COMM Radio
6|010-01823-50|8250|GNX 375 IFR GPS and ADS-B In/Out Transponder
6|010-01822-50|5525|GPS 175 IFR GPS Navigator
6|010-02481-01|4975|GNC 215 NAV/COMM Radio
6|010-03395-01|2160|GTR 205X COMM Radio
6|010-03396-01|1720|GTR 205XR Remote COMM Radio
6|010-01318-03|1770|GMA 245 Audio Panel
6|010-01471-03|1645|GMA 245R Remote Audio Panel
7|010-01757-46|4860|GTX 45R with GPS Remote ADS-B In/Out Transponder
7|010-01757-06|4180|GTX 45R Remote ADS-B In/Out Transponder
7|010-01756-01|2765|GTX 35R Remote ADS-B Out Transponder
7|010-01561-10|950|GDL 50R Remote ADS-B Receiver
7|010-01561-50|820|GDL 51R Remote SiriusXM Receiver
7|010-01561-30|1365|GDL 52R Remote SiriusXM and ADS-B Receiver
7|010-12498-60|70|GDL Remote Mount Connector Kit
7|010-12498-50|95|GA 24 TNC SiriusXM Antenna
8|006-B5211-00|2200|AXIS ChartView Enablement
8|006-B5211-01|2000|AXIS SurfaceWatch Enablement
8|006-B5211-02|8500|AXIS TAWS-B Enablement
8|010-02942-00|1995|GHA 15 Height Advisor
8|010-02975-01|549|GCO 14 Carbon Monoxide Detector
8|010-01172-20|565|GAD 29C ARINC 429 Interface Adapter
8|011-03271-00|90|GAD 29 Connector Kit
8|010-01525-10|825|GAD 27 Electrical Interface Adapter
8|011-03877-00|165|GAD 27 Connector Kit
8|010-01074-00|340|GAP 26 Unheated Pitot Tube
8|010-01074-10|465|GAP 26 Heated/Unregulated Pitot Tube
8|010-01074-20|700|GAP 26 Heated/Regulated Pitot Tube
8|010-01287-00|380|GI 260 Angle of Attack Indicator
`;

function loadEnv() {
  for (const raw of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}

function parse(source, kind) {
  return source.trim().split('\n').map((line) => {
    const [step, sku, price, title] = line.split('|');
    const system =
      kind === 'certified' ? 'Certified AXIS System' : 'Experimental AXIS System';
    return { step, sku, price, title: `${system} — ${title}`, kind };
  });
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function handleFor(item) {
  return `garmin-axis-${item.kind}-${slug(item.sku)}`;
}

function stepLabel(step) {
  return {
    '1': 'Select Displays', '1A': 'Display Install Kits',
    '2': 'System Sensors', '2A': 'System Sensor Install Kits',
    '3': 'Standby Flight Instrument', '4': 'Engine/Airframe Interface',
    '4A': 'Engine Sensors', '5': 'Autopilot',
    '5A': 'Autopilot Install Kits and Servo Mounts',
    '6': 'IFR GPS, Radios and Audio Panel',
    '7': 'Transponder and Datalinks', '8': 'Additional Options',
  }[step];
}

function description(item) {
  const aircraft = item.kind === 'certified' ? 'certified' : 'experimental';
  return `<h2>${item.title}</h2><p><strong>Garmin part number:</strong> ${item.sku}</p><p>This component appears in Step ${item.step}, <strong>${stepLabel(item.step)}</strong>, of Garmin's AXIS Build-A-System Guide for ${aircraft} aircraft.</p><p>AXIS brings advanced PFD, MFD and EIS capability to a highly integrated flight deck. Depending on the selected display and approved configuration, the system can incorporate IFR GPS, NAV/COMM, audio, traffic, weather, engine data and Garmin safety-enhancing functions.</p><p><strong>System planning note:</strong> AXIS is a configurable avionics system. Required hardware and aircraft eligibility depend on the complete installation. Contact Roger Wilco Aviation Services, a Garmin authorized dealer and FAA repair station, to confirm compatibility and obtain an installation proposal.</p><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%">${VIDEO.replace('width="560" height="315"', 'style="position:absolute;top:0;left:0;width:100%;height:100%"')}</div><p><small>Pricing follows the July 2026 Garmin AXIS Build-A-System Guide and is subject to change. Final certified installation pricing is determined after aircraft and configuration review.</small></p>`;
}

async function graphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) throw new Error(JSON.stringify(payload.errors || payload));
  return payload.data;
}

function assert(result, field) {
  const errors = result[field]?.userErrors || result[field]?.mediaUserErrors || [];
  if (errors.length) throw new Error(`${field}: ${JSON.stringify(errors)}`);
}

async function getState(items) {
  const [collections, publications] = await Promise.all([
    graphql(`query { collections(first: 250) { nodes { id handle ruleSet { appliedDisjunctively } } } }`),
    graphql(`query { publications(first: 50) { nodes { id name } } }`),
  ]);
  const products = [];
  for (let offset = 0; offset < items.length; offset += 40) {
    const query = items.slice(offset, offset + 40).map((item) => `handle:${handleFor(item)}`).join(' OR ');
    const data = await graphql(`query AxisProducts($query: String!) { products(first: 100, query: $query) { nodes { id handle title status productType tags descriptionHtml media(first: 20) { nodes { id alt status } } variants(first: 10) { nodes { id sku price inventoryItem { id } } } collections(first: 20) { nodes { id handle } } } } }`, { query });
    products.push(...data.products.nodes);
  }
  return {
    collections: new Map(collections.collections.nodes.map((node) => [node.handle, node])),
    publications: publications.publications.nodes.filter((node) => ['Online Store', 'Roger Wilco Aviation Services (RWAS)'].includes(node.name)),
    products: new Map(products.map((node) => [node.handle, node])),
  };
}

function audit(items, state) {
  return items.map((item) => {
    const handle = handleFor(item);
    const product = state.products.get(handle);
    const expectedCollections = item.kind === 'certified'
      ? ['garmin-dealer-install']
      : ['avionics-experimental'];
    const expectedType = item.kind === 'certified' ? 'Garmin Dealer Install' : 'Avionics — Experimental';
    const tags = [
      'Garmin',
      'AXIS',
      'garmin-family:axis',
      `garmin-subcategory:axis-step-${item.step.toLowerCase()}-${slug(stepLabel(item.step))}`,
      ...(item.kind === 'certified'
        ? ['dealer-install-only']
        : ['experimental-retail', 'otc-eligible']),
    ];
    const variant = product?.variants.nodes[0];
    const changes = [];
    if (!product) changes.push('create');
    else {
      if (product.title !== item.title || product.productType !== expectedType || product.status !== 'ACTIVE' || product.descriptionHtml !== description(item)) changes.push('product');
      if (variant?.sku !== item.sku || Number(variant?.price) !== Number(item.price)) changes.push('variant');
      if (expectedCollections.some((handle) => !product.collections.nodes.some((node) => node.handle === handle))) changes.push('collection');
      if (product.media.nodes.length < IMAGES.length) changes.push('media');
    }
    return { ...item, handle, expectedCollections, expectedType, tags, product, variant, changes };
  });
}

async function createProduct(record) {
  const data = await graphql(`mutation CreateAxisProduct($product: ProductCreateInput!) { productCreate(product: $product) { product { id handle variants(first: 5) { nodes { id inventoryItem { id } } } } userErrors { field message } } }`, {
    product: { title: record.title, handle: record.handle, vendor: 'Garmin', productType: record.expectedType, tags: record.tags, descriptionHtml: description(record), status: 'ACTIVE' },
  });
  assert(data, 'productCreate');
  return data.productCreate.product;
}

async function updateProduct(record, productId) {
  const data = await graphql(`mutation UpdateAxisProduct($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id } userErrors { field message } } }`, {
    product: { id: productId, title: record.title, vendor: 'Garmin', productType: record.expectedType, tags: record.tags, descriptionHtml: description(record), status: 'ACTIVE' },
  });
  assert(data, 'productUpdate');
}

async function updateVariant(productId, variantId, record) {
  const data = await graphql(`mutation UpdateAxisVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id sku price } userErrors { field message } } }`, {
    productId, variants: [{ id: variantId, price: record.price, inventoryPolicy: 'CONTINUE' }],
  });
  assert(data, 'productVariantsBulkUpdate');
}

async function updateSku(inventoryItemId, sku) {
  const data = await graphql(`mutation UpdateAxisSku($id: ID!, $input: InventoryItemInput!) { inventoryItemUpdate(id: $id, input: $input) { inventoryItem { id sku } userErrors { field message } } }`, { id: inventoryItemId, input: { sku } });
  assert(data, 'inventoryItemUpdate');
}

async function addCollection(productId, collectionId) {
  const data = await graphql(`mutation AddAxisCollection($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`, { id: collectionId, productIds: [productId] });
  const errors = data.collectionAddProducts.userErrors.filter((error) => !error.message.toLowerCase().includes('already exists'));
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function addMedia(productId, record) {
  const data = await graphql(`mutation AddAxisMedia($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { id status } mediaUserErrors { field message } } }`, {
    productId,
    media: IMAGES.map((originalSource, index) => ({ mediaContentType: 'IMAGE', originalSource, alt: `${record.title} — Garmin AXIS ${index + 1}` })),
  });
  assert(data, 'productCreateMedia');
}

async function publish(productId, publications) {
  if (!publications.length) return;
  const data = await graphql(`mutation PublishAxisProduct($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id: productId, input: publications.map(({ id }) => ({ publicationId: id })) });
  assert(data, 'publishablePublish');
}

async function apply(records, state) {
  let completed = 0;
  for (const record of records.filter((item) => item.changes.length)) {
    let product = record.product;
    if (!product) product = await createProduct(record);
    else if (record.changes.includes('product')) await updateProduct(record, product.id);
    const variantId = product.variants.nodes[0]?.id || record.variant?.id;
    const inventoryItemId = product.variants.nodes[0]?.inventoryItem?.id || record.variant?.inventoryItem?.id;
    await updateVariant(product.id, variantId, record);
    await updateSku(inventoryItemId, record.sku);
    if (record.changes.includes('collection') || record.changes.includes('create')) {
      for (const handle of record.expectedCollections) {
        const collection = state.collections.get(handle);
        if (!collection) throw new Error(`Required collection missing: ${handle}`);
        if (!collection.ruleSet) await addCollection(product.id, collection.id);
      }
    }
    if (record.changes.includes('media') || record.changes.includes('create')) await addMedia(product.id, record);
    await publish(product.id, state.publications);
    completed += 1;
    process.stderr.write(`[${completed}] ${record.handle}\n`);
  }
  return completed;
}

async function main() {
  loadEnv();
  const items = [...parse(CERTIFIED, 'certified'), ...parse(EXPERIMENTAL, 'experimental')];
  const state = await getState(items);
  const before = audit(items, state);
  const applyMode = process.argv.includes('--apply');
  const applied = applyMode ? await apply(before, state) : 0;
  const after = applyMode ? audit(items, await getState(items)) : null;
  const failures = after?.filter((item) => item.changes.length).map((item) => ({ handle: item.handle, changes: item.changes })) || [];
  const summary = {
    mode: applyMode ? 'apply' : 'dry-run', total: items.length,
    certified: items.filter((item) => item.kind === 'certified').length,
    experimental: items.filter((item) => item.kind === 'experimental').length,
    create: before.filter((item) => item.changes.includes('create')).length,
    change: before.filter((item) => item.changes.length && !item.changes.includes('create')).length,
    unchanged: before.filter((item) => !item.changes.length).length,
    pending: before.filter((item) => item.changes.length).map((item) => ({ handle: item.handle, changes: item.changes })),
    applied, failures,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`AXIS product reconciliation failed: ${error.message}\n`);
  process.exitCode = 1;
});
