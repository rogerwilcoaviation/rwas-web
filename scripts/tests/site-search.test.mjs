import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

async function loadModule(relativePath) {
  const result = await build({
    entryPoints: [new URL(relativePath, import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    tsconfig: new URL('../../tsconfig.json', import.meta.url).pathname,
  });
  return import(
    'data:text/javascript;base64,' +
      Buffer.from(result.outputFiles[0].text).toString('base64')
  );
}

const [searchModule, indexModule] = await Promise.all([
  loadModule('../../lib/site-search.ts'),
  loadModule('../../lib/site-search-index.generated.ts'),
]);
const index = indexModule.SITE_SEARCH_INDEX;
const expectedProductRoutes = JSON.parse(
  await readFile(
    new URL(
      '../../lib/site-search-product-routes.generated.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const { searchSiteIndex } = searchModule;

test('index contains only public route groups and no price fields', () => {
  const groups = new Set(index.map((entry) => entry.group));
  assert.deepEqual([...groups].sort(), [
    'Articles',
    'Planning tools',
    'Products',
    'Services',
  ]);
  for (const entry of index) {
    assert.match(
      entry.href,
      /^\/(services|products|blog|panel-planner|axis-system-planner|financing)(\/|$)/,
    );
    assert.doesNotMatch(
      entry.href,
      /^\/(admin|private|cart|checkout)(\/|$)|\/draft(\/|$)/i,
    );
    assert.equal('price' in entry, false);
    assert.equal('tags' in entry, false);
    assert.equal('productType' in entry, false);
    assert.doesNotMatch(entry.description, /\$|\b(?:usd|msrp)\b/i);
    if (entry.group === 'Products') {
      assert.equal(entry.href, '/products/' + encodeURIComponent(entry.handle));
      assert.ok(Array.isArray(entry.skus));
      assert.ok(entry.title && entry.description);
      assert.doesNotMatch(
        entry.description,
        /\b(price|pricing|checkout|dealer[- ]only|wholesale|discount|map)\b/i,
      );
    }
  }
  assert.doesNotMatch(
    JSON.stringify(index),
    /priceRange|minVariantPrice|access[_-]?token/i,
  );
});

test('empty and unknown queries have no results', () => {
  assert.deepEqual(searchSiteIndex(index, '   '), []);
  assert.deepEqual(
    searchSiteIndex(index, 'zzzz-no-such-public-result-zzzz'),
    [],
  );
});

test('exact part number ignores hyphen formatting and ranks first', () => {
  for (const query of [
    '233-20003-00',
    '2332000300',
    '233 20003 00',
    '233–20003–00',
  ]) {
    const result = searchSiteIndex(index, query)[0];
    assert.equal(result?.group, 'Products');
    assert.equal(result?.href, '/products/cable-assy-ball-ends-25');
    assert.ok(result.skus.includes('233-20003-00'));
    assert.ok(result.description);
  }
});

test('product routes exactly match the canonical generated public set', () => {
  const actual = index
    .filter((entry) => entry.group === 'Products')
    .map((entry) => entry.href);
  assert.equal(
    new Set(actual).size,
    actual.length,
    'duplicate product search routes',
  );
  assert.equal(
    new Set(expectedProductRoutes).size,
    expectedProductRoutes.length,
    'duplicate canonical product routes',
  );
  const actualSet = new Set(actual);
  const expectedSet = new Set(expectedProductRoutes);
  assert.deepEqual(
    actual.filter((route) => !expectedSet.has(route)),
    [],
    'unexpected product routes',
  );
  assert.deepEqual(
    expectedProductRoutes.filter((route) => !actualSet.has(route)),
    [],
    'missing product routes',
  );
  assert.deepEqual([...actual].sort(), [...expectedProductRoutes].sort());
});

test('required exact SKUs retain distinct public regional products', () => {
  const cable = searchSiteIndex(index, '233-20003-00');
  assert.equal(cable[0]?.href, '/products/cable-assy-ball-ends-25');
  assert.ok(cable[0]?.skus.includes('233-20003-00'));

  for (const query of [
    '010-01518-00',
    '0100151800',
    '010 01518 00',
    '010–01518–00',
  ]) {
    const result = searchSiteIndex(index, query)[0];
    assert.equal(result?.href, '/products/aera-660');
    assert.ok(result?.skus.includes('010-01518-00'));
  }
  assert.ok(
    index.some((entry) => entry.href.includes('aera-660-south-america')),
  );
});

test('service aliases and known one-edit typos resolve deterministically', () => {
  for (const query of ['ultraviolet printing', 'UV pritning'])
    assert.equal(
      searchSiteIndex(index, query)[0]?.href,
      '/services/custom-printing-finishing/uv-printing',
    );
  for (const query of ['powdercoat', 'poweder coating'])
    assert.ok(
      searchSiteIndex(index, query).some(
        (entry) =>
          entry.href === '/services/custom-printing-finishing/powder-coating',
      ),
    );
});

test('AND text matching finds required public coverage', () => {
  assert.equal(
    searchSiteIndex(index, 'Full Panel Planner')[0]?.href,
    '/panel-planner',
  );
  assert.equal(
    searchSiteIndex(index, 'powder coating')[0]?.href,
    '/services/custom-printing-finishing/powder-coating',
  );
  assert.equal(
    searchSiteIndex(index, 'UV printing')[0]?.href,
    '/services/custom-printing-finishing/uv-printing',
  );
  assert.ok(
    searchSiteIndex(index, 'CitationJet Garmin').some(
      (entry) => entry.group === 'Articles',
    ),
  );
  assert.deepEqual(searchSiteIndex(index, 'powder CitationJet'), []);
});

test('custom printing service pages are production-ready public entries', () => {
  const routes = index
    .filter((entry) =>
      entry.href.startsWith('/services/custom-printing-finishing'),
    )
    .map((entry) => entry.href)
    .sort();
  assert.deepEqual(routes, [
    '/services/custom-printing-finishing',
    '/services/custom-printing-finishing/powder-coating',
    '/services/custom-printing-finishing/uv-printing',
  ]);
  assert.ok(index.every((entry) => !Object.hasOwn(entry, 'preview')));
  assert.ok(
    index.every((entry) =>
      (entry.keywords || []).every(
        (keyword) =>
          !['admin', 'dealer-memo', 'draft', 'internal', 'private'].includes(
            keyword.toLowerCase(),
          ),
      ),
    ),
  );
  assert.ok(
    index
      .filter((entry) =>
        entry.href.startsWith('/services/custom-printing-finishing'),
      )
      .every((entry) => !/\bpreview\b/i.test(entry.description)),
  );
});

test('printing service routes are present in the sitemap source', async () => {
  const sitemap = await readFile(
    new URL('../../app/sitemap.ts', import.meta.url),
    'utf8',
  );
  for (const route of [
    'services/custom-printing-finishing',
    'services/custom-printing-finishing/uv-printing',
    'services/custom-printing-finishing/powder-coating',
  ])
    assert.match(sitemap, new RegExp(`['\"]${route}['\"]`));
});

test('search modal exposes clear/status behavior and locks background scroll', async () => {
  const source = await readFile(
    new URL(
      '../../components/shared/broadsheet/SiteSearch.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(source, />\s*Clear search\s*</);
  assert.match(source, /document\.documentElement\.style\.overflow = 'hidden'/);
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(source, /window\.scrollTo\(scrollX, scrollY\)/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
  assert.match(source, /\{' '}\s*found\./);
});
