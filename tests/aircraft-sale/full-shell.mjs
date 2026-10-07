import { createServer } from 'node:http';
import { stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve, extname, join } from 'node:path';
import { fixture, approve } from './fixture.mjs';
import { execFileSync } from 'node:child_process';
const [png, pdf, mp4] = await Promise.all(
  ['synthetic.png', 'synthetic.pdf', 'synthetic.mp4'].map(
    async (name) =>
      new Uint8Array(
        await readFile(new URL('./media-fixtures/' + name, import.meta.url)),
      ),
  ),
);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || 'tests/aircraft-sale',
);
await mkdir(artifacts, { recursive: true });
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
const f = fixture(),
  results = new Progress(),
  requests = [],
  blocked = [],
  errors = [];
const origin = 'http://127.0.0.1:18763';
let chatCalls = 0,
  browseFailures = 0;
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
    // Disposable stand-in for the approved edge identity assertion on staff downloads.
    if (
      (req.headers.cookie || '').includes('fixture_reviewer=approved') &&
      url.pathname.startsWith('/api/aircraft-sale/admin/')
    )
      req.headers.authorization = 'Bearer fixture-reviewer';
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (path === '/api/chat') {
      chatCalls++;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          reply: 'Your draft is ready to review.',
          action: {
            type: 'listing_draft',
            draft: {
              make: 'Synthetic',
              model: 'Jerry Draft',
              year: 2000,
              price: 1,
              nNumber: 'N123AB',
              description: 'Local synthetic conversation',
            },
          },
        }),
      );
      return;
    }
    if (!path.startsWith('/api/aircraft-sale')) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (url.pathname === '/api/aircraft-sale/browse' && browseFailures > 0) {
      browseFailures--;
      requests.push({ method: req.method, path, status: 503 });
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Synthetic unavailable inventory' }));
      return;
    }
    const response = await f.call(
      path.replace('/api/aircraft-sale', ''),
      req.method,
      body.length ? new Uint8Array(body) : undefined,
      undefined,
      req.headers,
    );
    requests.push({
      method: req.method,
      path,
      status: response.status,
      range: req.headers.range || null,
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});
await new Promise((r) => server.listen(18763, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    const target = new URL(url);
    if (target.origin === origin) await route.continue();
    else if (target.origin === 'https://sale-api.rogerwilcoaviation.com') {
      if (target.pathname === '/browse' && browseFailures > 0) {
        browseFailures--;
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Synthetic unavailable inventory' }),
        });
      }
      const response =
        target.pathname === '/browse'
          ? await f.call('/browse' + target.search)
          : await f.call(target.pathname);
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    } else {
      blocked.push(url);
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(origin + '/');
  await page.locator('a[href="/aircraft-for-sale"]:visible').first().click();
  await page.waitForURL(origin + '/aircraft-for-sale');
  results.push(
    'PASS actual exported Next home-to-aircraft navigation and hydration',
  );
  await page.getByRole('button', { name: 'Seller Login', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('browser@example.test');
  const mailer = f.env.MAILER.fetch;
  f.env.MAILER.fetch = async () => new Response(null, { status: 503 });
  await page.getByRole('button', { name: 'Send Code', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'We could not send a code.' })
    .waitFor();
  f.env.MAILER.fetch = mailer;
  await page.getByRole('button', { name: 'Send Code', exact: true }).click();
  results.push('PASS full-shell mail failure feedback and retry');
  await page.getByLabel('Verification code').waitFor();
  await page
    .getByLabel('Verification code')
    .fill(f.mail.at(-1).code === '000000' ? '111111' : '000000');
  await page
    .getByRole('button', { name: 'Verify & Sign In', exact: true })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Incorrect code.' })
    .waitFor();
  await page.getByLabel('Verification code').fill(f.mail.at(-1).code);
  await page
    .getByRole('button', { name: 'Verify & Sign In', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'My Listings', exact: true })
    .waitFor();
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.rwas_sale_v2).token,
  );
  results.push('PASS single-use fake-mail login and invalid-code UX');
  await page
    .getByRole('button', { name: 'List Your Aircraft', exact: true })
    .click();
  await page
    .getByText('What is your aircraft N-number?', { exact: false })
    .waitFor();
  for (const answer of [
    'N123AB',
    'Synthetic',
    'Jerry Draft',
    '2000',
    '1',
    'Local synthetic conversation',
    'skip',
  ]) {
    await page.locator('.jerry-widget-text-input').fill(answer);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/intake')),
      page.locator('.jerry-widget-send').click(),
    ]);
    await page.waitForFunction(
      () => !document.querySelector('.jerry-widget-send').disabled,
    );
  }
  await page
    .getByRole('heading', { name: 'Listing Draft', exact: true })
    .waitFor();
  assert.equal(requests.filter((r) => r.path.endsWith('/intake')).length, 8);
  assert.equal(
    await page.getByLabel('Model', { exact: true }).inputValue(),
    'Jerry Draft',
  );
  assert.equal(Object.keys(f.state().listings).length, 0);
  results.push(
    'PASS actual widget transfers draft to panel without create/publish',
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Photos, video and records' })
    .waitFor();
  let l = Object.values(f.state().listings)[0];
  assert.equal(l.status, 'draft');
  results.push('PASS draft saved before media or review');
  const inputs = page.locator('dialog input[type=file]');
  await inputs.nth(0).setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(png) },
    { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(png) },
  ]);
  await page.getByText('Photos (2)', { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('dialog img')];
    return (
      images.length === 2 &&
      images.every(
        (image) =>
          image.complete &&
          image.naturalWidth === 1 &&
          image.naturalHeight === 1,
      )
    );
  });
  results.push('PASS real uploaded PNG photos decode in the seller previews');
  await page.getByRole('button', { name: 'Move Earlier', exact: true }).click();
  await page
    .getByRole('button', { name: 'Move Earlier', exact: true })
    .waitFor();
  assert.equal(
    requests.filter((r) => r.path.includes('/photos/order')).at(-1).status,
    200,
  );
  await inputs.nth(1).setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from(mp4),
  });
  await page.getByText('Videos (1)', { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const video = document.querySelector('dialog video');
    return (
      video &&
      video.readyState >= 1 &&
      video.videoWidth === 320 &&
      video.videoHeight === 180 &&
      video.duration >= 1.9
    );
  });
  await page.locator('dialog video').evaluate(async (video) => {
    video.muted = true;
    video.currentTime = 1;
    await new Promise((resolve) =>
      video.addEventListener('seeked', resolve, { once: true }),
    );
    await video.play();
  });
  await page.waitForFunction(
    () => document.querySelector('dialog video')?.currentTime > 1.2,
  );
  await page.locator('dialog video').evaluate((video) => video.pause());
  results.push(
    'PASS real uploaded H.264 video decodes metadata, seeks and plays in the seller preview',
  );
  await inputs.nth(2).setInputFiles({
    name: 'log.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await page.getByText('Airframe logbooks (1)', { exact: true }).waitFor();
  results.push('PASS photos, reorder, video and PDF authenticated association');
  await page
    .getByRole('button', { name: 'Submit for Review', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'My Listings', exact: true })
    .waitFor();
  l = Object.values(f.state().listings)[0];
  assert.equal(l.status, 'pending');
  const staffContext = await browser.newContext({
    extraHTTPHeaders: { Authorization: 'Bearer fixture-reviewer' },
  });
  await staffContext.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === origin)
      await route.continue();
    else {
      blocked.push(route.request().url());
      await route.abort();
    }
  });
  await staffContext.addCookies([
    { name: 'fixture_reviewer', value: 'approved', url: origin },
  ]);
  const staff = await staffContext.newPage();
  staff.on('dialog', (d) => d.accept());
  await staff.goto(origin + '/seller-review');
  await staff.getByRole('button', { name: 'Load Review Queue' }).click();
  const record = staff.getByRole('link', { name: 'log.pdf' });
  await record.waitFor();
  const downloaded = await Promise.all([
    staff.waitForEvent('download'),
    record.click(),
  ]);
  assert.equal(downloaded[0].suggestedFilename(), 'log.pdf');
  assert.deepEqual(
    new Uint8Array(await readFile(await downloaded[0].path())),
    pdf,
  );
  const pdfRendered = join(artifacts, 'full-shell-downloaded-pdf.png');
  const parsedPdf = execFileSync(
    process.env.PDF_VERIFY_PYTHON || 'python3',
    [
      'tests/aircraft-sale/pdf-verify.py',
      await downloaded[0].path(),
      pdfRendered,
    ],
    { encoding: 'utf8' },
  ).trim();
  results.push(parsedPdf);
  await staff.getByRole('button', { name: 'Approve and Publish' }).click();
  await staff
    .getByRole('button', { name: 'Approve and Publish' })
    .waitFor({ state: 'detached' });
  assert.equal(Object.values(f.state().listings)[0].status, 'active');
  await staffContext.close();
  results.push(
    'PASS actual staff queue downloads private PDF and approves exact revision',
  );
  const buyer = await context.newPage();
  buyer.on('pageerror', (e) => errors.push(e.message));
  await buyer.goto(origin + '/');
  await buyer
    .locator('a.bs-listing[href="/aircraft-for-sale/' + l.id + '"]')
    .waitFor();
  await buyer.goto(origin + '/aircraft-for-sale');
  await buyer
    .locator('a.a4s-card[href="/aircraft-for-sale/' + l.id + '"]')
    .click();
  await buyer
    .getByRole('heading', { name: '2000 Synthetic Jerry Draft', exact: true })
    .waitFor();
  assert.equal(await buyer.locator('video').count(), 1);
  await buyer.waitForFunction(() => {
    const video = document.querySelector('video');
    return (
      video &&
      video.readyState >= 1 &&
      video.videoWidth === 320 &&
      video.duration >= 1.9
    );
  });
  await buyer.locator('video').evaluate(async (video) => {
    video.muted = true;
    video.currentTime = 1;
    await new Promise((resolve) =>
      video.addEventListener('seeked', resolve, { once: true }),
    );
    await video.play();
  });
  await buyer.waitForFunction(
    () => document.querySelector('video')?.currentTime > 1.2,
  );
  await buyer.locator('video').evaluate((video) => video.pause());
  assert.ok(
    requests.some(
      (r) => r.path.includes('/files/') && r.range && r.status === 206,
    ),
  );
  results.push(
    'PASS public video range streaming, decoded metadata, playback and seeking',
  );
  assert.equal(await buyer.locator('a[href*="log.pdf"]').count(), 0);
  const privateStatus = await buyer.evaluate(
    async (key) =>
      (await fetch('/api/aircraft-sale/files/' + encodeURIComponent(key)))
        .status,
    Object.values(f.state().files).find((x) => x.category === 'airframe').key,
  );
  assert.equal(privateStatus, 401);
  results.push(
    'PASS live homepage/card detail navigation, public media and private-record denial',
  );
  // The bounded intake launch deliberately preserves the existing read-only
  // catalogue behavior: an external refresh outage retains the static legacy cards.
  browseFailures = 2;
  await buyer.goto(origin + '/aircraft-for-sale');
  await buyer.locator('.a4s-card').first().waitFor();
  assert.ok((await buyer.locator('.a4s-card').count()) > 0);
  browseFailures = 0;
  await buyer.reload();
  await buyer.locator('.a4s-card').waitFor();
  results.push('PASS legacy inventory remains readable across refresh outage');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Sold', exact: true }).click();
  await page.getByText('sold', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByText('archived', { exact: true }).waitFor();
  await buyer.goto(origin + '/');
  await buyer
    .getByText('No aircraft currently listed.', { exact: false })
    .waitFor();
  assert.equal(await buyer.locator('a.bs-listing').count(), 0);
  const stale = await buyer.goto(origin + '/aircraft-for-sale/' + l.id);
  assert.ok([401, 404].includes(stale.status()));
  assert.equal(
    await buyer
      .getByRole('heading', { name: '2000 Synthetic Jerry Draft', exact: true })
      .count(),
    0,
  );
  await buyer.close();
  results.push('PASS archive removes homepage/inventory and old public detail');
  await page
    .getByRole('button', { name: 'Restore to Draft', exact: true })
    .click();
  await page.getByText('draft', { exact: true }).waitFor();
  results.push(
    'PASS submit/revision review, pause/resume/sold/archive/restore',
  );
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Model', { exact: true }).fill('Changed');
  await page.getByRole('textbox', { name: /^Description/ }).fill('');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page
    .getByText('Draft saved. Add media, then submit for review.', {
      exact: true,
    })
    .waitFor();
  assert.equal(Object.values(f.state().listings)[0].fields.description, '');
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  await page.getByText('deleted', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Delete Permanently', exact: true })
    .click();
  await page
    .getByText('No listings yet. Save a draft to get started.', { exact: true })
    .waitFor();
  assert.equal(f.objects.size, 0);
  results.push(
    'PASS edit, reversible trash and confirmed permanent file cleanup',
  );
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByLabel('name', { exact: true }).fill('Synthetic Name');
  await page.getByRole('button', { name: 'Save Profile', exact: true }).click();
  await page.getByText('Profile updated.', { exact: true }).waitFor();
  await page
    .getByLabel('New email', { exact: true })
    .fill('changed@example.test');
  await page
    .getByRole('button', { name: 'Send New Email Code', exact: true })
    .click();
  await page.getByLabel('New email code', { exact: true }).waitFor();
  await page
    .getByLabel('New email code', { exact: true })
    .fill(f.mail.at(-1).code);
  await page
    .getByRole('button', { name: 'Verify New Email', exact: true })
    .click();
  await page
    .getByText(
      'Email verified and updated. Other sessions have been revoked.',
      { exact: true },
    )
    .waitFor();
  results.push('PASS account profile and verified email change');
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  assert.ok(
    await page
      .locator('dialog')
      .evaluate((el) => el.getBoundingClientRect().width <= 390),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: join(artifacts, 'full-shell-mobile.png'),
    fullPage: true,
  });
  results.push('PASS mobile modal width and no horizontal overflow');
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await page
    .getByRole('button', { name: 'New Manual Listing', exact: true })
    .click();
  for (const [label, value] of [
    ['Make', 'Synthetic'],
    ['Model', 'Mobile'],
    ['Year', '2000'],
    ['Asking price (USD)', '1'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Photos, video and records' })
    .waitFor();
  const mobileFiles = page.locator('dialog input[type=file]');
  await mobileFiles.nth(0).setInputFiles({
    name: 'mobile.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  });
  await page.getByText('Photos (1)', { exact: true }).waitFor();
  await mobileFiles.nth(2).setInputFiles({
    name: 'invalid.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a PDF'),
  });
  await page
    .getByRole('alert')
    .filter({ hasText: 'Use a valid JPG' })
    .waitFor();
  await mobileFiles.nth(2).setInputFiles({
    name: 'mobile.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await page.getByText('Airframe logbooks (1)', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Submit for Review', exact: true })
    .click();
  await page.getByText('pending', { exact: true }).waitFor();
  const mobile = Object.values(f.state().listings)[0];
  assert.equal((await approve(f, mobile)).status, 200);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByText('archived', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Restore to Draft', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete Permanently', exact: true })
    .click();
  await page
    .getByText('No listings yet. Save a draft to get started.', { exact: true })
    .waitFor();
  assert.equal(f.objects.size, 0);
  results.push(
    'PASS mobile manual listing, photo/PDF rejection-retry, review/lifecycle and purge',
  );
  await page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page
    .getByRole('button', { name: 'Seller Login', exact: true })
    .waitFor();
  assert.equal((await f.call('/account', 'GET', undefined, token)).status, 401);
  results.push('PASS UI logout revokes server token');
  assert.equal(errors.length, 0);
  assert.ok(blocked.every((url) => new URL(url).origin !== origin));
} catch (e) {
  results.push('FAIL ' + e.stack);
  process.exitCode = 1;
  if (browser?.contexts()[0]?.pages()[0])
    await browser
      .contexts()[0]
      .pages()[0]
      .screenshot({
        path: join(artifacts, 'full-shell-failure.png'),
        fullPage: true,
      });
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await writeFile(
    join(artifacts, 'full-shell-results.json'),
    JSON.stringify(
      {
        results,
        requests,
        blocked,
        errors,
        chatCalls,
        scope:
          'Actual production Next static export and navigation, seller/staff dynamically loaded bundles, deferred Jerry widget; disposable v2 API/mail/storage; all external browser traffic blocked. Dynamic details use the same Worker API route as Pages; no cloud settings.',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { results, requests: requests.length, blocked, errors, chatCalls },
      null,
      2,
    ),
  );
}
