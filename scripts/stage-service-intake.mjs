import { build } from 'esbuild';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
// Pages advanced mode ignores /functions. Bundle the actual handlers explicitly;
// do not duplicate their implementation inside the existing generated application.
const root = resolve(process.argv[2] || '.vercel/output/static');
const directory = resolve(root, '_worker.js');
await build({ stdin: { contents: `
import { onRequestPost as intake } from './functions/api/service-intake';
import { onRequestGet as receipt } from './functions/api/service-receipt';
import { onRequestPost as dispatch } from './functions/api/intake-dispatch';
import { onRequestGet as config } from './functions/api/service-intake-config';
import { STAGING_ORIGIN } from './functions/_intake/core';
export { intake, receipt, dispatch, config, STAGING_ORIGIN };`, resolveDir: process.cwd(), sourcefile: 'intake-entry.ts' },
  outfile: resolve(directory, 'rwas-intake.js'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022' });
const index = resolve(directory, 'index.js');
renameSync(index, resolve(directory, 'rwas-csp-wrapper.js'));
writeFileSync(index, `import app from './rwas-csp-wrapper.js';
import { intake, receipt, dispatch, config, STAGING_ORIGIN } from './rwas-intake.js';
export default { ...app, async fetch(request, env, ctx) {
 const url = new URL(request.url);
 const path = url.pathname;
 const isolated = env.INTAKE_STAGING_MODE === 'true' || url.origin === STAGING_ORIGIN;
 const protect = (response) => {
   if (!isolated) return response;
   const result = new Response(response.body, response);
   result.headers.set('X-Robots-Tag', 'noindex, nofollow');
   return result;
 };
 if (url.origin === STAGING_ORIGIN && env.INTAKE_STAGING_MODE !== 'true') return protect(new Response('Staging disabled', {status:503}));
 if (isolated && path === '/robots.txt') return protect(new Response('User-agent: *\\nDisallow: /\\n'));

 const routes = { '/api/service-intake-config': ['GET', config], '/api/service-intake': ['POST', intake], '/api/service-receipt': ['GET', receipt], '/api/intake-dispatch': ['POST', dispatch] };
 if (Object.prototype.hasOwnProperty.call(routes, path)) {
   if (env.INTAKE_STAGING_MODE === 'true' && url.origin !== STAGING_ORIGIN) return protect(new Response('Staging destination not allowed', {status:503}));
   const [method, handler] = routes[path];
   if (request.method !== method) return protect(new Response(JSON.stringify({error:'Method not allowed.'}), {status:405, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
   return protect(await handler({request, env}));
 }
 return protect(await app.fetch(request, env, ctx));
}};
`);
const routesPath = resolve(root, '_routes.json');
const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
for (const path of ['/api/service-intake', '/api/service-receipt', '/api/intake-dispatch', '/api/service-intake-config']) {
 routes.include = routes.include || [];
 if (!routes.include.some(p => p === path || (p.endsWith('*') && path.startsWith(p.slice(0, -1))))) routes.include.push(path);
 routes.exclude = (routes.exclude || []).filter(p => p !== path);
 if (routes.exclude.some(p => p.includes('*') && path.startsWith(p.split('*')[0]))) throw new Error('An existing wildcard exclusion would bypass service intake');
}
writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('Staged four explicit intake routes; existing application and CSP preserved.');

// Only the exact authorized preview branch gets this artifact-level rule. Unlike
// Worker response headers, Pages _headers also covers excluded/static assets.
const previewBranch = 'intake-restoration-20260922';
const buildBranches = [process.env.CF_PAGES_BRANCH, process.env.GITHUB_HEAD_REF].filter(Boolean);
if (buildBranches.length && buildBranches.every(branch => branch === previewBranch)) {
 const headersPath = resolve(root, '_headers');
 const existing = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';
 writeFileSync(headersPath, existing + '\n# Authorized intake preview only: static assets included\n/*\n  X-Robots-Tag: noindex, nofollow\n');
}
