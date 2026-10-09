import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const source = new URL(
  '../../app/aircraft-for-sale/clerk-production-browser.ts',
  import.meta.url,
).pathname;
const uiSource = new URL(
  '../../app/aircraft-for-sale/clerk-production-ui.ts',
  import.meta.url,
).pathname;
const output = '/tmp/rwas-clerk-production-browser-test.js';
const harness = [
  'import { CLERK_PRODUCTION_HOST, CLERK_PRODUCTION_PUBLISHABLE_KEY, clerkProductionFailureTelemetry, getClerkProductionBrowser, isClerkProductionMethodEnabled } from ' +
    JSON.stringify(source) +
    ';',
  'import { CLERK_PRODUCTION_UI_URL, CLERK_PRODUCTION_UI_VERSION } from ' +
    JSON.stringify(uiSource) +
    ';',
  'const results = {};',
  'try {',
  ' await getClerkProductionBrowser();',
  ' results.officialLoaded = true;',
  ' results.officialUiInitializations = globalThis.__OFFICIAL_UI_INITIALIZATIONS__ || 0;',
  ' results.officialUiVersion = globalThis.__internal_ClerkUICtor?.version;',
  " const jwt = (azp) => ['e30', btoa(JSON.stringify({ azp })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''), 'signature'].join('.');",
  ' class ClerkMock {',
  "  constructor(key) { results.key = key; const tokens = [jwt('https://accounts.rogerwilcoaviation.com'), jwt('https://www.rogerwilcoaviation.com')]; this.session = { clearCache: () => { results.cacheClears = (results.cacheClears || 0) + 1; }, getToken: async (options) => { (results.tokenOptions ||= []).push(options); return tokens.shift() || jwt('https://www.rogerwilcoaviation.com'); } }; }",
  '  async load(options) { results.mockLoaded = true; results.mockReceivedUi = Boolean(options?.ui); }',
  "  mountSignIn(element, options) { results.signInOptions = options; element.dataset.clerkMounted = 'sign-in'; }",
  "  mountSignUp(element, options) { results.signUpOptions = options; element.dataset.clerkMounted = 'sign-up'; }",
  '  unmountSignIn() { results.signInUnmounted = true; }',
  '  unmountSignUp() { results.signUpUnmounted = true; }',
  '  addListener() { return () => {}; }',
  '  async signOut() { results.signedOut = true; }',
  ' }',
  ' const client = await getClerkProductionBrowser({ ClerkConstructor: ClerkMock });',
  " const mount = document.querySelector('#mount');",
  " const unmountSignIn = client.mountAuthentication(mount, '');",
  ' unmountSignIn();',
  " const unmountSignUp = client.mountAuthentication(mount, '?seller-auth=sign-up');",
  ' unmountSignUp();',
  ' results.handoffStages = []; results.session = await client.connect(stage => results.handoffStages.push(stage));',
  ' class WrongOriginClerk extends ClerkMock {',
  "  constructor(key) { super(key); this.session = { clearCache: () => { results.wrongOriginCacheClears = (results.wrongOriginCacheClears || 0) + 1; }, getToken: async () => { results.wrongOriginTokenCalls = (results.wrongOriginTokenCalls || 0) + 1; return jwt('https://accounts.rogerwilcoaviation.com'); } }; }",
  ' }',
  ' const wrongOriginClient = await getClerkProductionBrowser({ ClerkConstructor: WrongOriginClerk });',
  ' try { await wrongOriginClient.connect(); results.wrongOriginRejected = false; } catch { results.wrongOriginRejected = true; }',
  ' class DiagnosticClerk extends ClerkMock { constructor(key) { super(key); this.session = { clearCache: () => {}, getToken: async () => jwt("https://www.rogerwilcoaviation.com") }; } }',
  ' const diagnosticClient = await getClerkProductionBrowser({ ClerkConstructor: DiagnosticClerk, fetch: async () => new Response(JSON.stringify({ error: "redacted" }), { status: 401, headers: { "Content-Type": "application/json", "X-RWAS-Clerk-Failure-Stage": "jwt-claims" } }) });',
  ' try { await diagnosticClient.connect(); } catch (error) { results.failureTelemetry = clerkProductionFailureTelemetry(error); }',
  ' const untrustedDiagnosticClient = await getClerkProductionBrowser({ ClerkConstructor: DiagnosticClerk, fetch: async () => new Response("not-json", { status: 418, headers: { "X-RWAS-Clerk-Failure-Stage": "injected-value" } }) });',
  ' try { await untrustedDiagnosticClient.connect(); } catch (error) { results.untrustedFailureTelemetry = clerkProductionFailureTelemetry(error); }',
  " results.methodOff = isClerkProductionMethodEnabled({ methods: ['clerk-production'] }, false);",
  " results.methodOn = isClerkProductionMethodEnabled({ methods: ['clerk-production'] }, true);",
  ' results.host = CLERK_PRODUCTION_HOST;',
  ' results.expectedKey = CLERK_PRODUCTION_PUBLISHABLE_KEY;',
  ' results.uiUrl = CLERK_PRODUCTION_UI_URL;',
  ' results.uiVersion = CLERK_PRODUCTION_UI_VERSION;',
  " document.body.dataset.result = 'pass';",
  "} catch (error) { results.error = error.message; document.body.dataset.result = 'refused'; }",
  'globalThis.__RESULTS__ = results;',
].join(String.fromCharCode(10));
await build({
  stdin: {
    contents: harness,
    resolveDir: process.cwd(),
    sourcefile: 'clerk-production-browser-harness.ts',
    loader: 'ts',
  },
  outfile: output,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
const bundle = await readFile(output, 'utf8');
const parentOutput = '/tmp/rwas-clerk-production-parent-test.js';
await build({
  stdin: {
    contents:
      'import React from "react"; import { createRoot } from "react-dom/client"; import Seller from ' +
      JSON.stringify(
        new URL(
          '../../app/aircraft-for-sale/seller-auth-panel.tsx',
          import.meta.url,
        ).pathname,
      ) +
      '; createRoot(document.querySelector("#root")).render(React.createElement(Seller));',
    resolveDir: process.cwd(),
    sourcefile: 'clerk-production-parent-harness.ts',
    loader: 'ts',
  },
  outfile: parentOutput,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'mock-clerk-parent-boundary',
      setup(builder) {
        builder.onResolve({ filter: /clerk-production-browser$/ }, () => ({
          path: 'browser',
          namespace: 'clerk-parent',
        }));
        builder.onResolve({ filter: /clerk-production-panel$/ }, () => ({
          path: 'panel',
          namespace: 'clerk-parent',
        }));
        builder.onLoad(
          { filter: /^browser$/, namespace: 'clerk-parent' },
          () => ({
            loader: 'js',
            contents:
              'export const isClerkProductionMethodEnabled = data => Array.isArray(data?.methods) && data.methods.includes("clerk-production"); export const getClerkProductionBrowser = async () => { throw new Error("unused"); };',
          }),
        );
        builder.onLoad(
          { filter: /^panel$/, namespace: 'clerk-parent' },
          () => ({
            loader: 'js',
            resolveDir: process.cwd(),
            contents:
              'import React from "react"; export default function Panel(){ return React.createElement("div", { "data-clerk-parent": "mounted" }, window.location.search); }',
          }),
        );
      },
    },
  ],
});
const parentBundle = await readFile(parentOutput, 'utf8');
const productionSources =
  (await readFile(source, 'utf8')) + (await readFile(uiSource, 'utf8'));
assert.doesNotMatch(productionSources, /prototypes|clerk-isolated|pk_test_/);
const html =
  '<!doctype html><html><body><div id="mount"></div><script type="module" src="/adapter.js"></script></body></html>';
const browser = await chromium.launch({ headless: true });
try {
  const apiCalls = [];
  const clerkRequests = [];
  const serve = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/adapter.js')
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: bundle,
      });
    if (
      request.url() ===
      'https://clerk.rogerwilcoaviation.com/npm/@clerk/ui@1.39.0/dist/ui.browser.js'
    ) {
      clerkRequests.push(request.url());
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: "globalThis.__internal_ClerkUICtor = class ClerkUI { static version = '1.39.0'; constructor() { globalThis.__OFFICIAL_UI_INITIALIZATIONS__ = (globalThis.__OFFICIAL_UI_INITIALIZATIONS__ || 0) + 1; } };",
      });
    }
    if (url.hostname === 'clerk.rogerwilcoaviation.com') {
      clerkRequests.push(request.url());
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      });
    }
    if (url.pathname.startsWith('/api/aircraft-sale/')) {
      apiCalls.push({
        path: url.pathname,
        method: request.method(),
        headers: request.headers(),
        body: request.postData(),
      });
      if (url.pathname.endsWith('/start'))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ nonce: 'one-use-offline-nonce' }),
        });
      if (url.pathname.endsWith('/finish')) {
        assert.equal(
          JSON.parse(request.postData()).nonce,
          'one-use-offline-nonce',
        );
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: 'offline-core-session',
            csrf: 'offline-csrf',
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { email: 'seller@example.test', name: 'Seller' },
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  };
  const page = await browser.newPage();
  await page.route('**/*', serve);
  await page.goto('https://www.rogerwilcoaviation.com/offline-clerk-test');
  await page.waitForFunction(() => document.body.dataset.result, null, {
    timeout: 20_000,
  });
  assert.equal(await page.locator('body').getAttribute('data-result'), 'pass');
  assert.equal(
    await page.locator('#mount').getAttribute('data-clerk-mounted'),
    'sign-up',
  );
  const result = await page.evaluate(() => globalThis.__RESULTS__);
  assert.equal(result.officialLoaded, true);
  assert.equal(result.officialUiInitializations, 1);
  assert.equal(result.officialUiVersion, '1.39.0');
  assert.equal(result.uiVersion, '1.39.0');
  assert.equal(
    result.uiUrl,
    'https://clerk.rogerwilcoaviation.com/npm/@clerk/ui@1.39.0/dist/ui.browser.js',
  );
  assert.ok(
    clerkRequests.some((url) => url === result.uiUrl),
    'the official production UI asset was requested',
  );
  assert.ok(
    clerkRequests.some((url) => url.includes('/v1/environment')),
    'the compiled official Clerk client initialized',
  );
  assert.equal(result.key, result.expectedKey);
  assert.equal(result.host, 'clerk.rogerwilcoaviation.com');
  assert.equal(result.cacheClears, 1);
  assert.deepEqual(result.tokenOptions, Array(4).fill({ skipCache: true }));
  assert.equal(result.wrongOriginRejected, true);
  assert.equal(result.wrongOriginCacheClears, 1);
  assert.equal(result.wrongOriginTokenCalls, 2);
  assert.deepEqual(result.failureTelemetry, {
    status: '401',
    serverStage: 'jwt-claims',
  });
  assert.deepEqual(result.untrustedFailureTelemetry, {
    status: 'other-http',
    serverStage: '',
  });
  assert.equal(result.mockReceivedUi, false);
  assert.equal(result.signInUnmounted, true);
  assert.equal(result.signUpUnmounted, true);
  assert.deepEqual(result.signInOptions, {
    routing: 'hash',
    forceRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    fallbackRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    signUpUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=sign-up',
    signUpForceRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    signUpFallbackRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
  });
  assert.deepEqual(result.signUpOptions, {
    routing: 'hash',
    forceRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    fallbackRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    signInUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    signInForceRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
    signInFallbackRedirectUrl:
      'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
  });
  assert.equal(apiCalls.length, 3);
  assert.deepEqual(
    apiCalls.map(({ path, method }) => ({ path, method })),
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
  const canonicalToken = apiCalls[0].headers['x-clerk-session-token'];
  assert.equal(
    JSON.parse(Buffer.from(canonicalToken.split('.')[1], 'base64url')).azp,
    'https://www.rogerwilcoaviation.com',
  );
  for (const call of apiCalls)
    assert.equal(call.headers['x-clerk-session-token'], canonicalToken);
  assert.equal(
    apiCalls[0].headers.origin,
    'https://www.rogerwilcoaviation.com',
  );
  assert.equal(
    apiCalls[1].headers.origin,
    'https://www.rogerwilcoaviation.com',
  );
  assert.equal(apiCalls[2].headers.origin, undefined);
  assert.equal(apiCalls[0].headers['content-type'], 'application/json');
  assert.equal(apiCalls[0].headers.authorization, undefined);
  assert.equal(
    apiCalls[2].headers.authorization,
    'Bearer offline-core-session',
  );
  assert.equal(apiCalls[2].headers['x-rwas-csrf'], 'offline-csrf');
  assert.deepEqual(result.handoffStages, [
    'provider-session-present',
    'clerk-token-request',
    'rwas-start-request',
    'rwas-start-accepted',
    'clerk-token-request',
    'rwas-finish-request',
    'rwas-finish-accepted',
    'clerk-token-request',
    'rwas-account-request',
    'complete',
  ]);
  assert.deepEqual(result.session, {
    provider: 'clerk-production',
    token: 'offline-core-session',
    csrf: 'offline-csrf',
    email: 'seller@example.test',
    name: 'Seller',
  });
  assert.equal(result.methodOff, false);
  assert.equal(result.methodOn, true);

  const parent = await browser.newPage();
  parent.setDefaultTimeout(5000);
  let methodsFail = false;
  await parent.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/parent.js')
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: parentBundle,
      });
    if (url.pathname === '/api/aircraft-sale/auth/methods')
      return route.fulfill({
        status: methodsFail ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify({
          methods: ['clerk-production'],
          emailCode: false,
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div><script src="/parent.js"></script></body></html>',
    });
  });
  await parent.goto(
    'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=sign-up',
  );
  const parentPanel = parent.locator('[data-clerk-parent="mounted"]');
  await parentPanel.waitFor({ state: 'attached' });
  assert.equal(await parentPanel.textContent(), '?seller-auth=sign-up');
  await parent.getByRole('button', { name: 'Close seller panel' }).click();
  await parentPanel.waitFor({ state: 'detached' });
  assert.equal(
    parent.url(),
    'https://www.rogerwilcoaviation.com/aircraft-for-sale',
  );
  await parent.goto(
    'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
  );
  await parentPanel.waitFor({ state: 'attached' });
  assert.equal(await parentPanel.textContent(), '?seller-auth=complete');
  assert.equal(
    await parent
      .locator('[data-rwas-clerk-route-stage]')
      .getAttribute('data-rwas-clerk-route-stage'),
    'panel-requested',
  );
  await parent.getByRole('button', { name: 'Close seller panel' }).click();
  await parentPanel.waitFor({ state: 'detached' });
  assert.equal(
    parent.url(),
    'https://www.rogerwilcoaviation.com/aircraft-for-sale',
  );
  await parent.goto(
    'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=invalid',
  );
  await parent.waitForFunction(() => !location.search);
  assert.equal(
    await parent.locator('[data-clerk-parent="mounted"]').count(),
    0,
  );
  assert.equal(
    await parent
      .locator('[data-rwas-clerk-route-stage]')
      .getAttribute('data-rwas-clerk-route-stage'),
    'route-invalid',
  );
  methodsFail = true;
  await parent.goto(
    'https://www.rogerwilcoaviation.com/aircraft-for-sale?seller-auth=complete',
  );
  await parent.waitForFunction(() => !location.search);
  assert.equal(
    await parent
      .locator('[data-rwas-clerk-route-stage]')
      .getAttribute('data-rwas-clerk-route-stage'),
    'methods-failed',
  );
  assert.equal(
    await parent.locator('[data-clerk-parent="mounted"]').count(),
    0,
  );

  const refused = await browser.newPage();
  await refused.route('**/*', serve);
  await refused.goto('https://rogerwilcoaviation.com/offline-clerk-test');
  await refused.waitForFunction(() => document.body.dataset.result);
  assert.equal(
    await refused.locator('body').getAttribute('data-result'),
    'refused',
  );
  const refusal = await refused.evaluate(() => globalThis.__RESULTS__);
  assert.match(refusal.error, /unavailable here/);
  console.log(
    'production Clerk official UI/client init and browser request boundary: PASS',
  );
} finally {
  await browser.close();
}
