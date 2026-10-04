// Actual built Next page + disposable seller store. No provider credentials or hosted writes.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { fixture, create, fields, submit } from './fixture.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const base = resolve('out');
const html = await readFile(resolve(base, 'seller-review.html'), 'utf8');
assert.match(html, /name="robots" content="noindex, nofollow"/);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = resolve(base, '.' + url.pathname);
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
const origin = `http://127.0.0.1:${server.address().port}`;
const f = fixture();
const owner = await f.login();
const first = await create(f, owner, { ...fields, model: 'First Review' });
const second = await create(f, owner, { ...fields, model: 'Second Review' });
for (const listing of [first, second])
  assert.equal((await submit(f, owner, listing)).status, 200);
let browser;
const checkpoints = [],
  blocked = [],
  errors = [],
  decisions = [];
let queueFailure;
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
    if (url.pathname.endsWith('/admin/listings') && queueFailure) {
      const failure = queueFailure;
      queueFailure = undefined;
      await route.fulfill(failure);
      return;
    }
    const input = request.postData()
      ? JSON.parse(request.postData())
      : undefined;
    if (url.pathname.endsWith('/admin/review')) decisions.push(input);
    const response = await f.call(
      url.pathname.replace('/api/aircraft-sale', ''),
      request.method(),
      input,
      'fixture-reviewer',
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(origin + '/seller-review');
  const load = page.getByRole('button', { name: 'Load Review Queue' });
  queueFailure = {
    status: 200,
    contentType: 'text/html',
    body: '<html>Access login</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  checkpoints.push(
    'Access HTML prompts staff sign-in without JSON parsing details',
  );
  queueFailure = {
    status: 503,
    contentType: 'application/json',
    body: '{"error":"private diagnostic"}',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Staff review is unavailable' })
    .waitFor();
  assert.ok(
    !(await page.locator('main').getByRole('alert').innerText()).includes(
      'private diagnostic',
    ),
  );
  checkpoints.push('Unavailable review shows a bounded error');
  await load.click();
  const firstCard = page.locator('main section').filter({
    has: page.getByRole('heading', { name: '2000 Synthetic First Review' }),
  });
  const secondCard = page.locator('main section').filter({
    has: page.getByRole('heading', { name: '2000 Synthetic Second Review' }),
  });
  await firstCard.waitFor();
  await firstCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Private note before session expiry');
  queueFailure = {
    status: 403,
    contentType: 'text/html',
    body: '<html>Expired Access session</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  await load.click();
  await firstCard.waitFor();
  assert.equal(
    await firstCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    '',
  );
  checkpoints.push(
    'Expired staff access clears visible private records and unsent notes',
  );
  await firstCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Correct first record only');
  await secondCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Correct second record only');
  await firstCard.getByRole('button', { name: 'Request Changes' }).click();
  await firstCard.waitFor({ state: 'detached' });
  assert.equal(
    f.state().listings[first.id].reviewNote,
    'Correct first record only',
  );
  assert.equal(
    await secondCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    'Correct second record only',
  );
  checkpoints.push(
    'Notes remain isolated by listing and revision after a decision',
  );
  const oldRevision = f.state().listings[second.id].revision;
  const editedResponse = await f.call(
    '/listings/' + second.id,
    'PUT',
    {
      ...fields,
      model: 'Second Review',
      description: 'Changed while awaiting staff review',
    },
    owner,
  );
  assert.equal(editedResponse.status, 200);
  const edited = (await editedResponse.json()).listing;
  assert.equal((await submit(f, owner, edited)).status, 200);
  await secondCard.getByRole('button', { name: 'Approve and Publish' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Listing changed' })
    .waitFor();
  await page.waitForFunction(
    (revision) =>
      document
        .querySelector('main section')
        ?.textContent.includes('Revision ' + revision),
    f.state().listings[second.id].revision,
  );
  assert.equal(f.state().listings[second.id].status, 'pending');
  assert.ok(f.state().listings[second.id].revision > oldRevision);
  assert.equal(
    await secondCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    '',
  );
  checkpoints.push(
    'Stale approval is rejected, latest revision loaded, old note discarded',
  );
  await secondCard.getByRole('button', { name: 'Approve and Publish' }).click();
  await secondCard.waitFor({ state: 'detached' });
  assert.equal(f.state().listings[second.id].status, 'active');
  assert.equal(decisions.at(-1).note, '');
  checkpoints.push(
    'Explicit approval of the refreshed revision succeeds in disposable fixture',
  );
  queueFailure = {
    status: 403,
    contentType: 'text/html',
    body: '<html>Expired Access session</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  assert.deepEqual(errors, []);
  // Existing global integrations may be attempted; all external requests are aborted.
  await writeFile(
    'tests/aircraft-sale/review-browser-results.json',
    JSON.stringify(
      {
        checkpoints,
        pageErrors: errors.length,
        externalRequestsBlocked: blocked.length,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: checkpoints.length,
      checkpoints,
      pageErrors: errors.length,
      externalRequestsBlocked: blocked.length,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
