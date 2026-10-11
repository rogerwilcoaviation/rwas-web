import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const panelSource = new URL(
  '../../app/aircraft-for-sale/clerk-production-panel.tsx',
  import.meta.url,
).pathname;
const browserSource = new URL(
  '../../app/aircraft-for-sale/clerk-production-browser.ts',
  import.meta.url,
).pathname;

const canonicalJwt = [
  'e30',
  Buffer.from(
    JSON.stringify({ azp: 'https://www.rogerwilcoaviation.com' }),
  ).toString('base64url'),
  'fixture-signature',
].join('.');

async function bundleHarness() {
  const dir = await mkdtemp(join(tmpdir(), 'rwas-clerk-panel-lifecycle-'));
  const outfile = join(dir, 'panel.js');
  const harness = [
    'import React, { useState } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import Panel from ' + JSON.stringify(panelSource) + ';',
    'const state = globalThis.__CLERK_LIFECYCLE__;',
    'function Parent() {',
    ' const [version, setVersion] = useState(0);',
    ' const [panelKey, setPanelKey] = useState(0);',
    ' state.rerender = () => setVersion(value => value + 1);',
    ' state.replacePanel = () => setPanelKey(value => value + 1);',
    ' return React.createElement(Panel, { key: panelKey, linkOwner: state.owner, onSignedIn: session => { state.callbacks.push({ version, panelKey, session }); } });',
    '}',
    'const root = createRoot(document.querySelector("#root"));',
    'state.unmountRoot = () => root.unmount();',
    'root.render(React.createElement(Parent));',
  ].join('\n');
  await build({
    stdin: {
      contents: harness,
      resolveDir: process.cwd(),
      sourcefile: 'clerk-production-panel-lifecycle-harness.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'stable-clerk-session-fixture',
        setup(builder) {
          builder.onResolve(
            { filter: /^\.\/clerk-production-browser$/ },
            (args) =>
              args.importer === panelSource
                ? { path: 'fixture', namespace: 'clerk-lifecycle' }
                : null,
          );
          builder.onLoad(
            { filter: /^fixture$/, namespace: 'clerk-lifecycle' },
            () => ({
              loader: 'js',
              resolveDir: process.cwd(),
              contents: [
                'import { ClerkProductionBrowser } from ' +
                  JSON.stringify(browserSource) +
                  ';',
                'const state = globalThis.__CLERK_LIFECYCLE__;',
                'const makeSession = () => ({ id: "sess_panel_fixture", clearCache() {}, async getToken(options) { state.tokenOptions.push(options); return state.canonicalJwt; } });',
                'const clerk = {',
                ' session: state.initialSession ? makeSession() : null,',
                ' user: { id: "user_panel_fixture" },',
                ' addListener(listener) { state.listenerAdds++; state.listener = listener; return () => { state.listenerRemoves++; }; },',
                ' mountSignIn() { state.mounts++; },',
                ' unmountSignIn() { state.unmounts++; },',
                ' mountSignUp() { state.mounts++; },',
                ' unmountSignUp() { state.unmounts++; },',
                ' async signOut() {},',
                '};',
                'const client = new ClerkProductionBrowser(clerk, fetch);',
                'state.completeVerification = () => {',
                ' clerk.session = makeSession();',
                ' state.listener({ session: clerk.session });',
                '};',
                'state.switchIdentity = kind => { if (kind === "session") clerk.session.id = "sess_other"; else clerk.user.id = "user_other"; };',
                'export const clerkProductionFailureTelemetry = error => error?.telemetry || { status: "", serverStage: "" };',
                'export const getClerkProductionBrowser = async () => { if (state.delayBrowser) await new Promise(resolve => { state.releaseBrowser = resolve; }); return client; };',
              ].join('\n'),
            }),
          );
        },
      },
    ],
  });
  return readFile(outfile, 'utf8');
}

test('post-rerender verification keeps one listener and completes the real RWAS handshake', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const calls = [];
    await page.addInitScript(
      ({ token }) => {
        globalThis.__CLERK_LIFECYCLE__ = {
          canonicalJwt: token,
          initialSession: false,
          listenerAdds: 0,
          listenerRemoves: 0,
          mounts: 0,
          unmounts: 0,
          tokenOptions: [],
          callbacks: [],
        };
      },
      { token: canonicalJwt },
    );
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/panel.js')
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: bundle,
        });
      if (url.pathname.startsWith('/api/aircraft-sale/')) {
        const body = request.postData();
        calls.push({
          path: url.pathname,
          method: request.method(),
          headers: request.headers(),
          body: body ? JSON.parse(body) : null,
        });
        if (url.pathname.endsWith('/start'))
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ nonce: 'post-rerender-nonce' }),
          });
        if (url.pathname.endsWith('/finish')) {
          assert.deepEqual(JSON.parse(body), { nonce: 'post-rerender-nonce' });
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              session: 'post-rerender-rwas-session',
              csrf: 'post-rerender-csrf',
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: { email: 'fixture@example.test', name: 'Fixture Seller' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
      });
    });

    await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.listenerAdds === 1,
    );
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'provider-session-absent',
    );
    for (let index = 0; index < 4; index += 1) {
      await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.rerender());
      await page.waitForTimeout(0);
    }
    const before = await page.evaluate(() => ({
      listenerAdds: globalThis.__CLERK_LIFECYCLE__.listenerAdds,
      listenerRemoves: globalThis.__CLERK_LIFECYCLE__.listenerRemoves,
      mounts: globalThis.__CLERK_LIFECYCLE__.mounts,
      unmounts: globalThis.__CLERK_LIFECYCLE__.unmounts,
    }));
    assert.deepEqual(before, {
      listenerAdds: 1,
      listenerRemoves: 0,
      mounts: 1,
      unmounts: 0,
    });

    await page.evaluate(() =>
      globalThis.__CLERK_LIFECYCLE__.completeVerification(),
    );
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.callbacks.length === 1,
    );
    const state = await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__);
    assert.equal(
      await page
        .locator('[data-rwas-clerk-stage]')
        .getAttribute('data-rwas-clerk-stage'),
      'complete',
    );
    assert.equal(state.callbacks[0].version, 4);
    assert.deepEqual(state.callbacks[0].session, {
      provider: 'clerk-production',
      token: 'post-rerender-rwas-session',
      csrf: 'post-rerender-csrf',
      email: 'fixture@example.test',
      name: 'Fixture Seller',
    });
    assert.deepEqual(
      calls.map(({ path, method }) => ({ path, method })),
      [
        {
          path: '/api/aircraft-sale/auth/clerk-production/start',
          method: 'POST',
        },
        {
          path: '/api/aircraft-sale/auth/clerk-production/finish',
          method: 'POST',
        },
        { path: '/api/aircraft-sale/account', method: 'GET' },
      ],
    );
    for (const call of calls)
      assert.equal(call.headers['x-clerk-session-token'], canonicalJwt);
    assert.equal(
      calls[2].headers.authorization,
      'Bearer post-rerender-rwas-session',
    );
    assert.equal(calls[2].headers['x-rwas-csrf'], 'post-rerender-csrf');
    assert.deepEqual(state.tokenOptions, Array(3).fill({ skipCache: true }));

    await page.evaluate(() =>
      globalThis.__CLERK_LIFECYCLE__.completeVerification(),
    );
    await page.waitForTimeout(20);
    assert.equal(
      calls.length,
      3,
      'later provider updates cannot repeat a completed handoff',
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.callbacks.length,
      ),
      1,
    );

    await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.unmountRoot());
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.listenerRemoves === 1,
    );
    const after = await page.evaluate(() => ({
      listenerRemoves: globalThis.__CLERK_LIFECYCLE__.listenerRemoves,
      unmounts: globalThis.__CLERK_LIFECYCLE__.unmounts,
    }));
    assert.deepEqual(after, { listenerRemoves: 1, unmounts: 1 });
  } finally {
    await browser.close();
  }
});

test('a terminal validation failure stays latched through dialog removal and reload', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let releaseStart;
  const startGate = new Promise((resolve) => {
    releaseStart = resolve;
  });
  let starts = 0;
  try {
    const page = await browser.newPage();
    await page.addInitScript(
      ({ token }) => {
        globalThis.__CLERK_LIFECYCLE__ = {
          canonicalJwt: token,
          initialSession: true,
          listenerAdds: 0,
          listenerRemoves: 0,
          mounts: 0,
          unmounts: 0,
          tokenOptions: [],
          callbacks: [],
        };
      },
      { token: canonicalJwt },
    );
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/panel.js')
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: bundle,
        });
      if (url.pathname.endsWith('/auth/clerk-production/start')) {
        starts += 1;
        await startGate;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: { 'X-RWAS-Clerk-Failure-Stage': 'provider-session' },
          body: JSON.stringify({ error: 'redacted' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
      });
    });
    await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.tokenOptions.length === 1,
    );
    releaseStart();
    await page.waitForFunction(() =>
      Boolean(sessionStorage.getItem('rwas-clerk-production-failure-v1')),
    );
    await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.unmountRoot());
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.callbacks.length,
      ),
      0,
    );
    await page.reload();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'failed',
    );
    assert.equal(starts, 1);
    assert.equal(
      await page
        .locator('[data-rwas-clerk-stage]')
        .getAttribute('data-rwas-clerk-failure-status'),
      '401',
    );
    assert.match(
      await page.getByRole('alert').textContent(),
      /Further attempts in this tab are paused/,
    );
    assert.equal(
      await page.getByRole('button', { name: 'Retry secure sign-in' }).count(),
      0,
    );
  } finally {
    releaseStart?.();
    await browser.close();
  }
});

test('existing-session handoff skips SignIn mount and cleans up immediately', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let releaseStart;
  const startGate = new Promise((resolve) => {
    releaseStart = resolve;
  });
  try {
    const page = await browser.newPage();
    const calls = [];
    await page.addInitScript(
      ({ token }) => {
        globalThis.__CLERK_LIFECYCLE__ = {
          canonicalJwt: token,
          initialSession: true,
          listenerAdds: 0,
          listenerRemoves: 0,
          mounts: 0,
          unmounts: 0,
          tokenOptions: [],
          callbacks: [],
        };
      },
      { token: canonicalJwt },
    );
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/panel.js')
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: bundle,
        });
      if (url.pathname.startsWith('/api/aircraft-sale/')) {
        calls.push(url.pathname);
        if (url.pathname.endsWith('/start')) {
          await startGate;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ nonce: 'initial-session-nonce' }),
          });
        }
        if (url.pathname.endsWith('/finish'))
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              session: 'initial-session-rwas-session',
              csrf: 'initial-session-csrf',
            }),
          });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: { email: 'fixture@example.test', name: 'Fixture Seller' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
      });
    });

    await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.tokenOptions.length === 1,
    );
    assert.deepEqual(calls, ['/api/aircraft-sale/auth/clerk-production/start']);
    await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.unmountRoot());
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.listenerRemoves === 1,
    );
    const cleaned = await page.evaluate(() => ({
      listenerAdds: globalThis.__CLERK_LIFECYCLE__.listenerAdds,
      listenerRemoves: globalThis.__CLERK_LIFECYCLE__.listenerRemoves,
      mounts: globalThis.__CLERK_LIFECYCLE__.mounts,
      unmounts: globalThis.__CLERK_LIFECYCLE__.unmounts,
      callbacks: globalThis.__CLERK_LIFECYCLE__.callbacks.length,
    }));
    assert.deepEqual(cleaned, {
      listenerAdds: 1,
      listenerRemoves: 1,
      mounts: 0,
      unmounts: 0,
      callbacks: 0,
    });
    releaseStart();
    await page.waitForTimeout(20);
    assert.deepEqual(calls, ['/api/aircraft-sale/auth/clerk-production/start']);
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.tokenOptions.length,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem('rwas-clerk-production-failure-v1'),
      ),
      null,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.callbacks.length,
      ),
      0,
    );
  } finally {
    releaseStart?.();
    await browser.close();
  }
});

test('first temporary failure preserves its stage and blocks automatic same-mount retries', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let starts = 0;
    await page.addInitScript(
      ({ token }) => {
        globalThis.__CLERK_LIFECYCLE__ = {
          canonicalJwt: token,
          initialSession: false,
          listenerAdds: 0,
          listenerRemoves: 0,
          mounts: 0,
          unmounts: 0,
          tokenOptions: [],
          callbacks: [],
        };
      },
      { token: canonicalJwt },
    );
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/panel.js')
        return route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: bundle,
        });
      if (url.pathname.endsWith('/auth/clerk-production/start')) {
        starts += 1;
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          headers: { 'X-RWAS-Clerk-Failure-Stage': 'provider-session' },
          body: JSON.stringify({ error: 'redacted' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
      });
    });
    await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.listenerAdds === 1,
    );
    await page.evaluate(() =>
      globalThis.__CLERK_LIFECYCLE__.completeVerification(),
    );
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'failed',
    );
    const marker = await page
      .locator('[data-rwas-clerk-stage]')
      .evaluate((element) => ({ ...element.dataset }));
    assert.equal(marker.rwasClerkFailureStage, 'rwas-start-request');
    assert.equal(marker.rwasClerkFailureStatus, '503');
    assert.equal(marker.rwasClerkServerStage, 'provider-session');
    assert.equal(marker.rwasClerkFailureAttempt, '1');
    await page.evaluate(() =>
      globalThis.__CLERK_LIFECYCLE__.completeVerification(),
    );
    await page.waitForTimeout(20);
    assert.equal(starts, 1);
    await page.reload();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'failed',
    );
    const retained = await page
      .locator('[data-rwas-clerk-stage]')
      .evaluate((element) => ({ ...element.dataset }));
    assert.equal(retained.rwasClerkFailureStage, 'rwas-start-request');
    assert.equal(retained.rwasClerkFailureStatus, '503');
    assert.equal(retained.rwasClerkServerStage, 'provider-session');
    assert.equal(retained.rwasClerkFailureAttempt, '1');
    assert.equal(starts, 1);
  } finally {
    await browser.close();
  }
});

const failureKey = 'rwas-clerk-production-failure-v1';
async function retryPage(browser, bundle, respond, options = {}) {
  const page = await browser.newPage();
  await page.addInitScript(
    ({ token, owner }) => {
      globalThis.__CLERK_LIFECYCLE__ = {
        canonicalJwt: token,
        initialSession: true,
        owner,
        listenerAdds: 0,
        listenerRemoves: 0,
        mounts: 0,
        unmounts: 0,
        tokenOptions: [],
        callbacks: [],
      };
    },
    { token: canonicalJwt, owner: options.owner },
  );
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    assert.equal(url.origin, 'https://www.rogerwilcoaviation.com');
    if (url.pathname === '/panel.js')
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: bundle,
      });
    if (url.pathname.startsWith('/api/aircraft-sale/'))
      return respond(route, request, url.pathname);
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
    });
  });
  await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
  return page;
}
const jsonReply = (route, status, body) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
const waitFailed = (page) =>
  page.locator('[data-rwas-clerk-stage="failed"]').waitFor();
const waitComplete = (page) =>
  page.waitForFunction(
    () => globalThis.__CLERK_LIFECYCLE__.callbacks.length === 1,
  );

test('network, 429 and 503 handoff failures allow one explicit fresh transaction through account verification', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const failure of [
      { status: 'network', phase: 'finish' },
      { status: 429, phase: 'finish' },
      { status: 503, phase: 'account' },
    ]) {
      let starts = 0;
      let rejected = false;
      const consumed = new Set();
      const calls = [];
      const page = await retryPage(
        browser,
        bundle,
        async (route, request, path) => {
          const body = request.postDataJSON();
          calls.push({ path, body, headers: request.headers() });
          if (path.endsWith('/start'))
            return jsonReply(route, 200, { nonce: 'fresh-' + ++starts });
          if (path.endsWith('/finish')) {
            assert.equal(
              consumed.has(body.nonce),
              false,
              'finish must never replay a consumed nonce',
            );
            consumed.add(body.nonce);
            if (!rejected && failure.phase === 'finish') {
              rejected = true;
              return failure.status === 'network'
                ? route.abort('failed')
                : jsonReply(route, failure.status, {
                    error: 'temporary outage',
                  });
            }
            return jsonReply(route, 200, {
              session: 'seller-' + body.nonce,
              csrf: 'csrf-' + body.nonce,
            });
          }
          assert.equal(path, '/api/aircraft-sale/account');
          if (!rejected && failure.phase === 'account') {
            rejected = true;
            return jsonReply(route, failure.status, {
              error: 'temporary outage',
            });
          }
          assert.equal(
            request.headers().authorization,
            'Bearer seller-fresh-2',
          );
          assert.equal(request.headers()['x-rwas-csrf'], 'csrf-fresh-2');
          return jsonReply(route, 200, {
            profile: { email: 'fixture@example.test', name: 'Fixture Seller' },
          });
        },
      );
      await waitFailed(page);
      assert.equal(
        await page
          .locator('[data-rwas-clerk-stage]')
          .getAttribute('data-rwas-clerk-failure-status'),
        String(failure.status),
      );
      const beforeRetry = calls.length;
      await page.evaluate(() =>
        globalThis.__CLERK_LIFECYCLE__.completeVerification(),
      );
      await page.waitForTimeout(10);
      assert.equal(
        calls.length,
        beforeRetry,
        'provider updates cannot retry a failed handoff',
      );
      await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
      await waitComplete(page);
      assert.equal(starts, 2);
      assert.deepEqual([...consumed], ['fresh-1', 'fresh-2']);
      const state = await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__);
      assert.equal(state.callbacks[0].session.token, 'seller-fresh-2');
      assert.deepEqual(
        state.tokenOptions,
        Array(calls.length).fill({ skipCache: true }),
      );
      for (const call of calls)
        assert.equal(call.headers['x-clerk-session-token'], canonicalJwt);
      assert.equal(
        await page.evaluate((key) => sessionStorage.getItem(key), failureKey),
        null,
      );
      assert.equal(
        await page
          .getByRole('button', { name: 'Retry secure sign-in' })
          .count(),
        0,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('ordinary retries stop after three attempts and keep the bound limit after reload', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let starts = 0;
  try {
    const page = await retryPage(browser, bundle, (route, request, path) => {
      assert.equal(path, '/api/aircraft-sale/auth/clerk-production/start');
      starts++;
      return jsonReply(route, 503, { error: 'temporary outage' });
    });
    await waitFailed(page);
    for (const count of [2, 3]) {
      await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector('[data-rwas-clerk-stage="failed"]')
            ?.getAttribute('data-rwas-clerk-failure-attempt') ===
          String(expected),
        count,
      );
    }
    assert.equal(starts, 3);
    assert.equal(
      await page.getByRole('button', { name: 'Retry secure sign-in' }).count(),
      0,
    );
    await page.reload();
    await waitFailed(page);
    assert.equal(starts, 3);
    assert.equal(
      await page
        .locator('[data-rwas-clerk-stage]')
        .getAttribute('data-rwas-clerk-failure-attempt'),
      '3',
    );
    assert.match(
      await page.getByRole('alert').textContent(),
      /Further attempts in this tab are paused/,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.callbacks.length,
      ),
      0,
    );
  } finally {
    await browser.close();
  }
});

test('retry requires the same Clerk session and user and never clears a successor failure latch', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const changed of ['session', 'user', 'latch']) {
      let starts = 0;
      const page = await retryPage(browser, bundle, (route) => {
        starts++;
        return jsonReply(route, 503, { error: 'temporary outage' });
      });
      await waitFailed(page);
      const before = await page.evaluate(
        (key) => JSON.parse(sessionStorage.getItem(key)),
        failureKey,
      );
      if (changed === 'latch') {
        await page.evaluate((key) => {
          const value = JSON.parse(sessionStorage.getItem(key));
          value.attemptId = crypto.randomUUID();
          value.status = '403';
          sessionStorage.setItem(key, JSON.stringify(value));
        }, failureKey);
      } else
        await page.evaluate(
          (kind) => globalThis.__CLERK_LIFECYCLE__.switchIdentity(kind),
          changed,
        );
      const expected = await page.evaluate(
        (key) => sessionStorage.getItem(key),
        failureKey,
      );
      await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('button')].some(
            (button) => button.textContent === 'Retry secure sign-in',
          ),
      );
      assert.equal(starts, 1);
      assert.equal(
        await page.evaluate((key) => sessionStorage.getItem(key), failureKey),
        expected,
      );
      assert.equal(before.attemptCount, 1);
      assert.equal(
        await page.evaluate(
          () => globalThis.__CLERK_LIFECYCLE__.callbacks.length,
        ),
        0,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('validation rejections and existing-owner link outages stay terminal without automatic or explicit retry', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [status, owner] of [
      [401],
      [403],
      [409],
      [
        503,
        {
          token: 'existing-owner-proof',
          email: 'fixture@example.test',
          name: 'Fixture Seller',
        },
      ],
    ]) {
      const calls = [];
      const page = await retryPage(
        browser,
        bundle,
        (route, request, path) => {
          calls.push(path);
          assert.equal(path.includes('/link/'), Boolean(owner));
          return jsonReply(route, status, { error: 'rejected' });
        },
        { owner },
      );
      await waitFailed(page);
      assert.equal(
        await page
          .getByRole('button', { name: 'Retry secure sign-in' })
          .count(),
        0,
      );
      await page.evaluate(() =>
        globalThis.__CLERK_LIFECYCLE__.completeVerification(),
      );
      await page.waitForTimeout(10);
      assert.equal(calls.length, 1);
      await page.reload();
      await waitFailed(page);
      assert.equal(calls.length, 1);
      assert.equal(
        await page
          .getByRole('button', { name: 'Retry secure sign-in' })
          .count(),
        0,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('a retry callback waiting on browser loading cannot clear the latch after panel replacement', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let starts = 0;
  try {
    const page = await retryPage(browser, bundle, (route, request, path) => {
      if (path.endsWith('/start')) {
        starts++;
        return starts === 1
          ? jsonReply(route, 503, { error: 'temporary outage' })
          : jsonReply(route, 200, { nonce: 'successor-nonce' });
      }
      if (path.endsWith('/finish'))
        return jsonReply(route, 200, {
          session: 'successor-session',
          csrf: 'successor-csrf',
        });
      return jsonReply(route, 200, {
        profile: { email: 'fixture@example.test', name: 'Fixture Seller' },
      });
    });
    await waitFailed(page);
    const latch = await page.evaluate(
      (key) => sessionStorage.getItem(key),
      failureKey,
    );
    await page.evaluate(() => {
      globalThis.__CLERK_LIFECYCLE__.delayBrowser = true;
    });
    await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
    await page.waitForFunction(
      () => typeof globalThis.__CLERK_LIFECYCLE__.releaseBrowser === 'function',
    );
    await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.replacePanel());
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.listenerRemoves === 1,
    );
    await page.evaluate(() => {
      const state = globalThis.__CLERK_LIFECYCLE__;
      state.delayBrowser = false;
      state.releaseBrowser();
    });
    await page.waitForTimeout(10);
    assert.equal(starts, 1);
    assert.equal(
      await page.evaluate((key) => sessionStorage.getItem(key), failureKey),
      latch,
    );
    await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
    await waitComplete(page);
    assert.equal(starts, 2);
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_LIFECYCLE__.callbacks[0].panelKey,
      ),
      1,
    );
  } finally {
    await browser.close();
  }
});

test('cancelled retry transactions cannot finish or overwrite a succeeding panel handshake', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let release;
  let startedRetry;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const retryStarted = new Promise((resolve) => {
    startedRetry = resolve;
  });
  let starts = 0;
  const finishes = [];
  try {
    const page = await retryPage(
      browser,
      bundle,
      async (route, request, path) => {
        if (path.endsWith('/start')) {
          const number = ++starts;
          if (number === 1)
            return jsonReply(route, 503, { error: 'temporary outage' });
          if (number === 2) {
            startedRetry();
            await gate;
          }
          return jsonReply(route, 200, { nonce: 'nonce-' + number });
        }
        if (path.endsWith('/finish')) {
          const nonce = request.postDataJSON().nonce;
          finishes.push(nonce);
          return jsonReply(route, 200, {
            session: 'session-' + nonce,
            csrf: 'csrf-' + nonce,
          });
        }
        return jsonReply(route, 200, {
          profile: { email: 'fixture@example.test', name: 'Fixture Seller' },
        });
      },
    );
    await waitFailed(page);
    await page.getByRole('button', { name: 'Retry secure sign-in' }).click();
    await retryStarted;
    assert.equal(starts, 2);
    await page.evaluate(() => globalThis.__CLERK_LIFECYCLE__.replacePanel());
    await waitComplete(page);
    assert.equal(starts, 3);
    assert.deepEqual(finishes, ['nonce-3']);
    release();
    await page.waitForTimeout(20);
    assert.deepEqual(finishes, ['nonce-3']);
    assert.equal(
      await page.evaluate((key) => sessionStorage.getItem(key), failureKey),
      null,
    );
    const callbacks = await page.evaluate(
      () => globalThis.__CLERK_LIFECYCLE__.callbacks,
    );
    assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].panelKey, 1);
    assert.equal(callbacks[0].session.token, 'session-nonce-3');
  } finally {
    release?.();
    await browser.close();
  }
});
