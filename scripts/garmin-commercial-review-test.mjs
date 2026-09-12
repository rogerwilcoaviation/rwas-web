import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  expectedProduct,
  comparable,
} from './reconcile-garmin-public-prices.mjs';
import {
  approvedPublicPrice,
  assertReviewedCommercialWrites,
} from './garmin-commercial-review.mjs';
const p = JSON.parse(
  fs.readFileSync(
    new URL('../data/garmin-public-price-policy.json', import.meta.url),
  ),
);
assert.equal(p.containsPrivatePrices, false);
assert.equal(p.products.length, 30);
assert.equal(new Set(p.products.map((p) => p.sku)).size, 30);
let passed = 3;
for (const e of p.products) {
  assert.ok(Number(e.publicPrice) > 0);
  assert.ok(Number(e.publicPrice) <= Number(e.previousRetail));
  if (e.canonicalIdentityReviewed)
    assert.throws(() => assertReviewedCommercialWrites([e.sku]));
  else assertReviewedCommercialWrites([e.sku]);
  assert.equal(approvedPublicPrice(e.sku).list_price, Number(e.publicPrice));
  const product = {
    id: e.productId,
    handle: e.handle,
    status: 'ACTIVE',
    productType: 'Avionics — Certified',
    tags: ['otc-disabled', 'stock-check-required', 'keep-me'],
    descriptionHtml:
      '<p>This is a dealer-only Garmin avionics item. Contact RWAS to confirm aircraft eligibility, installation requirements, and pricing.</p><li><strong>Garmin list price:</strong> $9,999.00</li>',
    variants: {
      nodes: [
        {
          id: e.variantId,
          sku: e.sku,
          price: e.previousRetail,
          compareAtPrice: null,
          inventoryPolicy: 'CONTINUE',
          inventoryQuantity: 0,
          taxable: true,
        },
      ],
    },
  };
  const next = expectedProduct(product, e);
  assert.ok(next.tags.includes('keep-me'));
  assert.ok(next.tags.includes('otc-eligible'));
  assert.ok(!next.tags.includes('otc-disabled'));
  assert.ok(!next.descriptionHtml.includes('dealer-only'));
  assert.ok(!next.descriptionHtml.includes('list price'));
  assert.ok(
    next.descriptionHtml.includes(
      `Equipment price:</strong> $${Number(e.publicPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ),
  );
  assert.equal(next.variants.nodes[0].inventoryPolicy, 'CONTINUE');
  assert.equal(next.variants.nodes[0].taxable, true);
  assert.equal(next.variants.nodes[0].price, e.publicPrice);
  assert.deepEqual(comparable(expectedProduct(next, e)), comparable(next));
  assert.throws(() => expectedProduct({ ...product, id: 'wrong' }, e));
  assert.throws(() => expectedProduct({ ...product, status: 'ARCHIVED' }, e));
  assert.throws(() =>
    expectedProduct({ ...product, variants: { nodes: [] } }, e),
  );
  passed += 15;
}
for (const sku of [
  '010-01561-30',
  '010-02602-00',
  '010-04142-00',
  '010-02904-31',
  '010-14468-10',
  'K00-00512-10',
]) {
  assert.throws(() => assertReviewedCommercialWrites([sku]));
  assert.equal(approvedPublicPrice(sku), undefined);
  passed += 2;
}
assertReviewedCommercialWrites(['not-in-scope']);
passed++;
console.log(JSON.stringify({ passed, containsPrivatePrices: false }));
