import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fields, create, submit, approve } from './fixture.mjs';
import { listingCategories } from '../../lib/marketplace/schema.mjs';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

async function publishedHtml(f, owner, values) {
  const listing = await create(f, owner, values);
  assert.equal((await submit(f, owner, listing)).status, 200);
  assert.equal((await approve(f, listing)).status, 200);
  const response = await f.call(
    '/listing/' + listing.id,
    'GET',
    undefined,
    undefined,
    { Accept: 'text/html' },
  );
  assert.equal(response.status, 200);
  return response.text();
}

test('public aircraft details use readable labels without changing stored values', async () => {
  const f = fixture(),
    owner = await f.login();
  const html = await publishedHtml(f, owner, {
    ...fields,
    serialNumber: 'ABC-123',
    totalTime: '6500',
    engineTime: '1500',
    engineModel: 'O-540',
    propTime: '20',
    annualDue: 'February 2027',
    usefulLoad: '1000',
  });
  for (const label of [
    'Tail Number',
    'Serial Number',
    'Total Time',
    'Engine Time',
    'Engine Model',
    'Propeller Time',
    'Annual Inspection Due',
    'Useful Load',
  ]) {
    assert.ok(html.includes('<dt>' + label + '</dt>'), label);
  }
  assert.doesNotMatch(
    html,
    /<dt>(nNumber|serialNumber|totalTime|engineTime|engineModel|propTime|annualDue|usefulLoad)<\/dt>/,
  );
  assert.match(html, /<dd>N123AB<\/dd>/);
  assert.match(html, /<dd>6500<\/dd>/);
  assert.doesNotMatch(html, /owner@example\.test/);
});

test('equipment details display sale terms and escaped delivery text', async () => {
  const f = fixture(),
    owner = await f.login();
  const category = listingCategories.find(
    (c) => c.type === 'tools' && c.fields.includes('tools-delivery'),
  );
  assert.ok(category);
  const html = await publishedHtml(f, owner, {
    listingType: 'tools',
    category: category.id,
    title: 'Synthetic tug',
    condition: 'Used',
    quantity: '1',
    unitOfSale: 'EA',
    sellerLocation: 'Test City',
    description: 'Fixture',
    transactionType: 'sale',
    currency: 'USD',
    priceMode: 'amount',
    price: '5000',
    specifications: { 'tools-delivery': 'Pickup <available> in Test City' },
  });
  assert.match(html, /<dt>Unit of Sale<\/dt><dd>Each<\/dd>/);
  assert.match(html, /<dt>Transaction<\/dt><dd>For Sale<\/dd>/);
  assert.match(
    html,
    /<h3>Pickup &amp; Delivery<\/h3><p class="copy">Pickup &lt;available&gt; in Test City<\/p>/,
  );
  assert.doesNotMatch(html, /<h3>Avionics<\/h3>/);
});

test('staff review labels legacy fields even when the current category has no matching definition', async () => {
  const output = join(
    await mkdtemp(join(tmpdir(), 'rwas-listing-presentation-')),
    'render.cjs',
  );
  await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {ListingDetails} from './app/aircraft-for-sale/admin-listing-presentation'; export const render=fields=>renderToStaticMarkup(React.createElement(ListingDetails,{fields}));`,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const { render } = createRequire(import.meta.url)(output);
  const html = render({
    listingType: 'other',
    nNumber: 'N123AB',
    totalTime: '6500',
  });
  assert.match(html, /<dt>Tail Number<\/dt><dd>N123AB<\/dd>/);
  assert.match(html, /<dt>Airframe total time<\/dt><dd>6500<\/dd>/);
  assert.doesNotMatch(html, /<dt>nNumber<\/dt>/);
});
