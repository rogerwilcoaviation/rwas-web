import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Exclude the embedded RWAS Work Order System SPA paths from the Next.js worker
// so Cloudflare Pages serves them from the static layer, where public/_redirects
// provides the /ops redirects and SPA deep-link fallbacks.
const routesPath = resolve('.vercel/output/static/_routes.json');
const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
const excludes = ['/ops', '/ops/*', '/work-order-system', '/work-order-system/*'];
routes.exclude = Array.from(new Set([...(routes.exclude ?? []), ...excludes]));
writeFileSync(routesPath, JSON.stringify(routes, null, 1));
console.log('WOS paths excluded from worker:', excludes.join(', '));
