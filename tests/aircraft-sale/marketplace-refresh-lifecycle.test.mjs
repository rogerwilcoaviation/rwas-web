import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { create, fixture, submit } from './fixture.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const gridSource = new URL(
  '../../app/aircraft-for-sale/listings-grid.tsx',
  import.meta.url,
).pathname;
const origin = 'http://inventory.local.test';
const legacyOrigin = 'https://sale-api.rogerwilcoaviation.com';
const seller = (id) => ({ id, status: 'pending', make: id });
const legacy = (id) => ({ id, source: 'legacy', make: id });

const bundled = build({
  stdin: {
    contents: [
      'import React, { useState } from "react";',
      'import { createRoot } from "react-dom/client";',
      'import { ListingsGrid } from ' + JSON.stringify(gridSource) + ';',
      'const fixture = globalThis.__INVENTORY_FIXTURE__;',
      'function Harness() {',
      ' const [initial, setInitial] = useState(fixture.initial);',
      ' fixture.replaceInitial = setInitial;',
      ' return React.createElement(ListingsGrid, { initialListings: initial });',
      '}',
      'const root = createRoot(document.querySelector("#root"));',
      'fixture.unmount = () => root.unmount();',
      'root.render(React.createElement(Harness));',
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'marketplace-refresh-lifecycle-harness.ts',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
}).then((result) => result.outputFiles[0].text);

async function harness(t, { initial = [legacy('Legacy')], rows = [seller('Published')] } = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-background-networking'],
  });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const calls = [];
  const blocked = [];
  const state = { rows, legacy: initial, sellerFailure: false, legacyFailure: false };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/grid.js')
      return route.fulfill({ contentType: 'text/javascript', body: await bundled });
    if (url.origin === origin && url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><div id="root"></div><script src="/grid.js"></script>',
      });
    const source = url.origin === legacyOrigin && url.pathname === '/browse'
      ? 'legacy'
      : url.origin === origin && url.pathname === '/api/aircraft-sale/browse'
        ? 'seller'
        : null;
    if (source) {
      calls.push(source);
      return route.fulfill({
        status: state[source + 'Failure'] ? 503 : 200,
        headers: { 'access-control-allow-origin': origin },
        contentType: 'application/json',
        body: JSON.stringify({ listings: source === 'legacy' ? state.legacy : state.rows }),
      });
    }
    blocked.push(url.origin + url.pathname);
    return route.abort('blockedbyclient');
  });
  await page.clock.install({ time: new Date('2026-10-18T00:00:00Z') });
  await page.addInitScript(({ initial }) => {
    const fixture = globalThis.__INVENTORY_FIXTURE__ = {
      initial,
      visibility: 'visible',
      requests: [],
      aborts: [],
    };
    Object.defineProperty(document, 'visibilityState', {
      get: () => globalThis.__INVENTORY_FIXTURE__.visibility,
    });
    const fetchPublic = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, options) => {
      const source = String(input).startsWith('https:') ? 'legacy' : 'seller';
      fixture.requests.push(source);
      options.signal.addEventListener('abort', () => fixture.aborts.push(source));
      const waitForAbort = () => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Fixture aborted', 'AbortError')));
      });
      if (source === 'legacy' && fixture.hangLegacy === 'fetch') return waitForAbort();
      if (source === 'legacy' && fixture.hangLegacy === 'json')
        return { ok: true, json: waitForAbort };
      const response = await fetchPublic(input, options);
      if (source === 'seller' && fixture.holdNextSeller) {
        fixture.holdNextSeller = false;
        const data = await response.json();
        await new Promise((resolve) => { fixture.releaseSeller = resolve; });
        return Response.json(data);
      }
      return response;
    };
  }, { initial });
  await page.goto(origin);
  await page.locator('.a4s-card-title').filter({ hasText: rows[0]?.make || initial[0]?.make }).waitFor();
  await page.waitForFunction(() => document.querySelector('.a4s-grid')?.style.opacity === '1');
  t.after(() => {
    assert.deepEqual(errors, [], 'the real React grid must not throw');
    assert.deepEqual(blocked, [], 'all network requests must use mocked public browse routes');
  });
  const titles = () => page.locator('.a4s-card-title').allTextContents();
  const settle = async () => {
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await page.waitForTimeout(20);
  };
  return { page, state, calls, titles, settle };
}

test('an already-open grid replaces unpublished and expired cards and discovers new publication', async (t) => {
  const { page, state, calls, titles, settle } = await harness(t, {
    rows: [seller('Unpublished'), seller('Expired')],
  });
  assert.deepEqual(await titles(), ['Legacy', 'Unpublished', 'Expired']);
  state.rows = [seller('NewPublication')];
  await page.clock.runFor(30_001);
  await settle();
  assert.deepEqual(await titles(), ['Legacy', 'NewPublication']);
  assert.equal(calls.filter((source) => source === 'seller').length, 2);
});

test('a real expired bounded-publication browse response removes its already-rendered card', async (t) => {
  const f = fixture();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const owner = await f.login();
  const listing = await create(f, owner);
  await submit(f, owner, listing);
  const expiresAt = Date.now() + 120_000;
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({
    listingId: listing.id,
    ownerId: f.state().listings[listing.id].ownerId,
    revision: listing.revision,
    expiresAt,
  });
  assert.equal((await f.call('/admin/review', 'POST', {
    listingId: listing.id,
    revision: listing.revision,
    decision: 'acceptance-approve',
  }, 'fixture-reviewer')).status, 200);
  const publicRows = (await (await f.call('/browse')).json()).listings;
  assert.equal(publicRows[0].id, listing.id);
  const { page, state, titles, settle } = await harness(t, { rows: publicRows });
  const mockedNow = t.mock.method(Date, 'now', () => expiresAt + 1);
  try {
    state.rows = (await (await f.call('/browse')).json()).listings;
    assert.deepEqual(state.rows, []);
    assert.equal((await f.call('/listing/' + listing.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 404);
  } finally {
    mockedNow.mock.restore();
  }
  assert.equal((await titles()).length, 2, 'the previously public card remains until a refresh');
  await page.clock.runFor(30_001);
  await settle();
  assert.deepEqual(await titles(), ['Legacy']);
});

test('hidden tabs skip polling and returning visible or focused refreshes once', async (t) => {
  const { page, state, calls, titles, settle } = await harness(t);
  state.rows = [seller('VisibleReturn')];
  await page.evaluate(() => {
    globalThis.__INVENTORY_FIXTURE__.visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.clock.runFor(90_001);
  await settle();
  assert.equal(calls.filter((source) => source === 'seller').length, 1);
  await page.evaluate(() => {
    globalThis.__INVENTORY_FIXTURE__.visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.locator('.a4s-card-title').filter({ hasText: 'VisibleReturn' }).waitFor();
  assert.deepEqual(await titles(), ['Legacy', 'VisibleReturn']);
  assert.equal(calls.filter((source) => source === 'seller').length, 2);
  state.rows = [seller('FocusedReturn')];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.a4s-card-title').filter({ hasText: 'FocusedReturn' }).waitFor();
  assert.equal(calls.filter((source) => source === 'seller').length, 3);
});

for (const stage of ['fetch', 'json']) {
  test(`a hung legacy ${stage} reaches its deadline and cannot retain a withdrawn seller card`, async (t) => {
    const { page, state, titles, settle } = await harness(t);
    state.rows = [];
    await page.evaluate((stage) => {
      globalThis.__INVENTORY_FIXTURE__.hangLegacy = stage;
      window.dispatchEvent(new Event('focus'));
    }, stage);
    await page.clock.runFor(9_000);
    assert.deepEqual(await titles(), ['Legacy', 'Published']);
    await page.clock.runFor(1_001);
    await settle();
    assert.deepEqual(await titles(), ['Legacy']);
    assert.ok(await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.aborts.includes('legacy')));
    state.rows = [seller('Recovered')];
    await page.evaluate(() => {
      globalThis.__INVENTORY_FIXTURE__.hangLegacy = null;
      window.dispatchEvent(new Event('focus'));
    });
    await page.locator('.a4s-card-title').filter({ hasText: 'Recovered' }).waitFor();
  });
}

test('refresh triggers coalesce and late results from a replaced effect cannot overwrite current inventory', async (t) => {
  const { page, state, titles } = await harness(t);
  state.rows = [seller('Delayed')];
  await page.evaluate(() => {
    globalThis.__INVENTORY_FIXTURE__.holdNextSeller = true;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(() => typeof globalThis.__INVENTORY_FIXTURE__.releaseSeller === 'function');
  await page.evaluate(() => {
    for (let index = 0; index < 10; index += 1) {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  assert.equal(await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.requests.filter((source) => source === 'seller').length), 2);
  state.rows = [seller('Current')];
  await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.replaceInitial([]));
  await page.locator('.a4s-card-title').filter({ hasText: 'Current' }).waitFor();
  await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.releaseSeller());
  await page.waitForTimeout(20);
  assert.deepEqual(await titles(), ['Legacy', 'Current']);
  assert.ok(await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.aborts.includes('seller')));
});

test('unmount aborts its request and removes timers and focus/visibility listeners', async (t) => {
  const { page } = await harness(t);
  await page.evaluate(() => {
    globalThis.__INVENTORY_FIXTURE__.holdNextSeller = true;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(() => typeof globalThis.__INVENTORY_FIXTURE__.releaseSeller === 'function');
  const before = await page.evaluate(() => {
    const fixture = globalThis.__INVENTORY_FIXTURE__;
    fixture.unmount();
    fixture.releaseSeller();
    return fixture.requests.length;
  });
  await page.clock.runFor(90_001);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(20);
  assert.equal(await page.locator('#root').textContent(), '');
  assert.equal(await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.requests.length), before);
  assert.ok(await page.evaluate(() => globalThis.__INVENTORY_FIXTURE__.aborts.includes('seller')));
});

test('later source failures cannot restore removed legacy or seller snapshots', async (t) => {
  const { page, state, settle } = await harness(t);
  state.legacy = [];
  state.rows = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.a4s-empty').waitFor();
  state.legacyFailure = true;
  state.sellerFailure = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await settle();
  assert.equal(await page.locator('.a4s-card').count(), 0);
  assert.match(await page.locator('.a4s-empty').textContent(), /No aircraft are listed/);
});
