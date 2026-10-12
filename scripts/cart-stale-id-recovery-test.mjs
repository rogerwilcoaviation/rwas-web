import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'stale-cart-recovery-'));
const outfile = join(temp, 'cart.mjs');
await build({
  entryPoints: ['functions/api/cart.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  tsconfig: resolve('tsconfig.json'),
});
const { onRequestPost } = await import(pathToFileURL(outfile));
const money = (amount) => ({ amount, currencyCode: 'USD' });
const replacementCart = {
  id: 'gid://shopify/Cart/replacement',
  checkoutUrl: 'https://checkout.example/replacement',
  totalQuantity: 1,
  discountCodes: [],
  cost: { subtotalAmount: money('75.00'), totalAmount: money('75.00') },
  lines: {
    pageInfo: { hasNextPage: false },
    edges: [
      {
        node: {
          id: 'line-new',
          quantity: 1,
          cost: {
            amountPerQuantity: money('75.00'),
            subtotalAmount: money('75.00'),
            totalAmount: money('75.00'),
          },
          merchandise: {
            id: 'gid://shopify/ProductVariant/47408750985435',
            sku: '011-04895-00',
            title: 'Default Title',
            price: money('75.00'),
            product: {
              title: 'Sub-Assy, AP Disc/Trim Int Switch',
              handle: 'sub-assy-ap-disc-trim-int-switch',
            },
            selectedOptions: [],
          },
        },
      },
    ],
  },
};
const originalFetch = globalThis.fetch;
try {
  for (const scenario of [
    {
      name: 'expired cart recovers',
      addError: 'The specified cart does not exist.',
      expected: 200,
      creates: 1,
    },
    {
      name: 'other add errors stay closed',
      addError: 'Quantity is unavailable.',
      expected: 400,
      creates: 0,
    },
  ]) {
    let creates = 0;
    globalThis.fetch = async (_url, init) => {
      const { query } = JSON.parse(init.body);
      if (query.includes('MerchandiseProduct'))
        return Response.json({
          data: {
            node: {
              id: 'gid://shopify/ProductVariant/47408750985435',
              sku: '011-04895-00',
              product: {
                id: 'gid://shopify/Product/8961818362075',
                title: 'Sub-Assy, AP Disc/Trim Int Switch',
                handle: 'sub-assy-ap-disc-trim-int-switch',
                productType: 'Avionics — Certified',
                tags: ['otc-eligible'],
              },
            },
          },
        });
      if (query.includes('cartLinesAdd('))
        return Response.json({
          data: {
            cartLinesAdd: {
              cart: null,
              userErrors: [{ message: scenario.addError }],
            },
          },
        });
      if (query.includes('cartCreate(')) {
        creates++;
        return Response.json({
          data: {
            cartCreate: {
              cart: structuredClone(replacementCart),
              userErrors: [],
            },
          },
        });
      }
      throw new Error('Unexpected Shopify operation');
    };
    const request = new Request('https://example.com/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartId: 'gid://shopify/Cart/expired',
        merchandiseId: 'gid://shopify/ProductVariant/47408750985435',
        quantity: 1,
      }),
    });
    const response = await onRequestPost({
      request,
      env: { SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'offline-test' },
    });
    const payload = await response.json();
    assert.equal(response.status, scenario.expected, scenario.name);
    assert.equal(creates, scenario.creates, scenario.name);
    if (response.ok) {
      assert.equal(payload.cart.id, replacementCart.id);
      assert.equal(payload.cart.lines[0].merchandise.sku, '011-04895-00');
      assert.equal(payload.cart.cost.totalAmount.amount, '75.00');
    } else assert.equal(payload.error, scenario.addError);
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  JSON.stringify({ staleCartRecovered: true, unrelatedErrorsPreserved: true }),
);
