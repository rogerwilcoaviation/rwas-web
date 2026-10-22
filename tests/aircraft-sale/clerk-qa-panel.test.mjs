import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');
const root = new URL('../../', import.meta.url).pathname;
const seller = root + 'app/aircraft-for-sale/seller-auth-panel.tsx';
const provider = root + 'app/aircraft-for-sale/clerk-production-browser.ts';
const origin = 'https://www.rogerwilcoaviation.com';
const email = 'jerry+rwas-seller-qa-a-20261021-r1@rwas.team';
const baseline = { methods: ['password', 'google'], emailCode: true, clerkQaOnly: true };
const output = await build({
  stdin: {
    contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import Seller from ' + JSON.stringify(seller) + '; createRoot(document.querySelector("#root")).render(React.createElement(Seller));',
    resolveDir: root,
    loader: 'tsx',
  },
  write: false, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION': '"true"' },
  plugins: [{ name: 'local-qa-panel-fixtures', setup(builder) {
    builder.onResolve({ filter: /^\.\/clerk-production-browser$/ }, (args) => args.importer === seller ? { path: 'provider', namespace: 'qa-panel' } : null);
    builder.onResolve({ filter: /^\.\/clerk-production-panel$/ }, (args) => args.importer === seller ? { path: 'panel', namespace: 'qa-panel' } : null);
    builder.onLoad({ filter: /^provider$/, namespace: 'qa-panel' }, () => ({
      resolveDir: root,
      contents: 'export {configureClerkProductionQaCohort,isClerkProductionMethodEnabled} from ' + JSON.stringify(provider) + '; export async function getClerkProductionBrowser() { globalThis.__qaSdkRequests++; throw new Error("Unexpected provider access in local panel fixture"); }',
    }));
    builder.onLoad({ filter: /^panel$/, namespace: 'qa-panel' }, () => ({
      resolveDir: root,
      contents: 'import React from "react"; export default function Panel() { return React.createElement("p",{"data-qa-clerk-panel":true},"QA identity panel fixture"); } export const ClerkProductionAccountPanel = Panel; export const ClerkOwnerIdentityPanel = Panel;',
    }));
  } }],
});
let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

async function pageFixture(query = '', methods = baseline, options = {}) {
  const page = await browser.newPage();
  const calls = [];
  await page.addInitScript(({ owner, stored, identity }) => {
    globalThis.__qaSdkRequests = 0;
    if (stored) sessionStorage.setItem('rwas_sale_v2', JSON.stringify(stored));
    if (identity) sessionStorage.setItem('rwas_sale_identity', JSON.stringify({ state: 'fixture-state', proof: 'fixture-auth0-proof', link: false }));
    if (owner) sessionStorage.setItem('rwas_sale_clerk_owner_reauth', JSON.stringify({ purpose: 'clerk-owner', phase: 'reauth', requestedAt: Date.now(), state: 'fixture-state', proof: 'a'.repeat(43), csrf: 'fixture-csrf' }));
  }, { owner: options.owner || false, stored: options.stored || null, identity: options.identity || false });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ path: url.pathname, method: request.method(), headers: request.headers() });
    if (url.origin !== origin) throw new Error('Unexpected external request');
    if (url.pathname === '/api/aircraft-sale/auth/methods') return route.fulfill({ json: methods });
    if (url.pathname === '/api/aircraft-sale/auth/finish') return route.fulfill({ json: { session: 'fixture-baseline-auth0-session', email: 'customer@example.test', name: 'Customer' } });
    if (url.pathname.startsWith('/api/aircraft-sale/')) return route.fulfill({ json: { listings: [], profile: { email: 'customer@example.test', name: 'Customer', phone: '', location: '' }, sessions: [] } });
    if (url.pathname === '/aircraft-for-sale') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' });
    if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: output.outputFiles[0].text });
    return route.fulfill({ status: 404 });
  });
  const methodsResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/auth/methods'));
  await page.goto(origin + '/aircraft-for-sale' + query);
  await page.waitForFunction(() => document.querySelector('button') && !document.querySelector('[data-rwas-clerk-route-stage="methods-loading"]'));
  await methodsResponse;
  return { page, calls };
}

test('ordinary and invalid QA visitors keep baseline password/Google/email-code UI without loading Clerk', async () => {
  for (const query of ['', '?seller-auth=sign-up', '?seller-qa-email=customer%40example.test&seller-auth=complete']) {
    const { page, calls } = await pageFixture(query);
    try {
      await page.getByRole('button', { name: 'Seller Login', exact: true }).click();
      await page.getByRole('button', { name: 'Email and password', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Continue with Google', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Send Code', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Continue with RWAS secure sign-in', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-qa-clerk-panel]').count(), 0);
      assert.equal(await page.evaluate(() => globalThis.__qaSdkRequests), 0);
      assert.equal(calls.find((call) => call.path.endsWith('/auth/methods')).headers['x-rwas-qa-email'], undefined);
      assert.equal(calls.some((call) => call.path.includes('/auth/clerk-production/')), false);
    } finally { await page.close(); }
  }
});

test('only matching server-selected alias enters Clerk and suppresses owner linking', async () => {
  const query = '?' + new URLSearchParams({ 'seller-qa-email': email, 'seller-auth': 'sign-up' });
  const methods = { methods: ['clerk-production'], emailCode: false, clerkQaOnly: true, clerkQaEmail: email, existingAccountLink: 'fresh-email-code-session', existingAccountOwnerReauth: 'auth0-password' };
  const { page, calls } = await pageFixture(query, methods);
  try {
    await page.locator('[data-qa-clerk-panel]').waitFor();
    assert.equal(calls.find((call) => call.path.endsWith('/auth/methods')).headers['x-rwas-qa-email'], email);
    assert.equal(await page.getByRole('button', { name: 'Connect existing seller account', exact: true }).count(), 0);
    assert.equal(new URL(page.url()).searchParams.get('seller-qa-email'), email);
  } finally { await page.close(); }
});

test('mismatched methods response cannot restore a Clerk session or expose its interface', async () => {
  const query = '?' + new URLSearchParams({ 'seller-qa-email': email, 'seller-auth': 'complete' });
  const methods = { methods: ['clerk-production'], emailCode: false, clerkQaOnly: true, clerkQaEmail: 'jerry+rwas-seller-qa-b-20261021-r1@rwas.team' };
  const { page } = await pageFixture(query, methods, { stored: { provider: 'clerk-production', token: 'fixture-rwas-token', csrf: 'fixture-csrf', email, name: 'QA' } });
  try {
    await page.waitForFunction(() => document.querySelector('[data-rwas-clerk-route-stage="method-unavailable"]'));
    assert.equal(await page.locator('[data-qa-clerk-panel]').count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')), null);
    assert.equal(await page.evaluate(() => globalThis.__qaSdkRequests), 0);
  } finally { await page.close(); }
});

test('stale owner callback cannot load Clerk before baseline methods deny linking', async () => {
  const { page, calls } = await pageFixture('?state=fixture-state&code=fixture-code', baseline, { owner: true });
  try {
    await page.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => globalThis.__qaSdkRequests), 0);
    assert.equal(calls.some((call) => call.path.includes('/auth/clerk-production/')), false);
    assert.equal(new URL(page.url()).searchParams.has('code'), false);
  } finally { await page.close(); }
});

test('ordinary visitors discard a stale Clerk envelope without loading its SDK', async () => {
  const { page } = await pageFixture('', baseline, { stored: { provider: 'clerk-production', token: 'fixture-stale-clerk', csrf: 'fixture-csrf', email, name: 'QA' } });
  try {
    await page.waitForFunction(() => sessionStorage.getItem('rwas_sale_v2') === null);
    assert.equal(await page.evaluate(() => globalThis.__qaSdkRequests), 0);
    assert.equal(await page.getByRole('button', { name: 'Account', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Seller Login', exact: true }).count(), 1);
  } finally { await page.close(); }
});

test('ordinary Auth0 callback still establishes its existing account session', async () => {
  const { page, calls } = await pageFixture('?state=fixture-state&code=fixture-auth0-code', baseline, { identity: true });
  try {
    await page.getByRole('button', { name: 'Account', exact: true }).waitFor();
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('rwas_sale_v2')));
    assert.equal(session.token, 'fixture-baseline-auth0-session');
    assert.equal(session.email, 'customer@example.test');
    assert.equal(calls.filter((call) => call.path.endsWith('/auth/finish')).length, 1);
    assert.equal(calls.some((call) => call.path.includes('/auth/clerk-production/')), false);
    assert.equal(await page.evaluate(() => globalThis.__qaSdkRequests), 0);
    assert.equal(new URL(page.url()).searchParams.has('code'), false);
  } finally { await page.close(); }
});
