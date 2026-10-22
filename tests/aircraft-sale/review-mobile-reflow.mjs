// Focused ordinary Staff review reflow regression. All data and identity are local fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fixture, create, fields, submit, approve, pdf } from './fixture.mjs';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = resolve(process.env.TEST_ARTIFACT_DIR || join(sourceRoot, '../accessibility'));
await mkdir(artifacts, { recursive: true });
const exportedRoot = process.env.TEST_EXPORT_DIR ? resolve(process.env.TEST_EXPORT_DIR) : null;
const mode = exportedRoot ? 'built' : 'source-harness';
const reportPath = join(artifacts, `review-mobile-reflow-${mode}.json`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(await readFile(join(sourceRoot, 'app/seller-review/SellerReview.tsx')));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');
let harness;
if (!exportedRoot) {
  const { build } = await import('esbuild');
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import SellerReview from './app/seller-review/SellerReview'; createRoot(document.getElementById('app')).render(<SellerReview />);`,
      resolveDir: sourceRoot,
      sourcefile: 'review-mobile-harness.tsx',
      loader: 'tsx',
    },
    absWorkingDir: sourceRoot,
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  harness = result.outputFiles[0].contents;
}
const evidence = {
  mode, sourceHash, exportedRoot, node: process.version,
  scope: exportedRoot
    ? 'Actual local built Staff page served read-only with isolated in-memory seller APIs; all external browser and service requests blocked.'
    : 'Actual SellerReview React component bundled alone in a minimal flex page. This source harness is not a complete Next built-page check. All APIs and identities are local fixtures; all external requests blocked.',
  observations: [], servedAssets: [], externalRequestsBlocked: [], pageErrors: [], errors: [],
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!exportedRoot) {
      if (url.pathname === '/harness.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(harness); return; }
      if (url.pathname === '/seller-review') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local Staff review reflow</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;font:16px Arial,sans-serif}#app{display:flex;flex-direction:column;align-items:center;width:100%}button,input,textarea{font:inherit}h1{font-size:24px}h2{font-size:20px}button{padding:4px}</style></head><body><div id="app"></div><script src="/harness.js"></script></body></html>');
        return;
      }
      res.writeHead(404); res.end(); return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    if (!extname(path)) path += req.headers.rsc === '1' ? '.txt' : '.html';
    const full = resolve(exportedRoot, '.' + path);
    if (!full.startsWith(exportedRoot + '/')) throw Error('outside export');
    const bytes = await readFile(full);
    if (!evidence.servedAssets.some(x => x.path === path)) evidence.servedAssets.push({ path, sha256: hash(bytes) });
    res.setHeader('Content-Type', ({ '.html':'text/html', '.txt':'text/x-component', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' })[extname(full)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== origin) { evidence.externalRequestsBlocked.push({ service: url.origin }); return Promise.reject(Error('External service blocked')); }
  return nativeFetch(input, options);
};
const f = fixture();
f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
let browser;
try {
  const owner = await f.login('reflow-owner@example.test');
  const listing = await create(f, owner, { ...fields, model: 'Review Reflow' });
  const filename = 'N123ABAirframeLogbookVolumeOneScanned20261018OriginalRecords.pdf';
  const uploaded = await f.call('/upload?listingId=' + listing.id + '&category=airframe&filename=' + encodeURIComponent(filename), 'POST', pdf, owner);
  assert.equal(uploaded.status, 200, 'Supported PDF filename must be accepted by the real local worker fixture');
  assert.equal((await submit(f, owner, listing)).status, 200);
  const published = await create(f, owner, { ...fields, model: 'Published Reflow' });
  assert.equal((await submit(f, owner, published)).status, 200);
  assert.equal((await approve(f, published)).status, 200);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { evidence.externalRequestsBlocked.push({ browser: url.origin }); await route.abort(); return; }
    if (!url.pathname.startsWith('/api/aircraft-sale/')) { await route.continue(); return; }
    const body = request.postData() ? JSON.parse(request.postData()) : undefined;
    const response = await f.call(url.pathname.replace('/api/aircraft-sale', '') + url.search, request.method(), body, 'fixture-reviewer');
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  const page = await context.newPage();
  page.on('pageerror', e => evidence.pageErrors.push(e.message));
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto(origin + '/seller-review');
  const load = page.getByRole('button', { name: 'Load Review Queue', exact: true });
  await load.click();
  await page.getByRole('link', { name: filename, exact: true }).waitFor();
  async function verifyLayout(name) {
    await page.waitForFunction(() => ![...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Load Review Queue')?.disabled);
    const layout = await page.locator('main').evaluate(main => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      main: { left: main.getBoundingClientRect().left, right: main.getBoundingClientRect().right },
      actions: [...main.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), left: b.getBoundingClientRect().left, right: b.getBoundingClientRect().right, disabled: b.disabled })),
      filename: (() => { const a = main.querySelector('a[download]'); return { text: a.textContent, wrap: getComputedStyle(a).overflowWrap, lineRects: [...a.getClientRects()].map(r => ({left:r.left,right:r.right})) }; })(),
    }));
    evidence.observations.push({ name, ...layout });
    assert.equal(layout.viewport, 390);
    assert.ok(layout.documentWidth <= layout.viewport, JSON.stringify(layout));
    assert.ok(layout.main.left >= 0 && layout.main.right <= layout.viewport);
    assert.ok(layout.actions.length >= 4, 'Load, approve, request changes and unpublish are represented');
    for (const action of layout.actions) assert.ok(action.left >= 0 && action.right <= layout.viewport, `${action.label} must remain entirely within the viewport`);
    assert.ok(layout.filename.lineRects.every(r => r.left >= 0 && r.right <= layout.viewport));
    await page.screenshot({ path: join(artifacts, `review-mobile-reflow-${mode}-${name}.png`), fullPage: true });
  }
  await verifyLayout('supported-pdf-filename');
  const longModel = 'LongAircraftModel'.repeat(14);
  const edited = await f.call('/listings/' + listing.id, 'PUT', { ...fields, model: longModel, description: 'UnbrokenDescription'.repeat(40) }, owner);
  assert.equal(edited.status, 200);
  assert.equal((await submit(f, owner, listing)).status, 200);
  await load.click();
  await page.getByRole('heading', { name: '2000 Synthetic ' + longModel, exact: true }).waitFor();
  await verifyLayout('long-field-values');
  await page.getByRole('textbox', { name: 'Review note', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Approve and Publish');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Request Changes');
  evidence.observations.push({ name: 'keyboard-review-actions', result: 'Review note → Approve and Publish → Request Changes via Tab' });
  assert.deepEqual(evidence.pageErrors, []);
  evidence.passed = true;
} catch (error) {
  evidence.errors.push(error.stack); process.exitCode = 1;
} finally {
  globalThis.fetch = nativeFetch;
  await browser?.close();
  server.closeAllConnections(); await new Promise(r => server.close(r));
  await writeFile(reportPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: !!evidence.passed, mode, reportPath, observations: evidence.observations, pageErrors: evidence.pageErrors, errors: evidence.errors, externalRequestsBlocked: evidence.externalRequestsBlocked.length }, null, 2));
}
