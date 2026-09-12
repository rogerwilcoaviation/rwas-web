import fs from 'node:fs';
import assert from 'node:assert/strict';
const registry = JSON.parse(
  fs.readFileSync(
    new URL('../data/papa-alpha-coupon-variants.json', import.meta.url),
  ),
);
// Input is a private complete catalog snapshot, not a public-code export.
const file = process.argv[2];
if (!file) throw Error('Provide a complete private inventory snapshot path');
const snapshot = JSON.parse(fs.readFileSync(file));
assert.equal(snapshot.complete, true);
const variants = snapshot.products.flatMap((p) =>
  p.variants.nodes.map((v) => ({
    ...v,
    productId: p.id,
    productType: p.productType,
    handle: p.handle,
  })),
);
for (const e of registry.variants) {
  const v = variants.find((v) => v.id === e.variantId);
  assert(v, 'An admitted variant is missing: review before any scope write');
  assert.equal(v.sku, e.sku);
  assert.equal(v.productId, e.productId);
  assert.equal(v.handle, e.handle);
  assert.equal(v.productType, 'Papa-Alpha Tools');
}
assert.equal(registry.variants.length, 57);
assert.equal(new Set(registry.variants.map((v) => v.variantId)).size, 57);
console.log(
  JSON.stringify({
    admitted: 57,
    identityBindingsVerified: true,
    newVariantsAutoAdmitted: false,
  }),
);
