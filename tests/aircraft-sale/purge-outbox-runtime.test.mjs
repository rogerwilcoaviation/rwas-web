import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare } from './fixtures/workerd-options.mjs';
import { png } from './fixture.mjs';

// Fixture-only readback and fault trigger; neither enters the product bundle.
const fixtureSource = `
import worker, { SellerStore } from './workers/aircraft-sale/worker.mjs';
export class PurgeOutboxFixtureStore extends SellerStore {
  async fetch(request) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/_fixture/'))return super.fetch(request);
    const sql=this.ctx.storage.sql;
    if(url.pathname==='/_fixture/fail-final-outbox-delete') {
      const id=url.searchParams.get('listingId');
      if(!/^[a-f0-9-]{36}$/.test(id||''))return new Response(null,{status:400});
      sql.exec("CREATE TRIGGER fixture_outbox_abort BEFORE DELETE ON seller_records WHEN OLD.bucket='outbox' AND json_extract(OLD.value,'$.listingId')='"+id+"' BEGIN SELECT RAISE(ABORT,'Synthetic final metadata failure'); END");
      return Response.json({installed:true});
    }
    if(url.pathname==='/_fixture/allow-final-outbox-delete') {
      sql.exec('DROP TRIGGER IF EXISTS fixture_outbox_abort');return Response.json({removed:true});
    }
    const rows=sql.exec("SELECT bucket,record_key,value FROM seller_records WHERE bucket IN ('listings','files','outbox','idempotency','audit') ORDER BY bucket,record_key").toArray();
    const inventory=await this.env.MEDIA.list({limit:1000});
    return Response.json({rows:rows.map(row=>({...row,value:JSON.parse(row.value)})),objects:inventory.objects.map(object=>object.key).sort()});
  }
}
export default worker;
`;

test('actual SQLite/R2 purge transaction preserves target outbox on final-save abort and restart, then commits scoped cleanup', async () => {
  const reportRoot = new URL('../../../reports/outbox-purge/', import.meta.url).pathname;
  await mkdir(reportRoot, { recursive: true });
  const persistedRoot = await mkdtemp(join(reportRoot, 'runtime-fixture-')), mail = [];
  const script = (await build({ stdin: { contents: fixtureSource, resolveDir: process.cwd(), sourcefile: 'purge-outbox-local-fixture.mjs' }, bundle: true, write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
  const options = {
    modules: true, script, compatibilityDate: '2026-09-01',
    durableObjects: { SELLER_STORE: { className: 'PurgeOutboxFixtureStore', useSQLite: true } },
    durableObjectsPersist: join(persistedRoot, 'durable-objects'),
    r2Buckets: ['MEDIA'], r2Persist: join(persistedRoot, 'r2'),
    bindings: { EMAIL_CODE_LOGIN_ENABLED: 'true', PUBLIC_LISTINGS_ENABLED: 'true' },
    outboundService() { throw Error('External network forbidden in local purge fixture'); },
    serviceBindings: {
      MAILER: async request => { mail.push(await request.json()); return Response.json({ ok: true }); },
      ADMIN_AUTH: async request => request.headers.get('Authorization') === 'Bearer fixture-reviewer' ? Response.json({ actor: 'fixture-admin' }) : new Response(null, { status: 403 }),
    },
  };
  let mf;
  const call = async (path, method = 'GET', body, session, extra = {}) => {
    const response = await mf.dispatchFetch('http://localhost' + (path.startsWith('/_fixture/') ? path : '/api/aircraft-sale' + path), {
      method, headers: { ...(session ? { Authorization: 'Bearer ' + session } : {}), ...(body !== undefined ? { 'Content-Type': body instanceof Uint8Array ? 'image/png' : 'application/json' } : {}), ...extra },
      ...(body !== undefined ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) } : {}),
    });
    return new Response(await response.arrayBuffer(), response);
  };
  const ok = async (response, expected = 200) => { assert.equal(response.status, expected); return response.json(); };
  const login = async email => { await ok(await call('/send-code', 'POST', { email })); return (await ok(await call('/check-code', 'POST', { email, code: mail.at(-1).code }))).session; };
  const create = async (owner, key) => (await ok(await call('/listings', 'POST', { make: 'Synthetic', model: key, year: 2000, price: 1 }, owner, { 'Idempotency-Key': key }), 201)).listing;
  const submit = (owner, listing) => call('/listing/' + listing.id + '/status', 'POST', { status: 'pending' }, owner);
  const purge = (owner, listing) => call('/listings/' + listing.id, 'DELETE', { confirm: listing.id }, owner);
  const snapshot = () => call('/_fixture/snapshot').then(response => response.json());
  const matching = (snapshot, bucket, id) => snapshot.rows.filter(row => row.bucket === bucket && (bucket === 'outbox' || bucket === 'files' ? row.value.listingId === id : row.record_key === id));
  try {
    mf = new Miniflare(options);
    const owner = await login('sql-owner@example.test'), stranger = await login('sql-stranger@example.test');
    const listing = await create(owner, 'target-create'), other = await create(stranger, 'foreign-create');
    const uploaded = (await ok(await call('/upload?listingId=' + listing.id + '&category=photos&filename=fixture.png', 'POST', png, owner, { 'Idempotency-Key': 'rwas-upload-v1.' + Date.now() + '.' + crypto.randomUUID() }))).file;
    await ok(await submit(owner, listing));
    await ok(await call('/listings/' + listing.id, 'PUT', { description: 'Second review revision' }, owner));
    await ok(await submit(owner, listing));
    await ok(await submit(stranger, other));
    await ok(await call('/listing/' + listing.id + '/status', 'POST', { status: 'deleted' }, owner));
    const before = await snapshot(), targetOutbox = matching(before, 'outbox', listing.id);
    assert.equal(targetOutbox.length, 2);
    const otherRows = before.rows.filter(row => (row.bucket === 'outbox' && row.value.listingId === other.id) || (row.bucket === 'listings' && row.record_key === other.id));
    const idempotency = before.rows.filter(row => row.bucket === 'idempotency');
    await ok(await call('/_fixture/fail-final-outbox-delete?listingId=' + listing.id));
    await ok(await purge(owner, listing), 503);
    const failed = await snapshot();
    assert.equal(failed.objects.includes(uploaded.key), false, 'R2 deletion completed before final metadata transaction');
    assert.deepEqual(matching(failed, 'outbox', listing.id), targetOutbox);
    assert.equal(matching(failed, 'listings', listing.id)[0].value.purging, true);
    assert.equal(matching(failed, 'files', listing.id)[0].value.deleting, true);
    assert.equal(failed.rows.some(row => row.bucket === 'audit' && row.value.action === 'purge' && row.value.listingId === listing.id), false);
    assert.deepEqual(failed.rows.filter(row => row.bucket === 'idempotency'), idempotency);
    await mf.dispose(); mf = new Miniflare(options);
    const restarted = await snapshot();
    assert.deepEqual(matching(restarted, 'outbox', listing.id), targetOutbox);
    assert.equal(matching(restarted, 'listings', listing.id)[0].value.purging, true);
    await ok(await call('/listing/' + listing.id + '/status', 'POST', { status: 'restore' }, owner), 409);
    await ok(await call('/_fixture/allow-final-outbox-delete'));
    await ok(await purge(owner, listing));
    const after = await snapshot();
    for (const bucket of ['outbox', 'listings', 'files']) assert.deepEqual(matching(after, bucket, listing.id), []);
    assert.deepEqual(after.rows.filter(row => (row.bucket === 'outbox' && row.value.listingId === other.id) || (row.bucket === 'listings' && row.record_key === other.id)), otherRows);
    assert.deepEqual(after.rows.filter(row => row.bucket === 'idempotency'), idempotency);
    assert.equal(after.rows.filter(row => row.bucket === 'audit' && row.value.action === 'purge' && row.value.listingId === listing.id).length, 1);
    assert.equal(after.objects.some(key => key.startsWith('listings/' + listing.id + '/')), false);
    await mf.dispose(); mf = new Miniflare(options);
    for (const bucket of ['outbox', 'listings', 'files']) assert.deepEqual(matching(await snapshot(), bucket, listing.id), []);
  } finally { await mf?.dispose(); await rm(persistedRoot, { recursive: true, force: true }); }
});
