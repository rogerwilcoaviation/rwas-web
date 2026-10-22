import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fixture, create, png, fields } from './fixture.mjs';

globalThis.fetch = () =>
  Promise.reject(
    new Error('External service access forbidden in local upload probe.'),
  );

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const componentPath = new URL(
  '../../app/aircraft-for-sale/seller-auth-panel.tsx',
  import.meta.url,
).pathname;
const origin = 'https://seller-media.local.test';
const source = await readFile(componentPath, 'utf8');
const built = await build({
  stdin: {
    contents: `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SellerMedia } from ${JSON.stringify(componentPath)};
const onBusy = () => {};
function Harness() {
 const [listing, setListing] = useState(window.fixtureListing);
 const [open, setOpen] = useState(true);
 window.currentEditingId = listing.id;
 window.closeMedia = () => setOpen(false);
 window.openOtherListing = () => { setListing(window.fixtureOtherListing); setOpen(true); };
 window.replaceListing = () => setListing(window.fixtureOtherListing);
 return open ? React.createElement(SellerMedia, {
  listing, session: window.fixtureSession, onBusy,
  async onChange(stillCurrent = () => true) {
   if (!stillCurrent()) return;
   const response = await fetch('/api/aircraft-sale/my-listings');
   if (!response.ok) throw new Error('Saved media could not be loaded.');
   const data = await response.json();
   if (!stillCurrent()) return;
   setListing(data.listings.find(item => item.id === listing.id));
  }
 }) : null;
}
createRoot(document.querySelector('#root')).render(React.createElement(Harness));`,
    resolveDir: process.cwd(),
    loader: 'tsx',
    sourcefile: 'local-media-probe.tsx',
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
      name: 'local-media-component-only',
      setup(builder) {
        builder.onLoad({ filter: /seller-auth-panel\.tsx$/ }, () => ({
          contents: source + '\nexport { SellerMedia };',
          loader: 'tsx',
          resolveDir: new URL('../../app/aircraft-for-sale/', import.meta.url)
            .pathname,
        }));
        builder.onResolve({ filter: /^\.\/clerk-production-browser$/ }, () => ({
          path: 'unused-provider',
          namespace: 'local-probe',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'local-probe' }, () => ({
          contents: `export function getClerkProductionBrowser() { throw new Error('Provider access forbidden in local media probe'); }
export function configureClerkProductionQaCohort() { return { qaOnly: false, email: null }; }
export function isClerkProductionMethodEnabled() { return false; }
export function clerkProductionFailureTelemetry() { return {}; }
export const CLERK_PRODUCTION_ORIGIN = 'https://www.rogerwilcoaviation.com';`,
          loader: 'js',
        }));
      },
    },
  ],
});
const bundle = built.outputFiles[0].text;
let browser;
test.before(async () => {
  browser = await chromium.launch({ headless: true });
});
test.after(async () => {
  await browser?.close();
});

async function setup(mode) {
  const f = fixture(),
    token = await f.login();
  const listing = await create(f, token);
  const otherListing = await create(f, token, {
    ...fields,
    model: 'Other listing',
  });
  assert.ok(listing?.id, 'ordinary local fixture listing created');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let posts = 0,
    refreshes = 0,
    refreshBlocked = mode === 'unknown-refresh-outage';
  const external = [],
    errors = [],
    uploadIdentities = [];
  let release, accepted, readStarted;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const uploadAccepted = new Promise((resolve) => {
    accepted = resolve;
  });
  const refreshStarted = new Promise((resolve) => {
    readStarted = resolve;
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ unsupportedIdentity }) => {
      window.uploadInvocations = [];
      window.uploadIdentityCount = 0;
      const randomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: unsupportedIdentity
          ? undefined
          : () => {
              window.uploadIdentityCount++;
              return randomUUID();
            },
      });
      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : input.url;
        if (new URL(url, location.href).pathname.endsWith('/upload')) {
          const headers = new Headers(init?.headers);
          window.uploadInvocations.push({
            key: headers.get('Idempotency-Key'),
            generated: window.uploadIdentityCount,
          });
        }
        return originalFetch.call(this, input, init);
      };
    },
    { unsupportedIdentity: mode === 'unsupported-identity' },
  );
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      external.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<main><div id="root"></div></main><script>window.fixtureListing=${JSON.stringify(listing)};window.fixtureOtherListing=${JSON.stringify(otherListing)};window.fixtureSession=${JSON.stringify({ token })};</script><script>${bundle.replaceAll('</script', '<\\/script')}</script>`,
      });
    if (!url.pathname.startsWith('/api/aircraft-sale/')) return route.abort();
    if (url.pathname.endsWith('/my-listings')) {
      refreshes++;
      if (refreshBlocked)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"fixture read outage"}',
        });
    }
    const relative =
      url.pathname.replace('/api/aircraft-sale', '') + url.search;
    const upload = url.pathname.endsWith('/upload');
    if (upload) {
      posts++;
      uploadIdentities.push(request.headers()['idempotency-key']);
    }
    const response = await f.call(
      relative,
      request.method(),
      upload ? new Uint8Array(request.postDataBuffer()) : undefined,
      upload ? undefined : token,
      upload ? request.headers() : {},
    );
    if (upload) accepted();
    if (upload && mode.startsWith('delayed-upload')) {
      await gate;
      if (mode.endsWith('error')) return route.abort('failed');
    }
    if (url.pathname.endsWith('/my-listings') && mode === 'delayed-read') {
      readStarted();
      await gate;
    }
    if (upload && mode.startsWith('unknown')) return route.abort('failed');
    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.goto(origin);
  try {
    await page
      .getByLabel('Add photos', { exact: true })
      .waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      JSON.stringify({
        errors,
        body: await page.locator('body').innerText(),
        external,
      }),
      { cause: error },
    );
  }
  return {
    f,
    page,
    context,
    listing,
    otherListing,
    release,
    uploadAccepted,
    refreshStarted,
    external,
    errors,
    uploadIdentities,
    counters: () => ({ posts, refreshes }),
    unblockRefresh: () => {
      refreshBlocked = false;
    },
  };
}

test('partial batch refreshes the successfully saved file and clears stale upload progress', async () => {
  const s = await setup('partial');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles([
      { name: 'saved.png', mimeType: 'image/png', buffer: Buffer.from(png) },
      {
        name: 'invalid.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not a PNG'),
      },
      {
        name: 'not-sent.png',
        mimeType: 'image/png',
        buffer: Buffer.from(png),
      },
    ]);
    await s.page.getByRole('alert').waitFor();
    assert.equal(
      Object.keys(s.f.state().files).length,
      1,
      'real fixture Worker saved first file',
    );
    await s.page
      .getByRole('group', { name: 'Photos (1)', exact: true })
      .waitFor({ timeout: 2000 });
    assert.equal(
      await s.page.getByRole('status').count(),
      0,
      'no stale Uploading text after failure',
    );
    assert.match(
      await s.page.getByRole('alert').innerText(),
      /refreshed.*check/i,
    );
    assert.equal(
      s.counters().posts,
      2,
      'no automatic mutation retry or dispatch of later files after failure',
    );
    const invocations = await s.page.evaluate(() => window.uploadInvocations);
    assert.equal(
      invocations.length,
      2,
      'one client fetch for each attempted file',
    );
    assert.equal(
      invocations[0].generated,
      3,
      'all identities predate first dispatch',
    );
    assert.notEqual(invocations[0].key, invocations[1].key);
    assert.deepEqual(
      s.uploadIdentities,
      invocations.map(({ key }) => key),
    );
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});

for (const outcome of ['success', 'error']) {
  test(`late upload ${outcome} after closing A cannot restore A or dispatch the rest of its batch`, async () => {
    const s = await setup('delayed-upload-' + outcome);
    try {
      await s.page.getByLabel('Add photos', { exact: true }).setInputFiles([
        { name: 'first.png', mimeType: 'image/png', buffer: Buffer.from(png) },
        {
          name: 'not-sent.png',
          mimeType: 'image/png',
          buffer: Buffer.from(png),
        },
      ]);
      await s.uploadAccepted;
      await s.page.evaluate(() => window.closeMedia());
      await s.page
        .getByLabel('Add photos', { exact: true })
        .waitFor({ state: 'detached' });
      await s.page.evaluate(() => window.openOtherListing());
      await s.page.getByLabel('Add photos', { exact: true }).waitFor();
      s.release();
      await s.page.waitForTimeout(50);
      assert.equal(
        await s.page.evaluate(() => window.currentEditingId),
        s.otherListing.id,
      );
      assert.equal(
        s.counters().posts,
        1,
        'remaining files are not dispatched after editor closes',
      );
      assert.equal(
        s.counters().refreshes,
        0,
        'stale callback does not refresh or change target',
      );
      assert.equal(
        Object.values(s.f.state().files).filter(
          (file) => file.listingId === s.otherListing.id,
        ).length,
        0,
      );
      assert.deepEqual(s.errors, []);
      assert.deepEqual(s.external, []);
    } finally {
      s.release();
      await s.context.close();
    }
  });
}

test('a replaced listing ignores an old upload completion without requiring component unmount', async () => {
  const s = await setup('delayed-upload-success');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'old.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.uploadAccepted;
    await s.page.evaluate(() => window.replaceListing());
    await s.page.waitForFunction(
      (id) => window.currentEditingId === id,
      s.otherListing.id,
    );
    s.release();
    await s.page.waitForTimeout(50);
    assert.equal(
      await s.page.evaluate(() => window.currentEditingId),
      s.otherListing.id,
    );
    assert.equal(s.counters().refreshes, 0);
    assert.equal(
      await s.page.getByLabel('Add photos', { exact: true }).isEnabled(),
      true,
    );
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.external, []);
  } finally {
    s.release();
    await s.context.close();
  }
});

test('a readback already in flight cannot restore a closed editor target', async () => {
  const s = await setup('delayed-read');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'old.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.refreshStarted;
    await s.page.evaluate(() => window.closeMedia());
    await s.page
      .getByLabel('Add photos', { exact: true })
      .waitFor({ state: 'detached' });
    await s.page.evaluate(() => window.openOtherListing());
    await s.page.getByLabel('Add photos', { exact: true }).waitFor();
    s.release();
    await s.page.waitForTimeout(50);
    assert.equal(
      await s.page.evaluate(() => window.currentEditingId),
      s.otherListing.id,
    );
    assert.equal(s.counters().posts, 1);
    assert.equal(s.counters().refreshes, 1);
    const invocations = await s.page.evaluate(() => window.uploadInvocations);
    assert.equal(
      invocations.length,
      1,
      'the application does not repeat a dispatched upload',
    );
    assert.deepEqual(
      s.uploadIdentities,
      invocations.map(({ key }) => key),
    );
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.external, []);
  } finally {
    s.release();
    await s.context.close();
  }
});

test('each selected file has a stable request identity; intentional reselection gets a fresh identity', async () => {
  const s = await setup('success');
  try {
    const first = {
      name: 'same.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    };
    await s.page
      .getByLabel('Add photos', { exact: true })
      .setInputFiles([first, { ...first, name: 'second.png' }]);
    await s.page
      .getByRole('group', { name: 'Photos (2)', exact: true })
      .waitFor();
    const initial = await s.page.evaluate(() => window.uploadInvocations);
    assert.equal(initial.length, 2);
    assert.deepEqual(
      initial.map(({ generated }) => generated),
      [2, 2],
    );
    for (const { key } of initial)
      assert.match(
        key,
        /^rwas-upload-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    assert.notEqual(initial[0].key, initial[1].key);
    assert.deepEqual(
      s.uploadIdentities,
      initial.map(({ key }) => key),
    );

    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles(first);
    await s.page
      .getByRole('group', { name: 'Photos (3)', exact: true })
      .waitFor();
    const all = await s.page.evaluate(() => window.uploadInvocations);
    assert.equal(all.length, 3);
    assert.equal(new Set(all.map(({ key }) => key)).size, 3);
    assert.deepEqual(
      s.uploadIdentities,
      all.map(({ key }) => key),
    );
    assert.equal(
      s.counters().posts,
      3,
      'one fetch per file and per intentional selection',
    );
    assert.equal(
      Object.keys(s.f.state().files).length,
      3,
      'intentional later upload is not content-deduplicated',
    );
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});

test('unsupported secure upload identity fails clearly before dispatching files', async () => {
  const s = await setup('unsupported-identity');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'not-sent.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.page.getByRole('alert').waitFor();
    assert.match(
      await s.page.getByRole('alert').innerText(),
      /cannot securely identify uploads.*current browser/,
    );
    assert.equal(s.counters().posts, 0);
    assert.equal(
      s.counters().refreshes,
      1,
      'only an observational saved-media read is performed',
    );
    assert.deepEqual(await s.page.evaluate(() => window.uploadInvocations), []);
    assert.equal(Object.keys(s.f.state().files).length, 0);
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});

test('lost successful response reconciles saved media without repeating upload', async () => {
  const s = await setup('unknown-response');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'saved-once.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.page.getByRole('alert').waitFor();
    await s.page
      .getByRole('group', { name: 'Photos (1)', exact: true })
      .waitFor({ timeout: 2000 });
    assert.equal(Object.keys(s.f.state().files).length, 1);
    assert.equal(s.counters().posts, 1);
    assert.equal(s.counters().refreshes, 1);
    const invocations = await s.page.evaluate(() => window.uploadInvocations);
    assert.equal(
      invocations.length,
      1,
      'the application never retries uncertain uploads',
    );
    assert.deepEqual(
      s.uploadIdentities,
      invocations.map(({ key }) => key),
    );
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});

test('failed readback blocks further file selection until explicit saved-media refresh succeeds', async () => {
  const s = await setup('unknown-refresh-outage');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'saved.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.page.getByRole('alert').waitFor();
    assert.equal(Object.keys(s.f.state().files).length, 1);
    assert.equal(
      await s.page.getByLabel('Add photos', { exact: true }).isDisabled(),
      true,
    );
    assert.equal(s.counters().posts, 1);
    s.unblockRefresh();
    await s.page
      .getByRole('button', { name: 'Refresh saved media', exact: true })
      .click();
    await s.page
      .getByRole('group', { name: 'Photos (1)', exact: true })
      .waitFor({ timeout: 2000 });
    assert.equal(
      await s.page.getByLabel('Add photos', { exact: true }).isEnabled(),
      true,
    );
    assert.equal(s.counters().posts, 1, 'explicit refresh is GET only');
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});

test('successful upload keeps normal completion behavior and performs one readback', async () => {
  const s = await setup('success');
  try {
    await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
      name: 'normal.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await s.page
      .getByRole('group', { name: 'Photos (1)', exact: true })
      .waitFor({ timeout: 2000 });
    assert.match(
      await s.page.getByRole('status').innerText(),
      /Upload complete/,
    );
    assert.equal(s.counters().posts, 1);
    assert.equal(s.counters().refreshes, 1);
    assert.deepEqual(s.external, []);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.context.close();
  }
});
