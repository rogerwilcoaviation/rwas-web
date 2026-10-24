import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { LANGUAGE_VERSION } from '../../lib/site-language.mjs';
test('actual staged Pages wrapper routes Jerry and staff/admin transcript lookups over native RPC', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jerry-pages-'));
  let mf;
  try {
    await mkdir(join(root, '_worker.js'));
    await writeFile(
      join(root, '_worker.js/index.js'),
      "export default {fetch(){return new Response('existing-app')}}",
    );
    await writeFile(
      join(root, '_routes.json'),
      JSON.stringify({ version: 1, include: ['/*'], exclude: ['/ops/*'] }),
    );
    execFileSync(process.execPath, ['scripts/stage-service-intake.mjs', root]);
    const seller =
      "import {WorkerEntrypoint} from 'cloudflare:workers';export default class extends WorkerEntrypoint{jerryWebsite(request){return request.operation==='context'?{enabled:true,identity:null}:{operation:request.operation,pageContext:request.pageContext}}jerryActivity(request){return {id:request.eventId,staff:request.staff}}fetch(){return new Response('legacy-service')}}";
    mf = new Miniflare({
      workers: [
        {
          name: 'pages',
          modules: true,
          modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
          scriptPath: join(root, '_worker.js/index.js'),
          modulesRoot: join(root, '_worker.js'),
          compatibilityDate: '2026-09-01',
          bindings: { JERRY_CONVERSATIONS_ENABLED: 'true' },
          serviceBindings: {
            SELLER_API: 'seller',
            ASSETS: async () =>
              Response.json({
                version: LANGUAGE_VERSION,
                entries: [{ text: 'Published synthetic page reference' }],
              }),
          },
        },
        {
          name: 'seller',
          modules: true,
          script: seller,
          compatibilityDate: '2026-09-01',
        },
      ],
    });
    const base = 'https://www.rogerwilcoaviation.com';
    assert.equal(
      (await (await mf.dispatchFetch(base + '/api/jerry/context')).json())
        .enabled,
      true,
    );
    const sent = await mf.dispatchFetch(base + '/api/jerry/website', {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        'X-RWAS-Jerry': 'website-v1',
      },
      body: JSON.stringify({
        operation: 'list',
        surface: 'exchange',
        page: '/aircraft-for-sale',
        body: {},
      }),
    });
    assert.deepEqual(await sent.json(), {
      operation: 'list',
      pageContext: 'Published synthetic page reference',
    });
    const id = crypto.randomUUID();
    for (const role of ['admin', 'staff'])
      assert.deepEqual(
        await (
          await mf.dispatchFetch(
            base + '/api/aircraft-sale/' + role + '/activity/' + id,
          )
        ).json(),
        { id, staff: role === 'staff' },
      );
    assert.equal(
      await (await mf.dispatchFetch(base + '/faq')).text(),
      'existing-app',
    );
    const routes = JSON.parse(
      await readFile(join(root, '_routes.json'), 'utf8'),
    );
    assert.ok(routes.exclude.includes('/ops/*'));
    assert.ok(routes.include.some((p) => p === '/*' || p === '/api/jerry/*'));
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
