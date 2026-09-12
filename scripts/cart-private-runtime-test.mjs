import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const temp = mkdtempSync(join(tmpdir(), 'private-cart-runtime-'));
await build({
  entryPoints: ['functions/api/cart.ts'],
  outfile: join(temp, 'standalone.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  tsconfig: resolve('tsconfig.json'),
});
const standalone = await import(pathToFileURL(join(temp, 'standalone.mjs')));
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
writeFileSync(
  join(temp, 'worker.mjs'),
  readFileSync(join(workerDir, 'index.js')),
);
const worker = (await import(pathToFileURL(join(temp, 'worker.mjs')))).default;
const money = (amount) => ({ amount, currencyCode: 'USD' });
const cart = {
  id: 'cart',
  checkoutUrl: 'https://checkout.example/cart',
  totalQuantity: 1,
  discountCodes: [],
  cost: { subtotalAmount: money('100.00'), totalAmount: money('100.00') },
  lines: {
    pageInfo: { hasNextPage: false },
    edges: [
      {
        node: {
          id: 'line',
          quantity: 1,
          merchandise: {
            id: 'v1',
            sku: 'TEST-1',
            title: 'Test',
            price: money('100.00'),
            product: {
              id: 'p1',
              handle: 'example',
              title: 'Test',
              tags: ['otc-eligible'],
              productType: 'Avionics — Certified',
            },
            selectedOptions: [],
          },
          cost: {
            amountPerQuantity: money('100.00'),
            subtotalAmount: money('100.00'),
            totalAmount: money('100.00'),
          },
        },
      },
    ],
  },
};
const policy = {
  version: 1,
  enabled: true,
  expiresAt: '2099-01-01',
  entries: [
    {
      variantId: 'v1',
      productId: 'p1',
      handle: 'example',
      sku: 'TEST-1',
      code: 'SYNTHETIC',
      policy: 'MAP',
      otc: true,
      publicPrice: '100.00',
      cartPrice: '90.00',
    },
  ],
};
const env = {
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'offline-test',
  SHOPIFY_CART_PRICING_POLICY: JSON.stringify(policy),
};
const original = globalThis.fetch;
let passed = 0;
try {
  for (const runtime of ['standalone', 'injected'])
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'])
      for (const bad of [false, true]) {
        let applied = 0;
        globalThis.fetch = async (url, opt) => {
          const { query, variables } = JSON.parse(opt.body);
          if (query.includes('MerchandiseProduct'))
            return Response.json({
              data: {
                node: {
                  id: 'v1',
                  sku: 'TEST-1',
                  product: cart.lines.edges[0].node.merchandise.product,
                },
              },
            });
          if (query.includes('PrivateCartCodes')) {
            applied++;
            assert.deepEqual(variables.codes, ['SYNTHETIC']);
            const fresh = structuredClone(cart);
            fresh.cost.totalAmount = money('90.00');
            fresh.lines.edges[0].node.cost.totalAmount = money(
              bad ? '89.00' : '90.00',
            );
            return Response.json({
              data: {
                cartDiscountCodesUpdate: { cart: fresh, userErrors: [] },
              },
            });
          }
          const op = query.includes('cartCreate(')
            ? 'cartCreate'
            : query.includes('cartLinesAdd(')
              ? 'cartLinesAdd'
              : query.includes('cartLinesUpdate(')
                ? 'cartLinesUpdate'
                : query.includes('cartLinesRemove(')
                  ? 'cartLinesRemove'
                  : null;
          return Response.json({
            data: op
              ? { [op]: { cart: structuredClone(cart), userErrors: [] } }
              : { cart: structuredClone(cart) },
          });
        };
        const request = new Request(
          'https://example.com/api/cart?cartId=cart',
          {
            method,
            ...(method === 'GET'
              ? {}
              : {
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cartId: 'cart',
                    merchandiseId: 'v1',
                    lineId: 'line',
                    lineIds: ['line'],
                    quantity: 1,
                    price: '0.01',
                  }),
                }),
          },
        );
        const handler =
          standalone['onRequest' + method[0] + method.slice(1).toLowerCase()];
        const response =
          runtime === 'standalone'
            ? await handler({ request, env })
            : await worker.fetch(request, env, {});
        const json = await response.json();
        assert.equal(response.status, bad ? 502 : 200);
        assert.equal(applied, 1);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert(response.headers.get('X-Robots-Tag').includes('noindex'));
        assert(!JSON.stringify(json).includes('SYNTHETIC'));
        if (!bad) assert.equal(json.cart.cost.totalAmount.amount, '90.00');
        else assert(!json.cart);
        passed++;
      }
} finally {
  globalThis.fetch = original;
}
console.log(
  JSON.stringify({
    runtimeScenarios: passed,
    runtimes: 2,
    methods: 4,
    nativeFailureClosed: true,
    clientPricesIgnored: true,
  }),
);
