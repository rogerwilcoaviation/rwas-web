import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fixture, png, pdf, mp4 } from './fixture.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const f = fixture(),
  results = [],
  requests = [],
  blocked = [],
  errors = [];
const origin = 'http://127.0.0.1:18762';
const compiled = await build({
  stdin: {
    contents:
      "import React from 'react';import {createRoot}from 'react-dom/client';import Seller from './app/aircraft-for-sale/seller-auth-panel';createRoot(document.getElementById('root')).render(<Seller/>);",
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const staffCompiled = await build({
  stdin: {
    contents:
      "import React from 'react';import {createRoot}from 'react-dom/client';import Review from './app/seller-review/page';createRoot(document.getElementById('root')).render(<Review/>);",
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const widget = await readFile('public/jerry-widget.js', 'utf8');
let chatCalls = 0;
const server = createServer(async (req, res) => {
  try {
    const path = req.url;
    if (path === '/aircraft-for-sale') {
      res.setHeader('Content-Type', 'text/html;charset=UTF-8');
      res.end(
        '<!doctype html><html><body><h1>Synthetic Seller Acceptance</h1><div id="root"></div><script src="/bundle.js"></script><script src="/jerry-widget.js"></script></body></html>',
      );
      return;
    }
    if (path === '/seller-review') {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html><body><div id="root"></div><script src="/staff.js"></script></body></html>',
      );
      return;
    }
    if (path === '/staff.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(staffCompiled.outputFiles[0].text);
      return;
    }
    if (path === '/bundle.js' || path === '/jerry-widget.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(path === '/bundle.js' ? compiled.outputFiles[0].text : widget);
      return;
    }
    // Local fake edge identity; never a production credential or cookie.
    if (
      (req.headers.cookie || '').includes('fixture_reviewer=approved') &&
      path.startsWith('/api/aircraft-sale/admin/')
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
await new Promise((r) => server.listen(18762, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) await route.continue();
    else {
      blocked.push(url);
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(origin + '/aircraft-for-sale');
  await page.getByRole('button', { name: 'Seller Login', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('browser@example.test');
  await page.getByRole('button', { name: 'Send Code', exact: true }).click();
  await page.getByLabel('Verification code').waitFor();
  await page.getByLabel('Verification code').fill('000000');
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
  await staff.getByRole('button', { name: 'Approve and Publish' }).click();
  await staff
    .getByRole('button', { name: 'Approve and Publish' })
    .waitFor({ state: 'detached' });
  assert.equal(Object.values(f.state().listings)[0].status, 'active');
  await staffContext.close();
  results.push(
    'PASS actual staff queue downloads private PDF and approves exact revision',
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Sold', exact: true }).click();
  await page.getByText('sold', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByText('archived', { exact: true }).waitFor();
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
    path: 'tests/aircraft-sale/mobile.png',
    fullPage: true,
  });
  results.push('PASS mobile modal width and no horizontal overflow');
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
  assert.equal(blocked.length, 0);
} catch (e) {
  results.push('FAIL ' + e.stack);
  process.exitCode = 1;
  if (browser?.contexts()[0]?.pages()[0])
    await browser.contexts()[0].pages()[0].screenshot({
      path: 'tests/aircraft-sale/browser-failure.png',
      fullPage: true,
    });
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    'tests/aircraft-sale/browser-results.json',
    JSON.stringify(
      {
        results,
        requests,
        blocked,
        errors,
        chatCalls,
        scope:
          'Actual seller component and Jerry widget, authenticated deterministic intake, memory-only actual v2 API/storage/mail. No full Next shell or cloud settings.',
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
