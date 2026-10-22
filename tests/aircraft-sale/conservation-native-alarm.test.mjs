import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { build } from 'esbuild';

// Fixture-only routes exercise the actual Worker and native SQLite/alarm/KV/R2
// interfaces. No fixture route or fictional record enters the product bundle.
const fixtureSource = `
import worker, { SellerStore } from './workers/aircraft-sale/worker.mjs';
export class NativeAlarmConservationFixture extends SellerStore {
  constructor(ctx, env) { super(ctx, env); this.fixtureSaves=0; this.fixtureLoads=0; }
  async loadState() { this.fixtureLoads++; return super.loadState(); }
  async saveState(state) { this.fixtureSaves++; return super.saveState(state); }
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/_fixture/')) return super.fetch(request);
    const sql=this.ctx.storage.sql;
    if(path==='/_fixture/seed') {
      sql.exec('CREATE TABLE seller_records (bucket TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket, record_key))');
      const rows=[
        ['profiles','alarm-owner',{id:'alarm-owner',email:'alarm-owner@example.test',name:'Fictional alarm owner',futureField:{preserved:true}}],
        ['identities','alarm-identity',{userId:'alarm-owner',subject:'fictional-alarm-subject',issuer:'https://identity.fixture.test/',method:'clerk'}],
        ['listings','alarm-listing',{id:'alarm-listing',ownerId:'alarm-owner',status:'draft',revision:3,fields:{privateDescription:'Fictional alarm draft'}}],
        ['drafts','alarm-owner',{intake:true,step:2,fields:{tailNumber:'N0TEST'}}],
        ['files','listings/alarm-listing/misc/alarm.pdf',{key:'listings/alarm-listing/misc/alarm.pdf',ownerId:'alarm-owner',listingId:'alarm-listing',size:6,type:'application/pdf'}],
        ['idempotency','alarm-owner:upload-v1:fictional-operation',{kind:'upload-v1',state:'complete',ownerId:'alarm-owner',file:{ownerId:'alarm-owner',listingId:'alarm-listing',key:'listings/alarm-listing/misc/alarm.pdf'}}],
        ['sessions','fictional-excluded-session',{userId:'alarm-owner',csrf:'fictional-excluded-csrf'}]
      ];
      for(const [bucket,key,value] of rows) sql.exec('INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?)',bucket,key,JSON.stringify(value));
    }
    // Only the real native interface creates the reserved alarm metadata table.
    if(path==='/_fixture/alarm') await this.ctx.storage.setAlarm(Date.now()+3600000);
    if(path==='/_fixture/extra-table') sql.exec('CREATE TABLE unrelated_user_table (value TEXT)');
    if(path==='/_fixture/drop-extra-table') sql.exec('DROP TABLE unrelated_user_table');
    if(path==='/_fixture/extra-view') sql.exec('CREATE VIEW unrelated_user_view AS SELECT bucket FROM seller_records');
    if(path==='/_fixture/drop-extra-view') sql.exec('DROP VIEW unrelated_user_view');
    if(path==='/_fixture/user-alias') sql.exec('CREATE TABLE __cf_metadata (value TEXT)');
    if(path==='/_fixture/extra-column') sql.exec("ALTER TABLE seller_records ADD COLUMN unexpected TEXT GENERATED ALWAYS AS ('fictional') VIRTUAL");
    if(path==='/_fixture/unknown-bucket') sql.exec('INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?)','future_business','fictional','{}');
    if(path==='/_fixture/drop-unknown-bucket') sql.exec("DELETE FROM seller_records WHERE bucket='future_business'");
    if(path==='/_fixture/kv') await this.ctx.storage.put('fictional-alarm-kv','fictional-retained');
    if(path==='/_fixture/drop-kv') await this.ctx.storage.delete('fictional-alarm-kv');
    return Response.json({
      tables:sql.exec("SELECT name,type FROM sqlite_schema WHERE type IN ('table','view') AND substr(name,1,7)<>'sqlite_' ORDER BY name").toArray(),
      columns:sql.exec('PRAGMA table_xinfo(seller_records)').toArray(),
      rows:sql.exec('SELECT bucket,record_key,value FROM seller_records ORDER BY bucket,record_key').toArray(),
      alarm:await this.ctx.storage.getAlarm(),
      fixtureKvRetained:(await this.ctx.storage.get('fictional-alarm-kv'))==='fictional-retained',
      fixtureSaves:this.fixtureSaves,fixtureLoads:this.fixtureLoads
    });
  }
}
export default worker;
`;
const script = (await build({ stdin: { contents: fixtureSource,
  resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  sourcefile: 'native-alarm-conservation-fixture.mjs' }, bundle: true,
  write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
const endpoint = 'https://www.fixture.test/api/aircraft-sale/admin/accounts/_conservation/capture';
const mediaKey = 'listings/alarm-listing/misc/alarm.pdf';
const mediaBytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
const sha = value => createHash('sha256').update(value).digest('hex');
const projection = pages => {
  const last = pages.at(-1);
  return { schemaSha256:last.schemaSha256,endpointAlgorithmSha256:last.endpointAlgorithmSha256,
    scope:last.scope,stateRootSha256:last.stateRootSha256,inventoryRootSha256:last.inventoryRootSha256,
    recordCounts:last.recordCounts,recordCount:last.recordCount,mediaCount:last.mediaCount,mediaBytes:last.mediaBytes,
    records:pages.flatMap(page=>page.records),media:pages.flatMap(page=>page.media) };
};
async function fixture(t) {
  const mf = new Miniflare({ modules:true,script,compatibilityDate:'2026-09-01',
    durableObjects:{ SELLER_STORE:{className:'NativeAlarmConservationFixture',useSQLite:true} },
    r2Buckets:['MEDIA'],bindings:{ACCOUNT_ADMIN_SITE_ORIGIN:'https://www.fixture.test'},
    outboundService:()=>{ throw new Error('EXTERNAL_NETWORK_FORBIDDEN'); },
    serviceBindings:{
      ACCOUNT_ADMIN_AUTH:async request=>request.headers.get('Authorization')==='Bearer fictional-account-admin'
        ? Response.json({actor:'fictional-admin@example.test',scope:'seller-accounts',expiresAt:Date.now()+60000,authenticatedAt:Date.now()})
        : new Response(null,{status:403}),
      ADMIN_AUTH:async()=>Response.json({actor:'fictional-reviewer@example.test'})
    } });
  t.after(()=>mf.dispose());
  const call = url=>mf.dispatchFetch(url,{headers:{Authorization:'Bearer fictional-account-admin'}});
  const route = async name=>{
    const response=await call('https://www.fixture.test/_fixture/'+name);
    assert.equal(response.status,200);return response.json();
  };
  await route('seed');
  const bucket=await mf.getR2Bucket('MEDIA');
  await bucket.put(mediaKey,mediaBytes,{httpMetadata:{contentType:'application/pdf',cacheControl:'private'},customMetadata:{fictional:'alarm-regression'}});
  const captureResponse=async()=>{
    const response=await call(endpoint);
    return {status:response.status,body:await response.json()};
  };
  const capture=async()=>{
    const first=await captureResponse();
    assert.equal(first.status,200,JSON.stringify(first));
    const pages=[first.body];
    while(!pages.at(-1).complete){
      const response=await call(endpoint+'?cursor='+pages.at(-1).nextCursor);
      const page=await response.json();assert.equal(response.status,200,JSON.stringify(page));pages.push(page);
    }
    assert.equal(pages.at(-1).nextCursor,null);
    return projection(pages);
  };
  return {route,capture,captureResponse,bucket};
}
const unchangedRows = (before,after)=>{
  assert.deepEqual(after.rows,before.rows);
  assert.deepEqual(after.columns,before.columns);
  assert.equal(after.fixtureSaves,before.fixtureSaves);
  assert.equal(after.fixtureLoads,before.fixtureLoads);
};
async function assertRejected(f,code){
  const response=await f.captureResponse();
  assert.equal(response.status,409,JSON.stringify(response));
  assert.equal(response.body.code,code);
}

test('native alarm metadata preserves a nonempty complete conservation capture without saving business state',async t=>{
  const f=await fixture(t);
  const before=await f.route('probe');
  assert.deepEqual(before.tables,[{name:'seller_records',type:'table'}]);
  const baseline=await f.capture();
  assert.equal(baseline.recordCount,6);
  assert.deepEqual(baseline.recordCounts,{profiles:1,identities:1,listings:1,drafts:1,files:1,idempotency:1});
  assert.equal(baseline.mediaCount,1);assert.equal(baseline.mediaBytes,mediaBytes.length);
  assert.equal(baseline.media[0].bytesSha256,sha(mediaBytes));
  const alarm=await f.route('alarm');
  assert.deepEqual(alarm.tables,[{name:'_cf_METADATA',type:'table'},{name:'seller_records',type:'table'}]);
  assert.ok(Number.isSafeInteger(alarm.alarm));
  unchangedRows(before,alarm);
  const afterFirst=await f.captureResponse();
  t.diagnostic(JSON.stringify({beforeAlarmHttpStatus:200,afterNativeAlarmHttpStatus:afterFirst.status,afterNativeAlarmCode:afterFirst.body.code??null,nativeAlarmTableObserved:true,syntheticBusinessRows:before.rows.length}));
  assert.equal(afterFirst.status,200,JSON.stringify(afterFirst));
  assert.deepEqual(await f.capture(),baseline);
  const after=await f.route('probe');unchangedRows(alarm,after);assert.equal(after.alarm,alarm.alarm);
  const object=await f.bucket.get(mediaKey);
  assert.equal(sha(new Uint8Array(await object.arrayBuffer())),sha(mediaBytes));
  assert.deepEqual(object.httpMetadata,{contentType:'application/pdf',cacheControl:'private'});
  assert.deepEqual(object.customMetadata,{fictional:'alarm-regression'});
});

test('native alarm exception still rejects unknown application tables, views, aliases and buckets',async t=>{
  const f=await fixture(t);await f.route('alarm');
  const baseline=await f.capture();
  const before=await f.route('probe');
  for(const [create,remove] of [['extra-table','drop-extra-table'],['extra-view','drop-extra-view']]){
    await f.route(create);await assertRejected(f,'UNKNOWN_PERSISTED_SCHEMA');await f.route(remove);
    assert.deepEqual(await f.capture(),baseline);
  }
  await f.route('unknown-bucket');await assertRejected(f,'UNKNOWN_PERSISTED_BUCKET');await f.route('drop-unknown-bucket');
  assert.deepEqual(await f.capture(),baseline);
  await f.route('user-alias');await assertRejected(f,'UNKNOWN_PERSISTED_SCHEMA');
  unchangedRows(before,await f.route('probe'));
});

test('native alarm exception still rejects an added generated application column without discarding rows',async t=>{
  const f=await fixture(t);await f.route('alarm');await f.capture();
  const before=await f.route('probe');await f.route('extra-column');
  await assertRejected(f,'UNKNOWN_PERSISTED_SCHEMA');
  const after=await f.route('probe');assert.deepEqual(after.rows,before.rows);
  assert.equal(after.columns.length,before.columns.length+1);
  assert.equal(after.fixtureSaves,before.fixtureSaves);assert.equal(after.fixtureLoads,before.fixtureLoads);
});

test('native alarm exception still rejects nonempty native KV and preserves its value and complete business/media digests',async t=>{
  const f=await fixture(t);await f.route('alarm');const baseline=await f.capture();
  const before=await f.route('probe');await f.route('kv');
  await assertRejected(f,'UNEXPECTED_KV_STATE');
  const held=await f.route('probe');assert.equal(held.fixtureKvRetained,true);unchangedRows(before,held);
  await f.route('drop-kv');assert.deepEqual(await f.capture(),baseline);
  unchangedRows(before,await f.route('probe'));
});
