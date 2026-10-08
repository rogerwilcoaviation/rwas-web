// Actual built Next dashboard + disposable synthetic store. All external traffic is blocked.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { fixture, create, fields } from './fixture.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const base = resolve('out');
assert.match(
  await readFile(join(base, 'seller-accounts.html'), 'utf8'),
  /name="robots" content="noindex, nofollow"/,
);
const server = createServer(async (req, res) => {
  try {
    let path = resolve(
      base,
      '.' + new URL(req.url, 'http://localhost').pathname,
    );
    if (!path.startsWith(base + '/')) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!extname(path)) path += '.html';
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml',
    };
    const bytes = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`,
  f = fixture();
Object.assign(f.env, {
  AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
  ACCOUNT_ADMIN_SITE_ORIGIN: origin,
});
let fresh = Date.now(),
  expiry = Date.now() + 3600000;
f.env.ACCOUNT_ADMIN_AUTH = {
  fetch: async (req) =>
    req.headers.get('Authorization') === 'Bearer synthetic-admin'
      ? Response.json({
          actor: 'admin@example.test',
          scope: 'seller-accounts',
          authenticatedAt: fresh,
          expiresAt: expiry,
        })
      : new Response(null, { status: 403 }),
};
const owner = await f.login('owner@example.test'),
  other = await f.login('other@example.test');
await f.call(
  '/account',
  'PATCH',
  {
    name: 'Synthetic Owner',
    phone: 'PRIVATE-PHONE',
    location: 'PRIVATE-HANGAR',
  },
  owner,
);
const listing = await create(f, owner, {
  ...fields,
  model: 'Account Ownership Fixture',
});
const seeded = f.state();
for (let i = 0; i < 25; i++) {
  const id = crypto.randomUUID();
  seeded.profiles[id] = {
    id,
    email: `synthetic-${i}@example.test`,
    name: 'Synthetic seller ' + i,
    phone: '',
    location: '',
    createdAt: Date.now(),
  };
}
f.durable.set('state', seeded);
let browser,
  failure,
  delayed,
  capturedResponse,
  deliveredResponse,
  loseApplyResponse;
const checkpoints = [],
  errors = [],
  operations = [],
  blocked = [];
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
    if (failure) {
      const value = failure;
      failure = null;
      await route.fulfill(value);
      return;
    }
    const input = request.postData()
      ? JSON.parse(request.postData())
      : undefined;
    if (url.pathname.endsWith('/apply')) operations.push(input);
    const response = await f.call(
      url.pathname.replace('/api/aircraft-sale', '') + url.search,
      request.method(),
      input,
      'synthetic-admin',
      { Origin: origin },
    );
    if (loseApplyResponse && url.pathname.endsWith('/apply')) {
      loseApplyResponse = false;
      await response.arrayBuffer();
      await route.abort('failed');
      return;
    }
    const output = {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    };
    if (delayed && /\/admin\/accounts\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
      capturedResponse();
      await delayed;
      delayed = null;
    }
    await route.fulfill(output);
    if (deliveredResponse) {
      deliveredResponse();
      deliveredResponse = null;
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/seller-accounts');
  const load = page.getByRole('button', { name: 'Load accounts', exact: true });
  const selected = page.getByRole('region', {
    name: 'Selected account',
    exact: true,
  });
  async function privacyCleared() {
    assert.equal(await selected.count(), 0);
    assert.equal(await page.locator('main tbody tr').count(), 0);
    assert.equal(
      await page
        .getByRole('region', { name: 'Confirm account operation' })
        .count(),
      0,
    );
    const text = await page.locator('main').innerText();
    assert.ok(!text.includes('PRIVATE-PHONE'));
    assert.ok(!text.includes('PRIVATE-HANGAR'));
    assert.ok(!text.includes('owner@example.test'));
  }
  failure = {
    status: 200,
    contentType: 'text/html',
    body: '<html>Access login</html>',
  };
  await load.click();
  await page.locator('main').getByRole('alert').waitFor();
  await privacyCleared();
  assert.match(
    await page.locator('main').getByRole('alert').innerText(),
    /approved account administrator/,
  );
  checkpoints.push('Access HTML fails safely without rendering private data');
  failure = {
    status: 503,
    contentType: 'application/json',
    body: '{"error":"PRIVATE-DIAGNOSTIC"}',
  };
  await load.click();
  await page
    .locator('main')
    .getByRole('alert')
    .filter({ hasText: 'unavailable' })
    .waitFor();
  await privacyCleared();
  assert.ok(
    !(await page.locator('main').innerText()).includes('PRIVATE-DIAGNOSTIC'),
  );
  checkpoints.push(
    'Service failure shows bounded diagnostics and clears private state',
  );
  await load.click();
  await page.getByText('27 matching accounts', { exact: true }).waitFor();
  assert.equal(await page.locator('main tbody tr').count(), 25);
  const firstIds = await page
    .locator('main tbody button')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('main tbody tr').length === 2,
  );
  const nextIds = await page
    .locator('main tbody button')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
  assert.ok(nextIds.every((id) => !firstIds.includes(id)));
  checkpoints.push(
    'Directory pagination returns bounded distinct account pages',
  );
  await page
    .getByRole('textbox', { name: 'Search accounts' })
    .fill('owner@example.test');
  await load.click();
  await page.getByText('1 matching accounts', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'View account owner@example.test' })
    .click();
  await selected.waitFor();
  assert.equal(
    await selected
      .getByRole('textbox', { name: 'Phone', exact: true })
      .inputValue(),
    'PRIVATE-PHONE',
  );
  assert.ok((await selected.innerText()).includes('Account Ownership Fixture'));
  const ownerId = (
    await (await f.call('/account', 'GET', undefined, owner)).json()
  ).profile.id;
  await selected
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Corrected Owner');
  await selected
    .getByRole('combobox', { name: 'Operation reason' })
    .selectOption('contact-correction');
  await selected
    .getByRole('button', { name: 'Preview contact update' })
    .click();
  const confirmation = page.getByRole('region', {
    name: 'Confirm account operation',
  });
  await confirmation.waitFor();
  assert.equal(operations.length, 0);
  assert.equal(f.state().profiles[ownerId].name, 'Synthetic Owner');
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await selected
    .getByRole('heading', { name: 'Corrected Owner', exact: true })
    .waitFor();
  assert.equal(operations.length, 1);
  assert.equal(f.state().listings[listing.id].ownerId, ownerId);
  assert.equal(f.state().listings[listing.id].status, 'draft');
  assert.equal((await f.call('/account', 'GET', undefined, owner)).status, 200);
  assert.equal((await f.call('/account', 'GET', undefined, other)).status, 200);
  checkpoints.push(
    'Search, detail and confirmed contact edit affect only the selected account and preserve ownership',
  );
  await selected
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Stale Admin Edit');
  await selected
    .getByRole('button', { name: 'Preview contact update' })
    .click();
  await confirmation.waitFor();
  await f.call('/account', 'PATCH', { name: 'Seller Newer Edit' }, owner);
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Account changed' })
    .waitFor();
  assert.equal(
    await selected
      .getByRole('textbox', { name: 'Name', exact: true })
      .inputValue(),
    'Seller Newer Edit',
  );
  assert.equal(await confirmation.count(), 0);
  checkpoints.push(
    'Stale confirmation is rejected and the dashboard refreshes current seller details',
  );
  await selected.getByRole('button', { name: 'Preview suspension' }).click();
  await confirmation.waitFor();
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await selected
    .getByRole('button', { name: 'Preview reinstatement' })
    .waitFor();
  assert.equal((await f.call('/account', 'GET', undefined, owner)).status, 401);
  assert.equal((await f.call('/account', 'GET', undefined, other)).status, 200);
  await selected.getByRole('button', { name: 'Preview reinstatement' }).click();
  await confirmation.waitFor();
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await selected.getByRole('button', { name: 'Preview suspension' }).waitFor();
  const replacement = await f.login('owner@example.test');
  assert.equal(
    (await f.call('/account', 'GET', undefined, replacement)).status,
    200,
  );
  await selected
    .getByRole('button', { name: 'Preview session revocation' })
    .click();
  await confirmation.waitFor();
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Revoke all sessions completed' })
    .waitFor();
  assert.equal(
    (await f.call('/account', 'GET', undefined, replacement)).status,
    401,
  );
  assert.equal(f.state().listings[listing.id].ownerId, ownerId);
  checkpoints.push(
    'Confirmed suspension, reinstatement and revocation enforce seller sign-in boundaries',
  );
  const beforeLostResponse = await f.login('owner@example.test');
  await selected
    .getByRole('button', { name: 'Preview session revocation' })
    .click();
  await confirmation.waitFor();
  loseApplyResponse = true;
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await page
    .locator('main')
    .getByRole('alert')
    .filter({ hasText: 'request could not be confirmed' })
    .waitFor();
  assert.equal(
    (await f.call('/account', 'GET', undefined, beforeLostResponse)).status,
    401,
  );
  const afterLostResponse = await f.login('owner@example.test');
  const appliedId = operations.at(-1).id;
  await confirmation.getByRole('button', { name: 'Confirm operation' }).click();
  await confirmation.waitFor({ state: 'detached' });
  assert.equal(operations.at(-1).id, appliedId);
  assert.equal(
    (await f.call('/account', 'GET', undefined, afterLostResponse)).status,
    200,
  );
  assert.equal(
    f.state().audit.filter((a) => a.operationId === appliedId).length,
    1,
  );
  checkpoints.push(
    'Retry after a lost apply response reuses the operation receipt and preserves newer sessions',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const artifacts =
    process.env.TEST_ARTIFACT_DIR ||
    join(tmpdir(), 'rwas-account-admin-evidence');
  await mkdir(artifacts, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(artifacts, 'seller-account-admin-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(artifacts, 'seller-account-admin-desktop.png'),
    fullPage: true,
  });
  checkpoints.push(
    'Desktop and mobile layouts expose labeled controls without horizontal page overflow',
  );
  failure = { status: 403, contentType: 'application/json', body: '{}' };
  await load.click();
  await page.locator('main').getByRole('alert').waitFor();
  await privacyCleared();
  fresh = Date.now() - 700000;
  await load.click();
  await page
    .getByRole('button', { name: 'View account owner@example.test' })
    .click();
  await selected.waitFor();
  assert.equal(
    await selected
      .getByRole('button', { name: 'Preview suspension' })
      .isDisabled(),
    true,
  );
  assert.equal(
    await selected
      .getByRole('textbox', { name: 'Name', exact: true })
      .isDisabled(),
    true,
  );
  checkpoints.push(
    'Expired authorization clears all visible private details; old authentication permits only read-only controls',
  );
  fresh = Date.now();
  expiry = Date.now() + 1500;
  await load.click();
  await page
    .getByRole('button', { name: 'View account owner@example.test' })
    .waitFor();
  let release;
  delayed = new Promise((r) => (release = r));
  const captured = new Promise((r) => (capturedResponse = r));
  await page
    .getByRole('button', { name: 'View account owner@example.test' })
    .click();
  await captured;
  await page
    .getByRole('alert')
    .filter({ hasText: 'Administrator access expired' })
    .waitFor();
  const delivered = new Promise((r) => (deliveredResponse = r));
  release();
  await delivered;
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await privacyCleared();
  checkpoints.push(
    'A delayed private detail response cannot repopulate the page after administrator access expires',
  );
  assert.deepEqual(errors, []);
  const evidence = {
    result: 'PASS',
    checkpoints,
    externalTrafficBlocked: blocked.length,
    consoleErrors: errors,
    confirmedOperations: operations.length,
  };
  await writeFile(
    join(artifacts, 'seller-account-admin-browser.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
