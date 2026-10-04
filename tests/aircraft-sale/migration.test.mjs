import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLegacy } from '../../scripts/seller-legacy-plan.mjs';
test('offline legacy plan excludes credentials, requires ownership, drafts every imported listing', () => {
  const base = {
    id: 'synthetic-1',
    sellerEmail: 'owner@example.test',
    status: 'active',
    make: 'Synthetic',
    session: 'should-never-import',
    photos: [{ key: 'listings/synthetic-1/photos/a.png' }],
    logbooks: { airframe: [{ key: 'listings/synthetic-1/airframe/a.pdf' }] },
  };
  const plan = planLegacy([base]);
  assert.equal(plan.listings[0].proposedStatus, 'draft');
  assert.equal(plan.files.length, 2);
  assert.equal(JSON.stringify(plan).includes('should-never-import'), false);
  assert.throws(() => planLegacy([{ ...base, sellerEmail: '' }]));
  assert.throws(() =>
    planLegacy([{ ...base, photos: [{ key: 'listings/other/photos/a.png' }] }]),
  );
  assert.throws(() => planLegacy([base, base]));
});
