import assert from 'node:assert/strict';
import fs from 'node:fs';
import { papaAlphaVariantFromSearch } from '../lib/papa-alpha-variant-selection.mjs';
const title = 'Papa-Alpha PA-31 Rudder Trim Rigging Tool';
const first = 'gid://shopify/ProductVariant/47328308330715';
const second = 'gid://shopify/ProductVariant/47328308363483';
const variants = [{ id: first }, { id: second }];
const cases = [
  ['exact RT02', title, '?variant=47328308363483', second],
  ['exact RT01', title, '?variant=47328308330715', first],
  ['extra query preserved', title, '?source=jerry&variant=47328308363483', second],
  ['no query', title, '', null],
  ['unknown id', title, '?variant=999', null],
  ['unrelated product', 'Garmin GDU 116C', '?variant=47328308363483', null],
  ['embedded title', 'Other Papa-Alpha', '?variant=47328308363483', null],
  ['duplicate', title, '?variant=47328308363483&variant=47328308330715', null],
  ['duplicate same', title, '?variant=47328308363483&variant=47328308363483', null],
  ['gid text', title, '?variant=gid://shopify/ProductVariant/47328308363483', null],
  ['script', title, '?variant=javascript:alert(1)', null],
  ['encoded HTML', title, '?variant=%3Cscript%3E', null],
  ['leading zero', title, '?variant=047328308363483', null],
  ['wrong case parameter', title, '?Variant=47328308363483', null],
];
for (const [name, productTitle, search, expected] of cases) assert.equal(papaAlphaVariantFromSearch(productTitle, variants, search), expected, name);
const source = fs.readFileSync(new URL('../components/shopify/PdpPriceCard.tsx', import.meta.url), 'utf8');
assert.match(source, /papaAlphaVariantFromSearch\([\s\S]*window.location.search/);
assert.match(source, /addEventListener\('popstate', syncLinkedVariant\)/);
assert.match(source, /removeEventListener\('popstate', syncLinkedVariant\)/);
assert.match(source, /onChange=\{\(e\) => setSelectedId\(e.target.value\)\}/);
assert.match(source, /disabled=\{loading \|\| !selected\?\.availableForSale\}/);
console.log(`${cases.length}/${cases.length} exact Papa-Alpha variant URL cases passed; manual selection, unavailable guard, and popstate lifecycle preserved`);
