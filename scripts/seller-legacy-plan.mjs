// Pure, offline preparation only. Does not import, deploy, fetch or delete data.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  listingFields as allowed,
  cleanListing,
} from '../workers/aircraft-sale/listing-fields.mjs';
const categories = new Set([
  'photos',
  'videos',
  'airframe',
  'powerplant',
  'propeller',
  'adSbCompliance',
  'misc',
]);
export function planLegacy(listings) {
  if (!Array.isArray(listings))
    throw Error('Expected explicit listing export array.');
  const seen = new Set(),
    keys = new Map(),
    owners = new Map(),
    review = [],
    normalizations = [];
  const normalized = listings.map((l) => {
    if (
      !l ||
      typeof l !== 'object' ||
      Array.isArray(l) ||
      typeof l.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(l.id) ||
      ['__proto__', 'constructor', 'prototype'].includes(l.id) ||
      seen.has(l.id)
    )
      throw Error('Invalid or duplicate listing ID.');
    seen.add(l.id);
    const email = String(l.sellerEmail || '')
      .trim()
      .toLowerCase();
    if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error(
        'Missing owner email for ' +
          l.id +
          '; independent verification is still required.',
      );
    owners.set(email, [...(owners.get(email) || []), l.id]);
    if (
      (l.photos !== undefined && !Array.isArray(l.photos)) ||
      (l.videos !== undefined && !Array.isArray(l.videos)) ||
      (l.logbooks !== undefined &&
        (!l.logbooks ||
          typeof l.logbooks !== 'object' ||
          Array.isArray(l.logbooks)))
    )
      throw Error('Invalid media structure for ' + l.id);
    for (const [category, files] of Object.entries(l.logbooks || {}))
      if (
        !categories.has(category) ||
        ['photos', 'videos'].includes(category) ||
        !Array.isArray(files)
      )
        throw Error('Invalid record category for ' + l.id);
    const files = [
      ...(l.videos || []).map((f) => ({ ...f, category: 'videos' })),
      ...(l.photos || []).map((f) => ({ ...f, category: 'photos' })),
      ...Object.entries(l.logbooks || {}).flatMap(([category, fs]) =>
        fs.map((f) => ({ ...f, category })),
      ),
    ];
    for (const f of files) {
      if (
        typeof f.key !== 'string' ||
        !f.key.startsWith('listings/' + l.id + '/' + f.category + '/') ||
        /[\\\u0000-\u001f%]/.test(f.key) ||
        f.key
          .split('/')
          .some((part) => !part || part === '.' || part === '..') ||
        keys.has(f.key)
      )
        throw Error('Ambiguous file ownership: ' + f.key);
      keys.set(f.key, {
        listingId: l.id,
        ownerEmail: email,
        category: f.category,
        sourceKey: f.key,
      });
    }
    for (const key of allowed)
      if (l[key] !== undefined && !['string', 'number'].includes(typeof l[key]))
        throw Error('Invalid field type: ' + key);
    for (const key of allowed)
      if (typeof l[key] === 'number' && !Number.isFinite(l[key]))
        throw Error('Invalid numeric field: ' + key);
    const fields = Object.fromEntries(
      allowed.filter((k) => l[k] !== undefined).map((k) => [k, l[k]]),
    );
    review.push({
      listingId: l.id,
      priorStatus: l.status || 'unknown',
      proposedStatus: 'draft',
      reason:
        'Explicit owner mapping and content/media review required before publication.',
    });
    const destinationFields = cleanListing(fields);
    const changedFields = Object.keys(fields).filter(
      (key) => fields[key] !== destinationFields[key],
    );
    if (changedFields.length)
      normalizations.push({
        listingId: l.id,
        fields: changedFields,
        rule: 'Same field trimming, numeric conversion and N-number casing as destination API.',
      });
    return {
      id: l.id,
      ownerEmail: email,
      fields: destinationFields,
      proposedStatus: 'draft',
    };
  });
  return {
    version: 2,
    mode: 'OFFLINE PLAN — NOT IMPORTED',
    listingCount: normalized.length,
    fileCount: keys.size,
    owners: Object.fromEntries(owners),
    listings: normalized,
    files: [...keys.values()],
    review,
    normalizations,
    excludes: [
      'all OTPs, sessions, passwords, admin credentials, unauthenticated drafts and orphan files',
    ],
    cutoverGates: [
      'Operator-authorized current source/export',
      'Ownership validation',
      'Private destination bucket and approved bindings',
      'Review each imported draft',
      'Legacy URLs/CDN cache purge and old write-route retirement',
      'Backup, reconciliation, rollback and explicit rollout approval',
    ],
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      'Usage: node scripts/seller-legacy-plan.mjs INPUT.json OUTPUT.json (offline only)',
    );
  const parsed = JSON.parse(await readFile(input, 'utf8'));
  await writeFile(
    output,
    JSON.stringify(
      planLegacy(Array.isArray(parsed) ? parsed : parsed.listings),
      null,
      2,
    ),
  );
  console.log('Offline plan written. No import or deployment performed.');
}
