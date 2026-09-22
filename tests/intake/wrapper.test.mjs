import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Miniflare} from 'miniflare';
test('advanced Pages routing reaches actual handlers and preserves existing app', async()=>{
 const root=await mkdtemp(join(tmpdir(),'rwas-intake-wrapper-'));let mf;
 try {
 await mkdir(join(root,'_worker.js'));
 await writeFile(join(root,'_worker.js/index.js'),'export default {fetch(){return new Response("existing-app",{headers:{"Content-Security-Policy-Report-Only":"existing-policy"}})}}');
 await writeFile(join(root,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:['/ops/*']}));
 execFileSync(process.execPath,['scripts/stage-service-intake.mjs',root]);
 mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:join(root,'_worker.js/index.js'),modulesRoot:join(root,'_worker.js'),compatibilityDate:'2026-09-01'});
 const normal=await mf.dispatchFetch('https://www.rogerwilcoaviation.com/faq');assert.equal(await normal.text(),'existing-app');assert.equal(normal.headers.get('Content-Security-Policy-Report-Only'),'existing-policy');
 for(const path of ['/api/service-intake','/api/intake-dispatch'])assert.equal((await mf.dispatchFetch('https://www.rogerwilcoaviation.com'+path)).status,405);
 assert.equal((await mf.dispatchFetch('https://www.rogerwilcoaviation.com/api/service-receipt')).status,404);
 assert.equal((await mf.dispatchFetch('https://www.rogerwilcoaviation.com/api/service-intake',{method:'POST',headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await mf.dispatchFetch('https://www.rogerwilcoaviation.com/api/intake-dispatch',{method:'POST'})).status,503);
 const routes=JSON.parse(await readFile(join(root,'_routes.json'),'utf8'));assert.deepEqual(routes.exclude,['/ops/*']);assert(routes.include.includes('/api/service-intake'));
 } finally {await mf?.dispose();await rm(root,{recursive:true,force:true});}
});
