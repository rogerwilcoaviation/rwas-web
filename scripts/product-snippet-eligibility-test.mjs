import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hasProductSnippetEligibility as eligible } from '../lib/product-snippet-eligibility.mjs';
const product = { '@type': 'Product', name: 'Real product' };
let tests = 0;
const check = (node, expected) => { const before = JSON.stringify(node); assert.equal(eligible(node), expected); assert.equal(JSON.stringify(node), before); tests++; };
check(product, false);
for (const field of ['offers', 'review', 'aggregateRating']) {
  for (const value of [undefined, null, true, false, '', 'yes', {}, [], [{}], [null], { '@type': 'Offer' }]) check({ ...product, [field]: value }, false);
}
for (const value of [249, '249.00', 0, '0']) {
  check({ ...product, offers: { '@type': 'Offer', price: value } }, true);
  check({ ...product, offers: { '@type': 'Offer', priceSpecification: { '@type': 'PriceSpecification', price: value, priceCurrency: 'USD' } } }, true);
}
for (const value of ['', ' ', null, true, false, NaN, Infinity, -1, 'NaN', {}, []]) {
  check({ ...product, offers: { '@type': 'Offer', price: value } }, false);
  check({ ...product, offers: { '@type': 'Offer', priceSpecification: { price: value } } }, false);
}
check({ ...product, offers: { '@type': 'Offer', price: '', priceSpecification: { price: 249 } } }, false);
check({ ...product, offers: [{}, { '@type': 'Offer', price: '299.99' }] }, true);
check({ ...product, offers: { '@type': 'AggregateOffer', lowPrice: 10, priceCurrency: 'USD' } }, true);
check({ ...product, offers: { '@type': 'AggregateOffer', lowPrice: 10 } }, false);
const review = { '@type': 'Review', author: { '@type': 'Person', name: 'Fred Benson' }, reviewRating: { '@type': 'Rating', ratingValue: 4 } };
check({ ...product, review }, true);
check({ ...product, review: [null, review] }, true);
check({ ...product, review: { ...review, author: { '@type': 'Organization', name: 'CNET Reviewers' } } }, true);
check({ ...product, review: { ...review, author: {} } }, false);
check({ ...product, review: { ...review, reviewRating: { ratingValue: '' } } }, false);
for (const field of ['ratingCount', 'reviewCount']) check({ ...product, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.4, [field]: 89 } }, true);
check({ ...product, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.4, reviewCount: 0 } }, false);
check({ ...product, review: { ...review, reviewRating: { ratingValue: 9, bestRating: 10, worstRating: 0 } } }, true);
check({ ...product, review: { ...review, reviewRating: { ratingValue: 9 } } }, false);
check({ ...product, name: '', review }, false);
for (const ratingValue of ['60%', '6 / 10', '0/10']) check({ ...product, review: { ...review, reviewRating: { ratingValue } } }, true);
for (const ratingValue of ['101%', '11/10', '1/0']) check({ ...product, review: { ...review, reviewRating: { ratingValue } } }, false);
// The actual aircraft generator's price branch, evaluated with synthetic listings.
const aircraft = fs.readFileSync(new URL('../app/aircraft-for-sale/[id]/page.tsx', import.meta.url), 'utf8');
const branch = aircraft.slice(aircraft.indexOf('  if (listing.price &&'), aircraft.indexOf('  const breadcrumbJsonLd'));
assert.ok(branch.includes('productJsonLd.offers ='));
const generateAircraftOffer = new Function('listing', 'productJsonLd', 'isSold', 'canonicalUrl', branch + '\nreturn productJsonLd;');
for (const amount of [undefined, null, '', 0, -1, '0']) check(generateAircraftOffer({ price: amount, status: 'active' }, { ...product }, false, 'https://example.com/aircraft'), false);
for (const sold of [false, true]) check(generateAircraftOffer({ price: 149000, status: 'active' }, { ...product }, sold, 'https://example.com/aircraft'), true);
assert.match(aircraft, /hasProductSnippetEligibility\(productJsonLd\) \? \[productJsonLd\] : \[\]/);
const pdp = fs.readFileSync(new URL('../app/products/[handle]/page.tsx', import.meta.url), 'utf8');
assert.match(pdp, /hasProductSnippetEligibility\(productSchema\) &&/);
assert.match(pdp, /JSON.stringify\(breadcrumbSchema\)/);
console.log(JSON.stringify({ tests, mutationChecks: tests, aircraftPriceBranch: 'actual source, synthetic data', networkWrites: 0 }));
