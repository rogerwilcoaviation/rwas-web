import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test, { after } from 'node:test';
import {
  LEGACY_AIRCRAFT_API,
  PUBLIC_SELLER_AIRCRAFT_API,
  marketplaceInitialListings,
  refreshPublicMarketplaceListings,
} from '../../lib/public-aircraft-marketplace.mjs';
const root = new URL('../../', import.meta.url).pathname;
const temporary = await mkdtemp(join(root, '.replacement-catalog-test-'));
after(() => rm(temporary, { recursive: true, force: true }));
const legacy = {
  id: 'placeholder-old',
  source: 'legacy',
  make: 'Old Placeholder',
  status: 'active',
  year: 1970,
  model: 'Fixture',
};
const approved = {
  id: 'new-approved',
  make: 'Approved New Aircraft',
  status: 'active',
  year: 2026,
  model: 'Fixture',
  photos: [],
};

const response = (listings) => Response.json({ listings });
test('actual Next configuration defaults Git builds to the seller catalogue and retains explicit baseline mode', () => {
  const flag = 'NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG';
  const previous = process.env[flag];
  const configure = createRequire(import.meta.url)('../../next.config.js');
  try {
    delete process.env[flag];
    assert.equal(configure().env[flag], 'true');
    process.env[flag] = 'false';
    assert.equal(configure().env[flag], 'false');
    process.env[flag] = 'true';
    assert.equal(configure().env[flag], 'true');
  } finally {
    if (previous === undefined) delete process.env[flag];
    else process.env[flag] = previous;
  }
});
test('replacement browse excludes old fallback and performs no legacy fetch', async () => {
  const calls = [];
  const listings = await refreshPublicMarketplaceListings(
    async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, 'omit');
      assert.equal(url, PUBLIC_SELLER_AIRCRAFT_API + '/browse?include=sold');
      return response([
        approved,
        { ...approved, id: 'draft', status: 'draft' },
      ]);
    },
    [legacy],
    true,
  );
  assert.deepEqual(calls, [
    PUBLIC_SELLER_AIRCRAFT_API + '/browse?include=sold',
  ]);
  assert.deepEqual(
    listings.map((item) => item.id),
    ['new-approved'],
  );
  assert.deepEqual(marketplaceInitialListings([legacy], true), []);
  const failed = await refreshPublicMarketplaceListings(
    async () => new Response('', { status: 503 }),
    [legacy],
    true,
  );
  assert.deepEqual(failed, []);
});
test('baseline mode retains both public feeds and legacy outage fallback', async () => {
  const calls = [];
  const listings = await refreshPublicMarketplaceListings(
    async (url) => {
      calls.push(url);
      return url.startsWith(LEGACY_AIRCRAFT_API)
        ? response([legacy])
        : response([approved]);
    },
    [legacy],
    false,
  );
  assert.equal(calls.length, 2);
  assert.equal(
    calls.some((url) => url.startsWith(LEGACY_AIRCRAFT_API)),
    true,
  );
  assert.deepEqual(
    listings.map((item) => item.source),
    ['legacy', 'seller'],
  );
  assert.deepEqual(marketplaceInitialListings([legacy], false), [legacy]);
});

async function serverModules(flag) {
  const exports = join(temporary, 'server-' + flag + '.mjs');
  const page = join(root, 'app/aircraft-for-sale/page.tsx');
  const detail = join(root, 'app/aircraft-for-sale/[id]/page.tsx');
  await build({
    stdin: {
      contents: `export { default as Page } from ${JSON.stringify(page)}; export { default as Detail, generateMetadata, generateStaticParams } from ${JSON.stringify(detail)}; export {renderToStaticMarkup} from 'react-dom/server';`,
      resolveDir: root,
      loader: 'ts',
    },
    outfile: exports,
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    define: {
      'process.env.NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG':
        JSON.stringify(flag),
    },
    plugins: [
      {
        name: 'static-only-chrome',
        setup(builder) {
          builder.onResolve(
            { filter: /^@\/components\/shared\/broadsheet$/ },
            () => ({ path: 'chrome', namespace: 'fixture' }),
          );
          builder.onResolve({ filter: /seller-auth-panel-loader$/ }, () => ({
            path: 'auth',
            namespace: 'fixture',
          }));
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: 'navigation',
            namespace: 'fixture',
          }));
          builder.onResolve({ filter: /photo-carousel$/ }, () => ({
            path: 'carousel',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            loader: 'js',
            resolveDir: root,
            contents:
              args.path === 'navigation'
                ? 'export function notFound(){throw new Error("FIXTURE_NOT_FOUND")}'
                : args.path === 'auth'
                  ? 'export default function Auth(){return null}'
                  : args.path === 'carousel'
                    ? 'export function PhotoCarousel(){return null}'
                    : 'import React from "react"; const Box=({children})=>React.createElement("div",null,children); export const BroadsheetLayout=Box,Dateline=Box,Masthead=Box,BroadsheetNav=Box,CredentialsBar=Box,BulletinBar=Box,BroadsheetFooter=Box,Specimen=Box;',
          }));
        },
      },
    ],
  });
  return import(pathToFileURL(exports).href);
}
test('actual compiled replacement pages have empty SEO and only a reserved not-found export parameter', async () => {
  const modules = await serverModules('true');
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    throw new Error('No build-time catalog request should occur.');
  };
  try {
    const html = modules.renderToStaticMarkup(await modules.Page());
    const json = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(json.numberOfItems, 0);
    assert.deepEqual(json.itemListElement, []);
    assert.equal(html.includes('Old Placeholder'), false);
    const parameters = await modules.generateStaticParams();
    assert.deepEqual(parameters, [{ id: '__rwas-empty-catalog__' }]);
    // A nonempty export parameter satisfies Next's static exporter without
    // publishing an aircraft. Both it and old inventory remain not-found.
    for (const id of [parameters[0].id, legacy.id]) {
      assert.deepEqual(
        (await modules.generateMetadata({ params: Promise.resolve({ id }) }))
          .robots,
        { index: false, follow: false },
      );
      await assert.rejects(
        modules.Detail({ params: Promise.resolve({ id }) }),
        /FIXTURE_NOT_FOUND/,
      );
    }
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = original;
  }
});
test('actual compiled baseline still exports its existing listing and metadata', async () => {
  const modules = await serverModules('false');
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return String(url).includes('/listing/')
      ? Response.json({ listing: legacy })
      : response([legacy]);
  };
  try {
    const html = modules.renderToStaticMarkup(await modules.Page());
    const json = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(json.numberOfItems, 1);
    assert.equal(html.includes('Old Placeholder'), true);
    assert.deepEqual(await modules.generateStaticParams(), [{ id: legacy.id }]);
    const metadata = await modules.generateMetadata({
      params: Promise.resolve({ id: legacy.id }),
    });
    assert.equal(metadata.title.absolute.includes('Old Placeholder'), true);
    assert.ok(
      calls.every((url) => String(url).startsWith(LEGACY_AIRCRAFT_API)),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('compiled replacement grid never paints placeholder props and shows newly approved seller inventory', async () => {
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE ||
      '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
  );
  const target = join(temporary, 'client.js');
  await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ListingsGrid} from ${JSON.stringify(join(root, 'app/aircraft-for-sale/listings-grid.tsx'))}; createRoot(document.getElementById('root')).render(React.createElement(ListingsGrid,{initialListings:${JSON.stringify([legacy])}}));`,
      loader: 'tsx',
      resolveDir: root,
    },
    outfile: target,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_SELLER_REPLACE_LEGACY_CATALOG': '"true"',
    },
  });
  const bundle = await readFile(target, 'utf8');
  const browser = await chromium.launch({ headless: true });
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const calls = [];
  try {
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      calls.push(url.href);
      assert.equal(
        url.origin,
        'https://catalog.example.test',
        'No legacy or external request is allowed.',
      );
      if (url.pathname === '/client.js')
        return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (url.pathname === '/browse')
        return route.fulfill({
          contentType: 'text/html',
          body: '<div id="root"></div><script src="/client.js"></script>',
        });
      assert.equal(url.pathname, PUBLIC_SELLER_AIRCRAFT_API + '/browse');
      await ready;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ listings: [approved] }),
      });
    });
    await page.goto('https://catalog.example.test/browse', {
      waitUntil: 'domcontentloaded',
    });
    await page
      .getByText('No listings are available right now.', { exact: false })
      .waitFor();
    assert.equal(
      await page.getByText('Old Placeholder', { exact: false }).count(),
      0,
    );
    release();
    const card = page
      .getByRole('link')
      .filter({ hasText: 'Approved New Aircraft' });
    await card.waitFor();
    assert.equal(
      await card.getAttribute('href'),
      PUBLIC_SELLER_AIRCRAFT_API + '/listing/new-approved',
    );
    assert.equal(
      calls.some((url) => url.startsWith(LEGACY_AIRCRAFT_API)),
      false,
    );
  } finally {
    release();
    await browser.close();
  }
});
