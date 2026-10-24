import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planJerrySellerConfig } from '../../workers/aircraft-sale/jerry-release-plan.mjs';
test('offline binding/migration plan preserves the complete seller baseline and stays off', async () => {
  const source = await readFile(
    'workers/aircraft-sale/wrangler.production.toml',
    'utf8',
  );
  const plan = planJerrySellerConfig(source, {
    responseService: 'rwas-jerry-response-synthetic',
  });
  const existing = plan
    .split('\n# Offline candidate:')[0]
    .replace('JERRY_CONVERSATIONS_ENABLED = "false"\n', '');
  assert.equal(existing, source);
  assert.equal(
    (plan.match(/new_sqlite_classes = \["SellerStore"\]/g) || []).length,
    1,
  );
  assert.match(plan, /tag = "seller-production-20261007-first"/);
  assert.match(plan, /new_sqlite_classes = \["JerryConversations"\]/);
  assert.match(plan, /JERRY_CONVERSATIONS_ENABLED = "false"/);
  assert.match(plan, /keep_vars = true/);
  assert.throws(
    () =>
      planJerrySellerConfig(plan, {
        responseService: 'rwas-jerry-response-synthetic',
      }),
    /already appear/,
  );
  assert.throws(
    () => planJerrySellerConfig(source, { responseService: 'invalid"\n' }),
    /reviewed response service/,
  );
  const local = await readFile(
    'workers/aircraft-sale/wrangler.jerry.local.toml',
    'utf8',
  );
  assert.match(local, /JERRY_CONVERSATIONS_ENABLED = "false"/);
  const response = await readFile(
    'workers/jerry-response/wrangler.local.toml',
    'utf8',
  );
  assert.match(response, /new_sqlite_classes = \["JerryAdmission"\]/);
  assert.ok(!/^OPENAI_API_KEY\s*=/m.test(response));
  assert.ok(!/^JERRY_MODEL\s*=/m.test(response));
});
