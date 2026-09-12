import assert from 'node:assert/strict';
import { applyPrivateCartPricing as apply } from '../lib/cart-private-pricing.mjs';
let passed = 0;
const entry = {
  variantId: 'v1',
  productId: 'p1',
  handle: 'example',
  sku: 'TEST-1',
  code: 'SYNTHETIC',
  policy: 'MAP',
  otc: true,
  publicPrice: '100.00',
  cartPrice: '90.00',
};
const policy = {
  version: 1,
  enabled: true,
  expiresAt: '2099-01-01',
  entries: [entry],
};
const make = () => ({
  id: 'cart',
  discountCodes: [],
  lines: {
    pageInfo: { hasNextPage: false },
    edges: [
      {
        node: {
          id: 'line',
          quantity: 2,
          merchandise: {
            id: 'v1',
            sku: 'TEST-1',
            price: { amount: '100.00', currencyCode: 'USD' },
            product: { id: 'p1', handle: 'example', tags: ['otc-eligible'] },
          },
          cost: { totalAmount: { amount: '200.00', currencyCode: 'USD' } },
        },
      },
    ],
  },
});
const shopFor =
  (cart, paid = '180.00') =>
  async (q, v) => {
    assert(q.includes('cartDiscountCodesUpdate'));
    assert.equal(v.cartId, 'cart');
    const fresh = structuredClone(cart);
    fresh.discountCodes = v.codes.map((code) => ({ code, applicable: true }));
    fresh.lines.edges[0].node.cost.totalAmount.amount = paid;
    return { cartDiscountCodesUpdate: { cart: fresh, userErrors: [] } };
  };
const run = async (c, p = policy, shop = shopFor(c)) =>
  apply(c, JSON.stringify(p), shop, 'id', 0);
let c = make();
assert.equal(
  (await run(c)).lines.edges[0].node.cost.totalAmount.amount,
  '180.00',
);
passed++;
for (const mutate of [
  (c) => (c.lines.edges[0].node.merchandise.sku = 'OTHER'),
  (c) => (c.lines.edges[0].node.merchandise.product.id = 'other'),
  (c) => (c.lines.edges[0].node.merchandise.product.handle = 'other'),
  (c) => (c.lines.edges[0].node.merchandise.price.amount = '99.00'),
  (c) => (c.lines.edges[0].node.merchandise.price.currencyCode = 'CAD'),
  (c) => (c.lines.edges[0].node.merchandise.product.tags = []),
  (c) => c.lines.edges[0].node.merchandise.product.tags.push('otc-disabled'),
  (c) => (c.lines.pageInfo.hasNextPage = true),
  (c) => (c.lines.edges[0].node.quantity = 0),
]) {
  c = make();
  mutate(c);
  await assert.rejects(run(c));
  passed++;
}
for (const paid of ['179.99', '181.00', 'NaN']) {
  c = make();
  await assert.rejects(run(c, policy, shopFor(c, paid)));
  passed++;
}
c = make();
await assert.rejects(
  run(c, policy, async () => ({
    cartDiscountCodesUpdate: { cart: null, userErrors: [] },
  })),
);
passed++;
c = make();
await assert.rejects(apply(c, 'bad', shopFor(c), 'id'));
passed++;
for (const e of [
  { ...entry, policy: 'MRP' },
  { ...entry, otc: false },
  { ...entry, cartPrice: '-1' },
  { ...entry, cartPrice: '101.00' },
]) {
  await assert.rejects(run(make(), { ...policy, entries: [e] }));
  passed++;
}
c = make();
assert.equal(
  await apply(
    c,
    null,
    () => {
      throw Error('should not call');
    },
    'id',
  ),
  c,
);
passed++;
c = make();
const off = { ...policy, enabled: false };
assert.equal(await run(c, off), c);
passed++;
c = make();
c.discountCodes = [{ code: 'SYNTHETIC', applicable: true }];
let codes;
await run(c, { ...policy, expiresAt: '1970-01-01' }, async (q, v) => {
  codes = v.codes;
  return shopFor(c, '200.00')(q, v);
});
assert.deepEqual(codes, []);
passed++;
c = make();
c.discountCodes = [{ code: 'CUSTOMER', applicable: true }];
await run(c, policy, async (q, v) => {
  assert.deepEqual(v.codes, ['CUSTOMER', 'SYNTHETIC']);
  return shopFor(c, '200.00')(q, v);
});
passed++;
c = make();
c.discountCodes = Array.from({ length: 5 }, (_, i) => ({
  code: `CUSTOMER${i}`,
  applicable: true,
}));
await assert.rejects(run(c));
passed++;
c = make();
c.lines.edges[0].node.merchandise.id = 'unreviewed-new-variant';
assert.equal(await run(c), c);
passed++;
c = make();
const dup = { ...policy, entries: [entry, entry] };
await assert.rejects(run(c, dup));
passed++;
console.log(JSON.stringify({ passed, syntheticOnly: true }));
