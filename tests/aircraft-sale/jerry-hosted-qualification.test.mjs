import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';

test('hosted qualification is closed without a window, ignores arbitrary caller content, and exposes only fixed start/status routes', async () => {
  const script = (
    await build({
      entryPoints: ['workers/jerry-account-qualification/entry.mjs'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      external: ['cloudflare:workers'],
      logLevel: 'silent',
    })
  ).outputFiles[0].text;
  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    bindings: { QA_EXPIRES_AT: '0' },
    durableObjects: {
      QA_CONTROL: { className: 'QualificationControl', useSQLite: true },
    },
    outboundService: () => {
      throw Error('No qualification provider request allowed');
    },
  });
  try {
    assert.equal(
      (
        await mf.dispatchFetch('https://qa.invalid/start', {
          method: 'POST',
          body: 'UNTRUSTED INPUT MUST NOT BE PROCESSED',
        })
      ).status,
      410,
    );
    for (const path of ['/exec', '/respond', '/upload', '/start'])
      assert.equal(
        (await mf.dispatchFetch('https://qa.invalid' + path)).status,
        404,
      );
  } finally {
    await mf.dispose();
  }
});
