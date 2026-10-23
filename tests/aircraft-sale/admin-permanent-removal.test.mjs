import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {Miniflare} from './fixtures/workerd-options.mjs';
import {fields,png} from './fixture.mjs';
const source=`
import worker,{SellerStore} from './workers/aircraft-sale/worker.mjs';
const fixtureIssuedAt=Date.now()-1000;
export class RemovalFixtureStore extends SellerStore {
 constructor(ctx,env) {super(ctx,env,{readBetterAuthIdentity:async(_env,req)=>{
  const id=req.headers.get('Cookie');
  if(!['root','customer','orphan','delegate'].includes(id))return null;
  const row=await env.SELLER_AUTH_DB.prepare('SELECT * FROM "user" WHERE id = ?').bind(id).first();
  return row?{issuer:'rwas-better-auth',subject:id,providerSessionId:id+'-session',email:row.email,emailVerified:true,name:row.name,isAdministrator:row.role==='admin',createdAt:fixtureIssuedAt-(this.fixtureOldRoot&&id==='root'?700000:0),expiresAt:fixtureIssuedAt+86400000}:null;
 }});}
 async fetch(req) {
  const path=new URL(req.url).pathname;
  if(path==='/fixture/age-root'){this.fixtureOldRoot=true;return Response.json({ok:true});}
  if(path==='/fixture/fresh-root'){this.fixtureOldRoot=false;return Response.json({ok:true});}
  if(path==='/fixture/fail-final-save') {this.ctx.storage.sql.exec("CREATE TRIGGER fixture_removal_abort BEFORE UPDATE ON seller_records WHEN OLD.bucket='accountRemovalOperations' AND json_extract(NEW.value,'$.stage')='complete' BEGIN SELECT RAISE(ABORT,'Synthetic final-save interruption'); END");return Response.json({ok:true});}
  if(path==='/fixture/allow-final-save'){this.ctx.storage.sql.exec('DROP TRIGGER IF EXISTS fixture_removal_abort');return Response.json({ok:true});}
  return super.fetch(req);
 }
}
export default worker;
`;
for(const cascade of [true,false])test('permanent administrator deletion with '+(cascade?'cascading':'non-cascading')+' real D1, SQLite fences, R2 cleanup, protected hierarchy and resumable final-save failure',async()=>{
 const script=(await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'removal-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',conditions:['workerd','worker','browser'],mainFields:['module','main'],external:['cloudflare:workers','node:*'],logLevel:'silent'})).outputFiles[0].text;
 const directory=await mkdtemp(join(tmpdir(),'rwas-admin-removal-'));
 const options={modules:true,script,compatibilityDate:'2026-09-01',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],durableObjects:{SELLER_STORE:{className:'RemovalFixtureStore',useSQLite:true}},durableObjectsPersist:join(directory,'do'),d1Databases:['SELLER_AUTH_DB'],d1Persist:join(directory,'d1'),r2Buckets:['MEDIA'],r2Persist:join(directory,'r2'),bindings:{BETTER_AUTH_ENABLED:'true',BETTER_AUTH_LOCAL:'true',BETTER_AUTH_URL:'http://localhost',BETTER_AUTH_SECRET:'local-only-synthetic-secret-longer-than-32',BETTER_AUTH_ADMIN_USER_IDS:'root',ACCOUNT_ADMIN_SITE_ORIGIN:'http://localhost',PUBLIC_LISTINGS_ENABLED:'true'},outboundService(){throw Error('External network forbidden');}};
 let mf=new Miniflare(options);
 const call=async(path,method='GET',body,auth,cookie,headers={})=>{
  const r=await mf.dispatchFetch('http://localhost'+(path.startsWith('/fixture/')?path:'/api/aircraft-sale'+path),{method,headers:{Connection:'close',Origin:'http://localhost',...(auth?{Authorization:'Bearer '+auth.session,'X-RWAS-CSRF':auth.csrf}:{}),...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':body instanceof Uint8Array?'image/png':'application/json'}:{}),...headers},...(body!==undefined?{body:body instanceof Uint8Array?body:JSON.stringify(body)}:{})});return new Response(await r.arrayBuffer(),r);
 };
 const json=async(r,status=200)=>{assert.equal(r.status,status,await r.clone().text());return r.json();};
 const login=cookie=>call('/auth/better-auth','POST',{},undefined,cookie).then(r=>json(r));
 const rootCall=(path,method='GET',body)=>call(path,method,body,root,'root');
 let root;
 try {
  let db=await mf.getD1Database('SELLER_AUTH_DB');
  let schema=await readFile('workers/aircraft-sale/migrations/0001_seller_auth.sql','utf8');if(!cascade)schema=schema.replaceAll('references \"user\" (\"id\") on delete cascade','');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  for(const id of ['root','customer','orphan','delegate']) {
   await db.prepare('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt",role,"twoFactorEnabled") VALUES(?,?,?,1,?,?,?,0)').bind(id,'Synthetic '+id,id+'@example.test',new Date().toISOString(),new Date().toISOString(),id==='delegate'?'admin':'user').run();
   await db.prepare('INSERT INTO account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES(?,?,\'credential\',?,\'synthetic-not-a-password\',?,?)').bind(id+'-account',id,id,new Date().toISOString(),new Date().toISOString()).run();
   await db.prepare('INSERT INTO session(id,"userId",token,"expiresAt","createdAt","updatedAt") VALUES(?,?,?,?,?,?)').bind(id+'-stored-session',id,'synthetic-'+id,new Date(Date.now()+86400000).toISOString(),new Date().toISOString(),new Date().toISOString()).run();
   await db.prepare('INSERT INTO "twoFactor"(id,"userId",secret,"backupCodes") VALUES(?,?,\'synthetic\',\'synthetic\')').bind(id+'-factor',id).run();
  }
  root=await login('root');const customer=await login('customer'),delegate=await login('delegate');
  const profile=(await json(await call('/account','GET',undefined,customer,'customer'))).profile;
  const target={accountId:profile.id};
  const delegateCall=(path,method='GET',body)=>call(path,method,body,delegate,'delegate');
  assert.equal((await rootCall('/staff/removals/preview','POST',null)).status,400);
  assert.equal((await call('/staff/removals/preview','POST',{target,reasonCode:'maintenance'})).status,403);
  assert.equal((await call('/staff/removals/preview','POST',{target,reasonCode:'maintenance'},customer,'customer')).status,403);
  assert.equal((await call('/staff/removals/preview','POST',{target,reasonCode:'maintenance'},root,'root',{'X-RWAS-CSRF':'wrong'})).status,403);
  assert.equal((await rootCall('/staff/removals/preview','POST',{target:{identityId:'root'},reasonCode:'maintenance'})).status,403);
  assert.equal((await rootCall('/staff/removals/preview','POST',{target:{identityId:'delegate'},reasonCode:'maintenance'})).status,403);
  assert.equal((await call('/staff/removals/preview','POST',{target:{identityId:'orphan'},reasonCode:'maintenance'},delegate,'delegate')).status,403);
  const listing=(await json(await call('/listings','POST',fields,customer,'customer',{'Idempotency-Key':crypto.randomUUID()}),201)).listing;
  await json(await call('/upload?listingId='+listing.id+'&category=photos&filename=synthetic.png','POST',png,customer,'customer',{'Idempotency-Key':'rwas-upload-v1.'+Date.now()+'.'+crypto.randomUUID()}));
  let current=(await json(await rootCall('/staff/listings/'+listing.id))).listing;
  assert.equal((await rootCall('/staff/listings/'+listing.id,'POST',{action:'purge',revision:current.revision,confirm:listing.id})).status,409);
  current=(await json(await rootCall('/staff/listings/'+listing.id,'DELETE',{revision:current.revision,confirm:listing.id}))).listing;
  assert.equal((await rootCall('/staff/listings/'+listing.id,'POST',{action:'purge',revision:current.revision-1,confirm:listing.id})).status,409);
  assert.equal((await rootCall('/staff/listings/'+listing.id,'POST',{action:'purge',revision:current.revision,confirm:'wrong'})).status,409);
  await json(await rootCall('/staff/listings/'+listing.id,'POST',{action:'purge',revision:current.revision,confirm:listing.id}));
  assert.equal((await (await mf.getR2Bucket('MEDIA')).list()).objects.length,0);
  const notReady=await json(await rootCall('/staff/removals/preview','POST',{target,reasonCode:'maintenance'}));assert.equal(notReady.ready,false);
  const op={id:crypto.randomUUID(),operation:'delete-account',reasonCode:'maintenance'};
  const preview=await json(await rootCall('/staff/accounts/'+profile.id+'/preview','POST',op));
  await json(await rootCall('/staff/accounts/'+profile.id+'/apply','POST',{...op,confirmation:preview.confirmation}));
  const plan=await json(await delegateCall('/staff/removals/preview','POST',{target,reasonCode:'maintenance'}));assert.equal(plan.ready,true);assert.equal(plan.identityCount,1);
  const input={target,reasonCode:plan.reasonCode,operationId:plan.operationId,confirmation:plan.confirmation,confirmEmail:plan.email};
  assert.equal((await delegateCall('/staff/removals/apply','POST',{...input,confirmEmail:'wrong@example.test'})).status,400);
  await call('/fixture/age-root');assert.equal((await rootCall('/staff/removals/apply','POST',input)).status,401);await call('/fixture/fresh-root');
  await call('/fixture/fail-final-save');await json(await delegateCall('/staff/removals/apply','POST',input),503);
  assert.equal(await db.prepare('SELECT id FROM "user" WHERE id=\'customer\'').first(),null,'D1 deletion settled before interrupted final DO commit');
  assert.equal((await json(await rootCall('/staff/removals'))).removals.length,1,'Root can discover an interrupted deletion even when its identity is gone');
  const held=await json(await rootCall('/staff/accounts/'+profile.id));assert.equal(held.account.status,'deleted');
  assert.equal((await rootCall('/staff/accounts/'+profile.id+'/preview','POST',{id:crypto.randomUUID(),operation:'restore-account',reasonCode:'maintenance'})).status,409,'Cannot restore an identity whose permanent removal started');
  await mf.dispose();mf=new Miniflare(options);db=await mf.getD1Database('SELLER_AUTH_DB');root=await login('root');
  const resume=await json(await rootCall('/staff/removals/preview','POST',{target,reasonCode:'maintenance'}));assert.equal(resume.resuming,true);assert.equal(resume.operationId,input.operationId);
  await call('/fixture/allow-final-save');await json(await rootCall('/staff/removals/apply','POST',input));
  assert.equal((await rootCall('/staff/accounts/'+profile.id)).status,404);
  assert.equal((await json(await rootCall('/staff/removals'))).removals.length,0);
  assert.equal((await json(await rootCall('/staff/removals/apply','POST',input))).replayed,true);
  for(const table of ['user','session','account','twoFactor'])assert.equal((await db.prepare('SELECT count(*) AS count FROM "'+table+'" WHERE '+(table==='user'?'id':'"userId"')+' = ?').bind('customer').first()).count,0,table+' scoped cleanup');
  assert.equal((await db.prepare('SELECT count(*) AS count FROM "user"').first()).count,3,'Unrelated users are preserved');
  assert.equal((await call('/auth/better-auth','POST',{},undefined,'customer')).status,401);
  let orphanPlan=await json(await rootCall('/staff/removals/preview','POST',{target:{identityId:'orphan'},reasonCode:'maintenance'}));assert.equal(orphanPlan.ready,true);
  await db.prepare('UPDATE \"user\" SET name=\'Updated orphan\' WHERE id=\'orphan\'').run();
  assert.equal((await rootCall('/staff/removals/apply','POST',{target:orphanPlan.target,reasonCode:orphanPlan.reasonCode,operationId:orphanPlan.operationId,confirmation:orphanPlan.confirmation,confirmEmail:orphanPlan.email})).status,409,'A changed preview cannot delete an identity');
  orphanPlan=await json(await rootCall('/staff/removals/preview','POST',{target:{identityId:'orphan'},reasonCode:'maintenance'}));
  await json(await rootCall('/staff/removals/apply','POST',{target:orphanPlan.target,reasonCode:orphanPlan.reasonCode,operationId:orphanPlan.operationId,confirmation:orphanPlan.confirmation,confirmEmail:orphanPlan.email}));
  assert.equal(await db.prepare('SELECT id FROM "user" WHERE id=\'orphan\'').first(),null);
 } finally {await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
