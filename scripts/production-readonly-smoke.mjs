import assert from 'node:assert/strict';

// Deliberately no business API calls: GET documents and public static assets only.
const origin = 'https://www.rogerwilcoaviation.com';
const routes = ['/', '/contact', '/services', '/collections', '/product-index', '/axis-system-planner/certified', '/axis-system-planner/experimental', '/cart'];
async function get(path) {
  const response = await fetch(new URL(path, origin), { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(30000) });
  assert.equal(new URL(response.url).origin, origin, `Unexpected origin ${path}`);
  return response;
}
for (const path of routes) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') || '', /text\/html/, path);
  const html = await response.text();
  assert.match(html, /<title>[^<]+<\/title>/, `${path} title`);
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  assert.ok(canonical, `${path} canonical`);
  assert.equal(canonical[1].replace(/\/$/, ''), (origin + path).replace(/\/$/, ''), `${path} canonical target`);
  assert.ok(response.headers.get('content-security-policy'), `${path} enforcing CSP`);
  assert.ok(response.headers.get('x-content-type-options'), `${path} nosniff`);
  if (path === '/') {
    const asset = html.match(/<script[^>]+src="([^"?]+\.js)(?:\?[^"]*)?"/);
    assert.ok(asset, 'root JavaScript asset');
    const js = await get(asset[1]);
    assert.equal(js.status, 200, 'root asset available');
    assert.match(js.headers.get('content-type') || '', /javascript/);
  }
  if (path === '/cart') assert.match(html, /noindex/, 'cart noindex');
  console.log(`PASS GET ${path}: document, canonical, security headers`);
}
for (const path of ['/rwas-analytics.js', '/robots.txt', '/sitemap.xml']) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.ok((await response.text()).length > 0, path);
  console.log(`PASS GET ${path}`);
}
const missing = await get('/audit-readonly-missing-20260922');
assert.equal(missing.status, 404);
console.log('PASS missing route returns 404; no cart, contact, chat, listing or payment mutations attempted.');
