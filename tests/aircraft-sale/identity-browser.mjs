import { createServer } from 'node:http';
import { stat, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve, extname } from 'node:path';
import { create } from './fixture.mjs';
import { identityFixture } from './identity-fixture.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
class Progress extends Array {
  push(...items) {
    console.log(...items);
    return super.push(...items);
  }
}
// Require the real production export rather than a synthetic component shell.
const exportedHome = await readFile(resolve('out/index.html'), 'utf8');
assert.ok(
  !exportedHome.includes('sale-api.rogerwilcoaviation.com/files/'),
  'Homepage export must not freeze legacy aircraft photos.',
);
assert.ok(
  !/<loc>[^<]*\/aircraft-for-sale\/[^<]+<\/loc>/.test(
    await readFile(resolve('out/sitemap.xml'), 'utf8'),
  ),
  'Static sitemap must not freeze dynamic aircraft IDs.',
);
const origin = 'http://127.0.0.1:18764';
const identity = await identityFixture(origin);
const { f, issueCode } = identity;
const results = new Progress(),
  requests = [],
  blocked = [],
  errors = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin),
      path = url.pathname + url.search;
    if (!url.pathname.startsWith('/api/aircraft-sale')) {
      if (/^\/aircraft-for-sale\/[^/]+$/.test(url.pathname)) {
        const headers = { ...req.headers, accept: 'text/html' };
        const response = await f.call(
          '/listing/' + url.pathname.split('/')[2],
          'GET',
          undefined,
          undefined,
          headers,
        );
        requests.push({ method: 'GET', path, status: response.status });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const base = resolve('out');
      let asset = resolve(base, '.' + url.pathname);
      if (asset !== base && !asset.startsWith(base + '/')) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (url.pathname === '/') asset = resolve(base, 'index.html');
      if (!extname(asset)) asset += req.headers.rsc === '1' ? '.txt' : '.html';
      try {
        await stat(asset);
      } catch {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const types = {
        '.html': 'text/html',
        '.txt': 'text/x-component',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.json': 'application/json',
      };
      res.setHeader(
        'Content-Type',
        types[extname(asset)] || 'application/octet-stream',
      );
      res.end(await readFile(asset));
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const response = await f.call(
      path.replace('/api/aircraft-sale', ''),
      req.method,
      body.length ? new Uint8Array(body) : undefined,
      undefined,
      req.headers,
    );
    requests.push({ method: req.method, path, status: response.status });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});
await new Promise((r) => server.listen(18764, '127.0.0.1', r));
let browser;
let providerAction = 'success';
let providerSubject = 'password|browser';
let providerEmail = 'password-browser@example.test';
const providerPages = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin === 'https://identity.fixture.test') {
      providerPages.push(url.pathname);
      if (url.pathname === '/v2/logout')
        return route.fulfill({
          status: 302,
          headers: { location: origin + '/aircraft-for-sale' },
        });
      assert.equal(url.pathname, '/authorize');
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      const state = url.searchParams.get('state');
      const target = new URL(f.env.AUTH_REDIRECT_URI);
      target.searchParams.set('state', state);
      if (providerAction === 'cancel')
        target.searchParams.set('error', 'access_denied');
      else
        target.searchParams.set(
          'code',
          await issueCode(
            { state },
            { sub: providerSubject, email: providerEmail },
          ),
        );
      // Entire hosted login page and JWT issuer are synthetic and intercepted: no actual password entered.
      return route.fulfill({
        contentType: 'text/html',
        body:
          "<!doctype html><title>Synthetic hosted login</title><button onclick='location.href=" +
          JSON.stringify(target.href) +
          "'>Complete synthetic sign-in</button>",
      });
    }
    blocked.push(url.href);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  const session = () =>
    page.evaluate(() => JSON.parse(sessionStorage.rwas_sale_v2).token);
  async function complete() {
    await page
      .getByRole('button', { name: 'Complete synthetic sign-in' })
      .click();
    await page.waitForURL(origin + '/aircraft-for-sale');
  }
  async function login(method, subject, email) {
    providerSubject = subject;
    providerEmail = email;
    await page
      .getByRole('button', { name: 'Seller Login', exact: true })
      .click();
    await page.getByRole('button', { name: method, exact: true }).click();
    await complete();
    await page
      .getByRole('button', { name: 'My Listings', exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).search, '');
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem('rwas_sale_identity')),
      null,
    );
    return session();
  }
  async function logout(token) {
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page
      .getByRole('button', { name: 'Seller Login', exact: true })
      .waitFor();
    assert.equal(
      (await f.call('/account', 'GET', undefined, token)).status,
      401,
    );
  }
  await page.goto(origin + '/aircraft-for-sale');
  let password = await login(
    'Email and password',
    'auth0|browser',
    'password-browser@example.test',
  );
  assert.equal(Object.keys(f.state().profiles).length, 1);
  results.push(
    'PASS hosted email/password synthetic first login, verified identity and clean callback URL',
  );
  await logout(password);
  const google = await login(
    'Continue with Google',
    'google|browser',
    'google-browser@example.test',
  );
  await logout(google);
  await page.setViewportSize({ width: 390, height: 844 });
  const apple = await login(
    'Continue with Apple',
    'apple|browser',
    'apple-browser@example.test',
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await logout(apple);
  results.push(
    'PASS Google and Apple synthetic redirects, mobile fit, local and provider logout',
  );
  password = await login(
    'Email and password',
    'auth0|browser',
    'password-browser@example.test',
  );
  const listing = await create(f, password, {
    make: 'Synthetic',
    model: 'Identity Owner',
  });
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  providerSubject = 'google|connected';
  providerEmail = 'password-browser@example.test';
  await page
    .getByRole('button', { name: 'Connect Google', exact: true })
    .click();
  await complete();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page
    .getByText('Connected: Email and password, Google', { exact: true })
    .waitFor();
  const linkedToken = await session();
  const owned = await (
    await f.call('/my-listings', 'GET', undefined, linkedToken)
  ).json();
  assert.ok(owned.listings.some((item) => item.id === listing.id));
  results.push(
    'PASS explicit Google linking retains existing aircraft ownership',
  );
  await page
    .getByRole('button', { name: 'Password help', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Complete synthetic sign-in' })
    .waitFor();
  providerAction = 'cancel';
  // The already rendered page holds its success URL; go back and start an actual cancelled transaction.
  await page.goBack();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page
    .getByRole('button', { name: 'Password help', exact: true })
    .click();
  await complete();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign-in was cancelled' })
    .waitFor();
  assert.equal(
    (await f.call('/account', 'GET', undefined, linkedToken)).status,
    200,
  );
  results.push(
    'PASS hosted password-help routing and cancellation preserve current seller account',
  );
  providerAction = 'success';
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  const event = {
    id: 'browser-reset',
    kind: 'password-reset',
    subject: 'auth0|browser',
    issuedAt: Date.now(),
  };
  assert.equal(
    (await f.call('/auth/events', 'POST', event, f.env.AUTH_EVENT_SECRET))
      .status,
    200,
  );
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Sign in' }).waitFor();
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Seller Login', exact: true })
    .waitFor();
  results.push(
    'PASS authenticated synthetic reset event revokes browser session',
  );
  await page.goto(
    origin + '/aircraft-for-sale?code=synthetic-replay&state=unknown',
  );
  await page
    .getByRole('alert')
    .filter({ hasText: 'another tab or expired' })
    .waitFor();
  assert.equal(new URL(page.url()).search, '');
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
    null,
  );
  results.push(
    'PASS callback replay/missing browser proof rejected and URL scrubbed',
  );
  assert.deepEqual(blocked, []);
  assert.deepEqual(errors, []);
  assert.ok(providerPages.includes('/v2/logout'));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    'tests/aircraft-sale/identity-browser-results.json',
    JSON.stringify(
      {
        results,
        requests,
        providerPages,
        blocked,
        errors,
        scope:
          'Actual Next export with synthetic hosted identity pages, ephemeral RSA provider and disposable Worker state. Hosted pages intercepted locally; no real passwords, provider accounts, email, or network requests. Provider enrollment/recovery remains staging acceptance.',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { results, requests: requests.length, providerPages, blocked, errors },
      null,
      2,
    ),
  );
}
