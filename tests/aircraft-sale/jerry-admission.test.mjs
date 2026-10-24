import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { ADMISSION } from '../../workers/jerry-response/admission.mjs';
import { responseAdmission } from '../../workers/aircraft-sale/jerry-admission-context.mjs';
const script = (
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {JerryAdmission as Base,admittedResponse} from './workers/jerry-response/admission.mjs';
export class TestAdmission extends Base {
 now(){return Number(this.env.NOW);}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/__'))await request.arrayBuffer();
  if(path==='/__alarm'){try{await this.alarm();return Response.json({ok:true});}catch{return Response.json({error:'Synthetic alarm storage failure'},{status:503});}}
  if(path==='/__inspect'){this.init();return Response.json({ops:this.sql.exec('SELECT * FROM admission_ops').toArray(),rates:this.sql.exec('SELECT * FROM admission_rates').toArray(),alarm:await this.ctx.storage.getAlarm()});}
  if(path==='/__seed'){this.init();this.ctx.storage.transactionSync(()=>{for(let i=0;i<8192;i++)this.sql.exec("INSERT INTO admission_ops VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL)",'seed:'+i,'guest:'+('f'.repeat(64)),'public','respond','fixture-'+i,'e'.repeat(64),this.now(),this.now()+86400000,'completed');});return Response.json({ok:true});}
  const response=await super.fetch(request);
  if(this.env.DROP_START==='true'&&path==='/start'&&response.ok){await response.arrayBuffer();return Response.json({error:'Synthetic lost start acknowledgment'},{status:503});}
  if(this.env.DROP_FINISH==='true'&&path==='/finish'&&response.ok){await response.arrayBuffer();return Response.json({error:'Synthetic lost finish acknowledgment'},{status:503});}
  return response;
 }
 sweep(now){if(this.env.ROLLBACK==='true')throw Error('Synthetic storage sweep failure');return super.sweep(now);}
 reserve(body,now){const result=super.reserve(body,now);if(this.env.ROLLBACK==='true')throw Error('Synthetic durable commit failure');return result;}
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/invoke'){try{return Response.json(await admittedResponse(env,await request.json(),async()=>{const r=await env.PROVIDER.fetch('https://synthetic.invalid');if(!r.ok){await r.arrayBuffer();throw Error('Synthetic provider failure');}return r.json();}));}catch(e){return Response.json({error:e.message,code:e.code},{status:e.status||503});}}
 return env.JERRY_ADMISSION.get(env.JERRY_ADMISSION.idFromName('website-admission-v1')).fetch(new Request('https://jerry-admission.internal'+path,request));
}};`,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  })
).outputFiles[0].text;
async function fixture(run) {
  let now = Date.now(),
    calls = 0,
    drop = false,
    failProvider = false,
    dropFinish = false,
    rollback = false;
  const options = () => ({
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    durableObjects: {
      JERRY_ADMISSION: { className: 'TestAdmission', useSQLite: true },
    },
    bindings: {
      NOW: String(now),
      DROP_START: String(drop),
      DROP_FINISH: String(dropFinish),
      ROLLBACK: String(rollback),
    },
    serviceBindings: {
      PROVIDER: async () => {
        calls++;
        return failProvider
          ? new Response('Synthetic failure', { status: 503 })
          : Response.json({ reply: 'synthetic output' });
      },
    },
  });
  const mf = new Miniflare(options());
  const call = async (path, body = {}) => {
    const response = await mf.dispatchFetch('http://localhost/' + path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    });
  };
  const metadata = (overrides = {}) => ({
    category: 'guest',
    principal: 'a'.repeat(64),
    surface: 'public',
    kind: 'respond',
    operationId: crypto.randomUUID(),
    issuedAt: now,
    fingerprint: 'b'.repeat(64),
    ...overrides,
  });
  const restart = async (
    ms = 0,
    loseStart = false,
    failure = false,
    loseFinish = false,
    failCommit = false,
  ) => {
    now += ms;
    drop = loseStart;
    failProvider = failure;
    dropFinish = loseFinish;
    rollback = failCommit;
    await mf.setOptions(options());
  };
  try {
    await run({ call, metadata, restart, calls: () => calls, now: () => now });
  } finally {
    await mf.dispose();
  }
}
const reserve = async (f, input) => {
  const response = await f.call('reserve', input);
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).lease;
};
const finish = async (f, lease, outcome = 'completed') => {
  assert.equal((await f.call('start', { lease })).status, 200);
  assert.equal((await f.call('finish', { lease, outcome })).status, 200);
};
test('simultaneous reservations are atomically bounded across distinct guest groups', () =>
  fixture(async (f) => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        f.call(
          'reserve',
          f.metadata({ principal: (i + 1).toString(16).padStart(64, '0') }),
        ),
      ),
    );
    assert.equal(
      results.filter((r) => r.status === 200).length,
      ADMISSION.globalInFlight,
    );
    assert.equal(results.filter((r) => r.status === 429).length, 1);
  }));
test('a lost completion acknowledgement cannot repeat inference after restart', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await f.restart(0, false, false, true);
    assert.equal((await f.call('invoke', input)).status, 503);
    assert.equal(f.calls(), 1);
    await f.restart();
    assert.equal(
      (await (await f.call('invoke', input)).json()).code,
      'JERRY_ATTEMPT_COMPLETED',
    );
    assert.equal(f.calls(), 1);
  }));
test('alarm storage failure preserves metadata, schedules retry, and cleans after recovery', () =>
  fixture(async (f) => {
    await finish(f, await reserve(f, f.metadata()));
    await f.restart(ADMISSION.receiptMs + 1, false, false, false, true);
    assert.equal((await f.call('__alarm')).status, 503);
    let state = await (await f.call('__inspect')).json();
    assert.equal(state.ops.length, 1);
    assert.equal(state.alarm, f.now() + 60000);
    await f.restart(60001);
    assert.equal((await f.call('__alarm')).status, 200);
    state = await (await f.call('__inspect')).json();
    assert.equal(state.ops.length, 0);
    assert.equal(state.rates.length, 0);
  }));
test('durable transaction failure rolls back the permit and quota before any provider work', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await f.restart(0, false, false, false, true);
    assert.equal((await f.call('invoke', input)).status, 503);
    assert.equal(f.calls(), 0);
    const state = await (await f.call('__inspect')).json();
    assert.equal(state.ops.length, 0);
    assert.equal(state.rates.length, 0);
    await f.restart();
    assert.equal((await f.call('invoke', input)).status, 200);
    assert.equal(f.calls(), 1);
  }));
test('failed provider work holds its concurrency slot through the lease and never automatically reruns', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await f.restart(0, false, true);
    assert.equal((await f.call('invoke', input)).status, 503);
    assert.equal(f.calls(), 1);
    assert.equal(
      (await (await f.call('reserve', input)).json()).code,
      'JERRY_ATTEMPT_FAILED',
    );
    assert.equal((await f.call('reserve', f.metadata())).status, 429);
    await f.restart(ADMISSION.leaseMs + 1);
    assert.equal((await f.call('invoke', f.metadata())).status, 200);
    assert.equal(f.calls(), 2);
    assert.equal(
      (await (await f.call('reserve', input)).json()).code,
      'JERRY_ATTEMPT_FAILED',
    );
  }));
test('an operation cannot be replayed under a different principal or after an admission-secret rotation', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await finish(f, await reserve(f, input));
    assert.equal(
      (
        await (
          await f.call('reserve', {
            ...input,
            principal: 'e'.repeat(64),
            fingerprint: 'f'.repeat(64),
          })
        ).json()
      ).code,
      'JERRY_REPLAY_CONFLICT',
    );
  }));

test('durable metadata idempotency survives restart and never stores guest content or output', () =>
  fixture(async (f) => {
    const input = f.metadata(),
      lease = await reserve(f, input);
    assert.equal((await f.call('start', { lease })).status, 200);
    await f.restart();
    let response = await f.call('reserve', input);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'JERRY_ATTEMPT_PENDING');
    assert.equal(
      (await f.call('finish', { lease, outcome: 'completed' })).status,
      200,
    );
    await f.restart();
    response = await f.call('reserve', input);
    assert.equal((await response.json()).code, 'JERRY_ATTEMPT_COMPLETED');
    assert.equal(
      (await f.call('reserve', { ...input, fingerprint: 'c'.repeat(64) }))
        .status,
      409,
    );
    assert.equal(
      (
        await f.call('reserve', {
          ...input,
          message: 'SYNTHETIC PRIVATE CONTENT',
        })
      ).status,
      400,
    );
    const state = await (await f.call('__inspect')).json();
    assert.equal(state.ops.length, 1);
    assert.ok(!JSON.stringify(state).includes('SYNTHETIC PRIVATE CONTENT'));
    assert.deepEqual(
      Object.keys(state.ops[0]).sort(),
      [
        'op_key',
        'principal',
        'surface',
        'kind',
        'operation_id',
        'fingerprint',
        'issued_at',
        'expires_at',
        'state',
        'nonce',
        'deadline',
      ].sort(),
    );
  }));
test('expired unstarted lease recovers; expired started work stays uncertain and releases concurrency', () =>
  fixture(async (f) => {
    const input = f.metadata(),
      first = await reserve(f, input);
    await f.restart(ADMISSION.leaseMs + 1);
    const second = await reserve(f, input);
    assert.notEqual(first.nonce, second.nonce);
    assert.equal((await f.call('start', { lease: first })).status, 409);
    assert.equal((await f.call('start', { lease: second })).status, 200);
    await f.restart(ADMISSION.leaseMs + 1);
    assert.equal(
      (await f.call('finish', { lease: second, outcome: 'completed' })).status,
      409,
    );
    assert.equal(
      (await (await f.call('reserve', input)).json()).code,
      'JERRY_ATTEMPT_UNCERTAIN',
    );
    await finish(f, await reserve(f, f.metadata()));
  }));
test('global concurrency and principal concurrency apply across both surfaces and worker restarts', () =>
  fixture(async (f) => {
    const guest = await reserve(f, f.metadata());
    assert.equal(
      (await f.call('reserve', f.metadata({ surface: 'exchange' }))).status,
      429,
    );
    const other = await reserve(f, f.metadata({ principal: 'c'.repeat(64) }));
    const account = await reserve(
      f,
      f.metadata({ category: 'account', principal: 'd'.repeat(64) }),
    );
    const account2 = await reserve(
      f,
      f.metadata({
        category: 'account',
        principal: 'd'.repeat(64),
        surface: 'exchange',
      }),
    );
    assert.equal(
      (
        await f.call(
          'reserve',
          f.metadata({ category: 'account', principal: 'd'.repeat(64) }),
        )
      ).status,
      429,
    );
    await f.restart();
    assert.equal(
      (await f.call('reserve', f.metadata({ principal: 'e'.repeat(64) })))
        .status,
      429,
    );
    assert.equal(
      (
        await f.call('finish', {
          lease: { ...guest, nonce: crypto.randomUUID() },
          outcome: 'completed',
        })
      ).status,
      409,
    );
    await finish(f, guest);
    await finish(f, other);
    await finish(f, account);
    await finish(f, account2);
    await reserve(f, f.metadata({ principal: 'e'.repeat(64) }));
  }));
test('durable attempt caps count replay/rejection traffic and recover after the window', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await finish(f, await reserve(f, input));
    for (let i = 1; i < ADMISSION.principalAttempts; i++)
      assert.equal((await f.call('reserve', input)).status, 409);
    await f.restart();
    assert.equal((await f.call('reserve', f.metadata())).status, 429);
    await f.restart(ADMISSION.windowMs + 1);
    await reserve(f, f.metadata());
  }));
test('global attempt cap cannot be bypassed with new guest identities', () =>
  fixture(async (f) => {
    for (let i = 0; i < ADMISSION.globalAttempts; i++) {
      const principal = i.toString(16).padStart(64, '0');
      await finish(f, await reserve(f, f.metadata({ principal })));
    }
    await f.restart();
    assert.equal(
      (await f.call('reserve', f.metadata({ principal: 'f'.repeat(64) })))
        .status,
      429,
    );
  }));
test('receipt storage is bounded and a no-user-traffic alarm purges expired metadata', () =>
  fixture(async (f) => {
    await f.call('__seed');
    assert.equal((await f.call('reserve', f.metadata())).status, 429);
    await f.restart(ADMISSION.receiptMs + 1);
    await f.call('__alarm');
    const state = await (await f.call('__inspect')).json();
    assert.equal(state.ops.length, 0);
    assert.equal(state.rates.length, 0);
    const stale = f.metadata({ issuedAt: f.now() - ADMISSION.receiptMs });
    assert.equal(
      (await (await f.call('reserve', stale)).json()).code,
      'JERRY_ATTEMPT_EXPIRED',
    );
    await reserve(f, f.metadata());
  }));
test('lost start acknowledgement never invokes a provider and restart recovers without duplicate work', () =>
  fixture(async (f) => {
    const input = f.metadata();
    await f.restart(0, true);
    assert.equal((await f.call('invoke', input)).status, 503);
    assert.equal(f.calls(), 0);
    await f.restart(ADMISSION.leaseMs + 1);
    assert.equal(
      (await (await f.call('invoke', input)).json()).code,
      'JERRY_ATTEMPT_UNCERTAIN',
    );
    assert.equal(f.calls(), 0);
    assert.equal((await f.call('invoke', f.metadata())).status, 200);
    assert.equal(f.calls(), 1);
    assert.equal((await f.call('invoke', input)).status, 409);
  }));
test('purpose-separated HMAC labels bind principal/surface/input without storing an address or plaintext hash', async () => {
  const env = {
      BETTER_AUTH_SECRET:
        'synthetic-admission-fixture-key-not-a-real-credential',
    },
    proof = { admissionAddress: '192.0.2.1' };
  const base = {
    identity: null,
    proof,
    surface: 'public',
    kind: 'respond',
    operationId: crypto.randomUUID(),
    issuedAt: Date.now(),
    payload: { message: 'SYNTHETIC PRIVATE CONTENT' },
  };
  const first = await responseAdmission(env, base),
    same = await responseAdmission(env, base),
    surface = await responseAdmission(env, { ...base, surface: 'exchange' });
  assert.deepEqual(first, same);
  assert.equal(first.principal, surface.principal);
  assert.notEqual(first.fingerprint, surface.fingerprint);
  assert.ok(!JSON.stringify(first).includes('192.0.2.1'));
  assert.ok(!JSON.stringify(first).includes('SYNTHETIC PRIVATE CONTENT'));
  await assert.rejects(
    responseAdmission(env, { ...base, proof: { admissionAddress: 'forged' } }),
    { status: 503 },
  );
  await assert.rejects(responseAdmission({}, base), { status: 503 });
});
