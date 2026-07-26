#!/usr/bin/env node

import fs from 'node:fs';

const SHOPIFY_ENV_PATH =
  process.env.RWAS_SHOPIFY_ENV_PATH ||
  '/Users/rwas/.openclaw/workspace/configs/shopify.env';
const GENERAL_PROFILE_ID = 'gid://shopify/DeliveryProfile/104778727643';
const PRIMARY_LOCATION_GROUP_ID =
  'gid://shopify/DeliveryLocationGroup/106175070427';
const DOMESTIC_ZONE_ID = 'gid://shopify/DeliveryZone/431550267611';
const INTERNATIONAL_ZONE_ID = 'gid://shopify/DeliveryZone/431550300379';
const UPS_CARRIER_SERVICE_ID =
  'gid://shopify/DeliveryCarrierService/75727962331';

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

async function getProfile() {
  const data = await shopifyGraphql(`query ShippingMethodAudit {
    deliveryProfiles(first: 5) {
      nodes {
        id
        name
        profileLocationGroups {
          locationGroup {
            id
            locations(first: 20) {
              nodes { id name isActive fulfillsOnlineOrders }
            }
          }
          locationGroupZones(first: 20) {
            nodes {
              zone { id name }
              methodDefinitions(first: 50) {
                nodes {
                  id
                  name
                  description
                  active
                  rateProvider {
                    ... on DeliveryParticipant {
                      id
                      adaptToNewServicesFlag
                      carrierService { id name active }
                      participantServices { name active }
                    }
                    ... on DeliveryRateDefinition {
                      id
                      price { amount currencyCode }
                    }
                  }
                  methodConditions {
                    id
                    field
                    operator
                    conditionCriteria {
                      ... on MoneyV2 { amount currencyCode }
                      ... on Weight { unit value }
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
  return profile.profileLocationGroups.flatMap((group) => {
    const activeLocations = group.locationGroup.locations.nodes.filter(
      (location) => location.isActive && location.fulfillsOnlineOrders,
    );
    return group.locationGroupZones.nodes.flatMap((zone) =>
      zone.methodDefinitions.nodes.map((method) => ({
        locationGroupId: group.locationGroup.id,
        activeLocationCount: activeLocations.length,
        zoneId: zone.zone.id,
        zone: zone.zone.name,
        ...method,
      })),
    );
  });
}

function publicMethods(methods) {
  return methods.map((method) => ({
    id: method.id,
    locationGroupId: method.locationGroupId,
    activeLocationCount: method.activeLocationCount,
    zoneId: method.zoneId,
    zone: method.zone,
    name: method.name,
    description: method.description,
    active: method.active,
    carrierService: method.rateProvider?.carrierService?.name || null,
    carrierServiceActive: method.rateProvider?.carrierService?.active ?? null,
    participantServices: method.rateProvider?.participantServices || [],
    price: method.rateProvider?.price?.amount || null,
    conditions: method.methodConditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      amount: condition.conditionCriteria?.amount || null,
      currencyCode: condition.conditionCriteria?.currencyCode || null,
      weight: condition.conditionCriteria?.value || null,
      weightUnit: condition.conditionCriteria?.unit || null,
    })),
  }));
}

function isPrimaryDomestic(method) {
  return (
    method.locationGroupId === PRIMARY_LOCATION_GROUP_ID &&
    method.zoneId === DOMESTIC_ZONE_ID
  );
}

function isPrimaryInternational(method) {
  return (
    method.locationGroupId === PRIMARY_LOCATION_GROUP_ID &&
    method.zoneId === INTERNATIONAL_ZONE_ID
  );
}

function audit(profile) {
  const methods = flattenMethods(profile);
  const customerEligibleMethods = methods.filter(
    (method) => method.activeLocationCount > 0 && method.active,
  );
  const domesticUps = methods.find(
    (method) =>
      isPrimaryDomestic(method) &&
      method.rateProvider?.carrierService?.id === UPS_CARRIER_SERVICE_ID &&
      method.rateProvider.carrierService.active &&
      method.active,
  );
  const economy = methods.find(
    (method) => isPrimaryDomestic(method) && method.name === 'Economy',
  );
  const internationalFlatRate = methods.find(
    (method) =>
      isPrimaryInternational(method) &&
      method.name === 'International Flat Rate',
  );

  // These were legacy provider definitions in the International zone. Their
  // internal identifiers could not be renamed and were displayed verbatim in
  // Admin. Keep the restored UPS participant only in Domestic, where checkout
  // displays its returned service labels (for example, UPS Ground).
  const staleCarrierMethods = methods.filter(
    (method) =>
      ['usps', 'ups_shipping'].includes(method.name) &&
      !(
        isPrimaryDomestic(method) &&
        method.rateProvider?.carrierService?.id === UPS_CARRIER_SERVICE_ID
      ),
  );
  const amazonPrimeMethods = methods.filter(
    (method) => method.name === 'Amazon Prime',
  );
  const customerEligibleAmazonPrime = amazonPrimeMethods.filter(
    (method) => method.activeLocationCount > 0 && method.active,
  );

  const economyHasExpectedRate =
    economy?.active &&
    economy.rateProvider?.price?.amount === '0.0' &&
    economy.methodConditions.some(
      (condition) =>
        condition.field === 'TOTAL_PRICE' &&
        condition.operator === 'GREATER_THAN_OR_EQUAL_TO' &&
        condition.conditionCriteria?.amount === '400.0' &&
        condition.conditionCriteria?.currencyCode === 'USD',
    );
  const internationalHasExpectedRate =
    internationalFlatRate?.active &&
    internationalFlatRate.rateProvider?.price?.amount === '75.0' &&
    internationalFlatRate.rateProvider?.price?.currencyCode === 'USD' &&
    internationalFlatRate.methodConditions.length === 0;

  const failures = [];
  if (!economyHasExpectedRate) {
    failures.push('Domestic Economy must be free for orders of at least $400');
  }
  if (!internationalHasExpectedRate) {
    failures.push('International Flat Rate must be $75 without conditions');
  }
  if (customerEligibleAmazonPrime.length) {
    failures.push('Amazon Prime is attached to an active fulfillment location');
  }

  return {
    methodDefinitionsToDelete: staleCarrierMethods.map((method) => method.id),
    createDomesticUps: !domesticUps,
    failures,
    customerEligibleMethods: publicMethods(customerEligibleMethods),
    staleCarrierMethods: publicMethods(staleCarrierMethods),
    appManagedInactiveMethods: publicMethods(
      amazonPrimeMethods.filter((method) => method.activeLocationCount === 0),
    ),
  };
}

async function applyPlan(plan) {
  const profile = {};
  if (plan.methodDefinitionsToDelete.length) {
    profile.methodDefinitionsToDelete = plan.methodDefinitionsToDelete;
  }
  if (plan.createDomesticUps) {
    profile.locationGroupsToUpdate = [
      {
        id: PRIMARY_LOCATION_GROUP_ID,
        zonesToUpdate: [
          {
            id: DOMESTIC_ZONE_ID,
            methodDefinitionsToCreate: [
              {
                name: 'UPS',
                active: true,
                participant: {
                  carrierServiceId: UPS_CARRIER_SERVICE_ID,
                  adaptToNewServices: true,
                },
              },
            ],
          },
        ],
      },
    ];
  }
  if (!Object.keys(profile).length) return;
  const result = await shopifyGraphql(
    `mutation ReconcileCustomerShippingMethods($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) {
        profile { id name }
        userErrors { field message }
      }
    }`,
    { id: GENERAL_PROFILE_ID, profile },
  );
  assertNoUserErrors(result, 'deliveryProfileUpdate');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyAfterApply() {
  let after = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt) await delay(5000);
    after = audit(await getProfile());
    if (
      !after.methodDefinitionsToDelete.length &&
      !after.createDomesticUps &&
      !after.failures.length
    ) {
      return after;
    }
  }
  const failures = [
    ...after.failures,
    ...(after.methodDefinitionsToDelete.length
      ? ['stale carrier methods remain']
      : []),
    ...(after.createDomesticUps ? ['Domestic UPS participant is missing'] : []),
  ];
  throw new Error(`Shipping verification failed: ${failures.join('; ')}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnv(SHOPIFY_ENV_PATH);
  const before = audit(await getProfile());
  if (before.failures.length) {
    throw new Error(`Shipping audit failed: ${before.failures.join('; ')}`);
  }
  let after = null;
  if (apply) {
    await applyPlan(before);
    after = await verifyAfterApply();
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
