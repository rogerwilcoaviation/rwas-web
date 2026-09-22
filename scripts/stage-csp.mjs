import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// Per-document hashes avoid both the 100-rule and 2,000-character _headers
// limits. Advanced-mode Pages responses need the header on the Worker response.
export function policyFor(html) {
  const hashes = new Set();
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/i.test(script[1]) || !script[2].trim()) continue;
    hashes.add(`'sha256-${createHash('sha256').update(script[2]).digest('base64')}'`);
  }
  return `script-src 'self' ${[...hashes].join(' ')} https://challenges.cloudflare.com https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://*.vercel-analytics.com https://*.vercel-scripts.com; object-src 'none'; base-uri 'self'`;
}

export function stage(root) {
  const policies = {};
  function walk(dir) {
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, file.name);
      if (file.isDirectory() && file.name !== '_worker.js') walk(path);
      else if (file.isFile() && file.name.endsWith('.html')) {
        const route = '/' + relative(root, path).replaceAll('\\', '/');
        const policy = policyFor(readFileSync(path, 'utf8'));
        if (Buffer.byteLength(policy) > 24000) throw new Error(`CSP exceeds staging budget: ${route}`);
        policies[route] = policy;
        policies[route.replace(/\/index\.html$/, '/').replace(/\.html$/, '')] = policy;
      }
    }
  }
  walk(root);
  if (!policies['/']) throw new Error('No exported root document found');
  const workerDir = resolve(root, '_worker.js');
  const original = resolve(workerDir, 'index.js');
  renameSync(original, resolve(workerDir, 'rwas-app.js'));
  writeFileSync(resolve(workerDir, 'rwas-csp.json'), JSON.stringify(policies));
  writeFileSync(original, `import app from './rwas-app.js';\nconst policies = ${JSON.stringify(policies)};\nexport default { ...app, async fetch(request, env, ctx) {\n  const response = await app.fetch(request, env, ctx);\n  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;\n  const path = new URL(request.url).pathname;\n  const policy = policies[path] || policies[path.replace(/\\/$/, '')] || (response.status === 404 ? policies['/404'] : null);\n  if (!policy) return response;\n  const staged = new Response(response.body, response);\n  staged.headers.set('Content-Security-Policy-Report-Only', policy);\n  return staged;\n}};\n`);
  // Ensure HTML traverses the wrapper instead of bypassing it via static routing.
  const routesPath = resolve(root, '_routes.json');
  const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
  routes.exclude = (routes.exclude || []).filter((route) => {
    if (route === '/ops' || route.startsWith('/ops/') || route.startsWith('/work-order-system')) return true;
    if (route.includes('*')) return !Object.keys(policies).some((path) => path.startsWith(route.split('*')[0]));
    return !policies[route];
  });
  writeFileSync(routesPath, JSON.stringify(routes, null, 2));
  console.log(`Staged report-only CSP for ${Object.keys(policies).length} exported route aliases; existing enforcement unchanged. Browser console only; no remote report collector.`);
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) stage(resolve(process.argv[2] || '.vercel/output/static'));
