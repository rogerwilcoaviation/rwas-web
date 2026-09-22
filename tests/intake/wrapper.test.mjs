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
 const config = await mf.dispatchFetch('https://www.rogerwilcoaviation.com/api/service-intake-config');assert.deepEqual(await config.json(), {staging:false,siteKey:'0x4AAAAAADBTcvCdprG6EEdl'});
 const disabled = await mf.dispatchFetch('https://intake-restoration-20260922.rwas-web.pages.dev/faq');assert.equal(disabled.status,503);assert.equal(disabled.headers.get('X-Robots-Tag'),'noindex, nofollow');
 assert.equal(normal.headers.get('X-Robots-Tag'),null);
 await mf.setOptions({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:join(root,'_worker.js/index.js'),modulesRoot:join(root,'_worker.js'),compatibilityDate:'2026-09-01',bindings:{INTAKE_STAGING_MODE:'true'}});
 const stagePage = await mf.dispatchFetch('https://intake-restoration-20260922.rwas-web.pages.dev/faq');assert.equal(stagePage.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.equal(stagePage.headers.get('Content-Security-Policy-Report-Only'),'existing-policy');
 assert.match(await (await mf.dispatchFetch('https://intake-restoration-20260922.rwas-web.pages.dev/robots.txt')).text(),/Disallow: \//);
 assert.equal((await mf.dispatchFetch('https://intake-restoration-20260922.rwas-web.pages.dev/api/service-intake-config')).status,503);
 const routes=JSON.parse(await readFile(join(root,'_routes.json'),'utf8'));assert.deepEqual(routes.exclude,['/ops/*']);assert.deepEqual(routes.include,['/*']);
 } finally {await mf?.dispose();await rm(root,{recursive:true,force:true});}
});
