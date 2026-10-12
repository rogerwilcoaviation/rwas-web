// Actual React component and disposable Worker store; all external traffic is denied.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { fixture } from './fixture.mjs';

assert.ok(
  process.env.PLAYWRIGHT_MODULE,
  'Use an explicit isolated browser runtime',
);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const compiled = await build({
  stdin: {
    contents: `import {createRoot} from 'react-dom/client';
      import SellerAccounts from './app/seller-accounts/SellerAccounts';
      createRoot(document.getElementById('app')).render(<SellerAccounts/>);`,
    resolveDir: process.cwd(),
    sourcefile: 'account-authority-fixture.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  alias: { '@/lib/seller-api': resolve('lib/seller-api.ts') },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const html =
  '<!doctype html><html><body><div id="app"></div><script src="/fixture.js"></script></body></html>';
const server = createServer((req, res) => {
  if (req.url === '/fixture.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(compiled.outputFiles[0].contents);
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const f = fixture();
f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
f.env.ACCOUNT_ADMIN_SITE_ORIGIN = origin;
let fresh = Date.now(),
  allowed = true;
f.env.ACCOUNT_ADMIN_AUTH = {
  fetch: async () =>
    allowed
      ? Response.json({
          actor: 'admin@example.test',
          scope: 'seller-accounts',
          authenticatedAt: fresh,
          expiresAt: Date.now() + 3600000,
        })
      : new Response(null, { status: 403 }),
};
const owner = await f.login('authority-owner@example.test');
await f.call('/account', 'PATCH', { name: 'Original synthetic name' }, owner);
const ownerId = (
  await (await f.call('/account', 'GET', undefined, owner)).json()
).profile.id;
let browser;
const errors = [],
  methods = [],
  blocked = [],
  checks = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      blocked.push(url.origin);
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith('/api/aircraft-sale/')) {
      await route.continue();
      return;
    }
    methods.push(request.method());
    assert.equal(request.method(), 'GET', 'Access check must never mutate');
    const response = await f.call(
      url.pathname.replace('/api/aircraft-sale', '') + url.search,
      'GET',
      undefined,
      'synthetic-admin',
      { Origin: origin },
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  fresh = Date.now() - 596000;
  await page
    .getByRole('button', { name: 'Load accounts', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'View account authority-owner@example.test',
      exact: true,
    })
    .click();
  const selected = page.getByRole('region', {
    name: 'Selected account',
    exact: true,
  });
  const name = selected.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Unsubmitted synthetic edit');
  const check = page.getByRole('button', {
    name: 'Check management access',
    exact: true,
  });
  await check.waitFor({ state: 'visible' });
  assert.equal(await name.isDisabled(), true);
  assert.match(
    await page.locator('main').innerText(),
    /Reopening this page can reuse your current login/,
  );
  fresh = Date.now() - 600001;
  await check.click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Read-only access confirmed' })
    .waitFor();
  assert.equal(await name.inputValue(), 'Unsubmitted synthetic edit');
  assert.equal(await name.isDisabled(), true);
  assert.equal(await selected.count(), 1);
  assert.equal(f.state().profiles[ownerId].name, 'Original synthetic name');
  checks.push(
    'Expired write access stays read-only; GET check preserves selection and unsaved contact input',
  );

  fresh = Date.now() - 597000;
  await check.click();
  await check.waitFor({ state: 'hidden' });
  assert.equal(await name.isDisabled(), false);
  assert.equal(await name.inputValue(), 'Unsubmitted synthetic edit');
  checks.push(
    'Only a genuinely recent synthetic Worker authority enables management',
  );

  await check.waitFor({ state: 'visible' });
  allowed = false;
  await check.click();
  await page.getByRole('alert').waitFor();
  assert.equal(await selected.count(), 0);
  assert.equal(await page.locator('tbody tr').count(), 0);
  assert.ok(
    !(await page.locator('main').innerText()).includes(
      'authority-owner@example.test',
    ),
  );
  checks.push('Lost administrator authorization clears private account state');
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  assert.ok(methods.length >= 5 && methods.every((method) => method === 'GET'));
  console.log(
    JSON.stringify({
      status: 'PASS',
      checks,
      browserApiWrites: 0,
      externalRequests: blocked.length,
      liveAcceptance: false,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
