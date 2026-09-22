import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root = process.argv[2] || 'out';
const budgets = [
  ['garmin-dealer-install', 750000, 125000],
  ['watches-accessories', 500000, 65000],
];
const observations = [];
for (const [handle, htmlBudget, gzipBudget] of budgets) {
  let html;
  try {
    html = await readFile(
      path.join(root, 'collections', `${handle}.html`),
      'utf8',
    );
  } catch {
    html = await readFile(
      path.join(root, 'collections', handle, 'index.html'),
      'utf8',
    );
  }
  const bytes = Buffer.byteLength(html);
  const gzip = gzipSync(html).length;
  assert.ok(
    bytes <= htmlBudget,
    `${handle}: decoded HTML ${bytes} > ${htmlBudget}`,
  );
  assert.ok(gzip <= gzipBudget, `${handle}: gzip ${gzip} > ${gzipBudget}`);
  const asset = html.match(/\/catalog-data\/[a-f0-9]+\.json/)?.[0];
  assert.ok(asset, `${handle}: missing deferred catalog`);
  const catalog = JSON.parse(await readFile(path.join(root, asset), 'utf8'));
  const links = new Set(
    [...html.matchAll(/href="(\/products\/[^"?]+)"/g)].map((m) => m[1]),
  );
  for (const product of catalog.products)
    assert.ok(
      links.has(`/products/${encodeURIComponent(product.handle)}`),
      `${handle}: uncrawlable product ${product.handle}`,
    );
  assert.equal(catalog.products.length, catalog.finderProducts.length);
  observations.push({
    handle,
    bytes,
    gzip,
    completeProductLinks: catalog.products.length,
  });
}
console.log(
  JSON.stringify({
    observations,
    businessWrites: 0,
    type: 'static-artifact-payload-budget-not-field-CWV',
  }),
);
