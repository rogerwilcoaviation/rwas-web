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
const rwasOpsProxy = `const rwasUrl=new URL(t.url);if(rwasUrl.pathname==="/rwas-ops-api"||rwasUrl.pathname.startsWith("/rwas-ops-api/")){if(t.method==="POST"&&rwasUrl.pathname==="/rwas-ops-api/v1/auth/portal-account"){const rwasPortalBody=await t.clone().json().catch(()=>null);if(rwasPortalBody&&rwasPortalBody.role==="employee")return Response.json({error:"employee_accounts_admin_only"},{status:403,headers:{"Cache-Control":"no-store"}})}if(t.method==="GET"&&rwasUrl.pathname.startsWith("/rwas-ops-api/v1/aircraft-registry/n-number/")){const nRaw=decodeURIComponent(rwasUrl.pathname.split("/").pop()||"");const nNorm=nRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");const n=nNorm?nNorm.startsWith("N")?nNorm:"N"+nNorm:"";const srcBase="https://registry.faa.gov/aircraftinquiry/search/nnumberinquiry";const q=n.startsWith("N")?n.slice(1):n;const sourceUrl=q?srcBase+"?NNumbertxt="+encodeURIComponent(q):srcBase;if(!n)return Response.json({ok:false,status:"invalid_n_number",sourceUrl,message:"Enter an aircraft N-number before checking the FAA registry."},{status:400,headers:{"Cache-Control":"no-store"}});const resultUrl="https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt="+encodeURIComponent(q);const faaResponse=await fetch(resultUrl,{headers:{accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}});const html=await faaResponse.text();const clean=s=>String(s||"").replace(/<br\\s*\\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\\s+/g," ").trim();const key=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();const cells=[];let m;const re=/<td\\b([^>]*)>([\\s\\S]*?)<\\/td>/gi;while((m=re.exec(html))){const lm=(m[1]||"").match(/\\bdata-label=["']([^"']*)["']/i);cells.push({dataLabel:clean(lm&&lm[1]||""),text:clean(m[2]||"")})}const fields={};for(let i=0;i<cells.length;i++){const c=cells[i],nx=cells[i+1];if(!c.text)continue;if(c.dataLabel&&c.dataLabel===c.text){fields[key(c.dataLabel)]=c.text;continue}if(nx&&nx.dataLabel&&nx.dataLabel!==c.text){fields[key(nx.dataLabel)]=nx.text;continue}if(nx&&nx.text){fields[key(c.text)]=nx.text;i++}}const first=names=>{for(const name of names){const value=fields[key(name)];if(value&&!["none","unknown"].includes(value.toLowerCase()))return value}};const aircraft={nNumber:n,sourceUrl,collectedAt:new Date().toISOString(),serialNumber:first(["Serial Number"]),status:first(["Status"]),manufacturerName:first(["Manufacturer Name"]),model:first(["Model"]),mfrYear:first(["Mfr Year","MFR Year"]),typeAircraft:first(["Aircraft Type","Type Aircraft"]),typeEngine:first(["Engine Type","Type Engine"]),certificateIssueDate:first(["Certificate Issue Date"]),expirationDate:first(["Expiration Date"]),registeredOwnerName:first(["Name"]),registeredOwnerCity:first(["City"]),registeredOwnerState:first(["State"]),registeredOwnerCountry:first(["Country"]),engineManufacturer:first(["Engine Manufacturer"]),engineModel:first(["Engine Model"])};if(!faaResponse.ok||(!aircraft.serialNumber&&!aircraft.manufacturerName&&!aircraft.model))return Response.json({ok:false,status:faaResponse.ok?"not_collected":"faa_request_failed",sourceUrl,message:faaResponse.ok?"FAA registry data could not be collected automatically. Open the official inquiry and enter the fields manually.":"FAA registry request failed with HTTP "+faaResponse.status},{status:faaResponse.ok?404:502,headers:{"Cache-Control":"no-store"}});return Response.json({ok:true,status:"collected",sourceUrl,aircraft},{headers:{"Cache-Control":"no-store"}})}const rwasOpsPath=rwasUrl.pathname.replace(/^\\/rwas-ops-api\\/?/,"/");const rwasOpsTarget=new URL("https://rwas-ops-api.john-08c.workers.dev"+rwasOpsPath);rwasOpsTarget.search=rwasUrl.search;const rwasOpsHeaders=new Headers(t.headers);rwasOpsHeaders.delete("host");rwasOpsHeaders.delete("origin");rwasOpsHeaders.delete("referer");const rwasOpsResponse=await fetch(rwasOpsTarget,{method:t.method,headers:rwasOpsHeaders,body:t.method==="GET"||t.method==="HEAD"?void 0:t.body,redirect:"manual"});const rwasOpsResponseHeaders=new Headers(rwasOpsResponse.headers);rwasOpsResponseHeaders.delete("access-control-allow-origin");rwasOpsResponseHeaders.delete("access-control-allow-credentials");rwasOpsResponseHeaders.set("Cache-Control","no-store");return new Response(rwasOpsResponse.body,{status:rwasOpsResponse.status,statusText:rwasOpsResponse.statusText,headers:rwasOpsResponseHeaders})}`;
const injected = `${marker}${rwasOpsProxy}const rwasPath=rwasUrl.pathname.replace(/\\/$/,"");if(${JSON.stringify(
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
