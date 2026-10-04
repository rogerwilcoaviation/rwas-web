// Pure, offline preparation only. Does not import, deploy, fetch or delete data.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const allowed = [
  'sellerName',
  'sellerPhone',
  'sellerLocation',
  'make',
  'model',
  'year',
  'serialNumber',
  'nNumber',
  'totalTime',
  'engineTime',
  'engineModel',
  'propTime',
  'propModel',
  'price',
  'priceLabel',
  'description',
  'avionics',
  'equipmentList',
  'annualDue',
  'usefulLoad',
  'fuelCapacity',
  'cruiseSpeed',
  'range',
  'category',
  'condition',
  'damageHistory',
];
export function planLegacy(listings) {
  if (!Array.isArray(listings))
    throw Error('Expected explicit listing export array.');
  const seen = new Set(),
    keys = new Map(),
    owners = new Map(),
    review = [];
  const normalized = listings.map((l) => {
    if (!l.id || !/^[a-zA-Z0-9_-]+$/.test(l.id) || seen.has(l.id))
      throw Error('Invalid or duplicate listing ID.');
    seen.add(l.id);
    const email = String(l.sellerEmail || '')
      .trim()
      .toLowerCase();
    if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error('Missing verified ownership mapping for ' + l.id);
    owners.set(email, [...(owners.get(email) || []), l.id]);
    const files = [
      ...(l.photos || []).map((f) => ({ ...f, category: 'photos' })),
      ...Object.entries(l.logbooks || {}).flatMap(([category, fs]) =>
        fs.map((f) => ({ ...f, category })),
      ),
    ];
    for (const f of files) {
      if (
        !String(f.key).startsWith('listings/' + l.id + '/') ||
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
    return { id: l.id, ownerEmail: email, fields, proposedStatus: 'draft' };
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
