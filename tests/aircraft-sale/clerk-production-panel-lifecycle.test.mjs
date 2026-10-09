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
    ' state.rerender = () => setVersion(value => value + 1);',
    ' return React.createElement(Panel, { onSignedIn: session => { state.callbacks.push({ version, session }); } });',
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
                'const makeSession = () => ({ clearCache() {}, async getToken(options) { state.tokenOptions.push(options); return state.canonicalJwt; } });',
                'const clerk = {',
                ' session: state.initialSession ? makeSession() : null,',
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
                'export const getClerkProductionBrowser = async () => client;',
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
    await page.waitForFunction(
      () => globalThis.__CLERK_LIFECYCLE__.tokenOptions.length === 3,
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
