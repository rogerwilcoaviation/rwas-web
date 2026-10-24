import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');
const widget = await readFile('public/jerry-widget.js', 'utf8');
const publicModule = await readFile('public/jerry-public-chat.mjs', 'utf8');
async function fixture(run, { trusted = true, delayed = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let manual = 0, calls = 0, release;
  const errors = [];
  await context.addInitScript(() => {
    sessionStorage.setItem('jerry-chat-history', JSON.stringify([{ role: 'user', content: 'PRIVATE OLD HISTORY' }]));
    sessionStorage.setItem('rwas_sale_v2', JSON.stringify({ token: 'PRIVATE CORE TOKEN', email: 'private@example.test' }));
    window.rwasSaleSession = { token: 'PRIVATE CORE TOKEN', email: 'private@example.test' };
    window.rwasSellerRequestHeaders = () => { throw Error('Public chat must not read seller authority'); };
    document.addEventListener('rwas:open-manual-form', () => window.manualOpens = (window.manualOpens || 0) + 1);
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/aircraft-for-sale') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script src="/jerry-widget.js"></script></body></html>' });
    if (url.pathname === '/jerry-widget.js') return route.fulfill({ contentType: 'application/javascript', body: widget });
    if (url.pathname === '/jerry-public-chat.mjs') return route.fulfill({ contentType: 'application/javascript', body: publicModule });
    if (url.pathname === '/api/jerry/context') return route.fulfill({ json: { enabled: false } });
    assert.equal(url.href, 'https://rogerwilcoaviation.com/api/chat', 'No private account, action, upload or unknown endpoint');
    const headers = await request.allHeaders();
    for (const key of ['authorization', 'x-rwas-csrf', 'x-clerk-session-token', 'cookie']) assert.equal(headers[key], undefined);
    const body = request.postDataJSON();
    assert.equal(body.state, null); assert.equal(body.listingUi, false);
    assert.ok(!JSON.stringify(body).includes('PRIVATE'));
    assert.ok(!JSON.stringify(body).includes('private@example.test'));
    calls++;
    if (delayed) await new Promise(resolve => { release = resolve; });
    try { await route.fulfill({ json: { reply: 'Public shop guidance (605) 299-8178', publicFaqOnly: trusted, action: { type: 'listing_draft', draft: { private: true } } } }); } catch { /* aborted on account switch */ }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('https://www.rogerwilcoaviation.com/aircraft-for-sale');
    await page.getByRole('button', { name: 'Chat with Captain Jerry' }).click();
    await page.getByText('ONLINE — RWAS PUBLIC CHAT', { exact: true }).waitFor();
    await run({ page, calls: () => calls, release: () => release?.() });
    manual = await page.evaluate(() => window.manualOpens || 0);
    assert.deepEqual(errors, []);
    return { calls, manual };
  } finally { release?.(); await browser.close(); }
}
const send = async page => { await page.locator('.jerry-widget-text-input').fill('Hello'); await page.locator('.jerry-widget-send').click(); };
test('restored public chat sends only fresh public text, renders a real answer, ignores actions and retains manual seller entry', async () => {
  const result = await fixture(async ({ page }) => {
    assert.equal(await page.getByText('PRIVATE OLD HISTORY', { exact: true }).count(), 0);
    await page.evaluate(() => { window.drafts = 0; document.addEventListener('rwas:seller-draft', () => window.drafts++); window.jerryChat('PRIVATE SELLER SEED'); });
    await send(page);
    await page.getByText('Public shop guidance (605) 299-8178', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.drafts), 0);
    assert.ok((await page.evaluate(() => sessionStorage.getItem('jerry-chat-history'))).includes('PRIVATE OLD HISTORY'));
    await page.getByRole('button', { name: 'Continue listing manually' }).click();
    assert.equal(await page.locator('.jerry-widget-panel').isVisible(), false);
  });
  assert.equal(result.calls, 1); assert.equal(result.manual, 1);
});
test('public chat refuses an endpoint that does not confirm informational-only handling', async () => fixture(async ({ page }) => {
  await send(page);
  await page.getByRole('alert').filter({ hasText: 'temporarily unavailable' }).waitFor();
  assert.equal(await page.getByText('Public shop guidance (605) 299-8178', { exact: true }).count(), 0);
}, { trusted: false }));
test('account changes discard pending public replies and reset the transient public conversation', async () => fixture(async ({ page, calls, release }) => {
  await send(page);
  await page.waitForFunction(() => document.querySelector('.jerry-widget-send').disabled);
  while (calls() === 0) await new Promise(resolve => setTimeout(resolve, 10));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: null })));
  release();
  await page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
  assert.equal(await page.getByText('Public shop guidance (605) 299-8178', { exact: true }).count(), 0);
  assert.equal(await page.locator('.jerry-widget-row.user').count(), 0);
}, { delayed: true }));
