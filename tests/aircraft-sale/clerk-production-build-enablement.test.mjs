import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('production build explicitly enables the Clerk seller frontend', async () => {
  const env = await readFile(new URL('.env.production', root), 'utf8');
  const lines = env.split(/\r?\n/).filter((line) => !line.trim().startsWith('#'));
  assert.equal(
    lines.filter((line) => line === 'NEXT_PUBLIC_SELLER_CLERK_PRODUCTION=true').length,
    1,
  );
});

test('frontend still requires backend clerk-production advertisement', async () => {
  const source = await readFile(
    new URL('app/aircraft-for-sale/clerk-production-browser.ts', root),
    'utf8',
  );
  assert.match(source, /NEXT_PUBLIC_SELLER_CLERK_PRODUCTION === 'true'/);
  assert.match(source, /value\.methods\.includes\('clerk-production'\)/);
});
