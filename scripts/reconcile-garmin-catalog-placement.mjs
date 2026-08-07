#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';

const COLLECTIONS = {
  retail: 'avionics-certified',
  experimental: 'avionics-experimental',
  legacyExperimental: 'retail-experimental',
  certifiedInstallOnly: 'garmin-avionics',
  accessories: 'garmin-avionics-accessories',
  dealerInstall: 'garmin-dealer-install',
  databaseCards: 'garmin-database-cards',
  portable: 'garmin-portable-gps-wearables',
  pilotGear: 'pilot-gear',
  watches: 'watches-accessories',
  legacyWatches: 'garmin-watches',
  genericGarmin: 'garmin-products',
};

// These legacy collections are intentionally deleted once their memberships
// have been migrated. Their absence is the desired steady state, not a failed
// prerequisite for later catalog rescans.
const OPTIONAL_COLLECTIONS = new Set([COLLECTIONS.legacyExperimental]);

const TYPES = {
  certified: 'Avionics — Certified',
  experimental: 'Avionics — Experimental',
  dealer: 'Garmin Dealer Install',
  pilot: 'Pilot Gear',
  watches: 'Watches & Accessories',
  excluded: 'Garmin Catalog Excluded',
  unclassified: 'Garmin Aviation',
};

const REQUIRED_STOREFRONT_PUBLICATIONS = [
  'Online Store',
  'Roger Wilco Aviation Services (RWAS)',
];

// Source: 2026 Americas Aviation Dealer Requirements, p. 8,
// "Installed Products excluded under the Garmin Installation Policy."
// SHA-256: 436346b360216e824d949d671df443d6a48111429cbe1216924938181c16070f
// The exact SKU set below is the intersection of those approved families,
// active Shopify products, and the current Garmin list-price authority.
const APPROVED_CERTIFIED_OTC = new Set([
  '010-02232-00',
  '010-02232-50',
  '010-02232-51',
  '010-01822-50',
  '010-01823-50',
  '010-01823-51',
  'K10-00280-01',
  'K10-00280-21',
  'K10-00280-31',
  'K10-00280-51',
  '010-02203-00',
  '010-02203-K0',
  '010-01074-70',
  '010-01074-71',
  '010-01074-00',
  '010-01074-10',
  '010-01074-20',
  '010-01074-60',
  '010-01560-31',
  '010-02325-00',
  '010-02325-10',
  '010-02325-20',
  'K10-00202-00',
  'K10-00202-10',
  'K10-00202-20',
  '010-01287-00',
  'K10-00276-05',
  '010-01083-01',
  '010-01319-02',
  '010-01319-10',
  '010-01319-13',
  '010-02480-01',
  '010-02480-02',
  '010-01788-00',
  '010-01788-01',
  '010-02481-01',
  '010-02481-02',
  '010-02544-41',
  '010-02544-51',
  '010-02201-10',
  '010-02201-11',
  '010-02201-00',
  '010-02544-21',
  '010-02544-31',
]);

const OFFICIAL_EXPERIMENTAL = new Set([
  '010-01087-21',
  '010-01056-00',
  '010-01057-00',
  '010-01318-01',
  '010-01471-01',
  '010-01485-01',
  '010-01765-00',
  '011-02347-00',
  '011-02348-00',
  'K00-00512-10',
  'K00-00513-10',
  'K00-00514-10',
  'K10-00016-13',
  'K10-00016-14',
  '010-03395-01',
  '010-03396-01',
]);

// Garmin identifies these exact current products as consumer marine/outdoor
// families. RWAS deliberately removed those families from this aviation store
// in May 2026; incorrect Certified/Dealer/Pilot typing brought them back.
const EXCLUDED_MISPLACED_SKUS = new Set([
  '010-13088-00',
  '010-11550-00',
  '010-13096-00',
  '010-11551-01',
  '010-11595-00',
  '010-11752-00',
  '010-11934-00',
  '010-12746-02',
  '010-12747-02',
  '010-12748-02',
  '010-12749-02',
  '010-12750-02',
  '010-11288-07',
  '010-12036-02',
  '010-11875-00',
  '010-02573-30',
  '010-02573-10',
  '010-02573-00',
  '010-03011-00',
  '010-03011-10',
  '010-03855-00',
  '010-03855-01',
  '010-02919-00',
  '010-02919-02',
  '010-02919-01',
  '010-02919-03',
  '010-02236-02',
  '010-11654-11',
  '010-01958-05',
  '010-01958-30',
  '010-01781-51',
  '010-01781-50',
  '010-02212-00',
  '010-01781-11',
  '010-01781-10',
]);

const EXCLUDED_GENERIC_RECREATED_SKUS = new Set([
  '362-00009-01',
  '010-11855-00',
  '010-10838-10',
  '145-00212-00',
  '010-11734-20',
  '010-12897-01',
  '010-11756-03',
  '010-11270-00',
  '010-11206-01',
  '010-10231-01',
  '010-10723-17',
  '700-00004-00',
  '010-11022-10',
  '010-10117-02',
]);

const PORTABLE_MOUNT_SKUS = new Set([
  '010-11756-00',
  '010-11385-01',
  '010-11385-02',
]);

// John-approved direct-sale accessories. These are portable/cockpit/customer
// accessories, not dealer-install equipment, even when their titles contain
// words such as "mount", "connector kit", or "mounting kit" that would
// otherwise resemble installation hardware.
const PILOT_GEAR_PRODUCT_HANDLES = new Set([
  'gdl-52',
  'garmin-ac-adapter-010-11385-04',
  'garmin-ac-adapter-010-12180-01',
  'ac-adapter-with-international-adapter',
  'acc-connector-kit-gdl-50r-52r',
  'acc-connector-kit-gdl-39r',
  'bracket-mount',
  'battery-door-replacement',
  'base-mount-gdl-52-series',
  'cart-mount',
  'charging-data-cable',
  'dash-mount',
  'dashboard-discs-large-and-small',
  'dashboard-mount',
  'data-power-cable',
  'dual-port-usb-power-adapter-usb-a',
  'flotation-lanyard',
  'g5-mounting-ring',
  'g5-recessed-adapter-plate',
  'ga-24-mcx-siriusxm-antenna',
  'garmin-cleaning-cloth',
  'gsb-15-mounting-kit-3-125',
  'gsb-15-decorative-cover-black-powder-coat',
  'gsb-15-decorative-cover-unfinished',
  'gsb-15-mounting-kit-2-25',
  'ga-25mcx-remote-gps-antenna-low-profile',
  'ga-24-tnc-siriusxm-antenna',
  'handlebar-mount',
  'headset-audio-cable-virb',
  'headset-microphone-adapter',
  'lithium-ion-battery-charger',
  'lithium-ion-battery-pack',
  'microusb-cable',
  'mount-adapter',
  'power-cable-microusb',
  'prop-filter-virb-ultra',
  'quick-release-lanyard',
  'rail-mount-adapter',
  'retractable-lanyard',
  'garmin-usb-cable-010-10723-01',
  'garmin-usb-cable-010-10723-15',
  'usb-cable-type-c-to-type-c-0-5-m',
  'usb-cable-type-c-to-type-c-1-m',
  'garmin-usb-cable-type-c-to-type-c-2-m-010-13315-a3',
  'usb-cable-type-a-to-type-c-0-5-meter',
  'usb-cable-type-a-to-type-c-1-meter',
  'usb-power-cable',
  'usb-a-charging-data-cable-0-5-meter',
  'usb-a-charging-data-cable-1-meter',
  'garmin-usb-c-ac-adapter-010-13304-00',
  'garmin-usb-c-ac-adapter-010-13304-05',
  'garmin-usb-c-ac-adapter-010-13304-10',
  'usb-c-charging-data-cable-0-5-meter',
  'usb-c-charging-data-cable-1-meter',
  'garmin-vehicle-power-cable-010-10085-00',
  'garmin-vehicle-power-cable-010-10747-03',
  'garmin-vehicle-power-cable-010-12498-30',
  'weather-cap-bnc',
  'wrist-lanyard',
]);
const WATCH_CABLE_SKU = '010-11814-10';
const BACKSHELL_SKU = '135-00028-03';
const SURFACEWATCH_ENABLEMENT_SKU = '010-03905-08';
const GTN_ENABLEMENT_DOWNLOAD_SKUS = new Set([
  '006-D2990-01',
  '006-D2990-02',
  '006-D2990-03',
  '006-D2990-04',
  '006-D2990-05',
  '006-D2990-42',
  '006-D2990-48',
]);
const CATALOG_SYNC_DATABASE_SKUS = new Set(['010-02045-45', '010-03905-16']);

const RETIRED_CONSUMER_COLLECTIONS = new Set([
  'garmin-marine',
  'garmin-outdoor-dog-tracking',
  'garmin-cycling-fitness',
  'garmin-golf',
  'garmin-equine',
  'garmin-outdoor-navigation',
  'garmin-powersports',
]);
const RETIRED_CONSUMER_TYPES = new Set([
  'Garmin Marine',
  'Garmin Outdoor',
  'Garmin Cycling & Fitness',
  'Garmin Golf',
  'Garmin Equine',
  'Garmin Powersports',
]);
const PUBLIC_CATALOG_TYPES = new Set([
  TYPES.experimental,
  TYPES.dealer,
  TYPES.pilot,
  TYPES.watches,
]);

const WATCH_PATTERN =
  /\b(descent|epix|f[ēe]nix|f.nix|instinct|quatix|tactix)\b|quickfit|quick release bands|ultrafit/i;
const AVIATION_DATA_PATTERN =
  /\bdata card\b|jeppesen chartview|chartview enablement/i;
const AVIATION_DOCUMENTATION_PATTERN =
  /\bGPSMAP 96\b|\bexperimental aircraft\b/i;
const AVIATION_INSTALL_PATTERN =
  /faa-pma|\b(gdu|gma|gmc|gtx|gha)\b|\bgfc\s*\d+|\bgsd\s*41|\baxis\b|lru kit|install kit|go around|coil cord|audio cables|relay, dpdt|shaft locking|bridle cable clamp/i;
const EXCLUDED_CONSUMER_PATTERN =
  /\bbicycle\b|\bbike\b|\bEdge®|\bRally™|speed\/cadence|\bTacx®|\bVaria™|\bBlaze(?:™)?\b|\bApproach®|\bmarine mount\b|\bAlpha®|\bPRO 550\b|\bGLO™|GPSMAP® 86|GPSMAP® H1|\bMontana®|Xero® L60i|\bTread®|\bzūmo®|\bcar mount\b/i;

const RETAIL_POLICY_TAGS = new Set([
  'otc-eligible',
  'garmin-retail-policy-2026',
  'experimental-retail',
]);
const RETAIL_CONFLICT_TAGS = new Set([
  'garmin-dealer-only',
  'install-by-rwas',
  'otc-disabled',
  'stock-check-required',
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

function normalizeSku(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function firstSku(product) {
  return normalizeSku(product.variants.nodes[0]?.sku);
}

function collectionHandles(product) {
  return new Set(
    product.collections.nodes.map((collection) => collection.handle),
  );
}

function addTag(tags, tag) {
  if (!tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
    tags.push(tag);
  }
}

function removeTags(tags, removals) {
  return tags.filter((tag) => !removals.has(tag.toLowerCase()));
}

function sameTags(left, right) {
  const normalize = (tags) =>
    [...tags]
      .map((tag) => tag.toLowerCase())
      .sort()
      .join('\n');
  return normalize(left) === normalize(right);
}

function isManualCollection(handle, collections) {
  const collection = collections.get(handle);
  if (!collection) {
    if (OPTIONAL_COLLECTIONS.has(handle)) return false;
    throw new Error(`Missing required collection: ${handle}`);
  }
  return !collection.ruleSet;
}

function classifyUnplaced(product) {
  const sku = firstSku(product);
  if (WATCH_PATTERN.test(product.title)) return 'watches';
  if (AVIATION_DATA_PATTERN.test(product.title)) return 'database';
  if (AVIATION_DOCUMENTATION_PATTERN.test(product.title))
    return 'pilot-documentation';
  if (AVIATION_INSTALL_PATTERN.test(product.title)) return 'dealer-install';
  if (
    EXCLUDED_GENERIC_RECREATED_SKUS.has(sku) ||
    EXCLUDED_CONSUMER_PATTERN.test(product.title)
  ) {
    return 'excluded-consumer';
  }
  return 'unknown';
}

function isNonAviationMapCard(product) {
  const sku = firstSku(product);
  return (
    sku.startsWith('010-') &&
    /City Navigator|\bTOPO\b|Trailhead|BlueChart/i.test(product.title)
  );
}

function isSeoSafeProductHandle(handle) {
  return /^[a-z0-9][a-z0-9-]*$/.test(handle);
}

function isPublicCatalogProduct(product) {
  if (PUBLIC_CATALOG_TYPES.has(product.productType)) return true;
  if (product.productType !== TYPES.certified) return false;
  const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
  const price = Number(product.variants.nodes[0]?.price || 0);
  return (
    tags.has('otc-eligible') &&
    !tags.has('otc-disabled') &&
    !tags.has('garmin-dealer-only') &&
    Number.isFinite(price) &&
    price > 0
  );
}

function isRetiredConsumerProduct(product) {
  const handles = collectionHandles(product);
  return (
    RETIRED_CONSUMER_TYPES.has(product.productType) ||
    [...RETIRED_CONSUMER_COLLECTIONS].some((handle) => handles.has(handle))
  );
}

function makePlanRecord(product) {
  return {
    id: product.id,
    sku: firstSku(product),
    title: product.title,
    handle: product.handle,
    currentStatus: product.status,
    currentProductType: product.productType,
    currentVariants: product.variants.nodes.map((variant) => ({
      sku: normalizeSku(variant.sku),
      price: Number(variant.price),
    })),
    currentTags: product.tags,
    currentCollections: collectionHandles(product),
    productUpdate: {},
    nextTags: [...product.tags],
    addCollections: new Set(),
    removeCollections: new Set(),
    currentPublications: new Set(
      product.resourcePublicationsV2.nodes.map(
        (resourcePublication) => resourcePublication.publication.name,
      ),
    ),
    publishTo: new Map(),
    reasons: [],
  };
}

function ensureRequiredStorefrontPublications(record, publications) {
  for (const publication of publications) {
    if (!record.currentPublications.has(publication.name)) {
      record.publishTo.set(publication.id, publication.name);
    }
  }
  if (record.publishTo.size) {
    record.reasons.push('required RWAS storefront publication');
  }
}

function setTargetType(record, productType, reason) {
  if (record.currentProductType !== productType) {
    record.productUpdate.productType = productType;
  }
  record.reasons.push(reason);
}

function addManualCollection(record, handle, collections) {
  if (!isManualCollection(handle, collections)) return;
  if (!record.currentCollections.has(handle)) record.addCollections.add(handle);
  record.removeCollections.delete(handle);
}

function removeManualCollection(record, handle, collections) {
  if (!isManualCollection(handle, collections)) return;
  if (record.currentCollections.has(handle))
    record.removeCollections.add(handle);
  record.addCollections.delete(handle);
}

function normalizeRetailTags(record) {
  let tags = [...record.nextTags];
  if (
    record.currentStatus === 'ACTIVE' &&
    APPROVED_CERTIFIED_OTC.has(record.sku)
  ) {
    tags = removeTags(tags, RETAIL_CONFLICT_TAGS);
    addTag(tags, 'garmin');
    addTag(tags, 'garmin-retail-policy-2026');
    addTag(tags, 'otc-eligible');
  } else if (
    record.currentStatus === 'ACTIVE' &&
    OFFICIAL_EXPERIMENTAL.has(record.sku)
  ) {
    tags = removeTags(tags, RETAIL_CONFLICT_TAGS);
    addTag(tags, 'garmin');
    addTag(tags, 'experimental-retail');
    addTag(tags, 'otc-eligible');
  } else if ([TYPES.pilot, TYPES.watches].includes(record.currentProductType)) {
    tags = removeTags(
      tags,
      new Set(['garmin-retail-policy-2026', 'experimental-retail']),
    );
  } else {
    tags = removeTags(tags, RETAIL_POLICY_TAGS);
  }
  record.nextTags = tags;
}

function normalizeDirectSaleTags(record) {
  record.nextTags = removeTags(record.nextTags, RETAIL_CONFLICT_TAGS);
}

function normalizeDealerTags(record) {
  record.nextTags = removeTags(record.nextTags, RETAIL_POLICY_TAGS);
  for (const tag of [
    'garmin',
    'garmin-dealer-only',
    'install-by-rwas',
    'otc-disabled',
    'stock-check-required',
  ]) {
    addTag(record.nextTags, tag);
  }
}

function normalizeExcludedTags(record) {
  record.nextTags = removeTags(
    removeTags(record.nextTags, RETAIL_POLICY_TAGS),
    RETAIL_CONFLICT_TAGS,
  );
  addTag(record.nextTags, 'garmin');
  addTag(record.nextTags, 'rwas-catalog-excluded');
  addTag(record.nextTags, 'rwas-policy:aviation-store-only');
}

function applyWatchPlacement(record, collections, reason) {
  setTargetType(record, TYPES.watches, reason);
  normalizeDirectSaleTags(record);
  addManualCollection(record, COLLECTIONS.legacyWatches, collections);
  removeManualCollection(record, COLLECTIONS.certifiedInstallOnly, collections);
  removeManualCollection(record, COLLECTIONS.genericGarmin, collections);
}

function applyPilotPlacement(record, collections, reason) {
  setTargetType(record, TYPES.pilot, reason);
  normalizeDirectSaleTags(record);
  addManualCollection(record, COLLECTIONS.portable, collections);
}

function applyDealerPlacement(record, collections, reason, database = false) {
  setTargetType(record, TYPES.dealer, reason);
  normalizeDealerTags(record);
  addManualCollection(
    record,
    database ? COLLECTIONS.databaseCards : COLLECTIONS.accessories,
    collections,
  );
}

function applyExcludedPlacement(record, collections, reason) {
  setTargetType(record, TYPES.excluded, reason);
  record.productUpdate.status = 'ARCHIVED';
  normalizeExcludedTags(record);
  for (const [handle, collection] of collections) {
    if (!collection.ruleSet)
      removeManualCollection(record, handle, collections);
  }
}

function finalizeRecord(record) {
  if (!sameTags(record.currentTags, record.nextTags)) {
    record.productUpdate.tags = record.nextTags;
  }
  const changed =
    Object.keys(record.productUpdate).length > 0 ||
    record.addCollections.size > 0 ||
    record.removeCollections.size > 0 ||
    record.publishTo.size > 0;
  return changed ? record : null;
}

function buildPlan(products, collections, publications) {
  const changes = [];
  const blockers = [];

  for (const product of products) {
    // AXIS Build-A-System listings are intentionally certification-specific.
    // The same Garmin package SKU can carry different certified MSRP and
    // experimental pricing, so the dedicated AXIS reconciler owns their
    // product type, tags, collections, and pricing.
    if (
      product.handle.startsWith('garmin-axis-certified-') ||
      product.handle.startsWith('garmin-axis-experimental-')
    ) {
      continue;
    }
    const record = makePlanRecord(product);
    normalizeRetailTags(record);

    const active = product.status === 'ACTIVE';
    const unplaced =
      active &&
      product.productType === TYPES.unclassified &&
      product.collections.nodes.length === 0;
    const excluded =
      active &&
      (EXCLUDED_MISPLACED_SKUS.has(record.sku) ||
        isNonAviationMapCard(product) ||
        isRetiredConsumerProduct(product));
    const catalogSyncWatch =
      active &&
      product.productType === TYPES.unclassified &&
      WATCH_PATTERN.test(product.title);
    const catalogSyncDatabase =
      active && CATALOG_SYNC_DATABASE_SKUS.has(record.sku);

    if (excluded) {
      applyExcludedPlacement(
        record,
        collections,
        isNonAviationMapCard(product)
          ? 'non-aviation Garmin map-card correction'
          : EXCLUDED_MISPLACED_SKUS.has(record.sku)
            ? 'exact Garmin consumer-family correction'
            : 'retire restored consumer-family product',
      );
    } else if (catalogSyncWatch) {
      applyWatchPlacement(
        record,
        collections,
        'Garmin watch/accessory evidence',
      );
    } else if (catalogSyncDatabase) {
      applyDealerPlacement(
        record,
        collections,
        'Garmin aviation data-card/enablement evidence',
        true,
      );
    } else if (unplaced) {
      const classification = classifyUnplaced(product);
      if (classification === 'excluded-consumer') {
        applyExcludedPlacement(
          record,
          collections,
          'recreated consumer product excluded by RWAS aviation-store policy',
        );
      } else if (classification === 'watches') {
        applyWatchPlacement(
          record,
          collections,
          'Garmin watch/accessory evidence',
        );
      } else if (classification === 'database') {
        applyDealerPlacement(
          record,
          collections,
          'Garmin aviation data-card/enablement evidence',
          true,
        );
      } else if (classification === 'pilot-documentation') {
        applyPilotPlacement(
          record,
          collections,
          'Garmin pilot-facing portable/documentation evidence',
        );
      } else if (classification === 'dealer-install') {
        applyDealerPlacement(
          record,
          collections,
          'Garmin certified install/LRU/installation-hardware evidence',
        );
      } else {
        blockers.push({
          sku: record.sku,
          title: record.title,
          state: 'unclassified-active-garmin-product',
        });
      }
    }

    const nextStatus = record.productUpdate.status || record.currentStatus;
    const nextProductType =
      record.productUpdate.productType || record.currentProductType;
    const isCatalogSyncProduct = product.tags.some((tag) =>
      tag.toLowerCase().startsWith('catalog-sync:'),
    );
    if (
      isCatalogSyncProduct &&
      nextStatus === 'ACTIVE' &&
      ![TYPES.unclassified, TYPES.excluded].includes(nextProductType)
    ) {
      ensureRequiredStorefrontPublications(record, publications);
    }

    if (!excluded && !unplaced && !catalogSyncWatch && !catalogSyncDatabase) {
      if (PILOT_GEAR_PRODUCT_HANDLES.has(product.handle)) {
        applyPilotPlacement(
          record,
          collections,
          'John-approved Pilot Gear direct-sale accessory',
        );
      } else if (PORTABLE_MOUNT_SKUS.has(record.sku)) {
        applyPilotPlacement(
          record,
          collections,
          'Garmin aviation portable-mount evidence',
        );
      } else if (record.sku === WATCH_CABLE_SKU) {
        applyWatchPlacement(record, collections, 'Garmin watch-cable evidence');
        removeManualCollection(record, COLLECTIONS.accessories, collections);
      } else if (record.sku === BACKSHELL_SKU) {
        applyDealerPlacement(
          record,
          collections,
          'Garmin connector/backshell installation-hardware evidence',
        );
      } else if (record.sku === SURFACEWATCH_ENABLEMENT_SKU) {
        applyDealerPlacement(
          record,
          collections,
          'Garmin GX000 aviation enablement evidence',
          true,
        );
        removeManualCollection(record, COLLECTIONS.legacyWatches, collections);
      }
    }

    const expectedType =
      record.productUpdate.productType || product.productType;
    if (expectedType === TYPES.watches) {
      addManualCollection(record, COLLECTIONS.legacyWatches, collections);
      removeManualCollection(
        record,
        COLLECTIONS.certifiedInstallOnly,
        collections,
      );
      removeManualCollection(record, COLLECTIONS.genericGarmin, collections);
    }
    if (expectedType === TYPES.experimental) {
      removeManualCollection(
        record,
        COLLECTIONS.legacyExperimental,
        collections,
      );
      removeManualCollection(
        record,
        COLLECTIONS.certifiedInstallOnly,
        collections,
      );
    }
    if (
      product.productType === TYPES.certified &&
      record.currentCollections.has(COLLECTIONS.legacyWatches)
    ) {
      removeManualCollection(record, COLLECTIONS.legacyWatches, collections);
      record.reasons.push(
        'remove certified avionics from legacy watch collection',
      );
    }
    if (record.currentCollections.has(COLLECTIONS.legacyExperimental)) {
      removeManualCollection(
        record,
        COLLECTIONS.legacyExperimental,
        collections,
      );
      record.reasons.push('retire legacy Experimental manual membership');
    }
    if (GTN_ENABLEMENT_DOWNLOAD_SKUS.has(record.sku)) {
      removeManualCollection(record, COLLECTIONS.legacyWatches, collections);
    }

    const finalized = finalizeRecord(record);
    if (finalized) changes.push(finalized);
  }

  return {
    changes,
    blockers,
    collectionsToDelete: [...RETIRED_CONSUMER_COLLECTIONS].filter((handle) =>
      collections.has(handle),
    ),
  };
}

function publicChange(record) {
  return {
    sku: record.sku,
    title: record.title,
    handle: record.handle,
    currentStatus: record.currentStatus,
    nextStatus: record.productUpdate.status || record.currentStatus,
    currentProductType: record.currentProductType,
    currentVariants: record.currentVariants,
    nextProductType:
      record.productUpdate.productType || record.currentProductType,
    tagsChanged: Boolean(record.productUpdate.tags),
    addCollections: [...record.addCollections].sort(),
    removeCollections: [...record.removeCollections].sort(),
    publishTo: [...record.publishTo.values()].sort(),
    reasons: [...new Set(record.reasons)],
  };
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
    if (response.status === 429) {
      await delay(Math.min(1000 * 2 ** attempt, 15000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Shopify Admin API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload.errors?.length) {
      const throttled = payload.errors.some((error) =>
        String(error.message || error)
          .toLowerCase()
          .includes('throttled'),
      );
      if (throttled) {
        await delay(Math.min(1000 * 2 ** attempt, 15000));
        continue;
      }
      throw new Error(JSON.stringify(payload.errors));
    }
    return payload.data;
  }
  throw new Error('Shopify Admin throttling retries exhausted');
}

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function getCollections() {
  const data = await shopifyGraphql(`query PlacementCollections {
    collections(first: 250) {
      nodes {
        id
        handle
        title
        ruleSet { appliedDisjunctively rules { column relation condition } }
      }
    }
  }`);
  return new Map(
    data.collections.nodes.map((collection) => [collection.handle, collection]),
  );
}

async function getProducts() {
  const products = [];
  let cursor = null;
  do {
    const data = await shopifyGraphql(
      `query GarminPlacementProducts($after: String) {
        products(first: 100, after: $after, query: "vendor:Garmin", sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            handle
            status
            publishedAt
            vendor
            productType
            tags
            resourcePublicationsV2(first: 50, onlyPublished: true) {
              nodes { publication { id name } }
            }
            collections(first: 100) { nodes { id handle title } }
            variants(first: 100) { nodes { id sku price } }
          }
        }
      }`,
      { after: cursor },
    );
    products.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return products;
}

async function getRequiredStorefrontPublications() {
  const data = await shopifyGraphql(`query PlacementPublications {
    publications(first: 50) { nodes { id name } }
  }`);
  const byName = new Map(
    data.publications.nodes.map((publication) => [
      publication.name,
      publication,
    ]),
  );
  const missing = REQUIRED_STOREFRONT_PUBLICATIONS.filter(
    (name) => !byName.has(name),
  );
  if (missing.length) {
    throw new Error(
      `Missing required Shopify publications: ${missing.join(', ')}`,
    );
  }
  return REQUIRED_STOREFRONT_PUBLICATIONS.map((name) => byName.get(name));
}

async function updateProduct(record) {
  if (!Object.keys(record.productUpdate).length) return;
  const product = { id: record.id, ...record.productUpdate };
  const result = await shopifyGraphql(
    `mutation ReconcileGarminPlacementProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle status productType }
        userErrors { field message }
      }
    }`,
    { product },
  );
  assertNoUserErrors(result, 'productUpdate');
}

async function mutateCollection(handle, productIds, collections, operation) {
  if (!productIds.length) return;
  const collection = collections.get(handle);
  const mutation =
    operation === 'add'
      ? `mutation AddGarminPlacementProducts($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }`
      : `mutation RemoveGarminPlacementProducts($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }`;
  const field =
    operation === 'add' ? 'collectionAddProducts' : 'collectionRemoveProducts';
  const result = await shopifyGraphql(mutation, {
    id: collection.id,
    productIds,
  });
  const errors = result[field].userErrors.filter((error) => {
    const message = error.message.toLowerCase();
    return operation === 'add'
      ? !message.includes('already exists')
      : !message.includes('not exist');
  });
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function deleteCollection(handle, collections) {
  const collection = collections.get(handle);
  if (!collection) return;
  const result = await shopifyGraphql(
    `mutation DeleteRetiredGarminCollection($input: CollectionDeleteInput!) {
      collectionDelete(input: $input) {
        deletedCollectionId
        userErrors { field message }
      }
    }`,
    { input: { id: collection.id } },
  );
  assertNoUserErrors(result, 'collectionDelete');
}

async function publishProduct(record) {
  if (!record.publishTo.size) return;
  const result = await shopifyGraphql(
    `mutation PublishGarminPlacementProduct($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        publishable { availablePublicationsCount { count } }
        userErrors { field message }
      }
    }`,
    {
      id: record.id,
      input: [...record.publishTo.keys()].map((publicationId) => ({
        publicationId,
      })),
    },
  );
  assertNoUserErrors(result, 'publishablePublish');
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function applyPlan(plan, collections) {
  for (const [index, record] of plan.changes.entries()) {
    await updateProduct(record);
    await publishProduct(record);
    if ((index + 1) % 50 === 0) {
      process.stderr.write(
        `Applied product updates ${index + 1}/${plan.changes.length}\n`,
      );
    }
  }

  for (const operation of ['remove', 'add']) {
    const idsByCollection = new Map();
    for (const record of plan.changes) {
      const handles =
        operation === 'add' ? record.addCollections : record.removeCollections;
      for (const handle of handles) {
        if (!idsByCollection.has(handle)) idsByCollection.set(handle, []);
        idsByCollection.get(handle).push(record.id);
      }
    }
    for (const [handle, ids] of idsByCollection) {
      for (const idChunk of chunk([...new Set(ids)], 200)) {
        await mutateCollection(handle, idChunk, collections, operation);
      }
    }
  }
  for (const handle of plan.collectionsToDelete) {
    await deleteCollection(handle, collections);
  }
}

function auditState(products, collections) {
  const active = products.filter((product) => product.status === 'ACTIVE');
  const retailRendered = active.filter((product) => {
    const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
    const price = Number(product.variants.nodes[0]?.price || 0);
    return (
      (collectionHandles(product).has(COLLECTIONS.retail) ||
        product.productType === TYPES.experimental) &&
      tags.has('otc-eligible') &&
      !tags.has('otc-disabled') &&
      !tags.has('garmin-dealer-only') &&
      price > 0
    );
  });
  const approvedRetailSkus = new Set([
    ...APPROVED_CERTIFIED_OTC,
    ...OFFICIAL_EXPERIMENTAL,
  ]);
  const retailSkus = new Set(retailRendered.map(firstSku));
  const otcConflicts = active.filter((product) => {
    const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
    return (
      tags.has('otc-eligible') &&
      [...RETAIL_CONFLICT_TAGS].some((tag) => tags.has(tag))
    );
  });
  const activeUnplaced = active.filter(
    (product) =>
      product.productType === TYPES.unclassified &&
      product.collections.nodes.length === 0,
  );
  const activeUnclassified = active.filter(
    (product) => product.productType === TYPES.unclassified,
  );
  const activeNonAviationMaps = active.filter(isNonAviationMapCard);
  const activeRetiredConsumerProducts = active.filter(isRetiredConsumerProduct);
  const activeExcludedMisplacements = active.filter((product) =>
    EXCLUDED_MISPLACED_SKUS.has(firstSku(product)),
  );
  const activeUnsafePublicHandles = active.filter(
    (product) =>
      isPublicCatalogProduct(product) &&
      !isSeoSafeProductHandle(product.handle),
  );
  const experimentalProducts = active.filter(
    (product) => product.productType === TYPES.experimental,
  );
  const experimentalSkus = new Set(experimentalProducts.map(firstSku));
  const legacyExperimental = products.filter((product) =>
    collectionHandles(product).has(COLLECTIONS.legacyExperimental),
  );
  const experimentalInCertifiedManual = experimentalProducts.filter((product) =>
    collectionHandles(product).has(COLLECTIONS.certifiedInstallOnly),
  );
  const watchMissingManual = active.filter(
    (product) =>
      product.productType === TYPES.watches &&
      !collectionHandles(product).has(COLLECTIONS.legacyWatches),
  );
  const nonWatchInWatchManual = active.filter(
    (product) =>
      product.productType !== TYPES.watches &&
      collectionHandles(product).has(COLLECTIONS.legacyWatches),
  );
  const activeCatalogReview = active.filter(
    (product) => product.productType === 'Garmin Catalog Review',
  );
  const expectedRetailMissing = [...approvedRetailSkus].filter(
    (sku) => !retailSkus.has(sku),
  );
  const retailUnexpected = [...retailSkus].filter(
    (sku) => !approvedRetailSkus.has(sku),
  );
  const experimentalMissing = [...OFFICIAL_EXPERIMENTAL].filter(
    (sku) => !experimentalSkus.has(sku),
  );
  const experimentalUnexpected = [...experimentalSkus].filter(
    (sku) => !OFFICIAL_EXPERIMENTAL.has(sku),
  );

  const summary = {
    activeGarminProducts: active.length,
    archivedExcludedProducts: products.filter(
      (product) =>
        product.status === 'ARCHIVED' && product.productType === TYPES.excluded,
    ).length,
    activeUnplacedGarminAviation: activeUnplaced.length,
    activeUnclassifiedGarminAviation: activeUnclassified.length,
    activeNonAviationMapCards: activeNonAviationMaps.length,
    activeRetiredConsumerProducts: activeRetiredConsumerProducts.length,
    activeExactConsumerMisplacements: activeExcludedMisplacements.length,
    activeUnsafePublicProductHandles: activeUnsafePublicHandles.length,
    retailRenderedProducts: retailRendered.length,
    expectedRetailProducts: approvedRetailSkus.size,
    retailUnexpectedSkus: retailUnexpected,
    retailMissingSkus: expectedRetailMissing,
    experimentalProducts: experimentalProducts.length,
    experimentalUnexpectedSkus: experimentalUnexpected,
    experimentalMissingSkus: experimentalMissing,
    legacyExperimentalMemberships: legacyExperimental.length,
    experimentalInCertifiedManual: experimentalInCertifiedManual.length,
    otcTagConflicts: otcConflicts.length,
    watchProductsMissingWatchManual: watchMissingManual.length,
    nonWatchProductsInWatchManual: nonWatchInWatchManual.length,
    activeCatalogReviewProducts: activeCatalogReview.length,
    retiredConsumerCollectionsPresent: [...RETIRED_CONSUMER_COLLECTIONS].filter(
      (handle) => collections.has(handle),
    ),
  };
  const failures = Object.entries({
    activeUnplacedGarminAviation: summary.activeUnplacedGarminAviation,
    activeUnclassifiedGarminAviation: summary.activeUnclassifiedGarminAviation,
    activeNonAviationMapCards: summary.activeNonAviationMapCards,
    activeRetiredConsumerProducts: summary.activeRetiredConsumerProducts,
    activeExactConsumerMisplacements: summary.activeExactConsumerMisplacements,
    activeUnsafePublicProductHandles: summary.activeUnsafePublicProductHandles,
    retailUnexpectedSkus: summary.retailUnexpectedSkus.length,
    retailMissingSkus: summary.retailMissingSkus.length,
    experimentalUnexpectedSkus: summary.experimentalUnexpectedSkus.length,
    experimentalMissingSkus: summary.experimentalMissingSkus.length,
    legacyExperimentalMemberships: summary.legacyExperimentalMemberships,
    experimentalInCertifiedManual: summary.experimentalInCertifiedManual,
    otcTagConflicts: summary.otcTagConflicts,
    watchProductsMissingWatchManual: summary.watchProductsMissingWatchManual,
    nonWatchProductsInWatchManual: summary.nonWatchProductsInWatchManual,
    activeCatalogReviewProducts: summary.activeCatalogReviewProducts,
    retiredConsumerCollectionsPresent:
      summary.retiredConsumerCollectionsPresent.length,
  })
    .filter(([, count]) => count !== 0)
    .map(([name, count]) => ({ name, count }));
  return { summary, failures };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const [collections, products, publications] = await Promise.all([
    getCollections(),
    getProducts(),
    getRequiredStorefrontPublications(),
  ]);

  for (const handle of Object.values(COLLECTIONS)) {
    if (!collections.has(handle) && !OPTIONAL_COLLECTIONS.has(handle)) {
      throw new Error(`Missing required Shopify collection: ${handle}`);
    }
  }

  const beforeAudit = auditState(products, collections);
  const plan = buildPlan(products, collections, publications);
  if (plan.blockers.length) {
    throw new Error(
      `Unsafe catalog state: ${plan.blockers
        .map((blocker) => `${blocker.sku}:${blocker.state}`)
        .join(', ')}`,
    );
  }
  if (apply) await applyPlan(plan, collections);

  let afterProducts = products;
  let afterCollections = collections;
  let afterPlan = plan;
  let afterAudit = beforeAudit;
  if (apply) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      [afterProducts, afterCollections] = await Promise.all([
        getProducts(),
        getCollections(),
      ]);
      afterPlan = buildPlan(afterProducts, afterCollections, publications);
      afterAudit = auditState(afterProducts, afterCollections);
      if (
        !afterPlan.changes.length &&
        !afterPlan.blockers.length &&
        !afterAudit.failures.length
      ) {
        break;
      }
      await delay(3000);
    }
  }

  const byReason = {};
  for (const record of plan.changes) {
    for (const reason of new Set(record.reasons)) {
      byReason[reason] = (byReason[reason] || 0) + 1;
    }
  }
  const output = {
    mode: apply ? 'apply' : 'dry-run',
    sourcePolicy: {
      title: '2026 Americas Aviation Dealer Requirements',
      page: 8,
      section:
        'Installed Products excluded under the Garmin Installation Policy',
      asOf: '2026-01-01',
      sha256:
        '436346b360216e824d949d671df443d6a48111429cbe1216924938181c16070f',
      scope:
        'Exact certified OTC SKUs plus Garmin-supported experimental products and RWAS aviation-store taxonomy',
    },
    before: beforeAudit.summary,
    plannedProductChanges: plan.changes.length,
    plannedCollectionsToDelete: plan.collectionsToDelete,
    plannedChangesByReason: byReason,
    changes: plan.changes.map(publicChange),
    after: apply ? afterAudit.summary : null,
    remainingPlanChanges: apply ? afterPlan.changes.map(publicChange) : null,
    blockers: apply ? afterPlan.blockers : plan.blockers,
    verificationFailures: apply ? afterAudit.failures : null,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (
    apply &&
    (afterPlan.changes.length ||
      afterPlan.blockers.length ||
      afterAudit.failures.length)
  ) {
    throw new Error('Post-apply Garmin catalog placement verification failed');
  }
}

main().catch((error) => {
  process.stderr.write(
    `Garmin catalog placement reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
