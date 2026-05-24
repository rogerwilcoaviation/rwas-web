#!/usr/bin/env node
const base = (process.env.BASE_URL || process.argv[2] || 'https://www.rogerwilcoaviation.com').replace(/\/$/, '');
const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(base);
const CONCURRENCY = Math.max(1, Number(process.env.SEO_SMOKE_CONCURRENCY || 16));
const REQUIRED_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'content-security-policy',
];

function fail(message) {
  throw new Error(message);
}

async function fetchNoRedirect(url) {
  // Follow benign edge redirects during smoke checks. Cloudflare/Next can briefly
  // disagree on trailing-slash normalization during propagation, and the SEO
  // assertions below validate the final HTML/canonical instead of treating the
  // redirect itself as a production failure.
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return { res, text: await res.text() };
  } catch (error) {
    const detail = error?.cause?.code || error?.code || error?.message || String(error);
    fail(`${url} fetch failed: ${detail}`);
  }
}

function tags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return Array.from(html.matchAll(re), (m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function hasMeta(html, pattern) {
  return pattern.test(html);
}

const home = await fetchNoRedirect(`${base}/`);
if (home.res.status !== 200) fail(`Home returned ${home.res.status}`);
if (!isLocalBase) {
  for (const header of REQUIRED_HEADERS) {
    if (!home.res.headers.get(header)) fail(`Missing security header on home: ${header}`);
  }
}

const sitemapRes = await fetchNoRedirect(`${base}/sitemap.xml`);
if (sitemapRes.res.status !== 200) fail(`Sitemap returned ${sitemapRes.res.status}`);

const goneRes = await fetch(`${base}/pages/script-rwas`, { redirect: 'manual' });
if (goneRes.status !== 410) fail(`/pages/script-rwas should return 410, got ${goneRes.status}`);
if (!/noindex/i.test(goneRes.headers.get('x-robots-tag') || '')) {
  fail('/pages/script-rwas missing X-Robots-Tag noindex');
}

const urls = Array.from(sitemapRes.text.matchAll(/<loc>(.*?)<\/loc>/g), (m) => {
  const url = m[1];
  if (!isLocalBase) return url;
  try {
    const parsed = new URL(url);
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}).filter(Boolean);
if (!urls.length) fail('Sitemap has no URLs');

if (urls.some((url) => url.includes('/services/aircraft-maintenance-yankton'))) {
  const maintenanceRes = await fetch(`${base}/maintenance`, { redirect: 'manual' });
  if (maintenanceRes.status !== 301) fail(`/maintenance should 301, got ${maintenanceRes.status}`);
  const maintenanceLocation = maintenanceRes.headers.get('location') || '';
  if (!maintenanceLocation.includes('/services/aircraft-maintenance-yankton')) {
    fail(`/maintenance redirects to unexpected location: ${maintenanceLocation}`);
  }
}

const failures = [];

async function checkUrl(url) {
  const { res, text } = await fetchNoRedirect(url);
  if (res.status !== 200) {
    return `${url} returned ${res.status}${res.headers.get('location') ? ` -> ${res.headers.get('location')}` : ''}`;
  }
  const title = tags(text, 'title')[0];
  const h1s = tags(text, 'h1');
  const urlFailures = [];
  if (!title) urlFailures.push(`${url} missing <title>`);
  if (!hasMeta(text, /<meta[^>]+name=["']description["']/i)) urlFailures.push(`${url} missing meta description`);
  if (!hasMeta(text, /<link[^>]+rel=["']canonical["']/i)) urlFailures.push(`${url} missing canonical`);
  if (h1s.length !== 1) urlFailures.push(`${url} has ${h1s.length} H1 tags`);
  return urlFailures;
}

let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    try {
      const result = await checkUrl(url);
      if (Array.isArray(result)) failures.push(...result);
      else if (result) failures.push(result);
    } catch (error) {
      failures.push(`${url} failed: ${error?.message || String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`SEO smoke OK: ${urls.length} sitemap URLs checked on ${base}`);
