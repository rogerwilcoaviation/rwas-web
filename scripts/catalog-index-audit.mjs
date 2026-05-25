#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.CATALOG_AUDIT_BASE_URL || 'https://www.rogerwilcoaviation.com';
const limit = Number(process.env.CATALOG_AUDIT_LIMIT || process.argv[2] || 250);
const outputDir = process.env.CATALOG_AUDIT_OUTPUT_DIR || path.join('logs', 'catalog-index-audit');

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(',')),
  ].join('\n');
}

function match(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || '';
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RWAS catalog index audit/1.0' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

const sitemap = await fetchText(`${baseUrl}/sitemap.xml`);
const productUrls = Array.from(sitemap.matchAll(/<loc>(https:\/\/www\.rogerwilcoaviation\.com\/products\/[^<]+)<\/loc>/g))
  .map((m) => m[1])
  .slice(0, limit);

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outputDir, runId);
await fs.mkdir(runDir, { recursive: true });

const rows = [];

for (const [index, url] of productUrls.entries()) {
  try {
    const html = await fetchText(url);
    const title = match(html, /<title>(.*?)<\/title>/s);
    const description = match(html, /<meta name="description" content="(.*?)"/s);
    const canonical = match(html, /<link rel="canonical" href="(.*?)"/s);
    const productSchema = html.includes('"@type":"Product"') || html.includes('"@type": "Product"');
    const noindex = /noindex/i.test(html);
    const fallbackImage = /no-image|Picturemaynot|Picture[_-]?may[_-]?not/i.test(html);
    const bodyWords = html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    rows.push({
      url,
      status: 'ok',
      title_len: title.length,
      description_len: description.length,
      canonical_ok: canonical === url,
      product_schema: productSchema,
      noindex,
      fallback_image: fallbackImage,
      body_words: bodyWords,
    });
  } catch (error) {
    rows.push({
      url,
      status: error.message,
      title_len: '',
      description_len: '',
      canonical_ok: '',
      product_schema: '',
      noindex: '',
      fallback_image: '',
      body_words: '',
    });
  }

  if ((index + 1) % 25 === 0) {
    console.log(`Audited ${index + 1}/${productUrls.length}`);
  }
}

const columns = [
  'url',
  'status',
  'title_len',
  'description_len',
  'canonical_ok',
  'product_schema',
  'noindex',
  'fallback_image',
  'body_words',
];

await fs.writeFile(path.join(runDir, 'products.json'), JSON.stringify(rows, null, 2) + '\n');
await fs.writeFile(path.join(runDir, 'products.csv'), toCsv(rows, columns) + '\n');
await fs.writeFile(
  path.join(runDir, 'summary.json'),
  JSON.stringify({
    baseUrl,
    limit,
    audited: rows.length,
    generatedAt: new Date().toISOString(),
    failures: rows.filter((row) => row.status !== 'ok').length,
    missingCanonical: rows.filter((row) => row.status === 'ok' && !row.canonical_ok).length,
    missingProductSchema: rows.filter((row) => row.status === 'ok' && !row.product_schema).length,
    fallbackImages: rows.filter((row) => row.status === 'ok' && row.fallback_image).length,
    shortDescriptions: rows.filter((row) => row.status === 'ok' && Number(row.description_len) < 90).length,
  }, null, 2) + '\n',
);

console.log(`Catalog index audit written to ${runDir}`);
