import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
test('Pages advanced wrapper gates missing seller binding and serves current new IDs without static export', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seller-pages-'));
  let mf;
  try {
    await mkdir(join(root, '_worker.js'));
    await writeFile(
      join(root, '_worker.js/index.js'),
      'export default {fetch(){return new Response("old-static-app")}}',
    );
    await writeFile(
      join(root, '_routes.json'),
      JSON.stringify({ version: 1, include: ['/*'], exclude: [] }),
    );
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);
    const options = {
      modules: true,
      modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
      scriptPath: join(root, '_worker.js/index.js'),
      modulesRoot: join(root, '_worker.js'),
      compatibilityDate: '2026-09-01',
    };
    mf = new Miniflare(options);
    assert.equal(
      (await mf.dispatchFetch('https://fixture.test/api/aircraft-sale/health'))
        .status,
      503,
    );
    assert.equal(
      await (
        await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id')
      ).text(),
      'old-static-app',
    );
    await mf.setOptions({
      ...options,
      bindings: { SELLER_PUBLIC_ROUTES_ENABLED: 'true' },
    });
    assert.equal(
      (await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id'))
        .status,
      503,
    );
    await mf.setOptions({
      ...options,
      bindings: { SELLER_PUBLIC_ROUTES_ENABLED: 'true' },
      serviceBindings: {
        SELLER_API: async (request) =>
          Response.json({
            path: new URL(request.url).pathname,
            accept: request.headers.get('Accept'),
            method: request.method,
          }),
      },
    });
    const data = await (
      await mf.dispatchFetch('https://fixture.test/aircraft-for-sale/new-id')
    ).json();
    assert.equal(data.path, '/api/aircraft-sale/listing/new-id');
    assert.equal(data.accept, 'text/html');
    assert.equal(data.method, 'GET');
    const api = await (
      await mf.dispatchFetch('https://fixture.test/api/aircraft-sale/browse')
    ).json();
    assert.equal(api.path, '/api/aircraft-sale/browse');
    assert.equal(
      await (await mf.dispatchFetch('https://fixture.test/faq')).text(),
      'old-static-app',
    );
    const staging = 'https://intake-restoration-20260922.rwas-web.pages.dev';
    await mf.setOptions({
      ...options,
      bindings: {
        INTAKE_STAGING_MODE: 'true',
        SELLER_PUBLIC_ROUTES_ENABLED: 'true',
      },
      serviceBindings: { SELLER_API: async () => new Response('seller') },
    });
    for (const path of [
      '/api/aircraft-sale/browse',
      '/aircraft-for-sale/new-id',
    ]) {
      const denied = await mf.dispatchFetch('https://fixture.test' + path);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('X-Robots-Tag'), 'noindex, nofollow');
      const permitted = await mf.dispatchFetch(staging + path);
      assert.equal(permitted.status, 200);
      assert.equal(permitted.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    }
    const seller = 'https://repair-aircraft-seller-workf.rwas-web.pages.dev';
    await mf.setOptions({
      ...options,
      bindings: {
        INTAKE_STAGING_MODE: 'true',
        SELLER_STAGING_ORIGIN: seller,
        SELLER_PUBLIC_ROUTES_ENABLED: 'true',
      },
      serviceBindings: {
        SELLER_API: async () => new Response('dedicated-seller'),
      },
    });
    for (const path of [
      '/api/aircraft-sale/health',
      '/aircraft-for-sale/new-id',
    ]) {
      assert.equal(
        await (await mf.dispatchFetch(seller + path)).text(),
        'dedicated-seller',
      );
      for (const other of [
        staging,
        'https://www.rogerwilcoaviation.com',
        'https://abcdef12.rwas-web.pages.dev',
      ])
        assert.equal((await mf.dispatchFetch(other + path)).status, 503);
    }
    // Seller permission does not widen any existing intake endpoint's destination.
    assert.equal(
      (await mf.dispatchFetch(seller + '/api/service-intake-config')).status,
      503,
    );
    assert.match(
      await (await mf.dispatchFetch(seller + '/robots.txt')).text(),
      /Disallow: \//,
    );
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
