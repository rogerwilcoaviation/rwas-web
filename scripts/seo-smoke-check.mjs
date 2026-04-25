#!/usr/bin/env node
const base = (process.env.BASE_URL || process.argv[2] || 'https://www.rogerwilcoaviation.com').replace(/\/$/, '');
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
  const res = await fetch(url, { redirect: 'manual' });
  return { res, text: await res.text() };
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
for (const header of REQUIRED_HEADERS) {
  if (!home.res.headers.get(header)) fail(`Missing security header on home: ${header}`);
}

const sitemapRes = await fetchNoRedirect(`${base}/sitemap.xml`);
if (sitemapRes.res.status !== 200) fail(`Sitemap returned ${sitemapRes.res.status}`);
const urls = Array.from(sitemapRes.text.matchAll(/<loc>(.*?)<\/loc>/g), (m) => m[1]).filter(Boolean);
if (!urls.length) fail('Sitemap has no URLs');

const failures = [];
for (const url of urls) {
  const { res, text } = await fetchNoRedirect(url);
  if (res.status !== 200) {
    failures.push(`${url} returned ${res.status}${res.headers.get('location') ? ` -> ${res.headers.get('location')}` : ''}`);
    continue;
  }
  const title = tags(text, 'title')[0];
  const h1s = tags(text, 'h1');
  if (!title) failures.push(`${url} missing <title>`);
  if (!hasMeta(text, /<meta[^>]+name=["']description["']/i)) failures.push(`${url} missing meta description`);
  if (!hasMeta(text, /<link[^>]+rel=["']canonical["']/i)) failures.push(`${url} missing canonical`);
  if (h1s.length !== 1) failures.push(`${url} has ${h1s.length} H1 tags`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`SEO smoke OK: ${urls.length} sitemap URLs checked on ${base}`);
