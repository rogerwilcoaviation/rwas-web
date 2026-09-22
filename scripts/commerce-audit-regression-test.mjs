import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const temp = await mkdtemp(path.join(tmpdir(), 'commerce-regression-'));
await build({
  entryPoints: ['lib/part-search.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(temp, 'search.mjs'),
});
const { matchesPartSearch, normalizePartText } = await import(
  pathToFileURL(path.join(temp, 'search.mjs'))
);
const match = (query, sku, title = 'Garmin component') =>
  matchesPartSearch({
    query,
    skus: [sku],
    haystack: normalizePartText(`${title} ${sku}`),
  });
assert.ok(match('0100254421', '010-02544-21'));
assert.ok(match('010-02544-21', '010-02544-21'));
assert.ok(match('010 02544 21', '010-02544-21'));
assert.ok(!match('0100254422', '010-02544-21'));
assert.ok(!match('1234', '12/34'));
assert.ok(!match('AB12', 'AB.12'));
assert.ok(match('Garmin component', '010-02544-21'));
assert.ok(match('GDU 460', '010-00000-00', 'Garmin GDU 460 display'));
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'offline-fixture';
await build({
  entryPoints: ['lib/shopify.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(temp, 'shopify.mjs'),
});
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (_url, init) => {
  const { variables, query } = JSON.parse(init.body);
  assert.match(query, /query PartFinderProducts/);
  assert.equal(variables.first, 250);
  const start = calls++ * 250;
  const count = start === 2000 ? 87 : 250;
  const edges = Array.from({ length: count }, (_, n) => ({
    node: {
      id: `p${start + n}`,
      title:
        start + n === 7 ? 'GMC 605 installer only' : `Component ${start + n}`,
      handle:
        start + n === 2086
          ? 'yoke-mount-aera-5xx-series'
          : `component-${start + n}`,
      vendor: 'Garmin',
      productType: 'Accessories',
      variants: {
        edges: [
          {
            node: {
              sku: start + n === 2086 ? '010-11385-00' : `SKU-${start + n}`,
            },
          },
        ],
      },
    },
  }));
  return new Response(
    JSON.stringify({
      data: {
        products: {
          edges,
          pageInfo: {
            hasNextPage: start < 2000,
            endCursor: start < 2000 ? String(start + 250) : null,
          },
        },
      },
    }),
    { status: 200 },
  );
};
try {
  const { getPartFinderProducts } = await import(
    pathToFileURL(path.join(temp, 'shopify.mjs'))
  );
  const products = await getPartFinderProducts();
  assert.equal(products.length, 2086);
  assert.ok(!products.some((p) => p.title.includes('GMC 605')));
  assert.equal(calls, 9);
  assert.ok(
    products.some((p) => p.variants.some((v) => v.sku === '010-11385-00')),
  );
} finally {
  globalThis.fetch = originalFetch;
}
const page = await readFile('app/collections/[handle]/page.tsx', 'utf8');
assert.ok(page.includes('initialProducts={browserProducts.slice(0, 24)}'));
assert.ok(page.includes('Complete product index'));
assert.ok(page.includes('.map((product) => ('));
const articles = JSON.parse(
  await readFile('public/blog-articles.json', 'utf8'),
);
const archived = articles.articles.find(
  (x) =>
    x.id === 'garmin-pilot-promotion-adds-value-for-new-subscribers-20260408',
);
assert.ok(archived.lead.startsWith('Historical promotion notice'));
console.log(
  JSON.stringify({
    searchFixtures: 8,
    paginationPages: calls,
    eligibleFixtures: 2086,
    tailSkuFound: true,
    catalogFirstPage: 24,
    completeCrawlableIndexRetained: true,
    businessWrites: 0,
  }),
);
