import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { policyFor, stage } from './stage-csp.mjs';

const root = mkdtempSync(join(tmpdir(), 'rwas-csp-test-'));
mkdirSync(join(root, '_worker.js'));
const inline = 'self.__next_f.push([1,"fixture"]);';
const html = `<html><script src="/_next/static/test.js"></script><script>${inline}</script><script type="application/ld+json">{"@type":"WebPage"}</script></html>`;
writeFileSync(join(root, 'index.html'), html);
writeFileSync(join(root, '404.html'), html);
writeFileSync(join(root, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: ['/', '/404', '/_next/*', '/ops/*', '/work-order-system/*'] }));
writeFileSync(join(root, '_worker.js/index.js'), `export default {fetch(request){return new Response("fixture",{status:new URL(request.url).pathname==='/missing'?404:200,headers:{'content-type':'text/html','Content-Security-Policy':"script-src 'self' 'unsafe-inline' 'unsafe-eval'"}})}};`);
const policy = policyFor(html);
assert.ok(policy.includes(`'sha256-${createHash('sha256').update(inline).digest('base64')}'`));
assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|blob:|report-uri|report-to/);
stage(root);
const wrapper = readFileSync(join(root, '_worker.js/index.js'), 'utf8');
assert.match(wrapper, /Content-Security-Policy-Report-Only/);
assert.doesNotMatch(wrapper, /import[^\n]*rwas-csp\.json/); // Pages no-bundle upload does not resolve JSON modules.
assert.doesNotMatch(wrapper, /set\('Content-Security-Policy'/);
const routes = JSON.parse(readFileSync(join(root, '_routes.json'), 'utf8'));
assert.deepEqual(routes.exclude, ['/_next/*', '/ops/*', '/work-order-system/*']);
const policies = JSON.parse(readFileSync(join(root, '_worker.js/rwas-csp.json'), 'utf8'));
assert.equal(policies['/'], policy);
assert.equal(policies['/404'], policy);
console.log('PASS per-document exact hashes, exported route aliases, HTML Worker coverage, 404, unchanged enforcement, no remote reporting.');

await build({entryPoints:[join(root, '_worker.js/index.js')],bundle:true,format:'esm',platform:'node',outfile:join(root,'wrapper.mjs')});
const {default: worker} = await import(pathToFileURL(join(root,'wrapper.mjs')));
for (const route of ['/', '/missing']) {
 const response = await worker.fetch(new Request('https://fixture.test'+route),{},{});
 assert.equal(response.headers.get('Content-Security-Policy-Report-Only'),policy);
 assert.equal(response.headers.get('Content-Security-Policy'),"script-src 'self' 'unsafe-inline' 'unsafe-eval'");
 assert.equal(await response.text(),'fixture');
}
console.log('PASS actual bundled Worker response preserves body/enforcement and adds report-only header, including 404.');
