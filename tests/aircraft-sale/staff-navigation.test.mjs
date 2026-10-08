import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('broadsheet footer exposes the staff review sign-in entry point', async () => {
  const source = await readFile(
    new URL('../../components/shared/broadsheet/BroadsheetFooter.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /href: '\/seller-review', label: 'Staff Login'/);
  assert.match(source, /aria-label="Footer navigation"/);
});
