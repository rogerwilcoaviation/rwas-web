import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const temp = mkdtempSync(join(tmpdir(), 'rwas-seo-routing-'));
const workerDir = join(temp, '.vercel/output/static/_worker.js');
mkdirSync(workerDir, { recursive: true });
writeFileSync(join(workerDir, 'index.js'), 'export default {async fetch(t,e,c){return new Response("Not found",{status:404})}}');
execFileSync(process.execPath, [resolve('scripts/inject-cloudflare-collection-redirects.mjs')], { cwd: temp });
writeFileSync(join(temp, 'worker.mjs'), readFileSync(join(workerDir, 'index.js')));
const worker = (await import(pathToFileURL(join(temp, 'worker.mjs')))).default;
const redirects = {
  '/press': '/blog', '/features': '/shop-capabilities',
  '/pages/about': '/about', '/pages/contact': '/contact',
  '/pages/financing': '/financing',
  '/pages/garmin-avionics-accessories': '/collections/garmin-dealer-install',
  '/pages/shop-capabilities': '/shop-capabilities',
  '/collections/on-sale/Garmin-Product-On-Sale': '/collections/on-sale',
  '/brochures/papa-alpha-tools-trifold.pdf': '/brochures/papa-alpha-tools/papa-alpha-tools-trifold.pdf',
};
let passed = 0;
for (const [source, target] of Object.entries(redirects)) {
  for (const suffix of ['', '/']) {
    const r = await worker.fetch(new Request('https://www.rogerwilcoaviation.com' + source + suffix), {}, {});
    assert.equal(r.status, 301); assert.equal(r.headers.get('location'), 'https://www.rogerwilcoaviation.com' + target); passed++;
  }
}
const declarations = readFileSync('public/_redirects', 'utf8').split('\n').filter(l=>l.startsWith('/'));
for (const source of ['/careers', '/faq', '/pricing', '/collections/aircraft-management']) {
  for (const suffix of ['', '/']) {
    const r = await worker.fetch(new Request('https://www.rogerwilcoaviation.com' + source + suffix), {}, {});
    assert.equal(r.status, 404);
    assert.ok(!declarations.some(l=>l.split(/\s+/)[0] === source + suffix)); passed++;
  }
}
for (const route of ['brochures/papa-alpha-tools', 'launch/papa-alpha-rigging-kits']) {
  const html = readFileSync('public/' + route + '/index.html', 'utf8');
  assert.ok(html.includes('<link rel="canonical" href="https://www.rogerwilcoaviation.com/' + route + '">')); passed++;
}
assert.ok(readFileSync('public/brochures/papa-alpha-tools/index.html', 'utf8').includes('href="/brochures/papa-alpha-tools/papa-alpha-tools-trifold.pdf"')); passed++;
assert.ok(!/^Disallow: \/cart/m.test(readFileSync('public/robots.txt', 'utf8'))); passed++;
assert.ok(readFileSync('app/cart/page.tsx', 'utf8').includes('robots: { index: false, follow: false }')); passed++;
console.log(JSON.stringify({ passed, networkWrites: 0, retiredPaths: 4, legacyRedirectFamilies: 8, pdfAlias: 1 }));
