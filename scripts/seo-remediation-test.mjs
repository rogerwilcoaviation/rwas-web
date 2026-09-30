import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifiedQuoteRetailPrice } from '../lib/garmin-quote-retail-display.mjs';
const policy = JSON.parse(fs.readFileSync(new URL('../data/garmin-quote-retail-display.json', import.meta.url)));
const existing = JSON.parse(fs.readFileSync(new URL('../data/garmin-public-price-policy.json', import.meta.url)));
let passed = 0;
function test(value) { assert.ok(value); passed++; }
// Four exact GI 275 display-only additions were committed on 2026-09-26.
// Pin their full identity/provenance rather than treating them as audited rows
// or granting purchase eligibility to other products sharing these SKUs.
const gi275DisplayAdditions = [
  { productId: 'gid://shopify/Product/8961786609883', handle: 'kit-gi-275-adahrs-class-i-ii', variantId: 'gid://shopify/ProductVariant/47408721297627', sku: '010-02326-10', amount: '4695.00', currencyCode: 'USD', sourcePages: [20], sourceKey: 'aftermarket' },
  { productId: 'gid://shopify/Product/8961786151131', handle: 'kit-gi-275-adahrs-ap-class-i-ii', variantId: 'gid://shopify/ProductVariant/47408720904411', sku: '010-02326-20', amount: '5795.00', currencyCode: 'USD', sourcePages: [20], sourceKey: 'aftermarket' },
  { productId: 'gid://shopify/Product/9429397340379', handle: 'garmin-axis-certified-010-02326-20', variantId: 'gid://shopify/ProductVariant/49078739665115', sku: '010-02326-20', amount: '5795.00', currencyCode: 'USD', sourcePages: [20], sourceKey: 'aftermarket' },
  { productId: 'gid://shopify/Product/9429397307611', handle: 'garmin-axis-certified-010-02326-10', variantId: 'gid://shopify/ProductVariant/49078739632347', sku: '010-02326-10', amount: '4695.00', currencyCode: 'USD', sourcePages: [20], sourceKey: 'aftermarket' },
];
for (const addition of gi275DisplayAdditions) {
  const matches = policy.products.filter(row => row.variantId === addition.variantId);
  assert.deepEqual(matches, [addition]);
}
const originalAuditRows = policy.products.filter(row => !gi275DisplayAdditions.some(addition => addition.variantId === row.variantId));
test(originalAuditRows.length === 195);
test(policy.products.length === 199);
test(policy.quoteOnlyAuditProducts.length === 521);
test(new Set(originalAuditRows.map(p => p.sku)).size === 195);
test(new Set(policy.products.map(p => p.variantId)).size === 199);
for (const e of policy.products) {
  const p = { id: e.productId, handle: e.handle, vendor: 'Garmin', variants: [{ id: e.variantId, sku: e.sku, price: {amount:e.amount, currencyCode:e.currencyCode} }] };
  test(verifiedQuoteRetailPrice(p, policy)?.amount === e.amount);
  test(gi275DisplayAdditions.some(r => r.variantId === e.variantId) || policy.quoteOnlyAuditProducts.some(r => r.productId === e.productId && r.handle === e.handle));
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
console.log(JSON.stringify({passed,approvedDisplay:199,originalAuditDisplay:195,gi275Additions:4,auditScope:521,networkWrites:0}));
