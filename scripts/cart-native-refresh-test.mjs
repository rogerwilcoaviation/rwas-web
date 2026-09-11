import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stalePublicPriceLines } from '../lib/cart-native-refresh.mjs';
const reviewed = JSON.parse(
  readFileSync('data/garmin-public-price-policy.json'),
).products;
const p = reviewed.find((p) => p.sku === '010-02325-00');
const money = (amount) => ({ amount: String(amount), currencyCode: 'USD' });
const line = {
  id: 'same-line',
  quantity: 2,
  merchandise: { id: p.variantId, sku: p.sku, price: money(3695) },
  cost: {
    amountPerQuantity: money(3895),
    subtotalAmount: money(7790),
    totalAmount: money(7790),
  },
};
const other = {
  ...structuredClone(line),
  id: 'unrelated',
  merchandise: { ...line.merchandise, id: 'not-reviewed', sku: 'Papa-Alpha' },
};
const old = {
  id: 'same-cart',
  checkoutUrl: 'https://checkout.example/same-cart',
  totalQuantity: 4,
  cost: { subtotalAmount: money(15580), totalAmount: money(15580) },
  lines: { edges: [{ node: line }, { node: other }] },
};
const fresh = structuredClone(old);
fresh.lines.edges[0].node.cost = {
  amountPerQuantity: money(3695),
  subtotalAmount: money(7390),
  totalAmount: money(7390),
};
fresh.cost = { subtotalAmount: money(15180), totalAmount: money(15180) };
assert.deepEqual(stalePublicPriceLines(old, reviewed), [
  { id: 'same-line', quantity: 2 },
]);
assert.deepEqual(stalePublicPriceLines(fresh, reviewed), []);
assert.deepEqual(stalePublicPriceLines(null, reviewed), []);
for (const patch of [
  { quantity: 0 },
  { merchandise: { ...line.merchandise, sku: 'wrong' } },
  { merchandise: { ...line.merchandise, id: 'wrong' } },
  { cost: undefined },
  { cost: { subtotalAmount: { amount: '7790', currencyCode: 'CAD' } } },
  { cost: { subtotalAmount: money(7000) } },
]) {
  assert.deepEqual(
    stalePublicPriceLines(
      { lines: { edges: [{ node: { ...line, ...patch } }] } },
      reviewed,
    ),
    [],
  );
}
const temp = mkdtempSync(join(tmpdir(), 'cart-native-refresh-'));
const file = join(temp, 'standalone.mjs');
await build({
  entryPoints: ['functions/api/cart.ts'],
  outfile: file,
  bundle: true,
  platform: 'node',
  format: 'esm',
  tsconfig: resolve('tsconfig.json'),
});
const standalone = await import(pathToFileURL(file));
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
assert.ok(!injected.includes('REVIEWED_PRICE_VARIANTS'));
writeFileSync(join(temp, 'worker.mjs'), injected);
const worker = (await import(pathToFileURL(join(temp, 'worker.mjs')))).default;
const original = globalThis.fetch;
const env = { SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'offline-test' };
let checks = 0;
try {
  for (const [name, handler] of [
    ['standalone', (request) => standalone.onRequestGet({ request, env })],
    ['injected', (request) => worker.fetch(request, env, {})],
  ]) {
    for (const mode of [
      'stale',
      'fresh',
      'unrelated',
      'reject',
      'still-stale',
    ]) {
      const calls = [];
      globalThis.fetch = async (url, options) => {
        const q = JSON.parse(options.body);
        calls.push(q);
        if (q.query.includes('query Cart('))
          return Response.json({
            data: {
              cart:
                mode === 'fresh'
                  ? fresh
                  : mode === 'unrelated'
                    ? { ...old, lines: { edges: [{ node: other }] } }
                    : old,
            },
          });
        assert.ok(q.query.includes('mutation CartReprice('));
        assert.deepEqual(q.variables, {
          cartId: 'same-cart',
          lines: [{ id: 'same-line', quantity: 2 }],
        });
        return Response.json({
          data: {
            cartLinesUpdate:
              mode === 'reject'
                ? { cart: null, userErrors: [{ message: 'native refusal' }] }
                : {
                    cart: mode === 'still-stale' ? old : fresh,
                    userErrors: [],
                  },
          },
        });
      };
      const response = await handler(
        new Request('https://example.test/api/cart?cartId=same-cart'),
      );
      const result = await response.json();
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      if (['reject', 'still-stale'].includes(mode)) {
        assert.equal(response.status, 502);
        assert.ok(result.error);
        assert.equal(result.cart, undefined);
      } else {
        assert.equal(response.status, 200);
        assert.equal(result.cart.id, 'same-cart');
        assert.equal(result.cart.checkoutUrl, old.checkoutUrl);
        assert.equal(calls.length, mode === 'stale' ? 2 : 1);
        if (mode === 'stale') {
          assert.equal(result.cart.cost.subtotalAmount.amount, '15180');
          assert.deepEqual(result.cart.lines[1], other);
          assert.equal(result.cart.lines[0].cost.subtotalAmount.amount, '7390');
        }
      }
      assert.ok(!calls.some((x) => /CartCreate|CartLinesAdd/.test(x.query)));
      checks++;
    }
    console.log(
      `PASS ${name}: native batched refresh, quantity/identity preservation, untouched unrelated line, no fake price/cart recreation, fail-closed native failures`,
    );
  }
} finally {
  globalThis.fetch = original;
}
console.log(`PASS ${checks} runtime scenarios plus pure selection guards`);
