#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve(
  process.argv[2] || '.vercel/output/static',
);

function fail(message) {
  throw new Error(`SEO build artifact check failed: ${message}`);
}

async function readRequired(filePath, label) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) fail(`${label} is not a file: ${filePath}`);
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') fail(`${label} is missing: ${filePath}`);
    throw error;
  }
}

async function readRouteHtml(route) {
  const candidates = [
    path.join(outputRoot, route, 'index.html'),
    path.join(outputRoot, `${route}.html`),
    path.join(outputRoot, route),
  ];
  for (const candidate of candidates) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) return readFile(candidate, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  fail(`built HTML is missing for /${route}`);
}

function decodeHtmlEntities(value = '') {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#(?:x27|39);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

const sitemap = await readRequired(
  path.join(outputRoot, 'sitemap.xml'),
  'sitemap',
);
const urlBlocks = Array.from(
  sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g),
  (match) => match[1],
);
if (!urlBlocks.length) fail('sitemap contains no URL entries');

const lastmodCount = urlBlocks.filter((block) =>
  /<lastmod>[^<]+<\/lastmod>/.test(block),
).length;
const imageCount = urlBlocks.filter((block) =>
  /<image:image>/.test(block),
).length;
const minimumLastmod = Math.floor(urlBlocks.length * 0.9);
const minimumImages = Math.floor(urlBlocks.length * 0.8);

if (lastmodCount < minimumLastmod) {
  fail(
    `sitemap lastmod coverage is ${lastmodCount}/${urlBlocks.length}; expected at least 90%`,
  );
}
if (imageCount < minimumImages) {
  fail(
    `sitemap image coverage is ${imageCount}/${urlBlocks.length}; expected at least 80%`,
  );
}
for (const match of sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) {
  if (!/^https:\/\//i.test(match[1])) {
    fail(`sitemap contains a non-absolute image URL: ${match[1]}`);
  }
}

const expectedPages = [
  {
    route: 'axis-system-planner',
    title: 'Garmin AXIS System Planner — Certified & Experimental | RWAS',
    image: '/images/blog/axis-build-planner-display-family-20260807.jpg',
  },
  {
    route: 'axis-system-planner/certified',
    title: 'Garmin AXIS Certified Aircraft System Planner | RWAS',
    image: '/images/blog/axis-build-planner-cockpit-20260807.jpg',
  },
  {
    route: 'axis-system-planner/experimental',
    title: 'Garmin AXIS Experimental Aircraft System Planner | RWAS',
    image: '/images/blog/axis-build-planner-operating-display-20260807.jpg',
  },
  {
    route: 'panel-planner',
    title: 'Build My Panel — RWAS Garmin Panel Planner',
    image: '/images/blog/panel-planner-r182-concept-tool.jpg',
  },
];

for (const expected of expectedPages) {
  const html = await readRouteHtml(expected.route);
  const title = decodeHtmlEntities(
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim(),
  );
  if (title !== expected.title) {
    fail(`/${expected.route} does not contain the approved title`);
  }
  if (!html.includes(expected.image)) {
    fail(`/${expected.route} does not contain its dedicated social image`);
  }
}

console.log(
  `SEO build artifact OK: ${urlBlocks.length} URLs, ${lastmodCount} lastmod entries, ${imageCount} image entries`,
);
