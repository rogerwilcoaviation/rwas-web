import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fixture, fields, create, submit, approve } from './fixture.mjs';

let renderer;
async function render() {
  if (renderer) return renderer;
  const output = join(
    await mkdtemp(join(tmpdir(), 'rwas-condition-display-')),
    'render.cjs',
  );
  await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {ConditionReport} from './app/aircraft-for-sale/condition-report'; import {ListingDetails} from './app/aircraft-for-sale/admin-listing-presentation'; import {ListingCard} from './app/aircraft-for-sale/listing-card'; import Masthead from './components/shared/broadsheet/Masthead'; import Footer from './components/shared/broadsheet/BroadsheetFooter'; export const chrome=(showLocation)=>renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(Masthead,showLocation?{}:{certLocation:''}),React.createElement(Footer,{showLocation}))); export const report=(fields,compact=false)=>renderToStaticMarkup(React.createElement(ConditionReport,{fields,compact})); export const admin=fields=>renderToStaticMarkup(React.createElement(ListingDetails,{fields})); export const card=fields=>renderToStaticMarkup(React.createElement(ListingCard,{listing:fields}));`,
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
  renderer = createRequire(import.meta.url)(output);
  return renderer;
}

test('condition report renders accessible seller-reported stars and escaped notes', async () => {
  const { report } = await render();
  const html = report({
    exteriorRating: 4,
    interiorRating: '2',
    exteriorConditionNotes: 'Paint <touch-up>',
    interiorConditionNotes: 'Seat wear',
  });
  assert.match(html, /Seller-reported ratings/);
  assert.match(
    html,
    /role="img" aria-label="Exterior condition: 4 of 5 stars — Very good"/,
  );
  assert.match(html, /★★★★.*☆/);
  assert.match(html, /4\/5 — Very good/);
  assert.match(html, /2\/5 — Fair/);
  assert.match(html, /Paint &lt;touch-up&gt;/);
  assert.doesNotMatch(html, /aggregateRating/);
});

test('unrated older listings stay unrated and compact cards omit empty ratings', async () => {
  const { report, card } = await render();
  assert.equal((report({}).match(/Not rated/g) || []).length, 2);
  assert.equal(report({}, true), '');
  const html = card({ id: 'fixture', source: 'seller', exteriorRating: 5 });
  assert.match(html, /Seller-reported condition/);
  assert.match(html, /Exterior condition: 5 of 5 stars — Excellent/);
  assert.doesNotMatch(html, /Interior condition/);
});

test('reports respect applicable categories and legacy notes appear once in staff details', async () => {
  const { report, admin } = await render();
  assert.equal(
    report({ listingType: 'parts', exteriorRating: 5, interiorRating: 5 }),
    '',
  );
  const html = admin({
    make: 'Fixture',
    specifications: {
      'exterior-exterior-notes': 'Original paint notes',
      'interior-interior-notes': 'Original seat notes',
    },
  });
  assert.equal((html.match(/Original paint notes/g) || []).length, 1);
  assert.equal((html.match(/Original seat notes/g) || []).length, 1);
  assert.match(html, /Condition report/);
  assert.equal((html.match(/Not rated/g) || []).length, 2);
});

test('public Worker detail uses RWAS homepage chrome, condition report and actual seller location', async () => {
  const f = fixture(),
    owner = await f.login();
  const listing = await create(f, owner, {
    ...fields,
    sellerLocation: 'Tulsa, Oklahoma',
    exteriorRating: '4',
    interiorRating: '3',
    exteriorConditionNotes: 'Paint <touch-up>',
    interiorConditionNotes: 'Clean cabin',
  });
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
  assert.equal(
    response.headers.get('Content-Security-Policy'),
    "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; frame-ancestors 'none'",
  );
  const html = await response.text();
  for (const marker of [
    'bs-masthead',
    '/newspaper/images/logo-128.webp',
    'bs-nav__mobile',
    'AXIS System Builder',
    'Papa-Alpha Tools',
    'bs-footer',
    'Staff Login',
    'Condition report',
    'Seller-reported ratings',
    '4/5 — Very good',
    '3/5 — Good',
  ])
    assert.ok(html.includes(marker), marker);
  assert.match(
    html,
    /aria-label="Exterior condition: 4 of 5 stars — Very good"/,
  );
  assert.match(html, /Paint &lt;touch-up&gt;/);
  assert.match(html, /Tulsa, Oklahoma/);
  assert.doesNotMatch(html, /Yankton|South Dakota|KYKN|aggregateRating/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
});

test('Exchange chrome omits the fixed location while default site chrome retains it', async () => {
  const { chrome } = await render();
  assert.doesNotMatch(chrome(false), /Yankton|South Dakota|KYKN/i);
  assert.match(chrome(true), /Yankton/);
});
