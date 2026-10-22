import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('production build explicitly enables the Clerk seller frontend', async () => {
  // An isolated release can supply the same explicit Next build input without
  // copying the production environment file (which also holds private inputs).
  const env = await readFile(new URL('.env.production', root), 'utf8').catch(
    (error) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    },
  );
  const lines = env
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'));
  const configured = lines.filter((line) =>
    line.startsWith('NEXT_PUBLIC_SELLER_CLERK_PRODUCTION='),
  );
  assert.ok(configured.length <= 1, 'Clerk build input must not be ambiguous.');
  assert.equal(
    process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION ??
      configured[0]?.split('=')[1],
    'true',
    'The effective production build input must explicitly enable Clerk.',
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
