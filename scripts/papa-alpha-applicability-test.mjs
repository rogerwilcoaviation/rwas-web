#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Execute the actual pure chart/description and PDP helpers without credentials,
// Shopify calls, cart creation, or importing the Next.js application.
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const chartSource = read('data/papaAlphaRiggingChart.ts');
const chartRows = JSON.parse(
  chartSource.match(/PAPA_ALPHA_RIGGING_CHART_ROWS[^=]*=\s*(\[[\s\S]*?\])\s+as const;/)[1],
);
const script = read('scripts/reconcile-papa-alpha-pa28-pa32-custom-kit.mjs');
const context = vm.createContext({
  fs: { readFileSync: () => chartSource },
  URL,
});
vm.runInContext(
  script.slice(script.indexOf('const HANDLE'), script.indexOf('for (const raw')) +
    script.slice(script.indexOf('function esc'), script.indexOf('async function state'))
      .replaceAll('import.meta.url', JSON.stringify(import.meta.url)) +
    '\nglobalThis.result = { coverage: chart(), html: description(), BOMS, COMPONENTS, CONTENTS, PRICE, TAGS };',
  context,
);
const { coverage, html, BOMS, COMPONENTS, CONTENTS, PRICE, TAGS } = context.result;
const holds = chartRows.filter((row) => row.applicabilityWarning);
assert.equal(holds.length, 2);
assert.deepEqual(holds.map((row) => [row.model, row.serials, row.kit]), [
  ['PA-28-161 Warrior III', '2842001 thru 2842420', 'KT-07'],
  ['PA-28-161 Warrior III', '2816110 thru 2816119', 'KT-08'],
]);
for (const row of coverage) {
  const start = html.indexOf(`<td>${context.esc(row.model)}</td><td>${context.esc(row.serials.replace(/\s+/g, ' '))}</td>`);
  assert.ok(start >= 0, `Missing coverage row: ${row.model} ${row.serials}`);
  const renderedRow = html.slice(start, html.indexOf('</tr>', start));
  if (row.applicabilityWarning) {
    assert.ok(renderedRow.includes('source reference only; applicability unresolved'));
    assert.ok(renderedRow.includes(row.applicabilityWarning));
    assert.ok(renderedRow.includes('inclusion does not resolve applicability'));
  } else {
    assert.ok(renderedRow.includes(`<td>${row.kit}</td><td>${BOMS.get(row.kit)}</td>`));
  }
}
assert.equal(PRICE, '3499.99');
assert.equal(CONTENTS.length, 12);
assert.equal(CONTENTS.reduce((n, [, quantity]) => n + quantity, 0), 17);
assert.equal(JSON.stringify(COMPONENTS), JSON.stringify([
  ['KT-06', 1], ['R-04', 1], ['R-05', 1], ['R-06', 1], ['R-08', 1],
  ['BC-04', 2], ['BC-05', 2], ['BC-06', 2], ['BC-07', 2],
]));
assert.ok(TAGS.includes('rwas-custom-bundle'));

const page = read('app/products/[handle]/page.tsx');
const helperSource = page.slice(page.indexOf('function spreadsheetToolValue'), page.indexOf('const PA31_RUDDER_TRIM_ROWS'));
context.PAPA_ALPHA_RIGGING_CHART_ROWS = chartRows;
context.PAPA_ALPHA_APPLICABILITY_TOOL_KEYS = {
  'rigging-kit': 'kit', 'bell-crank-rigging-tool': 'bellcrank',
  'rudder-rigging-tool': 'rudder', 'stabilator-rigging-tool': 'stabilator',
  'pa-28-32-34-44-aileron-and-flap-rigging-tool-1': 'aileronFlap',
};
vm.runInContext(stripTypeScriptTypes(helperSource), context);
for (const [handle, key] of Object.entries(context.PAPA_ALPHA_APPLICABILITY_TOOL_KEYS)) {
  const rows = context.papaAlphaSpreadsheetRowsForHandle(handle);
  for (let i = 0; i < chartRows.length; i++) {
    const held = chartRows[i].applicabilityWarning && ['kit', 'bellcrank'].includes(key);
    assert.equal(rows[i].tool, held ? chartRows[i].applicabilityWarning : chartRows[i][key].trim() || 'N/A');
    assert.equal(rows[i].unresolved, Boolean(held));
  }
  const summary = page.slice(page.indexOf('  const supportedRows ='), page.indexOf('  const toolCounts ='));
  context.rows = rows;
  vm.runInContext(`{ ${summary} globalThis.counts = { supported: supportedRows.length, na: notApplicableRows, held: unresolvedRows }; }`, context);
  assert.equal(context.counts.held, ['kit', 'bellcrank'].includes(key) ? 2 : 0);
  assert.equal(context.counts.supported + context.counts.na + context.counts.held, rows.length);
}
vm.runInContext(stripTypeScriptTypes(page.slice(page.indexOf('function sanitizeProductHtml'), page.indexOf('export async function generateStaticParams'))), context);
assert.equal(context.sanitizeProductHtml(html), html);
const itemizedPattern = /<h2[^>]*>[^<]*kit contents\b/i;
assert.ok(itemizedPattern.test(html));
assert.ok(page.includes('!cleanDescText || hasItemizedKitContents'));
assert.ok(page.includes('Package contents and source-chart applicability warnings are listed below.'));
assert.ok(page.includes("availability: product.tags.includes('rwas-custom-bundle')\n          ? undefined"));
assert.ok(page.indexOf(") : product.tags.includes('rwas-custom-bundle') ? (") < page.indexOf(") : gating.otc === 'eligible' ? ("));
console.log(`PASS: ${coverage.length} package rows; 2 exact applicability holds; 5 PDP chart views; contents/price and rich warning preserved. No network or commerce writes.`);
