#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const siteUrl =
  process.env.GSC_SITE_URL || 'https://www.rogerwilcoaviation.com/';
const accessToken = process.env.GSC_ACCESS_TOKEN;
const serviceAccountKey = process.env.GSC_SERVICE_ACCOUNT_KEY;
const days = Number(process.env.GSC_DAYS || process.argv[2] || 28);
const outputDir =
  process.env.GSC_OUTPUT_DIR || path.join('logs', 'gsc-baseline');

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function tokenFromServiceAccount(keyPath) {
  const key = JSON.parse(await fs.readFile(keyPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(key.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const response = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(
      `Service account token request failed: ${JSON.stringify(json)}`,
    );
  }
  return json.access_token;
}

async function getAccessToken() {
  if (accessToken) return accessToken;
  if (serviceAccountKey) return tokenFromServiceAccount(serviceAccountKey);
  console.error('Missing GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_KEY.');
  console.error('Use one of:');
  console.error('  GSC_ACCESS_TOKEN=... GSC_DAYS=28 npm run seo:gsc-baseline');
  console.error(
    '  GSC_SERVICE_ACCOUNT_KEY=.secrets/gsc-baseline-rwas-seo.json GSC_DAYS=28 npm run seo:gsc-baseline',
  );
  process.exit(2);
}

const today = new Date();
const end = new Date(today);
end.setUTCDate(end.getUTCDate() - 2);
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - days + 1);

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

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

function pageGroup(page) {
  const pathname = new URL(page).pathname;
  const groups = [
    ['/products/', 'products'],
    ['/collections/', 'collections'],
    ['/services/', 'services'],
    ['/blog/', 'blog'],
    ['/aircraft-for-sale/', 'aircraft-for-sale'],
    ['/locations/', 'locations'],
  ];
  return groups.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'other';
}

function summarizePageGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = pageGroup(row.page);
    const current = groups.get(group) || {
      pageGroup: group,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      pages: 0,
    };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * row.impressions;
    current.pages += 1;
    groups.set(group, current);
  }
  return Array.from(groups.values())
    .map((group) => ({
      pageGroup: group.pageGroup,
      pages: group.pages,
      clicks: group.clicks,
      impressions: group.impressions,
      ctr: group.impressions ? group.clicks / group.impressions : 0,
      position: group.impressions
        ? group.weightedPosition / group.impressions
        : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

async function querySearchAnalytics(dimensions, rowLimit = 25000) {
  const bearerToken = await getAccessToken();
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: isoDate(start),
      endDate: isoDate(end),
      dimensions,
      rowLimit,
      startRow: 0,
      searchType: 'web',
      dataState: 'all',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC ${response.status} ${response.statusText}: ${text}`);
  }

  const json = await response.json();
  return (json.rows || []).map((row) => {
    const record = {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
    dimensions.forEach((dimension, index) => {
      record[dimension] = row.keys?.[index] || '';
    });
    return record;
  });
}

const runId = `${isoDate(start)}_${isoDate(end)}`;
const runDir = path.join(outputDir, runId);
await fs.mkdir(runDir, { recursive: true });

const exports = [
  {
    name: 'queries',
    dimensions: ['query'],
    columns: ['query', 'clicks', 'impressions', 'ctr', 'position'],
  },
  {
    name: 'pages',
    dimensions: ['page'],
    columns: ['page', 'clicks', 'impressions', 'ctr', 'position'],
  },
  {
    name: 'query-pages',
    dimensions: ['query', 'page'],
    columns: ['query', 'page', 'clicks', 'impressions', 'ctr', 'position'],
  },
  {
    name: 'countries',
    dimensions: ['country'],
    columns: ['country', 'clicks', 'impressions', 'ctr', 'position'],
  },
  {
    name: 'devices',
    dimensions: ['device'],
    columns: ['device', 'clicks', 'impressions', 'ctr', 'position'],
  },
];

const manifest = {
  siteUrl,
  days,
  startDate: isoDate(start),
  endDate: isoDate(end),
  generatedAt: new Date().toISOString(),
  files: [],
};

for (const item of exports) {
  let rows = await querySearchAnalytics(item.dimensions);
  if (item.dimensions.includes('page')) {
    rows = rows.map((row) => ({ ...row, pageGroup: pageGroup(row.page) }));
  }
  const columns = item.dimensions.includes('page')
    ? [
        ...item.columns.slice(0, item.columns.indexOf('page') + 1),
        'pageGroup',
        ...item.columns.slice(item.columns.indexOf('page') + 1),
      ]
    : item.columns;
  const jsonPath = path.join(runDir, `${item.name}.json`);
  const csvPath = path.join(runDir, `${item.name}.csv`);
  await fs.writeFile(jsonPath, JSON.stringify(rows, null, 2) + '\n');
  await fs.writeFile(csvPath, toCsv(rows, columns) + '\n');
  manifest.files.push({
    name: item.name,
    json: jsonPath,
    csv: csvPath,
    rows: rows.length,
  });
  console.log(`${item.name}: ${rows.length} rows`);

  if (item.name === 'pages') {
    const summary = summarizePageGroups(rows);
    const summaryJsonPath = path.join(runDir, 'page-groups.json');
    const summaryCsvPath = path.join(runDir, 'page-groups.csv');
    const summaryColumns = [
      'pageGroup',
      'pages',
      'clicks',
      'impressions',
      'ctr',
      'position',
    ];
    await fs.writeFile(
      summaryJsonPath,
      JSON.stringify(summary, null, 2) + '\n',
    );
    await fs.writeFile(summaryCsvPath, toCsv(summary, summaryColumns) + '\n');
    manifest.files.push({
      name: 'page-groups',
      json: summaryJsonPath,
      csv: summaryCsvPath,
      rows: summary.length,
    });
    console.log(`page-groups: ${summary.length} rows`);
  }
}

await fs.writeFile(
  path.join(runDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`GSC baseline written to ${runDir}`);
