import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';

// Synthetic local-only source injects fictional rows and exposes readback/counters.
// None of these fixture routes/classes enter the product Worker.
const fixtureSource = `
import worker, { SellerStore } from './workers/aircraft-sale/worker.mjs';
export class ConservationFixtureStore extends SellerStore {
  constructor(ctx, env) { super(ctx, env); this.fixtureSaves=0; this.fixtureLoads=0; }
  async loadState() { this.fixtureLoads++; return super.loadState(); }
  async saveState(state) { this.fixtureSaves++; return super.saveState(state); }
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if (!path.startsWith('/_fixture/')) return super.fetch(request);
    const sql=this.ctx.storage.sql;
    if(path==='/_fixture/kv-probe') return Response.json({fixtureKVRetained:(await this.ctx.storage.get('fictional-kv'))==='fictional-retained'});
    if(path==='/_fixture/media-shapes') {
      const inventory=await this.env.MEDIA.list({limit:1000,include:['httpMetadata','customMetadata']});
      const shapes=[];
      for(const object of inventory.objects) {
        const [head,get]=await Promise.all([this.env.MEDIA.head(object.key),this.env.MEDIA.get(object.key,{onlyIf:{etagMatches:object.etag}})]);
        const comparison=other=>({
          properties:Object.keys(other||{}),present:!!other,
          versionEqual:other?.version===object.version,etagEqual:other?.etag===object.etag,
          sizeEqual:other?.size===object.size,uploadedEqual:other?.uploaded?.getTime()===object.uploaded.getTime(),
          storageClass:other?.storageClass??'absent',
          httpEqual:JSON.stringify(other?.httpMetadata)===JSON.stringify(object.httpMetadata),
          customEqual:JSON.stringify(other?.customMetadata)===JSON.stringify(object.customMetadata),
          rangePresent:other?.range!==undefined,rangeNull:other?.range===null,
          rangeType:typeof other?.range,rangeKeys:Object.keys(other?.range||{}),
          rangeOffsetType:typeof other?.range?.offset,rangeOffsetZero:other?.range?.offset===0,
          rangeLengthType:typeof other?.range?.length,rangeLengthEqualsSize:other?.range?.length===object.size,
          rangeSuffixPresent:other?.range?.suffix!==undefined,bodyPresent:!!other?.body,
          checksums:Object.entries(other?.checksums||{}).map(([name,value])=>({name,arrayBuffer:value instanceof ArrayBuffer,type:typeof value,bytes:value?.byteLength})),
          ssecType:typeof other?.ssecKeyMd5
        });
        shapes.push({
        properties:Object.keys(object),keyType:typeof object.key,
        versionType:typeof object.version,versionPresent:!!object.version,
        etagType:typeof object.etag,etagPresent:!!object.etag,
        sizeType:typeof object.size,sizeSafeInteger:Number.isSafeInteger(object.size),
        uploadedType:typeof object.uploaded,uploadedDate:object.uploaded instanceof Date,
        storageClass:object.storageClass??'absent',
        httpType:typeof object.httpMetadata,httpKeys:Object.keys(object.httpMetadata||{}),
        httpPlain:object.httpMetadata&&Object.getPrototypeOf(object.httpMetadata)===Object.prototype,
        customType:typeof object.customMetadata,customKeys:Object.keys(object.customMetadata||{}),
        customPlain:object.customMetadata&&Object.getPrototypeOf(object.customMetadata)===Object.prototype,
        head:comparison(head),get:comparison(get),
        headGetChecksumsEqual:JSON.stringify(head?.checksums)===JSON.stringify(get?.checksums)
        });
        await get?.body?.cancel();
      }
      return Response.json(shapes);
    }
    if(path==='/_fixture/seed') {
      sql.exec('CREATE TABLE IF NOT EXISTS seller_records (bucket TEXT NOT NULL, record_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket, record_key))');
      const rows=[
        ['profiles','fictional-owner',{id:'fictional-owner',email:'fictional-private@example.test',name:'Fictional private name',phone:'555-fixture',futureField:{allFields:true}}],
        ['identities','fictional-identity',{userId:'fictional-owner',subject:'fictional-subject',issuer:'https://identity.fixture.test/',method:'password'}],
        ['drafts','fictional-owner',{intake:true,step:1,fields:{privateDescription:'Fictional private draft'}}],
        ['listings','fictional-listing',{id:'fictional-listing',ownerId:'fictional-owner',status:'deleted',revision:2,fields:{price:1,privateContact:'fictional-contact'}}],
        ['files','listings/fictional-listing/misc/fictional.pdf',{key:'listings/fictional-listing/misc/fictional.pdf',ownerId:'fictional-owner',listingId:'fictional-listing',deleting:true,size:6,type:'application/pdf'}],
        ['idempotency','fictional-owner:submission',{id:'fictional-listing',digest:'fictional-idempotency'}],
        ['sessions','fictional-session-secret',{userId:'fictional-owner',csrf:'fictional-csrf-secret'}]
      ];
      for(const [bucket,key,value] of rows) sql.exec('INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?)',bucket,key,JSON.stringify(value));
    }
    if(path==='/_fixture/unknown-bucket') sql.exec('INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?)','future_business','fictional-extra','{"fictional":true}');
    if(path==='/_fixture/remove-unknown') sql.exec("DELETE FROM seller_records WHERE bucket='future_business'");
    if(path==='/_fixture/extra-table') { sql.exec('CREATE TABLE sqliteExtra(value TEXT NOT NULL)'); sql.exec('INSERT INTO sqliteExtra(value) VALUES (?)','fictional-retained'); }
    if(path==='/_fixture/remove-extra') sql.exec('DROP TABLE sqliteExtra');
    if(path==='/_fixture/generated-column') sql.exec("ALTER TABLE seller_records ADD COLUMN generated_fixture TEXT GENERATED ALWAYS AS ('fictional-generated') VIRTUAL");
    if(path==='/_fixture/hidden-kv') await this.ctx.storage.put('fictional-kv','fictional-retained');
    if(path==='/_fixture/remove-kv') await this.ctx.storage.delete('fictional-kv');
    const tables=sql.exec("SELECT name,type FROM sqlite_schema WHERE type IN ('table','view') AND substr(name,1,7)<>'sqlite_'").toArray();
    return Response.json({ rows:tables.some(x=>x.name==='seller_records')?sql.exec('SELECT bucket,record_key,value FROM seller_records ORDER BY bucket,record_key').toArray():[],
      tables,
      columns:sql.exec('PRAGMA table_xinfo(seller_records)').toArray(),
      fixtureSaves:this.fixtureSaves,fixtureLoads:this.fixtureLoads });
  }
}
export default worker;
`;
const endpoint = 'https://www.fixture.test/api/aircraft-sale/admin/accounts/_conservation/capture';
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('actual local workerd SQLite/R2/DigestStream complete digest capture, account authority, no-save failures and schema/race rejection', async () => {
  const script = (await build({ stdin: { contents: fixtureSource, resolveDir: process.cwd(),
    sourcefile: 'local-conservation-runtime-fixture.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'browser' })).outputFiles[0].text;
  let accountChecks = 0;
  const mf = new Miniflare({ modules: true, script, compatibilityDate: '2026-09-01',
    durableObjects: { SELLER_STORE: { className: 'ConservationFixtureStore', useSQLite: true } },
    r2Buckets: ['MEDIA'], bindings: { ACCOUNT_ADMIN_SITE_ORIGIN: 'https://www.fixture.test' },
    outboundService: () => { throw new Error('No external network is permitted in this fixture'); },
    serviceBindings: {
      ACCOUNT_ADMIN_AUTH: async (request) => {
        accountChecks++;
        return request.headers.get('Authorization') === 'Bearer fictional-account-admin'
          ? Response.json({ actor: 'fictional-admin@example.test', scope: 'seller-accounts',
            expiresAt: Date.now() + 60000, authenticatedAt: Date.now() })
          : new Response(null, { status: 403 });
      },
      ADMIN_AUTH: async () => Response.json({ actor: 'fictional-listing-reviewer' }),
    },
  });
  const call = (url, token = 'fictional-account-admin', headers = {}) => mf.dispatchFetch(url,
    { headers: { Authorization: 'Bearer ' + token, ...headers } });
  const fixture = async (name) => (await call('https://www.fixture.test/_fixture/' + name)).json();
  const start = async () => {
    const response = await call(endpoint);
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify({ result,
      nativeMetadataShape:response.status===200?undefined:await fixture('media-shapes') }));
    return result;
  };
  const next = async (page) => {
    const response = await call(endpoint + '?cursor=' + page.nextCursor);
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify({ result,
      nativeMetadataShape:response.status===200?undefined:await fixture('media-shapes') }));
    return result;
  };
  try {
    const initial = await fixture('probe');
    const missing = await call(endpoint);
    assert.equal(missing.status, 409);
    assert.equal((await missing.json()).code, 'UNKNOWN_PERSISTED_SCHEMA');
    const empty = await fixture('probe');
    assert.deepEqual(empty.tables, initial.tables);
    assert.ok(!empty.tables.some((x) => x.name === 'seller_records'));
    assert.equal(empty.fixtureSaves, 0);
    assert.equal(empty.fixtureLoads, 0);
    const health = await call('https://www.fixture.test/api/aircraft-sale/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'seller-v2');
    const initialized = await fixture('probe');
    assert.ok(initialized.tables.some((x) => x.name === 'seller_records'));
    assert.equal(initialized.fixtureLoads, 1);
    assert.equal(initialized.fixtureSaves, 1);
    await fixture('seed');
    const bucket = await mf.getR2Bucket('MEDIA');
    const contents = new Map([
      ['listings/fictional-listing/misc/fictional.pdf', new Uint8Array([37, 80, 68, 70, 45, 49])],
      ['orphan/fictional-orphan', new Uint8Array([7, 8, 9, 10])],
      ['orphan/fictional-zero', new Uint8Array(0)],
    ]);
    for (const [key, bytes] of contents) await bucket.put(key, bytes,
      { httpMetadata: { contentType: 'application/pdf', cacheControl: 'private' },
        customMetadata: { fictionalPrivateMetadata: 'fictional-private-metadata' } });
    const before = await fixture('probe');
    for (const token of ['fictional-listing-reviewer', 'fictional-seller', 'anonymous'])
      assert.equal((await call(endpoint, token)).status, 403);
    assert.equal((await call(endpoint, 'fictional-account-admin', { Origin: 'https://other.fixture.test' })).status, 403);
    assert.equal((await call(endpoint, 'fictional-account-admin', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    const pages = [await start()];
    while (!pages.at(-1).complete) pages.push(await next(pages.at(-1)));
    const last = pages.at(-1);
    assert.equal(last.phase, 'complete');
    assert.equal(last.recordCount, 6);
    assert.equal(last.mediaCount, 3);
    assert.equal(last.mediaBytes, 10);
    assert.equal(last.nextCursor, null);
    assert.ok(accountChecks >= pages.length + 3); // Reauthorization for every page.
    const media = pages.flatMap((x) => x.media);
    for (const [key, bytes] of contents) {
      const descriptor = media.find((x) => x.objectKey === sha('seller-v2-media-key-v1\0' + key));
      assert.ok(descriptor, key);
      assert.equal(descriptor.bytesSha256, sha(bytes)); // Independent Node oracle.
      assert.equal(descriptor.bytes, bytes.byteLength);
      assert.match(descriptor.metadataSha256, /^[a-f0-9]{64}$/);
      assert.match(descriptor.inventoryMetadataSha256, /^[a-f0-9]{64}$/);
    }
    const payload = JSON.stringify(pages);
    for (const value of ['fictional-private@example.test', 'Fictional private name',
      'Fictional private draft', 'fictional-subject', 'fictional-owner', 'fictional-listing',
      'fictional-session-secret', 'fictional-csrf-secret', 'fictional-private-metadata'])
      assert.ok(!payload.includes(value), value);
    const after = await fixture('probe');
    assert.deepEqual(after.rows, before.rows);
    assert.equal(after.fixtureSaves, before.fixtureSaves);
    assert.equal(after.fixtureLoads, before.fixtureLoads);
    assert.equal((await bucket.list()).objects.length, 3);

    // A genuinely new R2 orphan between pages is detected by the terminal scan.
    let race = await start();
    while (race.phase !== 'media' || race.sequence < 4) race = await next(race);
    await bucket.put('orphan/fictional-new-race-object', new Uint8Array([11]));
    const drift = await call(endpoint + '?cursor=' + race.nextCursor);
    assert.equal(drift.status, 409);
    assert.equal((await drift.json()).code, 'MEDIA_INVENTORY_CHANGED');
    await bucket.delete('orphan/fictional-new-race-object');

    // Normal run() used to omit unknown buckets and save/erase them. Capture
    // rejection must preserve the actual unknown SQLite row and all originals.
    const unknown = await fixture('unknown-bucket');
    const unknownResponse = await call(endpoint);
    assert.equal(unknownResponse.status, 409);
    assert.equal((await unknownResponse.json()).code, 'UNKNOWN_PERSISTED_BUCKET');
    const retained = await fixture('probe');
    assert.deepEqual(retained.rows, unknown.rows);
    assert.equal(retained.fixtureSaves, before.fixtureSaves);
    assert.equal(retained.fixtureLoads, before.fixtureLoads);
    await fixture('remove-unknown');

    // This native name exposes SQL LIKE's underscore-wildcard regression.
    await fixture('extra-table');
    const tableResponse = await call(endpoint);
    assert.equal(tableResponse.status, 409);
    assert.equal((await tableResponse.json()).code, 'UNKNOWN_PERSISTED_SCHEMA');
    assert.ok((await fixture('probe')).tables.some((x) => x.name === 'sqliteExtra'));
    await fixture('remove-extra');

    await fixture('hidden-kv');
    const kvResponse = await call(endpoint);
    assert.equal(kvResponse.status, 409);
    const kvResult = await kvResponse.json(), kvRetained = await fixture('probe');
    assert.ok((await fixture('kv-probe')).fixtureKVRetained);
    assert.deepEqual(kvRetained.rows, before.rows);
    assert.equal(kvRetained.fixtureSaves, before.fixtureSaves);
    assert.equal(kvRetained.fixtureLoads, before.fixtureLoads);
    // This installed native runtime creates _cf_KV, unlike the documented
    // __cf_kv. It remains unknown scope and must not be silently allowlisted.
    assert.ok(kvRetained.tables.some((x) => x.name === '_cf_KV'));
    assert.equal(kvResult.code, 'UNKNOWN_PERSISTED_SCHEMA');
    await fixture('remove-kv');
    assert.equal((await call(endpoint)).status, 409); // Empty unknown table is still unknown.

    // The provider's unknown KV backing table remains after deleting its key.
    // Use a separate local synthetic object so the generated-column rejection
    // is causally isolated, not a second rejection of that unrelated table.
    const namespace = await mf.getDurableObjectNamespace('SELLER_STORE');
    const generatedStore = namespace.get(namespace.idFromName('fictional-generated-column-scope'));
    const generatedCall = (url) => generatedStore.fetch(url,
      { headers: { Authorization: 'Bearer fictional-account-admin' } });
    const generatedFixture = async (name) => (await generatedCall('https://www.fixture.test/_fixture/' + name)).json();
    const generatedBefore = await generatedFixture('seed');
    const supported = await generatedCall(endpoint);
    const supportedPage = await supported.json();
    assert.equal(supported.status, 200, JSON.stringify(supportedPage));
    assert.equal(supportedPage.phase, 'start');
    // table_info would hide this new business column; table_xinfo must fail.
    const generated = await generatedFixture('generated-column');
    assert.ok(generated.columns.some((x) => x.name === 'generated_fixture' && x.hidden !== 0));
    const columnResponse = await generatedCall(endpoint);
    assert.equal(columnResponse.status, 409);
    assert.equal((await columnResponse.json()).code, 'UNKNOWN_PERSISTED_SCHEMA');
    const final = await generatedFixture('probe');
    assert.equal(final.fixtureSaves, generatedBefore.fixtureSaves);
    assert.equal(final.fixtureLoads, generatedBefore.fixtureLoads);
    assert.deepEqual(final.rows, generatedBefore.rows);
  } finally { await mf.dispose(); }
});
