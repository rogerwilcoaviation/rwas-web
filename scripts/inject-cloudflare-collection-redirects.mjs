import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workerPath = resolve('.vercel/output/static/_worker.js/index.js');

const redirects = {
  '/contact.html': '/contact',
  '/newspaper/index.html': '/',
  '/aircraft4sale': '/aircraft-for-sale',
  '/Home': '/',
  '/contactContact': '/contact',
  '/collections/garmin-avionics': '/collections/avionics-certified',
  '/collections/garmin-avionics-certified-retail':
    '/collections/avionics-certified',
  '/collections/garmin-avionics-accessories':
    '/collections/garmin-dealer-install',
  '/collections/garmin-database-cards': '/collections/avionics-certified',
  '/collections/garmin-traffic-weather-receivers':
    '/collections/avionics-certified',
  '/collections/garmin-portable-gps-wearables': '/collections/pilot-gear',
  '/collections/garmin-watches': '/collections/watches-accessories',
  '/collections/garmin-inreach-communicators': '/collections/pilot-gear',
  '/collections/garmin-products': '/collections',
  '/collections/avionics-experimental': '/collections/avionics-certified',
  '/collections/retail-experimental': '/collections/avionics-certified',
  '/collections/rigging-tools': '/collections/papa-alpha-tools',
  '/collections/garmin-marine': '/collections',
  '/collections/garmin-cycling-fitness': '/collections',
  '/collections/garmin-golf': '/collections',
  '/collections/garmin-outdoor-dog-tracking': '/collections',
  '/collections/garmin-equine': '/collections',
  '/collections/garmin-outdoor-navigation': '/collections',
  '/collections/garmin-powersports': '/collections',
  '/maintenance': '/services/aircraft-maintenance',
  '/locations/sioux-falls': '/locations/yankton',
  '/services/aircraft-maintenance-sioux-falls':
    '/services/aircraft-maintenance',
  '/services/aircraft-maintenance-yankton': '/services/aircraft-maintenance',
};

const gonePaths = ['/pages/script-rwas'];

const fetchMarkerPattern = /async fetch\(t,e,[A-Za-z_$][\w$]*\)\{/g;
const worker = readFileSync(workerPath, 'utf8');
const markerMatches = [...worker.matchAll(fetchMarkerPattern)];
const marker = markerMatches[0]?.[0];
const rwasOpsProxy = `const rwasUrl=new URL(t.url);if(rwasUrl.pathname==="/rwas-ops-api"||rwasUrl.pathname.startsWith("/rwas-ops-api/")){if(t.method==="POST"&&rwasUrl.pathname==="/rwas-ops-api/v1/auth/portal-account"){const rwasPortalBody=await t.clone().json().catch(()=>null);if(rwasPortalBody&&rwasPortalBody.role==="employee")return Response.json({error:"employee_accounts_admin_only"},{status:403,headers:{"Cache-Control":"no-store"}})}if(t.method==="GET"&&rwasUrl.pathname.startsWith("/rwas-ops-api/v1/aircraft-registry/n-number/")){const nRaw=decodeURIComponent(rwasUrl.pathname.split("/").pop()||"");const nNorm=nRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");const n=nNorm?nNorm.startsWith("N")?nNorm:"N"+nNorm:"";const srcBase="https://registry.faa.gov/aircraftinquiry/search/nnumberinquiry";const q=n.startsWith("N")?n.slice(1):n;const sourceUrl=q?srcBase+"?NNumbertxt="+encodeURIComponent(q):srcBase;if(!n)return Response.json({ok:false,status:"invalid_n_number",sourceUrl,message:"Enter an aircraft N-number before checking the FAA registry."},{status:400,headers:{"Cache-Control":"no-store"}});const resultUrl="https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt="+encodeURIComponent(q);const faaResponse=await fetch(resultUrl,{headers:{accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}});const html=await faaResponse.text();const clean=s=>String(s||"").replace(/<br\\s*\\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\\s+/g," ").trim();const key=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();const cells=[];let m;const re=/<td\\b([^>]*)>([\\s\\S]*?)<\\/td>/gi;while((m=re.exec(html))){const lm=(m[1]||"").match(/\\bdata-label=["']([^"']*)["']/i);cells.push({dataLabel:clean(lm&&lm[1]||""),text:clean(m[2]||"")})}const fields={};for(let i=0;i<cells.length;i++){const c=cells[i],nx=cells[i+1];if(!c.text)continue;if(c.dataLabel&&c.dataLabel===c.text){fields[key(c.dataLabel)]=c.text;continue}if(nx&&nx.dataLabel&&nx.dataLabel!==c.text){fields[key(nx.dataLabel)]=nx.text;continue}if(nx&&nx.text){fields[key(c.text)]=nx.text;i++}}const first=names=>{for(const name of names){const value=fields[key(name)];if(value&&!["none","unknown"].includes(value.toLowerCase()))return value}};const aircraft={nNumber:n,sourceUrl,collectedAt:new Date().toISOString(),serialNumber:first(["Serial Number"]),status:first(["Status"]),manufacturerName:first(["Manufacturer Name"]),model:first(["Model"]),mfrYear:first(["Mfr Year","MFR Year"]),typeAircraft:first(["Aircraft Type","Type Aircraft"]),typeEngine:first(["Engine Type","Type Engine"]),certificateIssueDate:first(["Certificate Issue Date"]),expirationDate:first(["Expiration Date"]),registeredOwnerName:first(["Name"]),registeredOwnerCity:first(["City"]),registeredOwnerState:first(["State"]),registeredOwnerCountry:first(["Country"]),engineManufacturer:first(["Engine Manufacturer"]),engineModel:first(["Engine Model"])};if(!faaResponse.ok||(!aircraft.serialNumber&&!aircraft.manufacturerName&&!aircraft.model))return Response.json({ok:false,status:faaResponse.ok?"not_collected":"faa_request_failed",sourceUrl,message:faaResponse.ok?"FAA registry data could not be collected automatically. Open the official inquiry and enter the fields manually.":"FAA registry request failed with HTTP "+faaResponse.status},{status:faaResponse.ok?404:502,headers:{"Cache-Control":"no-store"}});return Response.json({ok:true,status:"collected",sourceUrl,aircraft},{headers:{"Cache-Control":"no-store"}})}const rwasOpsPath=rwasUrl.pathname.replace(/^\\/rwas-ops-api\\/?/,"/");const rwasOpsTarget=new URL("https://rwas-ops-api.john-08c.workers.dev"+rwasOpsPath);rwasOpsTarget.search=rwasUrl.search;const rwasOpsHeaders=new Headers(t.headers);rwasOpsHeaders.delete("host");rwasOpsHeaders.delete("origin");rwasOpsHeaders.delete("referer");const rwasOpsResponse=await fetch(rwasOpsTarget,{method:t.method,headers:rwasOpsHeaders,body:t.method==="GET"||t.method==="HEAD"?void 0:t.body,redirect:"manual"});const rwasOpsResponseHeaders=new Headers(rwasOpsResponse.headers);rwasOpsResponseHeaders.delete("access-control-allow-origin");rwasOpsResponseHeaders.delete("access-control-allow-credentials");rwasOpsResponseHeaders.set("Cache-Control","no-store");return new Response(rwasOpsResponse.body,{status:rwasOpsResponse.status,statusText:rwasOpsResponse.statusText,headers:rwasOpsResponseHeaders})}`;
const rwasAnalytics = `if(rwasUrl.pathname==="/api/rum"||rwasUrl.pathname==="/api/track"){if(t.method==="OPTIONS")return new Response(null,{status:204,headers:{Allow:"POST, OPTIONS","Cache-Control":"no-store"}});if(t.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST, OPTIONS","Cache-Control":"no-store"}});let p={};try{p=await t.clone().json()}catch{}const cs=(v,max=240)=>typeof v==="string"?v.slice(0,max):"";const cn=v=>typeof v==="number"&&Number.isFinite(v)?v:void 0;const ev={kind:"rwas_analytics",ts:new Date().toISOString(),event:cs(p.event||"event",40),sessionId:/^rwas_[a-z0-9_-]{12,80}$/i.test(p.sessionId||"")?p.sessionId:"",feature:cs(p.feature,80),path:cs(p.path||rwasUrl.pathname,240),referrer:cs(p.referrer,500),device:cs(p.device,30),metric:cs(p.metric,20),value:cn(p.value),rating:cs(p.rating,30),visibilityState:cs(p.visibilityState,30),navigationType:cs(p.navigationType,30),transferSize:cn(p.transferSize),element:cs(p.element,40),lcpUrl:cs(p.url,500),size:cn(p.size),userAgent:cs(t.headers.get("user-agent")||"",300),country:cs(t.headers.get("cf-ipcountry")||"",8)};console.log(JSON.stringify(ev));return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}})}`;
// Next-on-Pages does not include the standalone Pages Function in its generated
// worker. Keep this edge fallback aligned with functions/api/contact.ts.
const rwasContact = `if(rwasUrl.pathname==="/api/contact"){const j=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});if(t.method==="OPTIONS")return new Response(null,{status:204,headers:{Allow:"POST, OPTIONS","Cache-Control":"no-store"}});if(t.method!=="POST")return j({error:"Method not allowed"},405);let p;try{p=await t.clone().json()}catch{return j({error:"Invalid JSON body."},400)}const ticket=()=>{const n=new Date(),d=String(n.getUTCFullYear()).slice(-2)+String(n.getUTCMonth()+1).padStart(2,"0")+String(n.getUTCDate()).padStart(2,"0"),r=Math.random().toString(36).slice(2,6).toUpperCase();return"RWAS-"+d+"-"+r};if(p.website)return j({ticketId:ticket(),to:"service@rwas.team"});if(!p.name||p.name.length<2)return j({error:"Name is required."},400);if(!p.email)return j({error:"Email is required."},400);if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(p.email))return j({error:"Email looks invalid."},400);if(!/^\\d{4}$/.test(p.aircraftYear||""))return j({error:"A four-digit aircraft year is required."},400);if(!p.aircraftMake||!String(p.aircraftMake).trim())return j({error:"Aircraft make is required."},400);if(!p.aircraftModel||!String(p.aircraftModel).trim())return j({error:"Aircraft model is required."},400);if(!p.aircraftSerialNumber||!String(p.aircraftSerialNumber).trim())return j({error:"Aircraft serial number is required."},400);if(!p.message||p.message.length<10)return j({error:"Please include a short message so we can help."},400);if(p.message.length>4000)return j({error:"Message is too long (max 4000 characters)."},400);if(p.nNumber&&!/^[A-Za-z0-9-]{1,10}$/.test(p.nNumber))return j({error:"N-number has unexpected characters."},400);if(e.TURNSTILE_SECRET_KEY){if(!p.turnstileToken)return j({error:"Verification failed. Please refresh the page and try again, or email service@rwas.team directly."},429);const v=new URLSearchParams({secret:e.TURNSTILE_SECRET_KEY,response:p.turnstileToken});const ip=t.headers.get("CF-Connecting-IP");if(ip)v.set("remoteip",ip);let ok=false;try{const vr=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:v.toString()});ok=Boolean((await vr.json()).success)}catch{}if(!ok)return j({error:"Verification failed. Please refresh the page and try again, or email service@rwas.team directly."},429)}if(!e.RESEND_API_KEY||!e.TEAMS_RELAY_TOKEN){console.error("contact-form send failed","delivery provider not configured");return j({error:"We could not deliver your message right now. Please email service@rwas.team directly."},502)}const id=ticket(),esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),labels={quote:"Quote request",general:"General inquiry",service:"Service / maintenance","papa-alpha":"Papa-Alpha tool inquiry","aircraft-sales":"Aircraft for sale"},reason=labels[p.reason||"general"]||"Inquiry",to=e.CONTACT_TO_EMAIL||"service@rwas.team",from=e.CONTACT_FROM_EMAIL||"RWAS Correspondence <noreply@rwas.team>",subject=p.reason==="quote"&&p.product?"["+id+"] Quote: "+p.product+" — from "+p.name:"["+id+"] "+reason+" — from "+p.name,aircraft=[p.aircraftYear,p.aircraftMake,p.aircraftModel].join(" "),text=["RWAS CORRESPONDENCE DESK — "+id,"Reason: "+reason,p.product&&"Product: "+p.product,p.sku&&"SKU: "+p.sku,"Name: "+p.name,"Email: "+p.email,p.phone&&"Phone: "+p.phone,"Aircraft: "+aircraft,"Serial Number: "+p.aircraftSerialNumber,p.nNumber&&"N-Number: "+p.nNumber,"","Message:",p.message].filter(Boolean).join("\\n"),teamsText=["NEW WEBSITE INQUIRY — "+id,"Reason: "+reason,p.product&&"Product: "+p.product,p.sku&&"SKU: "+p.sku,"Name: "+p.name,"Email: "+p.email,p.phone&&"Phone: "+p.phone,p.preferredContact&&"Prefers: "+p.preferredContact,p.bestTimeToCall&&"Best time: "+p.bestTimeToCall,"Aircraft: "+aircraft,"Serial Number: "+p.aircraftSerialNumber,p.nNumber&&"N-Number: "+p.nNumber,p.source&&"Source: "+p.source,"","Message:",p.message].filter(Boolean).join("\\n"),html="<!doctype html><html><body><h2>"+esc(reason)+"</h2><p><b>Ticket:</b> "+esc(id)+"</p>"+(p.product?"<p><b>Product:</b> "+esc(p.product)+"</p>":"")+"<p><b>Name:</b> "+esc(p.name)+"<br><b>Email:</b> "+esc(p.email)+(p.phone?"<br><b>Phone:</b> "+esc(p.phone):"")+"<br><b>Aircraft:</b> "+esc(aircraft)+"<br><b>Serial Number:</b> "+esc(p.aircraftSerialNumber)+(p.nNumber?"<br><b>N-Number:</b> "+esc(p.nNumber):"")+"</p><h3>Message</h3><p style=\\"white-space:pre-wrap\\">"+esc(p.message)+"</p></body></html>",emailReq=fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+e.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],reply_to:p.email,subject,text,html,tags:[{name:"source",value:"rwas-contact-form"},{name:"reason",value:p.reason||"general"}]})}),teamsReq=fetch(e.CONTACT_TEAMS_RELAY_URL||"https://teamsbot.rwas.team/post",{method:"POST",headers:{Authorization:"Bearer "+e.TEAMS_RELAY_TOKEN,"Content-Type":"application/json"},body:JSON.stringify({channel:e.CONTACT_TEAMS_TARGET||"Shop Talk",text:teamsText})});try{const[sr,tr]=await Promise.all([emailReq,teamsReq]);if(!sr.ok||!tr.ok){console.error("contact-form send failed","Resend "+sr.status+"; Teams "+tr.status);return j({error:"We could not deliver your message right now. Please email service@rwas.team directly."},502)}}catch(err){console.error("contact-form send failed",err);return j({error:"We could not deliver your message right now. Please email service@rwas.team directly."},502)}return j({ticketId:id,to})}`;
const rwasCart = `if(rwasUrl.pathname==="/api/cart"){const j=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});if(t.method==="OPTIONS")return new Response(null,{status:204,headers:{Allow:"GET, POST, PATCH, DELETE, OPTIONS","Cache-Control":"no-store"}});const cf="id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title handle featuredImage { url altText } } selectedOptions { name value } } } } } }";const q={cart:"query Cart($cartId: ID!) { cart(id: $cartId) { "+cf+" } }",create:"mutation CartCreate($merchandiseId: ID!, $quantity: Int!) { cartCreate(input: { lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }] }) { cart { "+cf+" } userErrors { message } } }",add:"mutation CartLinesAdd($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) { cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $merchandiseId, quantity: $quantity }]) { cart { "+cf+" } userErrors { message } } }",update:"mutation CartLinesUpdate($cartId: ID!, $lineId: ID!, $quantity: Int!) { cartLinesUpdate(cartId: $cartId, lines: [{ id: $lineId, quantity: $quantity }]) { cart { "+cf+" } userErrors { message } } }",remove:"mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { "+cf+" } userErrors { message } } }"};const flat=c=>c?{id:c.id,checkoutUrl:c.checkoutUrl,totalQuantity:c.totalQuantity,cost:c.cost,lines:Array.isArray(c?.lines?.edges)?c.lines.edges.map(x=>x?.node).filter(Boolean):[]}:null;const shop=async(query,variables)=>{const domain=e.SHOPIFY_STORE_DOMAIN||"m06wpv-na.myshopify.com";const token=e.SHOPIFY_STOREFRONT_ACCESS_TOKEN||"";const version=e.SHOPIFY_STOREFRONT_API_VERSION||"2025-10";if(!token)throw new Error("Storefront token not configured");const r=await fetch("https://"+domain+"/api/"+version+"/graphql.json",{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Storefront-Access-Token":token},body:JSON.stringify({query,variables})});const x=await r.json();if(x.errors?.length)throw new Error(x.errors.map(y=>y.message).join("; "));return x.data};try{if(t.method==="GET"){const cartId=rwasUrl.searchParams.get("cartId");if(!cartId)return j({error:"cartId required"},400);const d=await shop(q.cart,{cartId});return j({cart:flat(d?.cart??null)})}const body=await t.clone().json().catch(()=>({}));if(t.method==="POST"){const merchandiseId=body.merchandiseId,quantity=body.quantity??1;if(!merchandiseId)return j({error:"merchandiseId is required"},400);let cart;if(body.cartId){const d=await shop(q.add,{cartId:body.cartId,merchandiseId,quantity});if(d?.cartLinesAdd?.userErrors?.length){const f=await shop(q.create,{merchandiseId,quantity});cart=f?.cartCreate?.cart}else cart=d?.cartLinesAdd?.cart}else{const d=await shop(q.create,{merchandiseId,quantity});cart=d?.cartCreate?.cart}if(!cart)return j({error:"Cart operation failed"},502);return j({cart:flat(cart)})}if(t.method==="PATCH"){if(!body.cartId||!body.lineId||typeof body.quantity!=="number")return j({error:"cartId, lineId, and quantity are required"},400);const d=await shop(q.update,{cartId:body.cartId,lineId:body.lineId,quantity:Math.max(0,Math.floor(body.quantity))});const er=d?.cartLinesUpdate?.userErrors;if(er?.length)return j({error:er.map(x=>x.message).join("; ")},422);return j({cart:flat(d?.cartLinesUpdate?.cart??null)})}if(t.method==="DELETE"){const lineIds=Array.isArray(body.lineIds)&&body.lineIds.length?body.lineIds:body.lineId?[body.lineId]:[];if(!body.cartId||lineIds.length===0)return j({error:"cartId and lineId(s) are required"},400);const d=await shop(q.remove,{cartId:body.cartId,lineIds});const er=d?.cartLinesRemove?.userErrors;if(er?.length)return j({error:er.map(x=>x.message).join("; ")},422);return j({cart:flat(d?.cartLinesRemove?.cart??null)})}return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET, POST, PATCH, DELETE, OPTIONS","Cache-Control":"no-store"}})}catch(err){return j({error:err instanceof Error?err.message:String(err)},502)}}`;
const rwasContactWithRequiredNNumber = rwasContact
  .replace(
    'if(!p.message||p.message.length<10)',
    'if(!p.nNumber)return j({error:"Aircraft N-number is required."},400);if(!/^[A-Za-z0-9-]{1,10}$/.test(p.nNumber))return j({error:"N-number has unexpected characters."},400);if(!p.message||p.message.length<10)',
  )
  .replace(
    'if(p.nNumber&&!/^[A-Za-z0-9-]{1,10}$/.test(p.nNumber))return j({error:"N-number has unexpected characters."},400);',
    '',
  );

// The generated worker must preserve the same delivery contract as the
// standalone Pages Function: Resend gates success, Teams is best-effort, and
// the planner request ID is reused as Resend's idempotency key.
const rwasContactAligned = `
if (rwasUrl.pathname === "/api/contact") {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (t.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" },
    });
  }
  if (t.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload;
  try {
    payload = await t.clone().json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const clean = (value, max = 240) =>
    typeof value === "string" ? value.slice(0, max) : "";
  const escapeHtml = (value) =>
    clean(value, 20000)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const number = (value) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const requestId = /^[A-Za-z0-9_-]{8,120}$/.test(payload.requestId || "")
    ? payload.requestId
    : "rwas_" +
      Date.now().toString(36) +
      "_" +
      crypto.randomUUID().replace(/-/g, "");

  if (payload.website) {
    return json({ ticketId: requestId, requestId, to: "service@rwas.team" });
  }
  if (!payload.name || payload.name.length < 2) {
    return json({ error: "Name is required." }, 400);
  }
  if (
    !payload.email ||
    !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(payload.email)
  ) {
    return json({ error: "Please enter a valid email." }, 400);
  }

  const quote = payload.reason === "quote";
  const allowedStatuses = [
    "registered",
    "under-construction",
    "identifiers-not-assigned",
  ];
  if (
    payload.aircraftStatus &&
    !allowedStatuses.includes(payload.aircraftStatus)
  ) {
    return json({ error: "Please choose a valid aircraft status." }, 400);
  }
  if (
    quote &&
    (!clean(payload.aircraftMake, 80).trim() ||
      !clean(payload.aircraftModel, 80).trim())
  ) {
    return json(
      { error: "Aircraft make and model are required for quote requests." },
      400,
    );
  }
  if (quote && !payload.aircraftStatus) {
    return json(
      { error: "Please choose the aircraft status for this quote request." },
      400,
    );
  }
  if (
    quote &&
    payload.aircraftStatus === "registered" &&
    (!/^\\d{4}$/.test(payload.aircraftYear || "") ||
      !clean(payload.aircraftSerialNumber, 80).trim() ||
      !clean(payload.nNumber, 10).trim())
  ) {
    return json(
      {
        error:
          "Registered-aircraft quotes require year, serial number, and N-number.",
      },
      400,
    );
  }
  if (payload.nNumber && !/^[A-Za-z0-9-]{1,10}$/i.test(payload.nNumber)) {
    return json({ error: "N-number has unexpected characters." }, 400);
  }
  if (typeof payload.message !== "string" || payload.message.length < 10) {
    return json(
      { error: "Please include a short message so we can help." },
      400,
    );
  }
  if (payload.message.length > 4000) {
    return json({ error: "Message is too long (max 4000 characters)." }, 400);
  }
  if (
    (payload.components &&
      (!Array.isArray(payload.components) || payload.components.length > 100)) ||
    (payload.advisories &&
      (!Array.isArray(payload.advisories) || payload.advisories.length > 30))
  ) {
    return json({ error: "Planner payload is too large." }, 400);
  }

  if (e.TURNSTILE_SECRET_KEY) {
    const verificationBody = new URLSearchParams({
      secret: e.TURNSTILE_SECRET_KEY,
      response: payload.turnstileToken || "",
    });
    const ip = t.headers.get("CF-Connecting-IP");
    if (ip) verificationBody.set("remoteip", ip);
    let verified = false;
    try {
      const verification = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verificationBody.toString(),
        },
      );
      verified = Boolean((await verification.json()).success);
    } catch {}
    if (!verified) {
      return json(
        {
          error:
            "Verification failed. Please refresh the page and try again, or email service@rwas.team directly.",
        },
        429,
      );
    }
  }

  if (!e.RESEND_API_KEY) {
    return json(
      {
        error:
          "We could not deliver your message right now. Please email service@rwas.team directly.",
      },
      502,
    );
  }

  const labels = {
    quote: "Quote request",
    general: "General inquiry",
    service: "Service / maintenance",
    "papa-alpha": "Papa-Alpha tool inquiry",
    "aircraft-sales": "Aircraft for sale",
  };
  const reason = labels[payload.reason || "general"] || "Inquiry";
  const to = e.CONTACT_TO_EMAIL || "service@rwas.team";
  const from =
    e.CONTACT_FROM_EMAIL || "RWAS Correspondence <noreply@rwas.team>";
  const aircraft = [
    clean(payload.aircraftYear, 4),
    clean(payload.aircraftMake, 80),
    clean(payload.aircraftModel, 80),
  ]
    .filter(Boolean)
    .join(" ");
  const attributionLines = [
    payload.source ? "Source: " + clean(payload.source, 120) : "",
    payload.utm_source
      ? "UTM source: " + clean(payload.utm_source, 240)
      : "",
    payload.utm_medium
      ? "UTM medium: " + clean(payload.utm_medium, 240)
      : "",
    payload.utm_campaign
      ? "UTM campaign: " + clean(payload.utm_campaign, 240)
      : "",
    payload.utm_content
      ? "UTM content: " + clean(payload.utm_content, 240)
      : "",
    payload.utm_term ? "UTM term: " + clean(payload.utm_term, 240) : "",
  ].filter(Boolean);
  const componentLines = Array.isArray(payload.components)
    ? payload.components.map(
        (item) =>
          "- " +
          clean(item && (item.title || item.sku || "Component"), 240) +
          " (" +
          clean(item && item.sku, 120) +
          ") x " +
          number(item && item.quantity) +
          " | unit " +
          number(item && item.unitPrice) +
          " | extended " +
          number(item && item.extendedPrice),
      )
    : [];
  const advisoryLines = Array.isArray(payload.advisories)
    ? payload.advisories.map((advisory) => "- " + clean(advisory, 400))
    : [];
  const text = [
    "RWAS CORRESPONDENCE DESK — " + requestId,
    "Request/build ID: " + requestId,
    "Reason: " + reason,
    payload.product ? "Product: " + clean(payload.product, 240) : "",
    payload.sku ? "SKU: " + clean(payload.sku, 120) : "",
    "Name: " + clean(payload.name, 120),
    "Email: " + clean(payload.email, 254),
    payload.phone ? "Phone: " + clean(payload.phone, 40) : "",
    payload.preferredContact
      ? "Prefers: " + clean(payload.preferredContact, 20)
      : "",
    payload.bestTimeToCall
      ? "Best time: " + clean(payload.bestTimeToCall, 120)
      : "",
    aircraft ? "Aircraft: " + aircraft : "",
    payload.aircraftSerialNumber
      ? "Serial Number: " + clean(payload.aircraftSerialNumber, 80)
      : "",
    payload.nNumber ? "N-Number: " + clean(payload.nNumber, 10) : "",
    payload.aircraftStatus
      ? "Aircraft status: " + clean(payload.aircraftStatus, 40)
      : "",
    payload.plannerKind
      ? "Planner: AXIS " + clean(payload.plannerKind, 20)
      : "",
    payload.createdAt ? "Build created: " + clean(payload.createdAt, 80) : "",
    payload.pricingReference
      ? "Pricing: " + clean(payload.pricingReference, 160)
      : "",
    ...attributionLines,
    "",
    "Message:",
    clean(payload.message, 4000),
    componentLines.length
      ? "\\nSelected equipment:\\n" + componentLines.join("\\n")
      : "",
    advisoryLines.length
      ? "\\nPlanner advisories:\\n" + advisoryLines.join("\\n")
      : "",
  ]
    .filter((line) => line !== "")
    .join("\\n");
  const subject =
    "[" +
    requestId +
    "] " +
    (quote && payload.product
      ? "Quote: " + clean(payload.product, 240)
      : reason) +
    " — from " +
    clean(payload.name, 120) +
    (payload.source ? " [src:" + clean(payload.source, 120) + "]" : "");
  const emailBody = {
    from,
    to: [to],
    reply_to: clean(payload.email, 254),
    subject,
    text,
    html:
      "<h2>" +
      escapeHtml(reason) +
      "</h2><pre style=\\\"font:14px/1.5 Arial,sans-serif;white-space:pre-wrap\\\">" +
      escapeHtml(text) +
      "</pre>",
    tags: [
      { name: "source", value: "rwas-contact-form" },
      { name: "reason", value: clean(payload.reason || "general", 64) },
    ],
  };

  const email = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + e.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify(emailBody),
  });
  if (!email.ok) {
    console.error("contact-form email send failed", requestId, email.status);
    return json(
      {
        error:
          "We could not deliver your message right now. Please email service@rwas.team directly.",
      },
      502,
    );
  }

  // AXIS planner submissions receive a separate customer-facing receipt. It
  // intentionally presents a concept board rather than implying a scaled or
  // installation-approved panel layout; the equipment builder does not collect
  // panel dimensions or component positions.
  if (payload.plannerKind && componentLines.length) {
    const customerComponents = Array.isArray(payload.components)
      ? payload.components
          .map((item) => ({
            title: clean(item && item.title, 240),
            sku: clean(item && item.sku, 120),
            quantity: number(item && item.quantity),
            extendedPrice: number(item && item.extendedPrice),
          }))
          .filter((item) => item.title && item.quantity > 0)
      : [];
    const customerTotal = customerComponents.reduce(
      (sum, item) => sum + item.extendedPrice,
      0,
    );
    const customerMoney = (value) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    const equipmentRows = customerComponents
      .map(
        (item) =>
          '<tr><td style="padding:9px;border-bottom:1px solid #ddd">' +
          item.quantity +
          ' × ' +
          escapeHtml(item.title) +
          '<br><span style="color:#666;font:12px monospace">' +
          escapeHtml(item.sku) +
          '</span></td><td style="padding:9px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold">' +
          escapeHtml(customerMoney(item.extendedPrice)) +
          '</td></tr>',
      )
      .join("");
    const customerAdvisories = Array.isArray(payload.advisories)
      ? payload.advisories
          .map((item) => '<li style="margin:0 0 6px">' + escapeHtml(clean(item, 400)) + '</li>')
          .join("")
      : "";
    const customerText = [
      "Your RWAS AXIS preliminary build",
      "Reference: " + requestId,
      "Planner: AXIS " + clean(payload.plannerKind, 20),
      "Aircraft: " + (aircraft || "Not specified"),
      "",
      "Selected equipment:",
      ...customerComponents.map(
        (item) =>
          item.quantity +
          " x " +
          item.title +
          " (" +
          item.sku +
          ") — " +
          customerMoney(item.extendedPrice),
      ),
      "",
      "Hardware retail total: " + customerMoney(customerTotal),
      advisoryLines.length ? "\\nPlanner advisories:\\n" + advisoryLines.join("\\n") : "",
      "",
      "This is a preliminary equipment-planning receipt, not an approved configuration or installed quote. RWAS will verify aircraft eligibility, compatibility, installation hardware, panel space, labor, and final pricing.",
    ]
      .filter(Boolean)
      .join("\\n");
    const customerHtml =
      '<!doctype html><html><body style="margin:0;background:#f4f1e9;color:#171717"><div style="max-width:760px;margin:auto;padding:28px;font:15px/1.5 Arial,sans-serif"><p style="margin:0;text-transform:uppercase;letter-spacing:2px;font-weight:bold">Roger Wilco Aviation Services</p><h1 style="font:800 30px/1.1 Arial,sans-serif;margin:8px 0 12px">Your AXIS preliminary build</h1><p>Thank you, ' +
      escapeHtml(clean(payload.name, 120)) +
      '. We received your build and will review it for aircraft eligibility, compatibility, required installation hardware, labor, and package pricing.</p><p><strong>Reference:</strong> ' +
      escapeHtml(requestId) +
      '</p><h2 style="font:800 21px Arial,sans-serif">Selected equipment</h2><table style="width:100%;border-collapse:collapse;background:white;border:2px solid #171717"><tbody>' +
      equipmentRows +
      '<tr><td style="padding:12px;font-weight:bold">Hardware retail total</td><td style="padding:12px;text-align:right;font-size:20px;font-weight:bold">' +
      escapeHtml(customerMoney(customerTotal)) +
      '</td></tr></tbody></table>' +
      (customerAdvisories
        ? '<h2 style="font:800 21px Arial,sans-serif">Planner advisories</h2><ul>' + customerAdvisories + '</ul>'
        : "") +
      '<p style="margin-top:24px;padding:15px;border-left:5px solid #c28b00;background:#fff8dd"><strong>Planning note:</strong> This is a preliminary equipment-planning receipt, not an approved configuration or installed quote. RWAS will verify final equipment placement after reviewing the aircraft panel.</p><p>Questions? Reply to this email or call <a href="tel:+16052998178">(605) 299-8178</a>.</p></div></body></html>';

    try {
      const customerEmail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + e.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": requestId + "_customer",
        },
        body: JSON.stringify({
          from,
          to: [clean(payload.email, 254)],
          reply_to: to,
          subject: "Your RWAS AXIS preliminary build — " + requestId,
          text: customerText,
          html: customerHtml,
          tags: [
            { name: "source", value: "rwas-axis-planner" },
            { name: "reason", value: "customer-copy" },
          ],
        }),
      });
      if (!customerEmail.ok) {
        console.error("AXIS customer copy send failed", requestId, customerEmail.status);
      }
    } catch (error) {
      console.error("AXIS customer copy send failed", requestId, error);
    }
  }

  if (e.TEAMS_RELAY_TOKEN) {
    try {
      const teams = await fetch(
        e.CONTACT_TEAMS_RELAY_URL || "https://teamsbot.rwas.team/post",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + e.TEAMS_RELAY_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: e.CONTACT_TEAMS_TARGET || "Shop Talk",
            text: "NEW WEBSITE INQUIRY — " + requestId + "\\n" + text,
            requestId,
            idempotencyKey: requestId,
          }),
        },
      );
      if (!teams.ok) {
        console.error(
          "contact-form Teams send failed after email success",
          requestId,
          teams.status,
        );
      }
    } catch (error) {
      console.error(
        "contact-form Teams send failed after email success",
        requestId,
        error,
      );
    }
  }

  return json({ ticketId: requestId, requestId, to });
}
`;

// Keep the hand-injected Pages fallback aligned with functions/api/cart.ts. The
// Next-on-Pages worker does not execute the TypeScript function directly.
const rwasCartFixed = rwasCart
  .replace(
    'const q={cart:',
    'const q={product:"query MerchandiseProduct($id: ID!) { node(id: $id) { ... on ProductVariant { product { productType title handle tags } } } }",cart:',
  )
  .replace(
    'if(!merchandiseId)return j({error:"merchandiseId is required"},400);',
    'if(!merchandiseId)return j({error:"merchandiseId is required"},400);if(typeof quantity!=="number"||!Number.isInteger(quantity)||quantity<1||quantity>100)return j({error:"quantity must be an integer from 1 to 100"},400);let pt="",tags=[];try{const md=await shop(q.product,{id:merchandiseId});pt=md?.node?.product?.productType||"";tags=(md?.node?.product?.tags||[]).map(x=>String(x).trim().toLowerCase())}catch{}const restricted=tags.some(x=>["garmin-dealer-only","otc-disabled","stock-check-required"].includes(x)),unapproved=pt==="Avionics — Certified"&&!tags.includes("otc-eligible");if(pt==="Garmin Dealer Install"||restricted||unapproved)return j({error:"Cart unavailable for non-OTC Garmin avionics"+(pt?" ("+pt+")":"")+". Contact us for package pricing."},400);',
  )
  .replace(
    'if(d?.cartLinesAdd?.userErrors?.length){const f=await shop(q.create,{merchandiseId,quantity});cart=f?.cartCreate?.cart}',
    'if(d?.cartLinesAdd?.userErrors?.length){return j({error:d.cartLinesAdd.userErrors.map(x=>x.message).join("; ")},400)}',
  )
  .replace(
    'else{const d=await shop(q.create,{merchandiseId,quantity});cart=d?.cartCreate?.cart}',
    'else{const d=await shop(q.create,{merchandiseId,quantity});if(d?.cartCreate?.userErrors?.length)return j({error:d.cartCreate.userErrors.map(x=>x.message).join("; ")},400);cart=d?.cartCreate?.cart}',
  );

const injected = `${marker}${rwasOpsProxy}${rwasAnalytics}${rwasContactAligned}${rwasCartFixed}const rwasPath=rwasUrl.pathname.replace(/\\/$/,"");if(${JSON.stringify(
  gonePaths,
)}.includes(rwasPath))return new Response("Gone",{status:410,headers:{"Cache-Control":"public, max-age=3600","X-Robots-Tag":"noindex, noarchive"}});const rwasTarget=${JSON.stringify(
  redirects,
)}[rwasPath];if(rwasTarget)return Response.redirect(new URL(rwasTarget,t.url),301);`;

if (
  worker.includes('const rwasUrl=') &&
  worker.includes('const rwasPath=') &&
  worker.includes('rwas_analytics') &&
  worker.includes('pathname==="/api/contact"') &&
  worker.includes('pathname==="/api/cart"')
) {
  console.log('RWAS SEO edge rules already injected into Cloudflare worker.');
} else if (markerMatches.length !== 1) {
  throw new Error(
    `Expected one Cloudflare worker fetch marker in ${workerPath}; found ${markerMatches.length}`,
  );
} else {
  writeFileSync(workerPath, worker.replace(marker, injected));
  console.log(
    `Injected ${Object.keys(redirects).length} RWAS collection redirects and ${gonePaths.length} gone URL into Cloudflare worker.`,
  );
}
