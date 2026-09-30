import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifiedQuoteRetailPrice } from '../lib/garmin-quote-retail-display.mjs';
const policy = JSON.parse(
  fs.readFileSync(
    new URL('../data/garmin-quote-retail-display.json', import.meta.url),
  ),
);
const existing = JSON.parse(
  fs.readFileSync(
    new URL('../data/garmin-public-price-policy.json', import.meta.url),
  ),
);
let passed = 0;
function test(value) {
  assert.ok(value);
  passed++;
}
// Exact GI 275 display-only additions from 36c5633 and d235b8b.
// Two AXIS records intentionally share SKUs with the original audit products;
// no other duplicate SKU or out-of-audit product is authorized by this test.
const addedDisplayRows = [
  [
    '8961786609883',
    '47408721297627',
    'kit-gi-275-adahrs-class-i-ii',
    '010-02326-10',
    '4695.00',
  ],
  [
    '9429397307611',
    '49078739632347',
    'garmin-axis-certified-010-02326-10',
    '010-02326-10',
    '4695.00',
  ],
  [
    '8961786151131',
    '47408720904411',
    'kit-gi-275-adahrs-ap-class-i-ii',
    '010-02326-20',
    '5795.00',
  ],
  [
    '9429397340379',
    '49078739665115',
    'garmin-axis-certified-010-02326-20',
    '010-02326-20',
    '5795.00',
  ],
].map(([productId, variantId, handle, sku, amount]) => ({
  productId: 'gid://shopify/Product/' + productId,
  variantId: 'gid://shopify/ProductVariant/' + variantId,
  handle,
  sku,
  amount,
  currencyCode: 'USD',
  sourcePages: [20],
  sourceKey: 'aftermarket',
}));
for (const expected of addedDisplayRows) {
  assert.deepEqual(
    policy.products.filter((row) => row.variantId === expected.variantId),
    [expected],
  );
  passed++;
}
test(policy.products.length === 199);
test(policy.quoteOnlyAuditProducts.length === 521);
test(new Set(policy.products.map((p) => p.variantId)).size === 199);
test(new Set(policy.products.map((p) => p.productId)).size === 199);
const originalDisplayRows = policy.products.filter(
  (row) => !addedDisplayRows.some((added) => added.variantId === row.variantId),
);
test(originalDisplayRows.length === 195);
test(new Set(originalDisplayRows.map((p) => p.sku)).size === 195);
test(
  !originalDisplayRows.some((row) =>
    ['010-02326-10', '010-02326-20'].includes(row.sku),
  ),
);
for (const e of policy.products) {
  const p = {
    id: e.productId,
    handle: e.handle,
    vendor: 'Garmin',
    variants: [
      {
        id: e.variantId,
        sku: e.sku,
        price: { amount: e.amount, currencyCode: e.currencyCode },
      },
    ],
  };
  test(verifiedQuoteRetailPrice(p, policy)?.amount === e.amount);
  test(
    policy.quoteOnlyAuditProducts.some(
      (r) => r.productId === e.productId && r.handle === e.handle,
    ) ||
      addedDisplayRows.some(
        (r) =>
          r.productId === e.productId &&
          r.handle === e.handle &&
          r.variantId === e.variantId,
      ),
  );
  test(!existing.products.some((r) => r.variantId === e.variantId));
  for (const field of ['id', 'handle', 'vendor'])
    test(
      verifiedQuoteRetailPrice({ ...p, [field]: 'different' }, policy) === null,
    );
  for (const field of ['id', 'sku'])
    test(
      verifiedQuoteRetailPrice(
        { ...p, variants: [{ ...p.variants[0], [field]: 'different' }] },
        policy,
      ) === null,
    );
  for (const amount of [
    '0',
    'NaN',
    String(Number(e.amount) - 1),
    String(Number(e.amount) + 1),
  ])
    test(
      verifiedQuoteRetailPrice(
        {
          ...p,
          variants: [
            { ...p.variants[0], price: { amount, currencyCode: 'USD' } },
          ],
        },
        policy,
      ) === null,
    );
  test(
    verifiedQuoteRetailPrice(
      { ...p, variants: [...p.variants, ...p.variants] },
      policy,
    ) === null,
  );
  test(
    verifiedQuoteRetailPrice(
      {
        ...p,
        variants: [
          {
            ...p.variants[0],
            price: { amount: e.amount, currencyCode: 'CAD' },
          },
        ],
      },
      policy,
    ) === null,
  );
}
for (const f of [
  'about_mockup.html',
  'about_sample.html',
  'collection_mockup.html',
  'pdp_mockup.html',
  'index.html',
])
  test(
    fs
      .readFileSync(new URL('../public/preview/' + f, import.meta.url), 'utf8')
      .includes('content="noindex, follow"'),
  );
test(
  fs
    .readFileSync(
      new URL('../public/newspaper/index.html', import.meta.url),
      'utf8',
    )
    .includes('content="noindex, follow"'),
);
const sitemap = fs.readFileSync(
  new URL('../app/sitemap.ts', import.meta.url),
  'utf8',
);
test(!sitemap.includes("'preview'"));
test(!sitemap.includes("'newspaper'"));
const card = fs.readFileSync(
  new URL('../components/shopify/PdpPriceCard.tsx', import.meta.url),
  'utf8',
);
test(card.includes("const otcEligible = otc === 'eligible'"));
test(card.includes('This listing is not'));
test(card.includes("? 'Contact RWAS for Installation and Availability'"));
const page = fs.readFileSync(
  new URL('../app/products/[handle]/page.tsx', import.meta.url),
  'utf8',
);
test(page.includes('quoteRetailPolicy.quoteOnlyAuditProducts.some'));
test(page.includes("gating.otc !== 'eligible'"));
console.log(
  JSON.stringify({
    passed,
    approvedDisplay: 199,
    auditScope: 521,
    networkWrites: 0,
  }),
);
