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
};

const marker = 'async fetch(t,e,a){';
const injected = `${marker}const rwasPath=new URL(t.url).pathname.replace(/\\/$/,"");const rwasTarget=${JSON.stringify(
  redirects
)}[rwasPath];if(rwasTarget)return Response.redirect(new URL(rwasTarget,t.url),301);`;

const worker = readFileSync(workerPath, 'utf8');
if (worker.includes('const rwasPath=')) {
  console.log('RWAS collection redirects already injected into Cloudflare worker.');
} else if (!worker.includes(marker)) {
  throw new Error(`Could not find Cloudflare worker fetch marker in ${workerPath}`);
} else {
  writeFileSync(workerPath, worker.replace(marker, injected));
  console.log(`Injected ${Object.keys(redirects).length} RWAS collection redirects into Cloudflare worker.`);
}
