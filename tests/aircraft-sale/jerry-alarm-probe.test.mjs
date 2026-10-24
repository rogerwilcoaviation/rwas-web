import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { Miniflare } from './fixtures/workerd-options.mjs';
import {
  PROBE,
  resourceManifest,
  assertIsolatedManifest,
  teardownPlan,
} from '../../workers/jerry-alarm-qualification/plan.mjs';

test('resource and teardown plans cannot select production or discard pending data', async () => {
  const manifest = resourceManifest();
  assert.equal(assertIsolatedManifest(manifest), true);
  assert.equal(manifest.namespaces.length, 3);
  assert.equal(manifest.objects.length, 4);
  for (const change of [
    { worker: 'rwas-seller-production-20261006' },
    { externalBindings: ['SELLER_STORE'] },
    { routes: ['www.rogerwilcoaviation.com/*'] },
    { executionAuthorized: true },
  ])
    assert.throws(
      () => assertIsolatedManifest({ ...manifest, ...change }),
      /exact unarmed/,
    );
  assert.equal(
    teardownPlan({
      pendingCopies: 1,
      outboxes: 0,
      unexpiredReceipts: 0,
      alarms: 0,
    }).deleteClassesAndWorker,
    false,
  );
  assert.equal(
    teardownPlan({
      pendingCopies: 0,
      outboxes: 0,
      unexpiredReceipts: 1,
      alarms: 0,
    }).preserveClassesAndBindings,
    true,
  );
  const config = await readFile(
    'workers/jerry-alarm-qualification/wrangler.local.toml',
    'utf8',
  );
  assert.match(config, /workers_dev = false/);
  assert.match(config, /PROBE_ARMED = "false"/);
  assert.ok(!config.includes('[[services]]'));
  assert.ok(!config.includes('[triggers]'));
  const source = await readFile(
    'workers/jerry-alarm-qualification/entry.mjs',
    'utf8',
  );
  assert.ok(!source.includes('api.openai.com'));
  assert.ok(!source.includes('/__test/'));
  assert.equal((source.match(/super\.alarm\(info\)/g) || []).length, 1);
});
async function fixture(run) {
  const start = Date.now() + 3600000;
  let now = start,
    buildName = 'prepare-v1',
    armed = true;
  const options = async () => ({
    workers: [
      {
        name: 'driver',
        modules: true,
        script: `export default {async fetch(r,env){const op=new URL(r.url).pathname.slice(1);if(!['prepare','inspect','reset','checkpoint','teardown'].includes(op))return new Response('no',{status:404});try{return Response.json(await env.PROBE[op]());}catch(e){return Response.json({error:e.message},{status:503});}}}`,
        serviceBindings: { PROBE: 'probe' },
        outboundService: () => {
          throw Error('No egress allowed');
        },
        compatibilityDate: '2026-09-01',
      },
      {
        name: 'probe',
        modules: true,
        script: (
          await build({
            stdin: {
              resolveDir: process.cwd(),
              contents: `
 import {default as Operator,JerryConversationsProbe as C,JerryAdmissionProbe as A,ProbeControl} from './workers/jerry-alarm-qualification/entry.mjs';
 Date.now=()=>${now};
 export default Operator; export {ProbeControl};
 const force=Base=>class extends Base{async fetch(r){if(new URL(r.url).pathname==='/__test/alarm'){await r.arrayBuffer();await this.alarm({localSimulation:true,retryCount:0,isRetry:false});return Response.json({controlled:true});}return super.fetch(r);}};
 export class JerryConversationsProbe extends force(C){};export class JerryAdmissionProbe extends force(A){};
 `,
            },
            bundle: true,
            write: false,
            format: 'esm',
            platform: 'neutral',
            external: ['cloudflare:workers'],
            logLevel: 'silent',
          })
        ).outputFiles[0].text,
        compatibilityDate: '2026-09-01',
        bindings: {
          PROBE_ARMED: String(armed),
          PROBE_BUILD: buildName,
          PROBE_START_AT: String(start),
          PROBE_STOP_AT: String(start + PROBE.activeMs),
          JERRY_CONVERSATIONS_ENABLED: 'false',
        },
        durableObjects: {
          JERRY_CONVERSATIONS: {
            className: 'JerryConversationsProbe',
            useSQLite: true,
          },
          JERRY_ADMISSION: {
            className: 'JerryAdmissionProbe',
            useSQLite: true,
          },
          PROBE_CONTROL: { className: 'ProbeControl', useSQLite: true },
          SELLER_STORE: { className: 'ProbeControl', useSQLite: true },
        },
        outboundService: () => {
          throw Error('Probe has no egress');
        },
      },
    ],
  });
  const mf = new Miniflare(await options());
  const call = async (op) => {
    const r = await mf.dispatchFetch('http://localhost/' + op);
    return { status: r.status, body: await r.json() };
  };
  const direct = async (binding, name, path, body = {}) => {
    const ns = await mf.getDurableObjectNamespace(binding, 'probe');
    const r = await ns
      .get(ns.idFromName(name))
      .fetch('https://probe.internal' + path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    return { status: r.status, body: await r.json() };
  };
  const advance = async (ms, build = buildName) => {
    now = start + ms;
    buildName = build;
    await mf.setOptions(await options());
  };
  try {
    await run({
      call,
      direct,
      advance,
      start,
      disable: async () => {
        armed = false;
        await mf.setOptions(await options());
      },
      mf,
    });
  } finally {
    await mf.dispose();
  }
}
test('local simulation: real reset preserves pending data; controlled native alarms recover across rollback and drain', () =>
  fixture(async (f) => {
    assert.equal((await f.call('prepare')).status, 200);
    assert.equal((await f.call('prepare')).body.alreadyStarted, true);
    const before = (await f.call('checkpoint')).body;
    assert.equal(before.conversations[0].turns, 2);
    assert.equal(before.admission.ops.length, 3);
    assert.ok(
      before.conversations.reduce((n, c) => n + c.logicalRecords, 0) +
        before.admission.logicalRecords <
        1000,
    );
    assert.ok(
      before.conversations.reduce((n, c) => n + c.logicalBytes, 0) +
        before.admission.logicalBytes <
        4 * 1024 * 1024,
    );
    assert.equal(
      (await f.call('teardown')).body.preserveClassesAndBindings,
      true,
    );
    await f.call('reset');
    const reset = (await f.call('checkpoint')).body;
    assert.notEqual(reset.conversations[0].boot, before.conversations[0].boot);
    assert.notEqual(reset.admission.boot, before.admission.boot);
    assert.equal(reset.admission.ops.length, 3);
    await f.advance(61000, 'rollback-v1');
    for (const surface of ['public', 'exchange'])
      assert.equal(
        (
          await f.direct(
            'JERRY_CONVERSATIONS',
            'synthetic:' + surface,
            '/__test/alarm',
          )
        ).status,
        200,
      );
    let state = (await f.call('inspect')).body;
    assert.equal(Object.keys(state.copies).length, 1);
    assert.equal(state.draft.title, 'Independent synthetic tool draft');
    assert.ok(
      state.events.some(
        (e) =>
          e.type === 'alarm-enter' &&
          e.origin === 'controlled-local' &&
          e.build === 'rollback-v1',
      ),
    );
    await f.advance(100000);
    await f.direct('JERRY_ADMISSION', 'website-admission-v1', '/__test/alarm');
    let check = (await f.call('checkpoint')).body;
    assert.deepEqual(check.admission.ops.map((o) => o.state).sort(), [
      'completed',
      'retryable',
      'uncertain',
    ]);
    assert.equal(check.conversations[1].metas[0].status, 'deleting');
    await f.advance(121000);
    await f.direct(
      'JERRY_CONVERSATIONS',
      'synthetic:exchange',
      '/__test/alarm',
    );
    await f.advance(182000);
    await f.direct(
      'JERRY_CONVERSATIONS',
      'synthetic:exchange',
      '/__test/alarm',
    );
    await f.direct('JERRY_ADMISSION', 'website-admission-v1', '/__test/alarm');
    state = (await f.call('inspect')).body;
    assert.deepEqual(state.copies, {});
    assert.deepEqual(
      state.events
        .filter((e) => e.type === 'copy-cleanup' && e.surface === 'exchange')
        .map((e) => e.status),
      [503, 503, 200],
    );
    await f.advance(326000);
    await f.direct('JERRY_ADMISSION', 'website-admission-v1', '/__test/alarm');
    check = (await f.call('checkpoint')).body;
    assert.ok(
      check.conversations.every(
        (c) =>
          c.live === 0 &&
          c.imports === 0 &&
          c.turns === 0 &&
          c.tombstones === 1 &&
          c.alarm === null,
      ),
    );
    assert.equal(check.admission.ops.length, 0);
    assert.equal(check.admission.rates.length, 0);
    const done = await f.call('teardown');
    assert.equal(done.status, 200);
    assert.equal(done.body.drained, true);
  }));
test('unarmed/public entry and rollback cannot bootstrap; deadline preserves pending records and stops alarms', () =>
  fixture(async (f) => {
    const worker = await f.mf.getWorker('probe');
    const publicResponse = await worker.fetch(
      'http://localhost/__probe/start',
      { method: 'POST' },
    );
    assert.equal(publicResponse.status, 404);
    await publicResponse.arrayBuffer();
    await f.call('prepare');
    await f.advance(PROBE.activeMs + 1, 'rollback-v1');
    assert.equal((await f.call('prepare')).status, 503);
    await f.direct(
      'JERRY_CONVERSATIONS',
      'synthetic:exchange',
      '/__test/alarm',
    );
    const snapshot = await f.direct(
      'JERRY_CONVERSATIONS',
      'synthetic:exchange',
      '/__probe/inspect',
    );
    assert.equal(snapshot.body.turns, 2);
    assert.equal(snapshot.body.alarm, null);
    assert.equal(
      (await f.call('teardown')).body.preserveClassesAndBindings,
      true,
    );
    await f.disable();
    assert.equal((await f.call('prepare')).status, 503);
  }));
test('durable concurrency and control budgets reject excess work without acquiring another object', () =>
  fixture(async (f) => {
    await f.call('prepare');
    const gate = () =>
      f.direct('PROBE_CONTROL', 'seller-v2', '/event', {
        type: 'native-request',
        kind: 'admission',
        boot: crypto.randomUUID(),
      });
    const results = await Promise.all([gate(), gate(), gate()]);
    assert.equal(results.filter((r) => r.body.allowed).length, 2);
    assert.equal(results.filter((r) => !r.body.allowed).length, 1);
    for (let i = 0; i < 29; i++)
      assert.equal((await f.call('inspect')).status, 200);
    assert.equal((await f.call('inspect')).status, 503);
  }));
test('event and payload limits stop alarms while retaining pending synthetic content', () =>
  fixture(async (f) => {
    await f.call('prepare');
    const send = (body) =>
      f.direct('PROBE_CONTROL', 'seller-v2', '/event', body);
    assert.equal(
      (
        await send({
          type: 'native-complete',
          kind: 'admission',
          boot: 'x'.repeat(5000),
        })
      ).status,
      503,
    );
    for (let i = 0; i < 210; i++)
      await send({
        type: 'native-complete',
        kind: 'admission',
        boot: crypto.randomUUID(),
      });
    assert.equal((await f.call('inspect')).body.events.length, 200);
    await f.direct('JERRY_CONVERSATIONS', 'synthetic:public', '/__test/alarm');
    const snapshot = (
      await f.direct(
        'JERRY_CONVERSATIONS',
        'synthetic:public',
        '/__probe/inspect',
      )
    ).body;
    assert.equal(snapshot.turns, 2);
    assert.equal(snapshot.alarm, null);
    assert.equal(
      (await f.call('teardown')).body.preserveClassesAndBindings,
      true,
    );
  }));
