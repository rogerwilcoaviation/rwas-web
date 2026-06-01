import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workerPath = resolve('.vercel/output/static/_worker.js/index.js');

const redirects = {
  '/collections/garmin-avionics': '/collections/avionics-certified',
  '/collections/garmin-avionics-certified-retail': '/collections/avionics-certified',
  '/collections/garmin-avionics-accessories': '/collections/garmin-dealer-install',
  '/collections/garmin-database-cards': '/collections/avionics-certified',
  '/collections/garmin-traffic-weather-receivers': '/collections/avionics-certified',
  '/collections/garmin-portable-gps-wearables': '/collections/pilot-gear',
  '/collections/garmin-watches': '/collections/watches-accessories',
  '/collections/garmin-inreach-communicators': '/collections/pilot-gear',
  '/collections/garmin-products': '/collections',
  '/collections/retail-experimental': '/collections/avionics-experimental',
  '/collections/rigging-tools': '/collections/papa-alpha-tools',
  '/collections/garmin-marine': '/collections',
  '/collections/garmin-cycling-fitness': '/collections',
  '/collections/garmin-golf': '/collections',
  '/collections/garmin-outdoor-dog-tracking': '/collections',
  '/maintenance': '/services/aircraft-maintenance-sioux-falls',
  '/services/aircraft-maintenance-yankton': '/services/aircraft-maintenance-sioux-falls',
};

const gonePaths = [
  '/pages/script-rwas',
];

const marker = 'async fetch(t,e,a){';
const injected = `${marker}const rwasUrl=new URL(t.url);if(rwasUrl.pathname==="/rwas-ops-api"||rwasUrl.pathname.startsWith("/rwas-ops-api/")){const rwasOpsPath=rwasUrl.pathname.replace(/^\\/rwas-ops-api\\/?/,"/");const rwasOpsTarget=new URL("https://rwas-ops-api.john-08c.workers.dev"+rwasOpsPath);rwasOpsTarget.search=rwasUrl.search;const rwasOpsHeaders=new Headers(t.headers);rwasOpsHeaders.delete("host");rwasOpsHeaders.delete("origin");rwasOpsHeaders.delete("referer");const rwasOpsResponse=await fetch(rwasOpsTarget,{method:t.method,headers:rwasOpsHeaders,body:t.method==="GET"||t.method==="HEAD"?void 0:t.body,redirect:"manual"});const rwasOpsResponseHeaders=new Headers(rwasOpsResponse.headers);rwasOpsResponseHeaders.delete("access-control-allow-origin");rwasOpsResponseHeaders.delete("access-control-allow-credentials");rwasOpsResponseHeaders.set("Cache-Control","no-store");return new Response(rwasOpsResponse.body,{status:rwasOpsResponse.status,statusText:rwasOpsResponse.statusText,headers:rwasOpsResponseHeaders})}const rwasPath=rwasUrl.pathname.replace(/\\/$/,"");if(${JSON.stringify(
  gonePaths
)}.includes(rwasPath))return new Response("Gone",{status:410,headers:{"Cache-Control":"public, max-age=3600","X-Robots-Tag":"noindex, noarchive"}});const rwasTarget=${JSON.stringify(
  redirects
)}[rwasPath];if(rwasTarget)return Response.redirect(new URL(rwasTarget,t.url),301);`;

const worker = readFileSync(workerPath, 'utf8');
if (worker.includes('const rwasUrl=') && worker.includes('const rwasPath=')) {
  console.log('RWAS SEO edge rules already injected into Cloudflare worker.');
} else if (!worker.includes(marker)) {
  throw new Error(`Could not find Cloudflare worker fetch marker in ${workerPath}`);
} else {
  writeFileSync(workerPath, worker.replace(marker, injected));
  console.log(`Injected ${Object.keys(redirects).length} RWAS collection redirects and ${gonePaths.length} gone URL into Cloudflare worker.`);
}
