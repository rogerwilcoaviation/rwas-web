import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productSchemaExpected } from '../lib/catalog-schema-status.mjs';

const legacyQuoteOnlyHandles = new Set(['legacy-quote-product']);
const expected = (html, handle = 'new-product') =>
  productSchemaExpected({ html, handle, legacyQuoteOnlyHandles });

test('current render policy overrides the incomplete historical quote-only list', () => {
  assert.equal(expected('<main data-product-snippet-eligible="false">'), false);
  assert.equal(
    expected(
      '<main data-product-snippet-eligible="true">',
      'legacy-quote-product',
    ),
    true,
  );
});

test('missing or malformed policy does not suppress schema errors for new products', () => {
  for (const html of ['', '<main data-product-snippet-eligible="maybe">']) {
    assert.equal(expected(html), true);
    assert.equal(expected(html, 'legacy-quote-product'), false);
  }
});

test('accepts both HTML attribute quote styles', () => {
  assert.equal(expected("<main data-product-snippet-eligible='false'>"), false);
  assert.equal(expected("<main data-product-snippet-eligible='true'>"), true);
});
