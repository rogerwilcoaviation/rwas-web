import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, webcrypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fixture } from './fixture.mjs';
import { CLERK_PRODUCTION } from '../../workers/aircraft-sale/clerk-production.mjs';

// Synthetic UI + real in-memory Worker contract. This is neither a live Clerk
// SDK/provider test nor acceptance evidence for a production seller account.
globalThis.crypto ||= webcrypto;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ||
  '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');
const widget = await readFile(new URL('../../public/jerry-widget.js', import.meta.url), 'utf8');
const origin = CLERK_PRODUCTION.origin;
// Production-mode config requires this prefix. The suffix is an explicit local
// placeholder, and every provider fetch below is intercepted by this fixture.
const secret = ['sk', 'live', 'LOCAL_WIDGET_FIXTURE_ONLY'].join('_');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
Object.assign(jwk, { kid: 'widget-fixture', alg: 'RS256', use: 'sig' });
const providerSession = JSON.parse(await readFile(new URL('./fixtures/clerk-backend-session-2025-04-10.json', import.meta.url), 'utf8'));
const providerUser = JSON.parse(await readFile(new URL('./fixtures/clerk-backend-user-2025-04-10.json', import.meta.url), 'utf8'));
Object.assign(providerSession, {
  id: 'sess_WidgetFixture', user_id: 'user_WidgetFixture', status: 'active',
  expire_at: Date.now() + 3600000, created_at: Date.now() - 10000,
});
Object.assign(providerUser, {
  id: providerSession.user_id, primary_email_address_id: 'email_widget',
  password_last_updated_at: 1000, first_name: 'Synthetic', last_name: 'Widget',
});
Object.assign(providerUser.email_addresses[0], {
  id: 'email_widget', email_address: 'widget-owner@example.test',
});
let jwtNumber = 0;
function jwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: CLERK_PRODUCTION.issuer, aud: CLERK_PRODUCTION.audience, azp: origin,
    sub: providerUser.id, sid: providerSession.id,
    iat: Math.floor(Date.now() / 1000) - 1, exp: Math.floor(Date.now() / 1000) + 300,
    jti: 'synthetic-widget-' + (++jwtNumber),
  })).toString('base64url');
  const input = header + '.' + payload;
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
}
const savedFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url) === CLERK_PRODUCTION.issuer + '/.well-known/jwks.json')
    return Response.json({ keys: [jwk] });
  assert.equal(init.headers.Authorization, 'Bearer ' + secret);
  assert.equal(init.headers['Clerk-API-Version'], '2025-04-10');
  if (String(url) === 'https://api.clerk.com/v1/sessions/' + providerSession.id)
    return Response.json(providerSession);
  if (String(url) === 'https://api.clerk.com/v1/users/' + providerUser.id)
    return Response.json(providerUser);
  throw new Error('Outbound service request blocked by widget fixture');
};

let browser;
const results = [];
async function setup(options = {}) {
  providerSession.status = 'active';
  const f = fixture();
  Object.assign(f.env, {
    CLERK_PRODUCTION_ENABLED: 'true', CLERK_PRODUCTION_SECRET_KEY: secret,
    PUBLIC_LISTINGS_ENABLED: 'false', AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
  });
  const authHeaders = { Origin: origin, 'X-Clerk-Session-Token': jwt() };
  const start = await f.call('/auth/clerk-production/start', 'POST', {}, undefined, authHeaders);
  assert.equal(start.status, 200);
  const finish = await f.call('/auth/clerk-production/finish', 'POST', { nonce: (await start.json()).nonce }, undefined, authHeaders);
  assert.equal(finish.status, 200);
  const authenticated = await finish.json();
  const session = {
    provider: 'clerk-production', token: authenticated.session, csrf: authenticated.csrf,
    email: 'widget-owner@example.test', name: 'Synthetic Widget',
  };
  if (options.noCsrf) delete session.csrf;
  const requestTokens = Array.from({ length: 64 }, jwt);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const observed = { seller: [], chat: 0, deniedExternal: 0, errors: [] };
  let releaseResponse;
  let markResponsePaused;
  const responsePaused = new Promise((resolve) => { markResponsePaused = resolve; });
  await context.addInitScript(({ session, requestTokens, options }) => {
    window.rwasSaleSession = session;
    sessionStorage.setItem('rwas_sale_v2', JSON.stringify(session));
    window.__widgetFixture = { headerPaths: [], rejected: 0, drafts: [], loginPrompts: 0, writesContainJwt: false };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (requestTokens.some((token) => String(value).includes(token)))
        window.__widgetFixture.writesContainJwt = true;
      return originalSetItem.call(this, key, value);
    };
    document.addEventListener('rwas:seller-draft', (event) => window.__widgetFixture.drafts.push(event.detail));
    document.addEventListener('rwas:open-seller-login', () => window.__widgetFixture.loginPrompts++);
    window.rwasSellerSessionRejected = (token) => {
      if (window.rwasSaleSession?.token !== token) return;
      window.__widgetFixture.rejected++;
      window.rwasSaleSession = null;
      sessionStorage.removeItem('rwas_sale_v2');
      document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: null }));
    };
    if (!options.noFacade) window.rwasSellerRequestHeaders = async (path) => {
      window.__widgetFixture.headerPaths.push(path);
      if (options.delayHeaders) await new Promise((resolve) => { window.__releaseHeaders = resolve; });
      if (options.facadeError) throw Object.assign(new Error('Synthetic provider failure'), { status: options.facadeError });
      const fresh = requestTokens[window.__widgetFixture.headerPaths.length - 1];
      return {
        Authorization: 'Bearer ' + (options.wrongCore ? 'stale-core-fixture' : session.token),
        'X-RWAS-CSRF': options.wrongCsrf ? 'wrong-csrf-fixture' : session.csrf,
        ...(options.noProviderToken ? {} : { 'X-Clerk-Session-Token': fresh }),
        'X-Unrelated-Fixture-Header': 'must-not-be-forwarded',
      };
    };
  }, { session, requestTokens, options });
  const pageOrigin = options.preview ? 'https://widget-preview.example.test' : origin;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href === pageOrigin + '/aircraft-for-sale') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script src="/jerry-widget.js"></script></body></html>' });
    } else if (url.href === pageOrigin + '/jerry-widget.js') {
      await route.fulfill({ contentType: 'application/javascript', body: widget });
    } else if (url.origin === origin && ['/api/aircraft-sale/intake', '/api/aircraft-sale/draft'].includes(url.pathname)) {
      const headers = await request.allHeaders();
      assert.equal(headers.authorization, 'Bearer ' + session.token);
      assert.equal(headers['x-rwas-csrf'], session.csrf);
      assert.equal(headers['x-clerk-session-token'], requestTokens[observed.seller.length]);
      assert.equal(headers['x-unrelated-fixture-header'], undefined);
      assert.equal(request.method(), url.pathname.endsWith('/draft') ? 'GET' : 'POST');
      observed.seller.push({ path: url.pathname, method: request.method() });
      const response = options.backendStatus
        ? Response.json({}, { status: options.backendStatus })
        : await f.callRaw(new Request(url, { method: request.method(), headers,
            ...(request.postData() ? { body: request.postData() } : {}) }));
      if (!options.backendStatus) assert.equal(response.status, options.revokedProvider ? 401 : 200);
      if (options.delayResponse) await new Promise((resolve) => {
        releaseResponse = resolve;
        markResponsePaused();
      });
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    } else if (url.href === 'https://rogerwilcoaviation.com/api/chat') {
      const headers = await request.allHeaders();
      for (const field of ['authorization', 'x-rwas-csrf', 'x-clerk-session-token']) assert.equal(headers[field], undefined);
      observed.chat++;
      await route.fulfill({ json: { reply: 'Synthetic general chat reply.', action: { type: 'listing_draft', draft: { make: 'Must not hand off' } } } });
    } else {
      observed.deniedExternal++;
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => observed.errors.push(error.message));
  await page.goto(pageOrigin + '/aircraft-for-sale');
  if (options.revokedProvider) providerSession.status = 'revoked';
  return { f, page, context, observed, session, responsePaused, releaseResponse: () => releaseResponse?.() };
}
async function send(page, text, wait = true) {
  if (!(await page.locator('.jerry-widget-text-input').isVisible()))
    await page.getByRole('button', { name: 'Chat with Captain Jerry' }).click();
  await page.locator('.jerry-widget-text-input').fill(text);
  await page.locator('.jerry-widget-send').click();
  if (wait) await page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
}
async function state(page) {
  return page.evaluate(() => ({ ...window.__widgetFixture,
    stored: sessionStorage.getItem('rwas_sale_v2'), currentToken: window.rwasSaleSession?.token || null,
    history: JSON.parse(sessionStorage.getItem('jerry-chat-history')),
  }));
}
async function rejectAlert(page, status = 401) {
  const alert = page.getByRole('alert');
  assert.equal(await alert.isVisible(), true);
  assert.ok((await alert.textContent()).startsWith(status === 403
    ? 'Your account cannot access this listing conversation.'
    : 'Your seller session has expired. Sign in again to continue.'));
}
async function run(name, options, assertions) {
  const t = await setup(options);
  try {
    await assertions(t);
    assert.equal(Object.keys(t.f.state().listings).length, 0);
    assert.equal((await state(t.page)).writesContainJwt, false);
    assert.deepEqual(t.observed.errors, []);
    assert.equal(t.observed.deniedExternal, 0);
    results.push({ case: name, result: 'PASS', scope: 'synthetic canonical UI and in-memory Worker; no live provider' });
    console.log('PASS ' + name);
  } finally { await t.context.close(); }
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Synthetic response fixture timed out')), 5000);
    })]);
  } finally { clearTimeout(timer); }
}
try {
  browser = await chromium.launch({ headless: true });
  await run('Clerk authenticated category intake and saved draft retrieval stay private', {}, async ({ page, f, observed }) => {
    for (const text of ['I want to create a listing', 'other', 'aviation-businesses', 'Synthetic business', 'Synthetic', 'Widget', 'skip', 'Used', 'sale', 'USD', 'amount', '1', 'Synthetic location', 'Synthetic other', 'skip', 'skip'])
      await send(page, text);
    const ready = await state(page);
    assert.equal(ready.drafts.length, 1);
    assert.equal(ready.drafts[0].make, 'Synthetic');
    assert.equal(ready.headerPaths.length, 16);
    assert.equal(Object.keys(f.state().drafts).length, 1);
    assert.equal((await f.call('/browse')).status, 200);
    assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
    await send(page, 'submit');
    const saved = await state(page);
    assert.equal(saved.drafts.length, 2);
    assert.equal(saved.headerPaths.at(-1), '/api/aircraft-sale/draft');
    assert.equal(observed.seller.length, 17);
    assert.equal(observed.chat, 0);
  });
  for (const [name, options, status] of [
    ['missing mounted Clerk facade', { noFacade: true }, 401],
    ['missing Clerk CSRF envelope', { noCsrf: true }, 403],
    ['facade failure', { facadeError: 401 }, 401],
    ['facade returns a stale core token', { wrongCore: true }, 401],
    ['facade returns the wrong CSRF value', { wrongCsrf: true }, 401],
    ['facade omits provider session token', { noProviderToken: true }, 401],
    ['Clerk seller credentials blocked on preview origin', { preview: true }, 403],
  ]) await run(name, options, async ({ page, observed }) => {
    await send(page, 'I want to list my aircraft');
    await rejectAlert(page, status);
    const captured = await state(page);
    assert.equal(captured.stored, null);
    assert.equal(captured.rejected, 1);
    assert.equal(captured.drafts.length, 0);
    assert.equal(observed.seller.length, 0);
    assert.equal(observed.chat, 0);
  });
  for (const [name, options, status] of [
    ['real Worker rejects revoked provider session', { revokedProvider: true }, 401],
    ['backend ownership denial clears matching seller panel session', { backendStatus: 403 }, 403],
  ]) await run(name, options, async ({ page, observed }) => {
    await send(page, 'I want to list my aircraft');
    await rejectAlert(page, status);
    const captured = await state(page);
    assert.equal(captured.rejected, 1);
    assert.equal(captured.stored, null);
    assert.equal(observed.seller.length, 1);
    assert.equal(captured.drafts.length, 0);
  });
  await run('general chat never receives seller headers or draft handoff', {}, async ({ page, observed }) => {
    await send(page, 'Hello');
    const captured = await state(page);
    assert.equal(captured.headerPaths.length, 0);
    assert.equal(captured.drafts.length, 0);
    assert.equal(captured.rejected, 0);
    assert.equal(observed.seller.length, 0);
    assert.equal(observed.chat, 1);
  });
  await run('seller service outage preserves the current session', { backendStatus: 503 }, async ({ page, observed, session }) => {
    await send(page, 'I want to list my aircraft');
    assert.ok((await page.getByRole('alert').textContent()).startsWith('Aircraft listing service is temporarily unavailable.'));
    const captured = await state(page);
    assert.equal(captured.currentToken, session.token);
    assert.equal(captured.rejected, 0);
    assert.equal(observed.seller.length, 1);
  });
  await run('signout event overrides old storage', {}, async ({ page, observed }) => {
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: null })));
    await send(page, 'I want to list my aircraft');
    const captured = await state(page);
    assert.ok(captured.stored); // Deliberately stale storage must not authorize.
    assert.equal(captured.loginPrompts, 1);
    assert.equal(captured.headerPaths.length, 0);
    assert.equal(observed.seller.length, 0);
  });
  for (const replace of [false, true]) await run(replace ? 'session replacement fences pending headers without clearing successor' : 'signout fences pending headers', { delayHeaders: true }, async ({ page, observed }) => {
    await send(page, 'I want to list my aircraft', false);
    await page.waitForFunction(() => typeof window.__releaseHeaders === 'function');
    await page.evaluate((replace) => {
      const next = replace ? { ...window.rwasSaleSession, token: 'successor-core-fixture' } : null;
      window.rwasSaleSession = next;
      if (next) sessionStorage.setItem('rwas_sale_v2', JSON.stringify(next));
      else sessionStorage.removeItem('rwas_sale_v2');
      document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: next }));
      window.__releaseHeaders();
    }, replace);
    await page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
    await rejectAlert(page);
    const captured = await state(page);
    assert.equal(captured.currentToken, replace ? 'successor-core-fixture' : null);
    assert.equal(captured.rejected, 0);
    assert.equal(observed.seller.length, 0);
  });
  await run('signout discards an already requested private draft response', { delayResponse: true }, async (t) => {
    await send(t.page, 'submit', false);
    await t.page.waitForFunction(() => window.__widgetFixture.headerPaths.length === 1);
    // The route pauses only after the real local Worker has returned its result.
    await t.page.waitForFunction(() => document.querySelector('.jerry-widget-send').disabled);
    await bounded(t.responsePaused);
    await t.page.evaluate(() => {
      window.rwasSaleSession = null;
      sessionStorage.removeItem('rwas_sale_v2');
      document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: null }));
    });
    t.releaseResponse();
    await t.page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
    await rejectAlert(t.page);
    assert.equal((await state(t.page)).drafts.length, 0);
    assert.equal((await state(t.page)).rejected, 0);
  });
  await run('late ownership denial cannot clear a replacement session', { delayResponse: true, backendStatus: 403 }, async (t) => {
    await send(t.page, 'submit', false);
    await bounded(t.responsePaused);
    await t.page.evaluate(() => {
      const next = { ...window.rwasSaleSession, token: 'replacement-core-fixture' };
      window.rwasSaleSession = next;
      sessionStorage.setItem('rwas_sale_v2', JSON.stringify(next));
      document.dispatchEvent(new CustomEvent('rwas:session-changed', { detail: next }));
    });
    t.releaseResponse();
    await t.page.waitForFunction(() => !document.querySelector('.jerry-widget-send').disabled);
    await rejectAlert(t.page);
    const captured = await state(t.page);
    assert.equal(captured.currentToken, 'replacement-core-fixture');
    assert.equal(captured.rejected, 0);
    assert.equal(captured.drafts.length, 0);
  });
} finally {
  globalThis.fetch = savedFetch;
  await browser?.close();
  if (process.env.CLERK_WIDGET_EVIDENCE_PATH) await writeFile(process.env.CLERK_WIDGET_EVIDENCE_PATH,
    JSON.stringify({ scope: 'local synthetic fixtures only; not live acceptance', results, actualExternalRequests: 0, liveAccountsCreated: 0 }, null, 2));
}
