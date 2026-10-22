// Local schema generation only. This never connects to a provider or live D1.
import { mkdir, writeFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { getMigrations } from 'better-auth/db/migration';
import { createSellerAuth } from '../../workers/aircraft-sale/better-auth-service.mjs';

const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("local"); } };',
  compatibilityDate: '2026-09-01',
  compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['SELLER_AUTH_DB'],
});
try {
  const database = await mf.getD1Database('SELLER_AUTH_DB');
  const auth = createSellerAuth(
    {
      BETTER_AUTH_ENABLED: 'true',
      BETTER_AUTH_LOCAL: 'true',
      BETTER_AUTH_URL: 'http://localhost',
      BETTER_AUTH_SECRET: 'rwas-local-fixture-only-never-production-20261022',
      SELLER_AUTH_DB: database,
    },
    {
      mailer: async () => {
        throw new Error('Schema generation must not send mail.');
      },
    },
  );
  const plan = await getMigrations(auth.options);
  if (plan.unsafeChanges.length || plan.schemaProblems.length)
    throw new Error('Unexpected schema generation problem.');
  const sql =
    '-- Generated from Better Auth 1.7.12 and better-auth-service.mjs.\n-- Apply only to the dedicated seller identity D1 database after approval.\n' +
    (await plan.compileMigrations()) +
    '\n';
  const directory = new URL(
    '../../workers/aircraft-sale/migrations/',
    import.meta.url,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('0001_seller_auth.sql', directory), sql);
  console.log(
    'Generated local dedicated identity schema; no provider operations.',
  );
} finally {
  await mf.dispose();
}
