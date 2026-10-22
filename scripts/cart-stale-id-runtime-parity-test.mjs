import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Offline parity: exercise the actual Pages injector and the approved Function.
// Every provider request is replaced with a synthetic response in this process.
const temporary = mkdtempSync(join(tmpdir(), 'cart-stale-id-runtime-parity-'));
const originalFetch = globalThis.fetch;
try {
  const standalonePath = join(temporary, 'standalone.mjs');
  await build({
    entryPoints: ['functions/api/cart.ts'],
    outfile: standalonePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    tsconfig: resolve('tsconfig.json'),
  });
  const standalone = await import(pathToFileURL(standalonePath));
  const workerDirectory = join(temporary, '.vercel/output/static/_worker.js');
  mkdirSync(workerDirectory, { recursive: true });
  writeFileSync(
    join(workerDirectory, 'index.js'),
    'export default {async fetch(t,e,c){return new Response("fallback")}}',
  );
  execFileSync(
    process.execPath,
    [resolve('scripts/inject-cloudflare-collection-redirects.mjs')],
    { cwd: temporary, stdio: 'pipe' },
  );
  const injectedPath = join(temporary, 'injected.mjs');
  writeFileSync(injectedPath, readFileSync(join(workerDirectory, 'index.js')));
  const injected = (await import(pathToFileURL(injectedPath))).default;
  const money = (amount) => ({ amount, currencyCode: 'USD' });
  const merchandise = {
    id: 'synthetic-variant',
    sku: 'SYNTHETIC-OTC',
    title: 'Synthetic product',
    price: money('75.00'),
    product: {
      id: 'synthetic-product',
      title: 'Synthetic product',
      handle: 'synthetic-public-product',
      productType: 'Avionics — Certified',
      tags: ['otc-eligible'],
    },
    selectedOptions: [],
  };
  const cart = {
    id: 'synthetic-replacement-cart',
    checkoutUrl: 'https://checkout.example/synthetic',
    totalQuantity: 1,
    discountCodes: [],
    cost: { subtotalAmount: money('75.00'), totalAmount: money('75.00') },
    lines: {
      pageInfo: { hasNextPage: false },
      edges: [{ node: {
        id: 'synthetic-line',
        quantity: 1,
        cost: {
          amountPerQuantity: money('75.00'),
          subtotalAmount: money('75.00'),
          totalAmount: money('75.00'),
        },
        merchandise,
      } }],
    },
  };
  const missing = 'The specified cart does not exist.';
  const cases = [
    { name: 'expired cart', addErrors: [missing], status: 200,
      operations: ['product', 'add', 'create'] },
    { name: 'case-insensitive missing cart', addErrors: ['THE SPECIFIED CART DOES NOT EXIST.'],
      status: 200, operations: ['product', 'add', 'create'] },
    { name: 'other add error', addErrors: ['Quantity is unavailable.'], status: 400,
      error: 'Quantity is unavailable.', operations: ['product', 'add'] },
    { name: 'replacement error', addErrors: [missing], createErrors: ['Replacement unavailable.'],
      status: 400, error: 'Replacement unavailable.', operations: ['product', 'add', 'create'] },
    { name: 'replacement absent', addErrors: [missing], missingReplacement: true,
      status: 502, error: 'Cart operation failed', operations: ['product', 'add', 'create'] },
    { name: 'active cart', addErrors: [], status: 200, operations: ['product', 'add'] },
    { name: 'new cart', noCartId: true, status: 200, operations: ['product', 'create'] },
    { name: 'restricted merchandise cannot recover', restricted: true, addErrors: [missing],
      // Preserve the existing outer error status in each runtime. Both gates
      // reject before any cart mutation; this patch does not change that path.
      statuses: { standalone: 502, injected: 400 },
      errorPattern: /non-OTC Garmin avionics/, operations: ['product'] },
    { name: 'invalid quantity cannot recover', quantity: 0, addErrors: [missing],
      status: 400, errorPattern: /quantity must be an integer/, operations: [] },
  ];
  let observations = 0;
  for (const scenario of cases) {
    const outcomes = [];
    for (const runtime of ['standalone', 'injected']) {
      const operations = [];
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.method, 'POST');
        const { query, variables } = JSON.parse(options.body);
        if (query.includes('MerchandiseProduct')) {
          operations.push('product');
          return Response.json({ data: { node: {
            id: merchandise.id,
            sku: merchandise.sku,
            product: scenario.restricted
              ? { ...merchandise.product, productType: 'Garmin Dealer Install', tags: ['otc-disabled'] }
              : merchandise.product,
          } } });
        }
        assert.equal(variables.merchandiseId, merchandise.id);
        assert.equal(variables.quantity, 1);
        if (query.includes('cartLinesAdd(')) {
          operations.push('add');
          return Response.json({ data: { cartLinesAdd: {
            cart: scenario.addErrors?.length ? null : structuredClone(cart),
            userErrors: (scenario.addErrors || []).map((message) => ({ message })),
          } } });
        }
        if (query.includes('cartCreate(')) {
          operations.push('create');
          return Response.json({ data: { cartCreate: {
            cart: scenario.missingReplacement ? null : structuredClone(cart),
            userErrors: (scenario.createErrors || []).map((message) => ({ message })),
          } } });
        }
        throw new Error('Unexpected provider operation in offline parity test');
      };
      const request = new Request('https://example.com/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(scenario.noCartId ? {} : { cartId: 'synthetic-old-cart' }),
          merchandiseId: merchandise.id,
          quantity: scenario.quantity ?? 1,
        }),
      });
      const env = { SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'offline-test' };
      const response = runtime === 'standalone'
        ? await standalone.onRequestPost({ request, env })
        : await injected.fetch(request, env, {});
      const payload = await response.json();
      assert.equal(response.status, scenario.statuses?.[runtime] ?? scenario.status,
        scenario.name + ' ' + runtime);
      assert.deepEqual(operations, scenario.operations, scenario.name + ' ' + runtime);
      if (scenario.error) assert.equal(payload.error, scenario.error);
      if (scenario.errorPattern) assert.match(payload.error, scenario.errorPattern);
      if (response.ok) assert.equal(payload.cart.id, cart.id);
      else assert.equal(payload.cart, undefined);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
      outcomes.push({ status: response.status, payload, operations });
      observations++;
    }
    if (scenario.statuses) {
      assert.deepEqual(outcomes[0].operations, outcomes[1].operations,
        scenario.name + ' gate confinement');
    } else assert.deepEqual(outcomes[0], outcomes[1], scenario.name + ' runtime parity');
  }
  console.log(JSON.stringify({ scenarios: cases.length, runtimes: 2, observations,
    missingCartOnlyRecovery: true, eligibilityAndUnrelatedErrorsPreserved: true,
    preexistingEligibilityStatusDifferencePreserved: true, liveProviderRequests: 0 }));
} finally {
  globalThis.fetch = originalFetch;
  rmSync(temporary, { recursive: true, force: true });
}
