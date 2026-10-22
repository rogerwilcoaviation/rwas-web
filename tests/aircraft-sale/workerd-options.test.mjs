import assert from 'node:assert/strict';
import test from 'node:test';
import { workerdOptions } from './fixtures/workerd-options.mjs';

test('bundled fixtures preserve exact source, flags, binding identities and repeatable options', () => {
  const script = 'export default { fetch() { return new Response("fixture"); } };';
  const serviceBindings = { MAILER: async () => new Response(null) };
  const options = {
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['global_fetch_strictly_public'],
    serviceBindings,
  };
  const normalized = workerdOptions(options);
  assert.deepEqual(normalized.modules, [{ type: 'ESModule', path: 'worker-fixture.mjs', contents: script }]);
  assert.equal('script' in normalized, false);
  assert.deepEqual(normalized.compatibilityFlags, ['global_fetch_strictly_public', 'nodejs_compat']);
  assert.equal(normalized.serviceBindings, serviceBindings);
  assert.deepEqual(workerdOptions(normalized), normalized);
  assert.equal(options.script, script);
  assert.equal(options.modules, true);
  assert.deepEqual(options.compatibilityFlags, ['global_fetch_strictly_public']);
});

test('multi-worker and unbundled graphs retain routing and options on setOptions preparation', () => {
  const unbundled = { name: 'pages', modules: true, scriptPath: '/fixture/index.js', modulesRoot: '/fixture', serviceBindings: { SELLER_API: 'seller' } };
  const options = { workers: [unbundled, { name: 'seller', modules: true, script: 'export default {}', d1Databases: ['SELLER_AUTH_DB'] }], durableObjectsPersist: '/fixture/local-only' };
  const normalized = workerdOptions(options);
  assert.equal(normalized.workers[0].scriptPath, unbundled.scriptPath);
  assert.equal(normalized.workers[0].modules, true);
  assert.equal(normalized.workers[0].serviceBindings, unbundled.serviceBindings);
  assert.equal(normalized.workers[1].modules[0].contents, options.workers[1].script);
  assert.deepEqual(normalized.workers[1].d1Databases, ['SELLER_AUTH_DB']);
  assert.equal(normalized.durableObjectsPersist, options.durableObjectsPersist);
  assert.deepEqual(workerdOptions(normalized), normalized);
});
