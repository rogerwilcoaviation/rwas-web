#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const GENERAL_PROFILE_ID = 'gid://shopify/DeliveryProfile/104778727643';
const PROHIBITED_METHOD_NAMES = new Set([
  'usps',
  'ups_shipping',
  'Amazon Prime',
]);
const REQUIRED_METHOD_NAMES = new Set([
  'Economy',
  'International Flat Rate',
  'Standard Shipping',
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

async function shopifyGraphql(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2026-01';
  if (!domain || !token) {
    throw new Error(`Missing Shopify Admin credentials in ${SHOPIFY_ENV_PATH}`);
  }
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

function assertNoUserErrors(result, field) {
  const errors = result[field]?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function getProfile() {
  const data = await shopifyGraphql(`query ShippingMethodAudit {
    deliveryProfiles(first: 20) {
      nodes {
        id
        name
        profileLocationGroups {
          locationGroup { id }
          locationGroupZones(first: 50) {
            nodes {
              zone { id name }
              methodDefinitions(first: 50) {
                nodes {
                  id
                  name
                  active
                  rateProvider {
                    ... on DeliveryParticipant {
                      id
                      carrierService { id name active }
                    }
                    ... on DeliveryRateDefinition {
                      id
                      price { amount currencyCode }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`);
  const profile = data.deliveryProfiles.nodes.find(
    (candidate) => candidate.id === GENERAL_PROFILE_ID,
  );
  if (!profile) {
    throw new Error(`Missing general delivery profile ${GENERAL_PROFILE_ID}`);
  }
  return profile;
}

function flattenMethods(profile) {
  return profile.profileLocationGroups.flatMap((group) =>
    group.locationGroupZones.nodes.flatMap((zone) =>
      zone.methodDefinitions.nodes.map((method) => ({
        locationGroupId: group.locationGroup.id,
        zoneId: zone.zone.id,
        zone: zone.zone.name,
        ...method,
      })),
    ),
  );
}

function publicMethods(methods) {
  return methods.map((method) => ({
    id: method.id,
    locationGroupId: method.locationGroupId,
    zoneId: method.zoneId,
    zone: method.zone,
    name: method.name,
    active: method.active,
    carrierService: method.rateProvider?.carrierService?.name || null,
    price: method.rateProvider?.price?.amount || null,
  }));
}

function audit(profile) {
  const methods = flattenMethods(profile);
  const names = new Set(methods.map((method) => method.name));
  const missingRequired = [...REQUIRED_METHOD_NAMES].filter(
    (name) => !names.has(name),
  );
  if (missingRequired.length) {
    throw new Error(
      `Required shipping methods missing: ${missingRequired.join(', ')}`,
    );
  }
  const prohibited = methods.filter((method) =>
    PROHIBITED_METHOD_NAMES.has(method.name),
  );
  const orphanedCarrierMethods = prohibited.filter((method) =>
    ['usps', 'ups_shipping'].includes(method.name),
  );
  for (const method of orphanedCarrierMethods) {
    if (!method.rateProvider?.carrierService) {
      throw new Error(`${method.name} is no longer a carrier-backed method`);
    }
  }
  const amazonMethods = prohibited.filter(
    (method) => method.name === 'Amazon Prime',
  );
  const standardsByZone = new Map();
  for (const method of methods.filter(
    (candidate) => candidate.name === 'Standard Shipping',
  )) {
    const key = `${method.locationGroupId}\n${method.zoneId}`;
    if (!standardsByZone.has(key)) standardsByZone.set(key, []);
    standardsByZone.get(key).push(method);
  }
  const duplicateStandardMethods = [...standardsByZone.values()].flatMap(
    (zoneMethods) => zoneMethods.slice(1),
  );
  return {
    // Amazon's app-managed definition is removed rather than renamed because
    // Shopify implements the rename as a new flat-rate definition; the app then
    // recreates Amazon Prime and leaves duplicate Standard Shipping methods.
    methodDefinitionsToDelete: [
      ...orphanedCarrierMethods,
      ...amazonMethods,
      ...duplicateStandardMethods,
    ].map((method) => method.id),
    prohibitedMethods: publicMethods(prohibited),
    duplicateStandardMethods: publicMethods(duplicateStandardMethods),
    preservedMethods: publicMethods(
      methods.filter(
        (method) =>
          !PROHIBITED_METHOD_NAMES.has(method.name) &&
          !duplicateStandardMethods.some(
            (duplicate) => duplicate.id === method.id,
          ),
      ),
    ),
  };
}

async function applyPlan(plan) {
  const profile = {};
  if (plan.methodDefinitionsToDelete.length) {
    profile.methodDefinitionsToDelete = plan.methodDefinitionsToDelete;
  }
  if (!Object.keys(profile).length) return;
  const result = await shopifyGraphql(
    `mutation ReconcileCustomerShippingMethods($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) {
        profile { id name }
        userErrors { field message }
      }
    }`,
    {
      id: GENERAL_PROFILE_ID,
      profile,
    },
  );
  assertNoUserErrors(result, 'deliveryProfileUpdate');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyAfterApply() {
  let lastMethods = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt) await delay(5000);
    const profile = await getProfile();
    lastMethods = flattenMethods(profile);
    const names = new Set(lastMethods.map((method) => method.name));
    const failures = [];
    for (const required of REQUIRED_METHOD_NAMES) {
      if (!names.has(required)) failures.push(`missing ${required}`);
    }
    for (const prohibited of PROHIBITED_METHOD_NAMES) {
      if (names.has(prohibited)) failures.push(`prohibited ${prohibited}`);
    }
    const duplicates = new Map();
    for (const method of lastMethods.filter(
      (candidate) => candidate.name === 'Standard Shipping',
    )) {
      const key = `${method.locationGroupId}\n${method.zoneId}`;
      duplicates.set(key, (duplicates.get(key) || 0) + 1);
    }
    if ([...duplicates.values()].some((count) => count > 1)) {
      failures.push('duplicate Standard Shipping methods');
    }
    if (!failures.length) {
      return { failures: [], methods: publicMethods(lastMethods) };
    }
    if (attempt === 3) {
      return { failures, methods: publicMethods(lastMethods) };
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const before = audit(await getProfile());
  let after = null;
  if (apply) {
    await applyPlan(before);
    after = await verifyAfterApply();
    if (after.failures.length) {
      throw new Error(
        `Shipping verification failed: ${after.failures.join('; ')}`,
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before, after }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `Shopify shipping reconciliation failed: ${error.message}\n`,
  );
  process.exitCode = 1;
});
