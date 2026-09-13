import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifiedQuoteRetailPrice } from '../lib/garmin-quote-retail-display.mjs';
const policy = JSON.parse(fs.readFileSync(new URL('../data/garmin-quote-retail-display.json', import.meta.url)));
const existing = JSON.parse(fs.readFileSync(new URL('../data/garmin-public-price-policy.json', import.meta.url)));
let passed = 0;
function test(value) { assert.ok(value); passed++; }
test(policy.products.length === 178);
test(policy.quoteOnlyAuditProducts.length === 521);
test(new Set(policy.products.map(p => p.sku)).size === 178);
for (const e of policy.products) {
  const p = { id: e.productId, handle: e.handle, vendor: 'Garmin', variants: [{ id: e.variantId, sku: e.sku, price: {amount:e.amount, currencyCode:e.currencyCode} }] };
  test(verifiedQuoteRetailPrice(p, policy)?.amount === e.amount);
  test(policy.quoteOnlyAuditProducts.some(r => r.productId === e.productId && r.handle === e.handle));
  test(!existing.products.some(r => r.variantId === e.variantId));
  for (const field of ['id', 'handle', 'vendor']) test(verifiedQuoteRetailPrice({...p, [field]: 'different'}, policy) === null);
  for (const field of ['id', 'sku']) test(verifiedQuoteRetailPrice({...p, variants:[{...p.variants[0], [field]:'different'}]}, policy) === null);
  for (const amount of ['0', 'NaN', String(Number(e.amount)-1), String(Number(e.amount)+1)]) test(verifiedQuoteRetailPrice({...p, variants:[{...p.variants[0], price:{amount,currencyCode:'USD'}}]}, policy) === null);
  test(verifiedQuoteRetailPrice({...p, variants:[...p.variants,...p.variants]}, policy) === null);
  test(verifiedQuoteRetailPrice({...p, variants:[{...p.variants[0],price:{amount:e.amount,currencyCode:'CAD'}}]}, policy) === null);
}
for (const f of ['about_mockup.html','about_sample.html','collection_mockup.html','pdp_mockup.html','index.html']) test(fs.readFileSync(new URL('../public/preview/'+f,import.meta.url),'utf8').includes('content="noindex, follow"'));
test(fs.readFileSync(new URL('../public/newspaper/index.html',import.meta.url),'utf8').includes('content="noindex, follow"'));
const sitemap = fs.readFileSync(new URL('../app/sitemap.ts',import.meta.url),'utf8');
test(!sitemap.includes("'preview'")); test(!sitemap.includes("'newspaper'"));
const card = fs.readFileSync(new URL('../components/shopify/PdpPriceCard.tsx',import.meta.url),'utf8');
test(card.includes('const otcEligible = otc === \'eligible\''));
test(card.includes('This listing is not'));
test(card.includes("? 'Contact RWAS for Installation and Availability'"));
const page = fs.readFileSync(new URL('../app/products/[handle]/page.tsx',import.meta.url),'utf8');
test(page.includes('quoteRetailPolicy.quoteOnlyAuditProducts.some'));
test(page.includes("gating.otc !== 'eligible'"));
console.log(JSON.stringify({passed,approvedDisplay:178,auditScope:521,networkWrites:0}));
