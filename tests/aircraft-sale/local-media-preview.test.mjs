import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fixture, create, fields } from './fixture.mjs';

globalThis.fetch = () =>
  Promise.reject(
    new Error('External service access forbidden in media preview fixture.'),
  );
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const componentPath = new URL(
  '../../app/aircraft-for-sale/seller-auth-panel.tsx',
  import.meta.url,
).pathname;
const source = await readFile(componentPath, 'utf8');
const png = await readFile(
  new URL('./media-fixtures/synthetic.png', import.meta.url),
);
const origin = 'https://seller-preview.local.test';
const bundle = (
  await build({
    stdin: {
      contents: `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SellerMedia } from ${JSON.stringify(componentPath)};
const onBusy = () => {};
function Harness() {
 const [listing, setListing] = useState(window.fixtureListing);
 const [open, setOpen] = useState(true);
 window.closeMedia = () => setOpen(false);
 window.replaceListing = () => setListing(window.fixtureOtherListing);
 return open ? React.createElement(SellerMedia, {
  listing, session: window.fixtureSession, onBusy,
  async onChange(stillCurrent) {
   if (!stillCurrent()) return;
   const r = await fetch('/api/aircraft-sale/my-listings');
   if (!r.ok) throw new Error('Saved media could not be loaded.');
   const data = await r.json();
   if (stillCurrent()) setListing(data.listings.find(item => item.id === listing.id));
  }
 }) : null;
}
createRoot(document.querySelector('#root')).render(React.createElement(Harness));`,
      resolveDir: process.cwd(),
      sourcefile: 'local-media-preview-harness.tsx',
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION': '"false"',
    },
    plugins: [
      {
        name: 'local-preview-component-only',
        setup(builder) {
          builder.onLoad({ filter: /seller-auth-panel\.tsx$/ }, () => ({
            contents: source + '\nexport { SellerMedia };',
            loader: 'tsx',
            resolveDir: new URL('../../app/aircraft-for-sale/', import.meta.url)
              .pathname,
          }));
          builder.onResolve(
            { filter: /^\.\/clerk-production-browser$/ },
            () => ({ path: 'unused-provider', namespace: 'local-preview' }),
          );
          builder.onLoad({ filter: /.*/, namespace: 'local-preview' }, () => ({
            contents: `export function getClerkProductionBrowser() { throw new Error('Provider forbidden'); }
export function configureClerkProductionQaCohort() { return { qaOnly: false, email: null }; }
export function isClerkProductionMethodEnabled() { return false; }
export function clerkProductionFailureTelemetry() { return {}; }
export const CLERK_PRODUCTION_ORIGIN = 'https://www.rogerwilcoaviation.com';`,
            loader: 'js',
          }));
        },
      },
    ],
  })
).outputFiles[0].text;
let browser;
test.before(async () => {
  browser = await chromium.launch({ headless: true });
});
test.after(async () => {
  await browser?.close();
});

async function setup(mode, failureStatus = 503) {
  const f = fixture();
  const token = await f.login('preview-owner@example.test');
  const listing = await create(f, token, { ...fields, model: 'Preview A' });
  const other = await create(f, token, { ...fields, model: 'Preview B' });
  const add = async (name) => {
    const r = await f.call(
      '/upload?listingId=' + listing.id + '&category=photos&filename=' + name,
      'POST',
      new Uint8Array(png),
      token,
    );
    assert.equal(r.status, 200);
    return (await r.json()).file;
  };
  const failed = await add('failed-preview.png');
  if (mode === 'http') await add('working-preview.png');
  const hydrated = (
    await (await f.call('/my-listings', 'GET', undefined, token)).json()
  ).listings.find((x) => x.id === listing.id);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const errors = [],
    external = [],
    uploadIdentities = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalBlob = Response.prototype.blob;
    window.previewMetrics = {
      settled: 0,
      failed: 0,
      bodySettled: 0,
      created: [],
      revoked: [],
    };
    window.fetch = async (...args) => {
      const input = args[0];
      const preview = String(
        input instanceof Request ? input.url : input,
      ).includes('/files/');
      try {
        return await originalFetch(...args);
      } catch (error) {
        if (preview) window.previewMetrics.failed++;
        throw error;
      } finally {
        if (preview) window.previewMetrics.settled++;
      }
    };
    Response.prototype.blob = async function () {
      try {
        return await originalBlob.call(this);
      } finally {
        window.previewMetrics.bodySettled++;
      }
    };
    URL.createObjectURL = (...args) => {
      const url = originalCreate(...args);
      window.previewMetrics.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      window.previewMetrics.revoked.push(url);
      return originalRevoke(url);
    };
  });
  let release, started;
  const gate = new Promise((done) => {
    release = done;
  });
  const previewStarted = new Promise((done) => {
    started = done;
  });
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      external.push(url.origin + url.pathname);
      return route.abort();
    }
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<div id="root"></div><script>window.fixtureListing=${JSON.stringify(hydrated)};window.fixtureOtherListing=${JSON.stringify(other)};window.fixtureSession=${JSON.stringify({ token })};</script><script>${bundle.replaceAll('</script', '<\\/script')}</script>`,
      });
    if (!url.pathname.startsWith('/api/aircraft-sale/')) return route.abort();
    const relative =
      url.pathname.replace('/api/aircraft-sale', '') + url.search;
    if (url.pathname.endsWith('/files/' + encodeURIComponent(failed.key))) {
      started();
      if (mode !== 'http') await gate;
      if (mode === 'deferred-network') return route.abort('failed');
      if (mode === 'http')
        return route.fulfill({
          status: failureStatus,
          contentType: 'application/json',
          body: '{"error":"Synthetic preview unavailable"}',
        });
    }
    const upload = url.pathname.endsWith('/upload');
    if (upload) uploadIdentities.push(request.headers()['idempotency-key']);
    const r = await f.call(
      relative,
      request.method(),
      request.postDataBuffer()
        ? new Uint8Array(request.postDataBuffer())
        : undefined,
      upload ? undefined : token,
      upload ? request.headers() : {},
    );
    return route.fulfill({
      status: r.status,
      headers: Object.fromEntries(r.headers),
      body: Buffer.from(await r.arrayBuffer()),
    });
  });
  await page.goto(origin);
  await page.getByLabel('Add photos', { exact: true }).waitFor();
  return {
    page,
    context,
    f,
    token,
    listing,
    other,
    errors,
    external,
    uploadIdentities,
    release,
    previewStarted,
  };
}

for (const status of [503, 403]) {
  test(`HTTP${status} preview failure is explained, preserves working previews and upload outcome warning`, async () => {
    const s = await setup('http', status);
    try {
      await s.page
        .getByRole('alert')
        .filter({ hasText: 'could not be previewed' })
        .waitFor();
      await s.page.waitForFunction(() => {
        const img = document.querySelector('img[alt="working-preview.png"]');
        return img?.complete && img.naturalWidth === 1;
      });
      await s.page.getByLabel('Add photos', { exact: true }).setInputFiles([
        { name: 'saved-upload.png', mimeType: 'image/png', buffer: png },
        {
          name: 'invalid.png',
          mimeType: 'image/png',
          buffer: Buffer.from('not an image'),
        },
      ]);
      await s.page
        .getByRole('group', { name: 'Photos (3)', exact: true })
        .waitFor();
      await s.page
        .getByRole('alert')
        .filter({ hasText: 'Use a valid JPG' })
        .waitFor();
      await s.page
        .getByRole('alert')
        .filter({ hasText: 'could not be previewed' })
        .waitFor();
      assert.match(
        await s.page
          .getByRole('alert')
          .filter({ hasText: 'Use a valid JPG' })
          .innerText(),
        /Saved media refreshed/,
      );
      assert.equal(s.uploadIdentities.length, 2);
      assert.equal(new Set(s.uploadIdentities).size, 2);
      for (const key of s.uploadIdentities)
        assert.match(
          key,
          /^rwas-upload-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      assert.deepEqual(s.errors, []);
      assert.deepEqual(s.external, []);
    } finally {
      s.release();
      await s.context.close();
    }
  });
}

test('a stale network preview failure cannot put its alert in the replacement editor', async () => {
  const s = await setup('deferred-network');
  try {
    await s.previewStarted;
    await s.page.evaluate(() => window.replaceListing());
    await s.page
      .getByRole('group', { name: 'Photos (0)', exact: true })
      .waitFor();
    s.release();
    await s.page.waitForFunction(() => window.previewMetrics.failed === 1);
    assert.deepEqual(await s.page.getByRole('alert').allTextContents(), []);
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.external, []);
  } finally {
    s.release();
    await s.context.close();
  }
});

test('preview completion after unmount creates no unreleased object URL', async () => {
  const s = await setup('deferred-success');
  try {
    await s.previewStarted;
    await s.page.evaluate(() => window.closeMedia());
    await s.page
      .getByLabel('Add photos', { exact: true })
      .waitFor({ state: 'detached' });
    s.release();
    await s.page.waitForFunction(
      () =>
        window.previewMetrics.bodySettled + window.previewMetrics.failed === 1,
    );
    const metrics = await s.page.evaluate(() => window.previewMetrics);
    assert.equal(metrics.created.length, 0);
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.external, []);
  } finally {
    s.release();
    await s.context.close();
  }
});
