import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import { fixture } from './fixture.mjs';

// Real widget DOM + real in-memory business Worker. Only the provider identity
// reader is injected; no D1/provider/network credentials or hosted acceptance.
globalThis.crypto ||= webcrypto;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');
const widget = await readFile(new URL('../../public/jerry-widget.js', import.meta.url), 'utf8');
const origin = 'https://www.rogerwilcoaviation.com';
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function setup(options = {}) {
  const f = fixture();
  f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
  const current = { identity: { issuer: 'rwas-better-auth', subject: 'widget-user-a',
    providerSessionId: 'widget-session-a', email: 'widget-a@example.test', emailVerified: true,
    name: 'Synthetic Widget A', createdAt: Date.now() - 1000, expiresAt: Date.now() + 172800000 } };
  let session;
  if (options.legacy) session = { token: await f.login('legacy-widget@example.test'), email: 'legacy-widget@example.test' };
  else {
    Object.assign(f.env, { BETTER_AUTH_ENABLED: 'true', BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: 'local-widget-fixture-only-not-a-real-secret',
      RESEND_API_KEY: 'fixture-never-used-no-network', FROM_EMAIL: 'Fixture <widget@example.test>',
      SELLER_AUTH_DB: { prepare() { throw Error('Fixture never opens D1.'); } } });
    const store = new SellerStore(f.ctx, f.env, { readBetterAuthIdentity: async (_env, request) =>
      request.headers.get('Cookie')?.includes('rwas-seller.session_token=fixture-cookie-a') ? current.identity : null });
    f.callRaw = request => store.fetch(request);
    const response = await f.callRaw(f.request('/auth/better-auth', 'POST', {}, undefined,
      { Origin: origin, Cookie: 'rwas-seller.session_token=fixture-cookie-a' }));
    assert.equal(response.status, 200);
    const bridge = await response.json();
    session = { provider: 'better-auth', token: bridge.session, csrf: bridge.csrf,
      email: current.identity.email, name: current.identity.name,
      identityUserId: bridge.identityUserId, identitySessionId: bridge.identitySessionId };
  }
  if (options.noCsrf) delete session.csrf;
  if (options.noIdentity) delete session.identitySessionId;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addCookies([{ name: 'rwas-seller.session_token', value: 'fixture-cookie-a', url: origin, secure: true, httpOnly: true }]);
  await context.addInitScript(({ session, options }) => {
    window.rwasSaleSession = session;
    sessionStorage.setItem('rwas_sale_v2', JSON.stringify(session));
    window.__widgetFixture = { headerPaths: [], rejected: 0, drafts: [], loginPrompts: 0 };
    document.addEventListener('rwas:seller-draft', event => window.__widgetFixture.drafts.push(event.detail));
    document.addEventListener('rwas:open-seller-login', () => window.__widgetFixture.loginPrompts++);
    window.rwasSellerSessionRejected = token => {
      if (window.rwasSaleSession?.token !== token) return;
      window.__widgetFixture.rejected++;
      window.rwasSaleSession = null;
      sessionStorage.removeItem('rwas_sale_v2');
      document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: null }));
    };
    if (!options.noFacade) window.rwasSellerRequestHeaders = async path => {
      window.__widgetFixture.headerPaths.push(path);
      if (options.delayHeaders) await new Promise(resolve => { window.__releaseHeaders = resolve; });
      return { Authorization: 'Bearer ' + (options.wrongToken ? 'wrong-fixture' : session.token),
        'X-RWAS-CSRF': options.wrongCsrf ? 'wrong-fixture' : session.csrf,
        'X-Clerk-Session-Token': 'unrelated-provider-fixture', 'X-Unrelated': 'must-not-forward' };
    };
  }, { session, options });
  const observed = { seller: [], chat: 0, external: 0, errors: [] };
  let releaseResponse, markPaused;
  const paused = new Promise(resolve => { markPaused = resolve; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.href === origin + '/aircraft-for-sale') return route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script src="/jerry-widget.js"></script></body></html>' });
    if (url.href === origin + '/jerry-widget.js') return route.fulfill({ contentType: 'application/javascript', body: widget });
    if (url.origin === origin && ['/api/aircraft-sale/intake', '/api/aircraft-sale/draft'].includes(url.pathname)) {
      const headers = await request.allHeaders();
      assert.equal(headers.authorization, 'Bearer ' + session.token);
      assert.equal(headers['x-clerk-session-token'], undefined);
      assert.equal(headers['x-unrelated'], undefined);
      if (!options.legacy) {
        assert.equal(headers['x-rwas-csrf'], session.csrf);
        assert.ok(headers.cookie.includes('rwas-seller.session_token=fixture-cookie-a'));
      }
      observed.seller.push({ path: url.pathname, method: request.method() });
      const response = await f.callRaw(new Request(url, { method: request.method(), headers,
        ...(request.postData() ? { body: request.postData() } : {}) }));
      if (options.delayResponse) await new Promise(resolve => { releaseResponse = resolve; markPaused(); });
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    if (url.href === 'https://rogerwilcoaviation.com/api/chat') {
      const headers = await request.allHeaders();
      for (const key of ['authorization', 'x-rwas-csrf', 'x-clerk-session-token']) assert.equal(headers[key], undefined);
      observed.chat++;
      return route.fulfill({ json: { reply: 'Synthetic general chat.' } });
    }
    observed.external++;
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => observed.errors.push(error.message));
  await page.goto(origin + '/aircraft-for-sale');
  return { f, current, session, context, page, observed, paused, releaseResponse: () => releaseResponse?.() };
}
async function send(page, value, wait = true) {
  if (!await page.locator('.jerry-widget-text-input').isVisible()) await page.getByRole('button', { name: 'Chat with Captain Jerry' }).click();
  await page.locator('.jerry-widget-text-input').fill(value);
  await page.locator('.jerry-widget-send').click();
  if (wait) await page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
}
const state = page => page.evaluate(() => ({ ...window.__widgetFixture, current: window.rwasSaleSession }));
async function run(options, body) {
  const t = await setup(options);
  try {
    await body(t);
    assert.equal(Object.keys(t.f.state().listings).length, 0);
    assert.equal(t.observed.external, 0);
    assert.deepEqual(t.observed.errors, []);
  } finally { await t.context.close(); }
}

test('Better Auth Jerry intake and saved draft use CSRF, same-origin cookie and no Clerk token', async () => run({}, async t => {
  for (const text of ['I want to list my aircraft', 'N123AB', 'Synthetic', 'Widget', '2000', '1', 'Synthetic aircraft only', 'Synthetic avionics']) await send(t.page, text);
  assert.equal((await state(t.page)).drafts.length, 1);
  assert.equal(Object.keys(t.f.state().drafts).length, 1);
  await send(t.page, 'submit');
  const result = await state(t.page);
  assert.equal(result.drafts.length, 2);
  assert.equal(result.headerPaths.at(-1), '/api/aircraft-sale/draft');
  assert.equal(t.observed.seller.length, 9);
  assert.equal(t.observed.chat, 0);
}));

test('missing or mismatched Better Auth envelope/facade fails before any private request', async t => {
  for (const options of [{ noCsrf: true }, { noFacade: true }, { noIdentity: true }, { wrongCsrf: true }, { wrongToken: true }])
    await t.test(JSON.stringify(options), () => run(options, async value => {
      await send(value.page, 'I want to list my aircraft');
      assert.equal(value.observed.seller.length, 0);
      assert.equal((await state(value.page)).drafts.length, 0);
      assert.equal((await state(value.page)).rejected, 1);
    }));
});

test('immutable identity changes fence awaited headers even without a token change or session event', async () => run({ delayHeaders: true }, async t => {
  await send(t.page, 'I want to list my aircraft', false);
  await t.page.waitForFunction(() => typeof window.__releaseHeaders === 'function');
  await t.page.evaluate(() => {
    window.rwasSaleSession = { ...window.rwasSaleSession, identityUserId: 'successor-user', identitySessionId: 'successor-session' };
    window.__releaseHeaders();
  });
  await t.page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
  const result = await state(t.page);
  assert.equal(t.observed.seller.length, 0);
  assert.equal(result.current.identityUserId, 'successor-user');
  assert.equal(result.rejected, 0);
}));

test('late private draft response cannot hand off data after an account switch', async () => run({ delayResponse: true }, async t => {
  await send(t.page, 'submit', false);
  await t.paused;
  await t.page.evaluate(() => {
    const next = { ...window.rwasSaleSession, identityUserId: 'successor-user', identitySessionId: 'successor-session' };
    window.rwasSaleSession = next;
    document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: next }));
  });
  t.releaseResponse();
  await t.page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
  const result = await state(t.page);
  assert.equal(result.drafts.length, 0);
  assert.equal(result.current.identityUserId, 'successor-user');
  assert.equal(result.rejected, 0);
}));

test('real business Worker rejects changed provider session and widget clears only the matching envelope', async () => run({}, async t => {
  t.current.identity = { ...t.current.identity, providerSessionId: 'changed-provider-session' };
  await send(t.page, 'I want to list my aircraft');
  assert.equal(t.observed.seller.length, 1);
  assert.equal((await state(t.page)).rejected, 1);
  assert.equal((await state(t.page)).drafts.length, 0);
}));

test('general chat remains free of seller credentials and legacy email-code intake still works', async () => {
  await run({}, async t => { await send(t.page, 'Hello'); assert.equal(t.observed.chat, 1); assert.equal((await state(t.page)).headerPaths.length, 0); });
  await run({ legacy: true, noFacade: true }, async t => {
    await send(t.page, 'I want to list my aircraft');
    assert.equal(t.observed.seller.length, 1);
    assert.equal((await state(t.page)).headerPaths.length, 0);
    assert.equal((await state(t.page)).rejected, 0);
  });
});
