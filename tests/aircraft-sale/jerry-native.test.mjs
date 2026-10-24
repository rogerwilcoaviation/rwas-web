import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';

test('canonical content and alarm changes roll back together on initial scheduling acknowledgment failure', async () => {
  const script = (
    await build({
      stdin: {
        resolveDir: process.cwd(),
        contents: `import {JerryConversations as Base} from './workers/aircraft-sale/jerry-conversations.mjs';
 export class JerryConversations extends Base {async schedule(){await super.schedule();if(this.env.FAIL==='true'&&(await this.ctx.storage.list({prefix:'t:'})).size)throw Error('Synthetic alarm registration failure');}async fetch(r){if(new URL(r.url).pathname==='/__test/inspect'){await r.arrayBuffer();return Response.json({entries:[...await this.ctx.storage.list()],alarm:await this.ctx.storage.getAlarm()});}return super.fetch(r);}}
 export default {fetch(r,env){return env.C.get(env.C.idFromName('canonical-fixture')).fetch(r)}};`,
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    })
  ).outputFiles[0].text;
  let fail = false;
  const options = () => ({
    script,
    modules: true,
    compatibilityDate: '2026-09-01',
    bindings: { FAIL: String(fail) },
    durableObjects: { C: { className: 'JerryConversations', useSQLite: true } },
  });
  const mf = new Miniflare(options());
  const call = async (path, body = {}) => {
    const r = await mf.dispatchFetch('http://localhost/' + path, {
      method: 'POST',
      headers: { 'X-Jerry-Owner': 'a'.repeat(64), 'X-Jerry-Surface': 'public' },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    const id = crypto.randomUUID();
    assert.equal((await call('create', { id })).status, 200);
    const before = (await call('__test/inspect')).body;
    fail = true;
    await mf.setOptions(options());
    const request = {
      id,
      generation: 1,
      turnId: crypto.randomUUID(),
      input: {
        message: 'CANONICAL FAILURE MUST ROLL BACK',
        mode: 'chat',
        locale: 'en',
        page: '/',
      },
    };
    assert.equal((await call('reserve', request)).status, 503);
    const after = (await call('__test/inspect')).body;
    assert.ok(!JSON.stringify(after).includes(request.input.message));
    assert.equal(after.alarm, before.alarm);
    fail = false;
    await mf.setOptions(options());
    assert.equal((await call('reserve', request)).status, 200);
  } finally {
    await mf.dispose();
  }
});

test('native SQLite conversation transactions survive worker restart and block late finalization after deletion', async () => {
  const script = (
    await build({
      stdin: {
        contents:
          "export {JerryConversations} from './workers/aircraft-sale/jerry-conversations.mjs'; export default {fetch(request,env){return env.CONVERSATIONS.get(env.CONVERSATIONS.idFromName('synthetic')).fetch(request)}};",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
    })
  ).outputFiles[0].text;
  const options = {
    script,
    modules: true,
    compatibilityDate: '2026-09-01',
    durableObjects: {
      CONVERSATIONS: { className: 'JerryConversations', useSQLite: true },
    },
  };
  const mf = new Miniflare(options);
  const call = (path, body) =>
    mf.dispatchFetch('http://localhost/' + path, {
      method: path === 'list' ? 'GET' : 'POST',
      headers: {
        'X-Jerry-Owner': 'a'.repeat(64),
        'X-Jerry-Surface': 'exchange',
      },
      ...(path === 'list' ? {} : { body: JSON.stringify(body) }),
    });
  try {
    const id = crypto.randomUUID(),
      turnId = crypto.randomUUID();
    const created = await call('create', { id });
    assert.equal(created.status, 200, await created.clone().text());
    const message = {
      id,
      generation: 1,
      turnId,
      input: {
        message: 'Synthetic native turn',
        page: '/aircraft-for-sale',
        locale: 'en',
        mode: 'chat',
      },
    };
    const reserve = await (await call('reserve', message)).json();
    assert.ok(reserve.turn?.lease, JSON.stringify(reserve));
    await mf.setOptions(options);
    const read = await (await call('read', { id })).json();
    assert.equal(read.turns[0].id, turnId);
    assert.equal((await call('delete', { id, generation: 1 })).status, 200);
    assert.equal(
      (
        await call('finalize', {
          id,
          generation: 1,
          turnId,
          lease: reserve.turn.lease,
          result: { reply: 'Late reply' },
        })
      ).status,
      410,
    );
    assert.equal((await call('cleanup-complete', { id })).status, 200);
    assert.equal((await call('cleanup-complete', { id })).status, 200);
    assert.equal((await call('create', { id })).status, 410);
  } finally {
    await mf.dispose();
  }
});

test('real service-binding RPC preserves failure status and guest context without exposing internal routes', async () => {
  const bundle = async (contents) =>
    (
      await build({
        stdin: { contents, resolveDir: process.cwd() },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        conditions: ['workerd', 'worker', 'browser'],
        external: ['cloudflare:workers', 'node:*'],
        logLevel: 'silent',
      })
    ).outputFiles[0].text;
  const front = await bundle(
    'export default {async fetch(request,env){const input=await request.json();return Response.json(await env.SELLER_API.jerryWebsite(input));}}',
  );
  const seller = await bundle(
    "export {default,SellerStore,JerryConversations} from './workers/aircraft-sale/entry.mjs';",
  );
  const mf = new Miniflare({
    workers: [
      {
        name: 'front',
        modules: true,
        script: front,
        compatibilityDate: '2026-09-01',
        serviceBindings: { SELLER_API: 'seller' },
      },
      {
        name: 'seller',
        modules: true,
        script: seller,
        compatibilityDate: '2026-09-01',
        durableObjects: {
          SELLER_STORE: { className: 'SellerStore', useSQLite: true },
          JERRY_CONVERSATIONS: {
            className: 'JerryConversations',
            useSQLite: true,
          },
        },
        bindings: { JERRY_CONVERSATIONS_ENABLED: 'true' },
      },
    ],
  });
  const call = async (data) =>
    (
      await mf.dispatchFetch('http://localhost/', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    ).json();
  try {
    const context = await call({
      operation: 'context',
      proof: { origin: 'http://localhost' },
    });
    assert.equal(context.enabled, true);
    assert.equal(context.identity, null);
    const rejected = await call({
      operation: 'publish',
      proof: { origin: 'http://localhost' },
    });
    assert.equal(rejected.status, 400);
    assert.match(rejected.error, /Unsupported/);
    const privateRequest = await mf.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'list',
        proof: { origin: 'http://localhost' },
        surface: 'public',
        page: '/',
      }),
    });
    assert.equal((await privateRequest.json()).status, 401);
  } finally {
    await mf.dispose();
  }
});
