import test from 'node:test';
import assert from 'node:assert/strict';
import { editSource } from '../../lib/marketplace/edit-source.mjs';

test('editing asks before restoring an existing listing draft', () => {
  const listing = { id: 'one' };
  assert.equal(editSource(listing, { listingId: 'one' }, null), 'choose');
  assert.equal(editSource(listing, null, { listingId: 'one' }), 'choose');
  assert.equal(editSource(listing, null, null), 'current');
  assert.equal(editSource(listing, { listingId: 'two' }, null), 'different');
  assert.equal(editSource(listing, { listingId: 'one' }, { listingId: 'two' }), 'different');
});
