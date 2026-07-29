#!/usr/bin/env node
const base = (
  process.env.BASE_URL ||
  process.argv[2] ||
  'https://www.rogerwilcoaviation.com'
).replace(/\/$/, '');
const isLocalBase =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(base);
const CONCURRENCY = Math.max(
  1,
  Number(process.env.SEO_SMOKE_CONCURRENCY || 16),
);
const REQUIRED_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'content-security-policy',
];
const FORBIDDEN_LOCATION_PATTERN =
  /Sioux(?:[\s\u00a0-]|&nbsp;|&#0*32;|&#x0*20;)*Falls|\bKFSD\b|Joe(?:[\s\u00a0-]|&nbsp;|&#0*32;|&#x0*20;)*Foss/i;

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
    const detail =
      error?.cause?.code || error?.code || error?.message || String(error);
    fail(`${url} fetch failed: ${detail}`);
  }
}

function tags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return Array.from(html.matchAll(re), (m) =>
    m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function hasMeta(html, pattern) {
  return pattern.test(html);
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}

function metaContent(html, key, value) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attribute(tag, key).toLowerCase() === value.toLowerCase()) {
      return attribute(tag, 'content');
    }
  }
  return '';
}

function decodeHtmlEntities(value = '') {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#(?:x27|39);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function canonicalHref(html) {
  return (
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    )?.[1] ||
    ''
  );
}

function jsonLdErrors(html) {
  const errors = [];
  let index = 0;
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    index += 1;
    try {
      JSON.parse(match[1]);
    } catch (error) {
      errors.push(`JSON-LD block ${index}: ${error.message}`);
    }
  }
  return errors;
}

function canonicalMatchesUrl(canonical, url) {
  const actual = new URL(canonical);
  const expected = new URL(url);
  const matchingOrigin =
    actual.origin === expected.origin ||
    (isLocalBase && actual.origin === 'https://www.rogerwilcoaviation.com');

  if (
    matchingOrigin &&
    actual.pathname === expected.pathname &&
    actual.search === expected.search &&
    actual.hash === expected.hash
  ) {
    return true;
  }
  if (
    matchingOrigin &&
    expected.pathname === '/' &&
    !expected.search &&
    !expected.hash
  ) {
    return actual.pathname === '/' && !actual.search && !actual.hash;
  }
  return false;
}

const home = await fetchNoRedirect(`${base}/`);
if (home.res.status !== 200) fail(`Home returned ${home.res.status}`);
if (FORBIDDEN_LOCATION_PATTERN.test(home.text)) {
  fail('Home contains a former RWAS location reference');
}
for (const [label, value] of [
  [
    'structured street address',
    '"streetAddress":"3309 Douglas Avenue Unit #3"',
  ],
  ['structured locality', '"addressLocality":"Yankton"'],
  ['structured postal code', '"postalCode":"57078"'],
  ['structured opening time', '"opens":"07:00"'],
  ['structured closing time', '"closes":"17:00"'],
]) {
  if (!home.text.includes(value)) fail(`Home is missing ${label}`);
}
if (!isLocalBase) {
  for (const header of REQUIRED_HEADERS) {
    if (!home.res.headers.get(header))
      fail(`Missing security header on home: ${header}`);
  }
}

const sitemapRes = await fetchNoRedirect(`${base}/sitemap.xml`);
if (sitemapRes.res.status !== 200)
  fail(`Sitemap returned ${sitemapRes.res.status}`);

if (!isLocalBase) {
  const goneRes = await fetch(`${base}/pages/script-rwas`, {
    redirect: 'manual',
  });
  if (goneRes.status !== 410)
    fail(`/pages/script-rwas should return 410, got ${goneRes.status}`);
  if (!/noindex/i.test(goneRes.headers.get('x-robots-tag') || '')) {
    fail('/pages/script-rwas missing X-Robots-Tag noindex');
  }
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
if (!urls.includes(`${base}/contact`)) fail('Sitemap is missing /contact');

const today = new Date().toISOString().slice(0, 10);
const currentDateLastmods = Array.from(
  sitemapRes.text.matchAll(
    new RegExp(`<lastmod>${today}(?:T[^<]+)?<\\/lastmod>`, 'g'),
  ),
).length;
if (currentDateLastmods > 50) {
  fail(`Sitemap has ${currentDateLastmods} URLs claiming today's lastmod date`);
}

if (
  !isLocalBase &&
  urls.some((url) => url.includes('/services/aircraft-maintenance'))
) {
  const maintenanceRes = await fetch(`${base}/maintenance`, {
    redirect: 'manual',
  });
  if (maintenanceRes.status !== 301)
    fail(`/maintenance should 301, got ${maintenanceRes.status}`);
  const maintenanceLocation = maintenanceRes.headers.get('location') || '';
  if (!maintenanceLocation.includes('/services/aircraft-maintenance')) {
    fail(
      `/maintenance redirects to unexpected location: ${maintenanceLocation}`,
    );
  }

  const oldMaintenanceRes = await fetch(
    `${base}/services/aircraft-maintenance-yankton`,
    { redirect: 'manual' },
  );
  if (oldMaintenanceRes.status !== 301) {
    fail(
      `/services/aircraft-maintenance-yankton should 301, got ${oldMaintenanceRes.status}`,
    );
  }
  const oldMaintenanceLocation =
    oldMaintenanceRes.headers.get('location') || '';
  if (!oldMaintenanceLocation.includes('/services/aircraft-maintenance')) {
    fail(
      `/services/aircraft-maintenance-yankton redirects to unexpected location: ${oldMaintenanceLocation}`,
    );
  }

  for (const [legacyPath, expectedPath] of [
    ['/locations/sioux-falls', '/locations/yankton'],
    [
      '/services/aircraft-maintenance-sioux-falls',
      '/services/aircraft-maintenance',
    ],
  ]) {
    const legacyRes = await fetch(`${base}${legacyPath}`, {
      redirect: 'manual',
    });
    if (legacyRes.status !== 301) {
      fail(`${legacyPath} should 301, got ${legacyRes.status}`);
    }
    const legacyLocation = legacyRes.headers.get('location') || '';
    if (!legacyLocation.includes(expectedPath)) {
      fail(`${legacyPath} redirects to unexpected location: ${legacyLocation}`);
    }
  }
}

if (!isLocalBase) {
  const duplicateContactRes = await fetch(`${base}/contact.html`, {
    redirect: 'manual',
  });
  if (duplicateContactRes.status !== 301)
    fail(`/contact.html should 301, got ${duplicateContactRes.status}`);
  const duplicateContactLocation =
    duplicateContactRes.headers.get('location') || '';
  if (!duplicateContactLocation.includes('/contact')) {
    fail(
      `/contact.html redirects to unexpected location: ${duplicateContactLocation}`,
    );
  }

  const newspaperIndexRes = await fetch(`${base}/newspaper/index.html`, {
    redirect: 'manual',
  });
  if (newspaperIndexRes.status !== 301)
    fail(`/newspaper/index.html should 301, got ${newspaperIndexRes.status}`);
  const newspaperIndexLocation =
    newspaperIndexRes.headers.get('location') || '';
  if (
    !newspaperIndexLocation.endsWith('/') &&
    !newspaperIndexLocation.endsWith(base)
  ) {
    fail(
      `/newspaper/index.html redirects to unexpected location: ${newspaperIndexLocation}`,
    );
  }
}

const failures = [];
const titles = new Map();

async function checkUrl(url) {
  const { res, text } = await fetchNoRedirect(url);
  if (res.status !== 200) {
    return `${url} returned ${res.status}${res.headers.get('location') ? ` -> ${res.headers.get('location')}` : ''}`;
  }
  const title = tags(text, 'title')[0];
  const h1s = tags(text, 'h1');
  const canonical = canonicalHref(text);
  const description = metaContent(text, 'name', 'description');
  const ogTitle = metaContent(text, 'property', 'og:title');
  const ogDescription = metaContent(text, 'property', 'og:description');
  const ogImage = metaContent(text, 'property', 'og:image');
  const decodedTitle = decodeHtmlEntities(title);
  const decodedDescription = decodeHtmlEntities(description);
  const urlFailures = [];
  if (FORBIDDEN_LOCATION_PATTERN.test(text)) {
    urlFailures.push(`${url} contains a former RWAS location reference`);
  }
  if (!title) urlFailures.push(`${url} missing <title>`);
  if (!hasMeta(text, /<meta[^>]+name=["']description["']/i))
    urlFailures.push(`${url} missing meta description`);
  if (!canonical) urlFailures.push(`${url} missing canonical`);
  if (canonical && !canonicalMatchesUrl(canonical, url)) {
    urlFailures.push(`${url} canonical mismatch: ${canonical}`);
  }
  if (h1s.length !== 1) urlFailures.push(`${url} has ${h1s.length} H1 tags`);
  if (!ogTitle) urlFailures.push(`${url} missing og:title`);
  if (!ogDescription) urlFailures.push(`${url} missing og:description`);
  if (!ogImage) urlFailures.push(`${url} missing og:image`);
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    urlFailures.push(`${url} has a relative og:image: ${ogImage}`);
  }
  for (const error of jsonLdErrors(text)) {
    urlFailures.push(`${url} has invalid ${error}`);
  }
  if (
    url.includes('/products/') &&
    /\SGarmin part number|\.[A-Z]|\SThis is a dealer-only/.test(description)
  ) {
    urlFailures.push(
      `${url} has malformed product meta-description boundaries`,
    );
  }
  if (decodedTitle.length > 60) {
    urlFailures.push(`${url} title is ${decodedTitle.length} characters`);
  }
  if (decodedDescription.length > 160) {
    urlFailures.push(
      `${url} meta description is ${decodedDescription.length} characters`,
    );
  }
  if (title) {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(url);
  }
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

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker),
);

for (const path of [
  '/blog-articles.json',
  '/feed.xml',
  '/llms.txt',
  '/garmin',
  '/newspaper',
]) {
  const artifact = await fetchNoRedirect(`${base}${path}`);
  if (artifact.res.status !== 200) {
    failures.push(`${path} returned ${artifact.res.status}`);
    continue;
  }
  if (FORBIDDEN_LOCATION_PATTERN.test(artifact.text)) {
    failures.push(`${path} contains a former RWAS location reference`);
  }
}

const duplicateProductTitles = Array.from(titles.entries())
  .map(([title, titleUrls]) => ({
    title,
    urls: titleUrls.filter((url) => url.includes('/products/')),
  }))
  .filter((group) => group.urls.length > 1);
for (const group of duplicateProductTitles) {
  failures.push(
    `Duplicate product title (${group.urls.length}): ${group.title} :: ${group.urls.join(', ')}`,
  );
}

const collections = await fetchNoRedirect(`${base}/collections`);
if (
  /\/products\/garmin-gfc-500-digital-autopilot["']/i.test(collections.text)
) {
  failures.push('/collections still links to the retired GFC 500 product URL');
}
if (!/\/services\/gfc-500-autopilot-installation["']/i.test(collections.text)) {
  failures.push(
    '/collections is missing the GFC 500 installation service link',
  );
}

const missingPage = await fetchNoRedirect(`${base}/seo-audit-intentional-404`);
if (missingPage.res.status !== 404)
  failures.push(
    `Intentional missing page returned ${missingPage.res.status}, expected 404`,
  );
const robotsValues = Array.from(
  missingPage.text.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*>/gi),
).map((match) => attribute(match[0], 'content').toLowerCase());
if (!robotsValues.some((value) => value.split(/[\s,]+/).includes('noindex'))) {
  failures.push('404 page is missing a robots noindex directive');
}
if (robotsValues.some((value) => value.split(/[\s,]+/).includes('index'))) {
  failures.push(
    `404 page has a conflicting robots index directive: ${robotsValues.join(' | ')}`,
  );
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`SEO smoke OK: ${urls.length} sitemap URLs checked on ${base}`);
