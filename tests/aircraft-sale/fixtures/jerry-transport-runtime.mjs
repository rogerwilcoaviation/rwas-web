import { build } from 'esbuild';
import { Miniflare } from './workerd-options.mjs';
import {
  WEBSITE_PROTOCOL,
  scopeKey,
} from '../../../workers/jerry-website-transport/contract.mjs';
const bundle = async (contents) =>
  (
    await build({
      stdin: { contents, resolveDir: process.cwd() },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      external: ['cloudflare:workers'],
      logLevel: 'silent',
    })
  ).outputFiles[0].text;
export async function transportFixture(run) {
  let failure = '',
    transportMode = 'synthetic-fixture',
    drop = false,
    hold = false,
    release,
    started,
    startedResolve,
    calls = 0;
  const script = await bundle(`
 import Transport,{runWebsiteResponse,transportResult,syntheticReply} from './workers/jerry-website-transport/entry.mjs';
 import {WebsiteTransportCopies as Copies} from './workers/jerry-website-transport/copies.mjs';
 export {JerryAdmission} from './workers/jerry-website-transport/entry.mjs';
 export class WebsiteTransportCopies extends Copies {
 async schedule(){if(this.env.FAILURE==='alarm-before')throw Error('Synthetic initial alarm outage');await super.schedule();if(this.env.FAILURE==='alarm-after')throw Error('Synthetic alarm acknowledgment outage');}
 async handle(r){this.testPath=new URL(r.url).pathname;return super.handle(r);}
 async transaction(fn){return super.transaction(async tx=>{const result=await fn(tx);if(this.env.FAILURE==='finish-storage'&&this.testPath==='/finish')throw Error('Synthetic finish storage outage');return result;});}
 async fetch(r){const path=new URL(r.url).pathname;if(path.startsWith('/__test/')){await r.arrayBuffer();if(path==='/__test/expire'){await this.ctx.storage.transaction(async tx=>{for(const [key,row] of await tx.list({prefix:'op:'})){row.expiresAt=Date.now()-1;await tx.put(key,row);}});await this.alarm();}return Response.json({entries:[...await this.ctx.storage.list()],alarm:await this.ctx.storage.getAlarm()});}return super.fetch(r);}
 }
 export default class extends Transport {
 async respond(e){const result=await transportResult(()=>runWebsiteResponse(this.env,'respond',e,async value=>{const r=await this.env.TEST_GATE.fetch('https://synthetic.invalid/'+value.operationId,{method:'POST',body:JSON.stringify({kind:value.kind})});if(!r.ok){await r.arrayBuffer();throw Error('Synthetic inference failure');}await r.arrayBuffer();return syntheticReply(value);}));if(this.env.DROP==='true')throw Error('Synthetic lost reply acknowledgment');return result;}
 }`);
  const options = () => ({
    workers: [
      {
        name: 'driver',
        modules: true,
        script: `export default {async fetch(r,env){const {method,request}=await r.json();if(!['respond','translate','status','erase'].includes(method))return Response.json({error:'Unsupported'},{status:404});try{const value=await env.TRANSPORT[method](request);return Response.json(value,{status:value.error?value.status||503:200});}catch(e){return Response.json({error:e.status?e.message:'Synthetic transport failure',code:e.code},{status:e.status||503});}}};`,
        serviceBindings: { TRANSPORT: 'transport' },
        compatibilityDate: '2026-09-01',
        outboundService: () => {
          throw Error('No driver egress');
        },
      },
      {
        name: 'transport',
        modules: true,
        script,
        compatibilityDate: '2026-09-01',
        bindings: {
          JERRY_TRANSPORT_MODE: transportMode,
          FAILURE: failure,
          DROP: String(drop),
        },
        durableObjects: {
          JERRY_TRANSPORT_COPIES: {
            className: 'WebsiteTransportCopies',
            useSQLite: true,
          },
          JERRY_ADMISSION: { className: 'JerryAdmission', useSQLite: true },
        },
        serviceBindings: {
          TEST_GATE: async (r) => {
            calls++;
            await r.arrayBuffer();
            if (hold) {
              hold = false;
              startedResolve();
              await new Promise((resolve) => {
                release = resolve;
              });
            }
            return new Response(null, {
              status: failure === 'inference' ? 503 : 200,
            });
          },
        },
        outboundService: () => {
          throw Error('No provider egress');
        },
      },
    ],
  });
  const mf = new Miniflare(options());
  const call = async (method, request) => {
    const r = await mf.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ method, request }),
    });
    return { status: r.status, body: await r.json() };
  };
  const inspect = async (scope, path = '/__test/inspect') => {
    const ns = await mf.getDurableObjectNamespace(
      'JERRY_TRANSPORT_COPIES',
      'transport',
    );
    const r = await ns
      .get(ns.idFromName(scopeKey(scope)))
      .fetch('https://website-copies.internal' + path, {
        method: 'POST',
        body: '{}',
      });
    return r.json();
  };
  const restart = async ({
    fail = '',
    loseReply = false,
    mode = 'synthetic-fixture',
  } = {}) => {
    failure = fail;
    drop = loseReply;
    transportMode = mode;
    await mf.setOptions(options());
  };
  const delayed = () => {
    hold = true;
    started = new Promise((resolve) => {
      startedResolve = resolve;
    });
    return { started: () => started, release: () => release() };
  };
  const envelope = (overrides = {}) => {
    const now = Date.now(),
      operationId = crypto.randomUUID();
    const scope = {
      category: 'account',
      owner: 'a'.repeat(64),
      surface: 'exchange',
      conversationId: crypto.randomUUID(),
      generation: 1,
      sessionRef: 'b'.repeat(64),
      sessionExpiresAt: now + 3600000,
    };
    return {
      protocol: WEBSITE_PROTOCOL,
      scope,
      operationId,
      issuedAt: now,
      expiresAt: now + 90 * 86400000,
      kind: 'respond',
      payload: {
        input: {
          message: 'SYNTHETIC PRIVATE PROMPT',
          page: '/aircraft-for-sale',
          locale: 'en',
          mode: 'chat',
        },
        history: [],
        reference: null,
        pageContext: 'Published synthetic context',
      },
      admission: {
        category: 'account',
        principal: 'c'.repeat(64),
        surface: 'exchange',
        kind: 'respond',
        operationId,
        issuedAt: now,
        fingerprint: 'd'.repeat(64),
      },
      ...overrides,
    };
  };
  try {
    await run({
      mf,
      call,
      inspect,
      restart,
      delayed,
      envelope,
      calls: () => calls,
    });
  } finally {
    release?.();
    await mf.dispose();
  }
}
