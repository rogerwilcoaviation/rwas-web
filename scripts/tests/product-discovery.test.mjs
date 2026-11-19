import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isDiscoverableProductHandle,
  isPublicProductHandle,
} from '../../lib/public-product-route.mjs';

const checker = fileURLToPath(
  new URL('../seo-build-artifact-check.mjs', import.meta.url),
);
const excluded = '/products/fcbt-1-prototype';
const normal = '/products/ordinary-out-of-stock-product';

test('the one-off remains a valid product page but is excluded from discovery', () => {
  assert.equal(isPublicProductHandle('fcbt-1-prototype'), true);
  assert.equal(isDiscoverableProductHandle('fcbt-1-prototype'), false);
  assert.equal(
    isDiscoverableProductHandle('ordinary-out-of-stock-product'),
    true,
  );
  assert.equal(isDiscoverableProductHandle('invalid handle'), false);
});

async function checkArtifact(sitemapRoutes, searchRoutes) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rwas-seo-test-'));
  try {
    await mkdir(path.join(dir, 'lib'));
    await mkdir(path.join(dir, 'output'));
    const urls = sitemapRoutes
      .map(
        (route) =>
          `<url><loc>https://example.com${route}</loc><lastmod>2026-01-01</lastmod><image:image><image:loc>https://example.com/image.jpg</image:loc></image:image></url>`,
      )
      .join('');
    await writeFile(
      path.join(dir, 'output/sitemap.xml'),
      `<urlset>${urls}</urlset>`,
    );
    await writeFile(
      path.join(dir, 'lib/site-search-product-routes.generated.json'),
      JSON.stringify(searchRoutes),
    );
    const pages = [
      [
        'axis-system-planner',
        'Garmin AXIS System Planner — Certified & Experimental | RWAS',
        '/images/blog/axis-build-planner-display-family-20260807.jpg',
      ],
      [
        'axis-system-planner/certified',
        'Garmin AXIS Certified Aircraft System Planner | RWAS',
        '/images/blog/axis-build-planner-cockpit-20260807.jpg',
      ],
      [
        'axis-system-planner/experimental',
        'Garmin AXIS Experimental Aircraft System Planner | RWAS',
        '/images/blog/axis-build-planner-operating-display-20260807.jpg',
      ],
      [
        'panel-planner',
        'Build My Panel — RWAS Garmin Panel Planner',
        '/images/blog/panel-planner-r182-concept-tool.jpg',
      ],
    ];
    for (const [route, title, image] of pages) {
      await mkdir(path.join(dir, 'output', route), { recursive: true });
      await writeFile(
        path.join(dir, 'output', route, 'index.html'),
        `<title>${title.replaceAll('&', '&amp;')}</title>${image}`,
      );
    }
    return spawnSync(process.execPath, [checker, 'output'], {
      cwd: dir,
      encoding: 'utf8',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('artifact checker accepts matching ordinary products', async () => {
  const result = await checkArtifact([normal], [normal]);
  assert.equal(result.status, 0, result.stderr);
});

test('artifact checker rejects the excluded route in either or both outputs', async () => {
  for (const [sitemap, search, label] of [
    [[normal, excluded], [normal], 'sitemap'],
    [[normal], [normal, excluded], 'search index'],
    [[normal, excluded], [normal, excluded], 'sitemap'],
  ]) {
    const result = await checkArtifact(sitemap, search);
    assert.notEqual(result.status, 0);
    assert.ok(
      result.stderr.includes(
        `${label} contains discovery-excluded product routes: ${excluded}`,
      ),
    );
  }
});

test('artifact checker reports unexpected mismatches and rejects duplicates', async () => {
  const missing = await checkArtifact([normal], ['/products/another-product']);
  assert.notEqual(missing.status, 0);
  assert.ok(missing.stderr.includes(`1 missing from search [${normal}]`));
  assert.ok(
    missing.stderr.includes(
      '1 missing from sitemap [/products/another-product]',
    ),
  );
  for (const [sitemap, search, message] of [
    [[normal, normal], [normal], 'sitemap contains duplicate product routes'],
    [
      [normal],
      [normal, normal],
      'search index contains duplicate product routes',
    ],
  ]) {
    const result = await checkArtifact(sitemap, search);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(message));
  }
});
