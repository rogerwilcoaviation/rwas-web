import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// Offline only: exercise both the standalone Function and the actual edge injector.
const temp = mkdtempSync(join(tmpdir(), 'rwas-cart-exception-'));
const bundle = async (entry, name) => {
  const outfile = join(temp, name + '.mjs');
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    tsconfig: resolve('tsconfig.json'),
  });
  return import(pathToFileURL(outfile));
};
const policy = JSON.parse(
  readFileSync('data/cart-purchase-exceptions.json', 'utf8'),
);
assert.equal(policy.length, 1);
const entry = policy[0];
const product = {
  id: entry.productId,
  handle: entry.handle,
  productType: 'Garmin Dealer Install',
  tags: ['otc-disabled', 'stock-check-required'],
};
const variant = { id: entry.variantId, sku: entry.sku };
const helpers = await bundle('lib/cart-purchase-exceptions.ts', 'helpers');
let passed = 0;
function check(value) {
  assert.ok(value);
  passed++;
}
check(helpers.isCartPurchaseException({ product, variant }));
check(
  helpers.isCartPurchaseExceptionProduct({ ...product, variants: [variant] }),
);
check(!helpers.isCartPurchaseExceptionProduct({ ...product, variants: [] }));
check(
  !helpers.isCartPurchaseExceptionProduct({
    ...product,
    variants: [variant, { ...variant, id: 'other' }],
  }),
);
for (const key of ['id', 'handle'])
  check(
    !helpers.isCartPurchaseException({
      product: { ...product, [key]: 'other' },
      variant,
    }),
  );
for (const key of ['id', 'sku'])
  check(
    !helpers.isCartPurchaseException({
      product,
      variant: { ...variant, [key]: 'other' },
    }),
  );
check(!helpers.isCartPurchaseException({}));

const standalone = await bundle('functions/api/cart.ts', 'standalone');
const workerDir = join(temp, '.vercel/output/static/_worker.js');
mkdirSync(workerDir, { recursive: true });
writeFileSync(
  join(workerDir, 'index.js'),
  'export default {async fetch(t,e,c){return new Response("fallback")}}',
);
execFileSync(
  process.execPath,
  [resolve('scripts/inject-cloudflare-collection-redirects.mjs')],
  { cwd: temp },
);
const injected = readFileSync(join(workerDir, 'index.js'), 'utf8');
check(!injected.includes('CART_PURCHASE_EXCEPTIONS'));
writeFileSync(join(temp, 'worker.mjs'), injected);
const worker = (await import(pathToFileURL(join(temp, 'worker.mjs')))).default;
const originalFetch = globalThis.fetch;
const env = { SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'offline-test' };
try {
  for (const [name, handler] of [
    ['standalone', (request) => standalone.onRequestPost({ request, env })],
    ['injected', (request) => worker.fetch(request, env, {})],
  ]) {
    const cases = [
      { name: 'approved', node: { ...variant, product }, allowed: true },
      {
        name: 'wrong product',
        node: { ...variant, product: { ...product, id: 'other' } },
      },
      {
        name: 'wrong handle',
        node: { ...variant, product: { ...product, handle: 'other' } },
      },
      { name: 'wrong variant', node: { ...variant, id: 'other', product } },
      { name: 'wrong sku', node: { ...variant, sku: '011-02326-01', product } },
      { name: 'missing sku', node: { id: variant.id, product } },
      {
        name: 'dealer neighbor',
        node: { id: 'other', sku: '135-00028-03', product },
      },
      {
        name: 'certified restricted',
        node: {
          id: 'other',
          product: { productType: 'Avionics — Certified', tags: [] },
        },
      },
      {
        name: 'Papa Alpha retail',
        node: {
          id: 'other',
          product: { productType: 'Papa-Alpha Tools', tags: ['otc-eligible'] },
        },
        allowed: true,
      },
      {
        name: 'approved unavailable Shopify rejection',
        node: { ...variant, product },
        rejected: true,
      },
    ];
    for (const test of cases) {
      let mutations = 0;
      globalThis.fetch = async (_url, init) => {
        const { query, variables } = JSON.parse(init.body);
        if (query.includes('MerchandiseProduct')) {
          assert.match(query, /id sku product \{ id/);
          return Response.json({ data: { node: test.node } });
        }
        mutations++;
        assert.equal(variables.merchandiseId, variant.id);
        assert.equal(variables.quantity, 2);
        return Response.json({
          data: {
            cartCreate: {
              cart: { id: 'test-cart', totalQuantity: 2, lines: { edges: [] } },
              userErrors: test.rejected
                ? [{ message: 'Not available for sale' }]
                : [],
            },
          },
        });
      };
      const response = await handler(
        new Request('https://example.test/api/cart', {
          method: 'POST',
          body: JSON.stringify({ merchandiseId: variant.id, quantity: 2 }),
        }),
      );
      assert.equal(response.ok, Boolean(test.allowed), `${name}: ${test.name}`);
      assert.equal(
        mutations,
        test.allowed || test.rejected ? 1 : 0,
        `${name}: ${test.name} mutation boundary`,
      );
      passed++;
    }
    for (const quantity of [0, -1, 101, 1.5, '2']) {
      globalThis.fetch = async () => {
        throw new Error('Invalid quantity must not call Shopify');
      };
      const response = await handler(
        new Request('https://example.test/api/cart', {
          method: 'POST',
          body: JSON.stringify({ merchandiseId: variant.id, quantity }),
        }),
      );
      check(response.status === 400);
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  `PASS ${passed} cart exception checks (exact identity, future variants, both cart runtimes, restricted neighbors, Papa-Alpha, Shopify rejection, quantity bounds).`,
);

const renderBundle = join(temp, 'render.cjs');
await build({
  stdin: {
    contents: `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PdpPriceCard from './components/shopify/PdpPriceCard';
export const render = (props) => renderToStaticMarkup(React.createElement(PdpPriceCard, props));`,
    resolveDir: process.cwd(),
  },
  jsx: 'automatic',
  outfile: renderBundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  tsconfig: resolve('tsconfig.json'),
});
const { render } = await import(pathToFileURL(renderBundle));
const props = {
  productTitle: 'GTN 750 Connector Kit',
  variants: [
    {
      ...variant,
      title: 'Standard configuration',
      price: { amount: '540.00', currencyCode: 'USD' },
      availableForSale: true,
      selectedOptions: [],
    },
  ],
  otc: 'eligible',
  isDealerInstall: true,
  isGarmin: true,
  stockCheckRequired: true,
  mapLocked: false,
};
check(!render(props).includes('Add to Cart'));
const approvedHtml = render({ ...props, cartPurchaseException: true });
check(approvedHtml.includes('Add to Cart'));
check(approvedHtml.includes('$540.00'));
check(approvedHtml.includes('Special order'));
check(!approvedHtml.includes('In stock'));
const unavailableHtml = render({
  ...props,
  cartPurchaseException: true,
  variants: [{ ...props.variants[0], availableForSale: false }],
});
check(
  unavailableHtml.includes('Unavailable') &&
    unavailableHtml.includes('disabled'),
);
const zeroHtml = render({
  ...props,
  cartPurchaseException: true,
  variants: [
    { ...props.variants[0], price: { amount: '0', currencyCode: 'USD' } },
  ],
});
check(
  !zeroHtml.includes('Add to Cart') &&
    zeroHtml.includes('Contact us for package pricing'),
);
check(
  render({
    ...props,
    isDealerInstall: false,
    isGarmin: false,
    productTitle: 'Papa-Alpha',
  }).includes('Add to Cart'),
);
console.log(
  `PASS ${passed} total checks including rendered buy box, zero/unavailable safeguards, and unchanged dealer/Papa-Alpha behavior.`,
);
