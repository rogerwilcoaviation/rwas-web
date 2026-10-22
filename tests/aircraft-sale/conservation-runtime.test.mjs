import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from './fixtures/workerd-options.mjs';
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
    const denied=statement=>{
      try { sql.exec(statement).toArray(); return false; }
      catch(error) { return /not authorized|prohibited|SQLITE_AUTH/i.test(String(error?.message)); }
    };
    if(path==='/_fixture/native-create-proof') {
      const present=()=>sql.exec("SELECT name FROM sqlite_schema WHERE name='_cf_KV'").toArray().length!==0;
      const existedBefore=present();
      const createDenied=denied('CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID');
      return Response.json({existedBefore,createDenied,existsAfter:present()});
    }
    if(path==='/_fixture/native-read-proof') return Response.json({
      selectDenied:denied('SELECT key FROM _cf_KV LIMIT 1'),
      columnInfoDenied:denied('PRAGMA table_xinfo(_cf_KV)')
    });
    if(path==='/_fixture/kv-probe') return Response.json({
      fixtureKVRetained:(await this.ctx.storage.get('fictional-kv'))==='fictional-retained',
      nativeKvEmpty:(await this.ctx.storage.list({limit:1})).size===0
    });
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
    if(path==='/_fixture/user-alias-empty') sql.exec('CREATE TABLE __cf_kv(value TEXT NOT NULL)');
    if(path==='/_fixture/user-alias-populate') sql.exec('INSERT INTO __cf_kv(value) VALUES (?)','fictional-user-table-retained');
    if(path==='/_fixture/hidden-kv') await this.ctx.storage.put('fictional-kv','fictional-retained');
    if(path==='/_fixture/remove-kv') await this.ctx.storage.delete('fictional-kv');
    const tables=sql.exec("SELECT name,type FROM sqlite_schema WHERE type IN ('table','view') AND substr(name,1,7)<>'sqlite_'").toArray();
    return Response.json({ rows:tables.some(x=>x.name==='seller_records')?sql.exec('SELECT bucket,record_key,value FROM seller_records ORDER BY bucket,record_key').toArray():[],
      tables,
      columns:sql.exec('PRAGMA table_xinfo(seller_records)').toArray(),
      documentedAliasRows:tables.some(x=>x.name==='__cf_kv')?sql.exec('SELECT value FROM __cf_kv').toArray():[],
      fixtureSaves:this.fixtureSaves,fixtureLoads:this.fixtureLoads });
  }
}
export default worker;
`;
const endpoint = 'https://www.fixture.test/api/aircraft-sale/admin/accounts/_conservation/capture';
const sha = (value) => createHash('sha256').update(value).digest('hex');
// Independent Node oracle over only the fixture's already-read synthetic JSON.
const canonical = (value) => value && typeof value === 'object'
  ? Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  : JSON.stringify(value);

test('actual local workerd SQLite/R2/DigestStream complete digest capture, account authority, no-save failures and schema/race rejection', async () => {
  const script = (await build({ stdin: { contents: fixtureSource, resolveDir: process.cwd(),
    sourcefile: 'local-conservation-runtime-fixture.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'browser' })).outputFiles[0].text;
  let accountChecks = 0;
  const persistedRoot = await mkdtemp(join(tmpdir(), 'native-conservation-kv-'));
  const options = { modules: true, script, compatibilityDate: '2026-09-01',
    durableObjects: { SELLER_STORE: { className: 'ConservationFixtureStore', useSQLite: true } },
    durableObjectsPersist: join(persistedRoot, 'durable-objects'),
    r2Persist: join(persistedRoot, 'r2'), r2Buckets: ['MEDIA'],
    bindings: { ACCOUNT_ADMIN_SITE_ORIGIN: 'https://www.fixture.test' },
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
  };
  let mf;
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
  const finishCapture = async () => {
    const pages = [await start()];
    while (!pages.at(-1).complete) pages.push(await next(pages.at(-1)));
    assert.equal(pages.at(-1).phase, 'complete');
    assert.equal(pages.at(-1).nextCursor, null);
    return pages;
  };
  // Exclude only capture-specific cursor/clock/sequence fields. All business,
  // inventory, body and metadata digests/counts must survive KV changes/restart.
  const projection = (pages) => {
    const last = pages.at(-1);
    return {
      schemaSha256: last.schemaSha256, endpointAlgorithmSha256: last.endpointAlgorithmSha256,
      scope: last.scope, stateRootSha256: last.stateRootSha256,
      inventoryRootSha256: last.inventoryRootSha256, recordCounts: last.recordCounts,
      recordCount: last.recordCount, mediaCount: last.mediaCount, mediaBytes: last.mediaBytes,
      records: pages.flatMap((page) => page.records), media: pages.flatMap((page) => page.media),
    };
  };
  try {
    mf = new Miniflare(options);
    const freshNamespace = await mf.getDurableObjectNamespace('SELLER_STORE');
    const freshStore = freshNamespace.get(freshNamespace.idFromName('fictional-native-authorizer-proof'));
    const createProof = await (await freshStore.fetch('https://www.fixture.test/_fixture/native-create-proof')).json();
    assert.deepEqual(createProof, { existedBefore: false, createDenied: true, existsAfter: false });

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
    let bucket = await mf.getR2Bucket('MEDIA');
    const contents = new Map([
      ['listings/fictional-listing/misc/fictional.pdf', new Uint8Array([37, 80, 68, 70, 45, 49])],
      ['orphan/fictional-orphan', new Uint8Array([7, 8, 9, 10])],
      ['orphan/fictional-zero', new Uint8Array(0)],
    ]);
    for (const [key, bytes] of contents) await bucket.put(key, bytes,
      { httpMetadata: { contentType: 'application/pdf', cacheControl: 'private' },
        customMetadata: { fictionalPrivateMetadata: 'fictional-private-metadata' } });
    const assertOriginalMedia = async () => {
      assert.equal((await bucket.list()).objects.length, contents.size);
      for (const [key, bytes] of contents) {
        const object = await bucket.get(key);
        assert.ok(object, key);
        assert.equal(sha(new Uint8Array(await object.arrayBuffer())), sha(bytes));
        assert.deepEqual(object.httpMetadata, { contentType: 'application/pdf', cacheControl: 'private' });
        assert.deepEqual(object.customMetadata, { fictionalPrivateMetadata: 'fictional-private-metadata' });
      }
    };
    const before = await fixture('probe');
    for (const token of ['fictional-listing-reviewer', 'fictional-seller', 'anonymous'])
      assert.equal((await call(endpoint, token)).status, 403);
    assert.equal((await call(endpoint, 'fictional-account-admin', { Origin: 'https://other.fixture.test' })).status, 403);
    assert.equal((await call(endpoint, 'fictional-account-admin', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    const pages = await finishCapture();
    const baseline = projection(pages);
    const last = pages.at(-1);
    assert.equal(last.phase, 'complete');
    assert.equal(last.recordCount, 6);
    assert.equal(last.mediaCount, 3);
    assert.equal(last.mediaBytes, 10);
    assert.equal(last.nextCursor, null);
    assert.ok(accountChecks >= pages.length + 3); // Reauthorization for every page.
    assert.deepEqual(last.recordCounts, { profiles: 1, identities: 1, listings: 1, drafts: 1, files: 1, idempotency: 1 });
    const expectedRecords = before.rows.filter((row) => row.bucket !== 'sessions').map((row) => {
      const full = canonical({ bucket: row.bucket, key: row.record_key, value: JSON.parse(row.value) });
      return { bucket: row.bucket,
        objectId: row.bucket + ':' + sha('seller-v2-record-key-v1\0' + row.bucket + '\0' + row.record_key),
        fullFieldsSha256: sha(full), fullFieldsBytes: Buffer.byteLength(full) };
    }).sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
    assert.deepEqual(pages.flatMap((page) => page.records), expectedRecords);
    assert.equal(last.stateRootSha256, sha(canonical(expectedRecords)));
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
    assert.deepEqual(after, before); // Empty KV/capture must not create native metadata or other SQL schema.
    assert.deepEqual(after.rows, before.rows);
    assert.equal(after.fixtureSaves, before.fixtureSaves);
    assert.equal(after.fixtureLoads, before.fixtureLoads);
    await assertOriginalMedia();

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

    const kvBefore = await fixture('hidden-kv');
    assert.deepEqual(await fixture('native-read-proof'), { selectDenied: true, columnInfoDenied: true });
    const kvResponse = await call(endpoint);
    assert.equal(kvResponse.status, 409);
    const kvResult = await kvResponse.json(), kvRetained = await fixture('probe');
    assert.deepEqual(await fixture('kv-probe'), { fixtureKVRetained: true, nativeKvEmpty: false });
    assert.deepEqual(kvRetained.rows, before.rows);
    assert.deepEqual(kvRetained.tables, kvBefore.tables);
    assert.equal(kvRetained.fixtureSaves, before.fixtureSaves);
    assert.equal(kvRetained.fixtureLoads, before.fixtureLoads);
    // Genuine native writes create the exact protected provider table, but
    // nonempty native KV remains outside the supported conserved scope.
    assert.ok(kvRetained.tables.some((x) => x.name === '_cf_KV'));
    assert.equal(kvResult.code, 'UNEXPECTED_KV_STATE');
    await assertOriginalMedia();
    await fixture('remove-kv');
    const nativeEmpty = await fixture('probe');
    assert.ok(nativeEmpty.tables.some((x) => x.name === '_cf_KV'));
    assert.deepEqual(await fixture('kv-probe'), { fixtureKVRetained: false, nativeKvEmpty: true });
    assert.deepEqual(projection(await finishCapture()), baseline);
    const nativeAfter = await fixture('probe');
    assert.deepEqual(nativeAfter, nativeEmpty); // No capture DDL/load/save or business mutation.
    await assertOriginalMedia();

    // Emptiness is rechecked on continuation, not just the start page.
    const emptyStart = await start();
    assert.equal(emptyStart.complete, false);
    const betweenPages = await fixture('hidden-kv');
    const kvDrift = await call(endpoint + '?cursor=' + emptyStart.nextCursor);
    assert.equal(kvDrift.status, 409);
    assert.equal((await kvDrift.json()).code, 'UNEXPECTED_KV_STATE');
    assert.deepEqual(await fixture('probe'), betweenPages);
    assert.deepEqual(await fixture('kv-probe'), { fixtureKVRetained: true, nativeKvEmpty: false });
    await assertOriginalMedia();
    await fixture('remove-kv');
    assert.deepEqual(projection(await finishCapture()), baseline);

    // Restart against the same SQLite and R2 directories. No reseeding, media
    // upload, ordinary health request or reused ephemeral capture cursor occurs.
    await mf.dispose();
    mf = new Miniflare(options);
    bucket = await mf.getR2Bucket('MEDIA');
    const restartedBefore = await fixture('probe');
    assert.ok(restartedBefore.tables.some((x) => x.name === '_cf_KV'));
    assert.deepEqual(restartedBefore.rows, before.rows);
    assert.equal(restartedBefore.fixtureSaves, 0);
    assert.equal(restartedBefore.fixtureLoads, 0);
    assert.deepEqual(await fixture('kv-probe'), { fixtureKVRetained: false, nativeKvEmpty: true });
    assert.deepEqual(projection(await finishCapture()), baseline);
    assert.deepEqual(await fixture('probe'), restartedBefore);
    await assertOriginalMedia();

    // The documented alias is ordinary user-readable SQL in this runtime.
    // Separate synthetic objects prove both empty and nonempty aliases reject
    // with actual native KV empty, preserving the rows and alias contents.
    const namespace = await mf.getDurableObjectNamespace('SELLER_STORE');
    for (const populated of [false, true]) {
      const aliasStore = namespace.get(namespace.idFromName('fictional-user-alias-' + populated));
      const aliasCall = (url) => aliasStore.fetch(url,
        { headers: { Authorization: 'Bearer fictional-account-admin' } });
      const aliasFixture = async (name) => (await aliasCall('https://www.fixture.test/_fixture/' + name)).json();
      await aliasFixture('seed');
      await aliasFixture('user-alias-empty');
      if (populated) await aliasFixture('user-alias-populate');
      const aliasBefore = await aliasFixture('probe');
      assert.deepEqual(aliasBefore.documentedAliasRows,
        populated ? [{ value: 'fictional-user-table-retained' }] : []);
      assert.ok(aliasBefore.tables.some((x) => x.name === '__cf_kv'));
      assert.deepEqual(await aliasFixture('kv-probe'), { fixtureKVRetained: false, nativeKvEmpty: true });
      const aliasResponse = await aliasCall(endpoint);
      assert.equal(aliasResponse.status, 409);
      assert.equal((await aliasResponse.json()).code, 'UNKNOWN_PERSISTED_SCHEMA');
      assert.deepEqual(await aliasFixture('probe'), aliasBefore);
      await assertOriginalMedia();
    }

    // Generated-column rejection is causally isolated from unsupported tables.
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
  } finally {
    try { await mf?.dispose(); }
    finally { await rm(persistedRoot, { recursive: true, force: true }); }
  }
});
