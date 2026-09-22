import { build } from 'esbuild';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
// Pages advanced mode ignores /functions. Bundle the actual handlers explicitly;
// do not duplicate their implementation inside the existing generated application.
const root = resolve(process.argv[2] || '.vercel/output/static');
const directory = resolve(root, '_worker.js');
await build({ stdin: { contents: `
import { onRequestPost as intake } from './functions/api/service-intake';
import { onRequestGet as receipt } from './functions/api/service-receipt';
import { onRequestPost as dispatch } from './functions/api/intake-dispatch';
export { intake, receipt, dispatch };`, resolveDir: process.cwd(), sourcefile: 'intake-entry.ts' },
  outfile: resolve(directory, 'rwas-intake.js'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022' });
const index = resolve(directory, 'index.js');
renameSync(index, resolve(directory, 'rwas-csp-wrapper.js'));
writeFileSync(index, `import app from './rwas-csp-wrapper.js';
import { intake, receipt, dispatch } from './rwas-intake.js';
export default { ...app, async fetch(request, env, ctx) {
 const path = new URL(request.url).pathname;
 const routes = { '/api/service-intake': ['POST', intake], '/api/service-receipt': ['GET', receipt], '/api/intake-dispatch': ['POST', dispatch] };
 if (Object.prototype.hasOwnProperty.call(routes, path)) {
   const [method, handler] = routes[path];
   if (request.method !== method) return new Response(JSON.stringify({error:'Method not allowed.'}), {status:405, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
   return handler({request, env});
 }
 return app.fetch(request, env, ctx);
}};
`);
const routesPath = resolve(root, '_routes.json');
const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
for (const path of ['/api/service-intake', '/api/service-receipt', '/api/intake-dispatch']) {
 routes.include = routes.include || [];
 if (!routes.include.some(p => p === path || (p.endsWith('*') && path.startsWith(p.slice(0, -1))))) routes.include.push(path);
 routes.exclude = (routes.exclude || []).filter(p => p !== path);
 if (routes.exclude.some(p => p.includes('*') && path.startsWith(p.split('*')[0]))) throw new Error('An existing wildcard exclusion would bypass service intake');
}
writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('Staged three explicit intake routes; existing application and CSP preserved.');
