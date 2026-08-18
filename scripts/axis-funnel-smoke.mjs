import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contact = read('functions/api/contact.ts');
const form = read('components/shared/ContactForm.tsx');
const planner = read('components/shopify/AxisBuildPlanner.tsx');
const certifiedCatalog = read('lib/gfc500-certified-catalog.ts');
const plannerData = read('lib/axis-planner-data.ts');
const landing = read('app/axis-system-planner/page.tsx');
const landingLink = read('components/shopify/AxisPlannerAttributedLink.tsx');
const edgeInjector = read('scripts/inject-cloudflare-collection-redirects.mjs');
const sitemap = read('app/sitemap.ts');
const blog = JSON.parse(read('public/blog-articles.json'));
const axisArticle = blog.articles.find(
  (article) => article.id === 'build-your-garmin-axis-panel-with-rwas-20260807',
);

assert.match(contact, /'Idempotency-Key': requestId/);
assert.match(contact, /const ticketId = requestId/);
assert.match(contact, /const emailSend = await sendViaResend/);
assert.match(contact, /sendToTeams\(env, payload, ticketId, requestId\)/);
assert.match(contact, /contact-form Teams send failed after email success/);
assert.match(contact, /aircraftStatus/);
assert.match(
  form,
  /aria-invalid=\{Boolean\(errors\.aircraftStatus\)\}/,
);
assert.match(
  read('app/contact.css'),
  /select\[aria-invalid='true'\]/,
);
assert.match(contact, /UTM campaign/);
assert.match(form, /legacy plain-string draft format/);
assert.match(form, /removeItem\('rwas-contact-draft'\)/);
assert.match(form, /ATTRIBUTION_KEYS\.map/);
assert.match(planner, /extendedPrice/);
assert.match(planner, /Garmin July 2026 Build-A-System Guide/);
assert.match(planner, /Submit Preliminary Build with Advisories/);
assert.match(planner, /Aircraft eligibility group/);
assert.match(planner, /GFC500_CERTIFIED_AIRCRAFT\.map/);
assert.match(planner, /gfcAircraft\.configurations\.map/);
assert.match(certifiedCatalog, /export const GFC500_CERTIFIED_AIRCRAFT/);
assert.match(certifiedCatalog, /label: 'Cessna 182'/);
assert.match(plannerData, /GFC 500X Autopilot/);
assert.equal((plannerData.match(/8D\|6420093-5\|969\|/g) || []).length, 2);
assert.equal((plannerData.match(/title: 'Panel Accessories'/g) || []).length, 2);
assert.match(plannerData, /CHRONOS CH93MAX/);
assert.match(plannerData, /22–32 VDC/);
assert.match(
  planner,
  /const requestId = `rwas_axis_\$\{Date\.now\(\)\.toString\(36\)\}/,
);
assert.doesNotMatch(planner, /setItem\('rwas-axis-request-id'/);
assert.match(landing, /Panel Layout Planner/);
assert.match(landing, /AxisPlannerAttributedLink/);
assert.match(landingLink, /searchParams\.get\('source'\) \|\| defaultSource/);
assert.match(landingLink, /utm_campaign/);
for (const runtimeField of [
  'Phone:',
  'Aircraft status:',
  'Serial Number:',
  'UTM campaign:',
  'componentLines',
  'idempotencyKey: requestId',
]) {
  assert.match(edgeInjector, new RegExp(runtimeField));
}
assert.match(sitemap, /'axis-system-planner'/);
assert.equal(
  axisArticle.social.facebook.post_id,
  '106057782039473_1042531901867348',
);
assert.equal(axisArticle.social.instagram.media_id, '17862655845658358');
assert.match(axisArticle.social.facebook.text, /source=facebook/);
assert.match(axisArticle.social.instagram.text, /source=instagram/);
assert.doesNotMatch(axisArticle.social.facebook.text, /completed build/i);
assert.doesNotMatch(axisArticle.social.instagram.text, /completed build/i);
assert.doesNotMatch(axisArticle.social.facebook.text, /read the full article/i);
assert.doesNotMatch(axisArticle.social.instagram.text, /read the article/i);
assert.match(
  axisArticle.body_markdown,
  /Registered-aircraft submissions also need the year, serial number, and N-number/,
);

const generatedWorkerUrl = new URL(
  '../.vercel/output/static/_worker.js/index.js',
  import.meta.url,
);
if (fs.existsSync(generatedWorkerUrl)) {
  const generatedWorker = fs.readFileSync(generatedWorkerUrl, 'utf8');
  assert.match(generatedWorker, /Idempotency-Key/);
  assert.match(generatedWorker, /Aircraft status:/);
  assert.match(generatedWorker, /Selected equipment:/);
  assert.match(generatedWorker, /UTM campaign:/);
}

const runtimeMatch = edgeInjector.match(
  /const rwasContactAligned = `([\s\S]*?)`;\n\n\/\/ Keep/,
);
assert.ok(
  runtimeMatch,
  'Cloudflare contact runtime source must be extractable.',
);
const runtimeSource = Function(`return \`${runtimeMatch[1]}\`;`)();
const runContactRuntime = Function(
  't',
  'e',
  'rwasUrl',
  `return (async () => {${runtimeSource}})();`,
);
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const runtimeErrors = [];
const resendRequests = [];
const teamsRequests = [];
let resendStatus = 200;
let customerResendStatus = 200;
let teamsStatus = 200;

globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes('api.resend.com')) {
    resendRequests.push(init);
    const status = String(init.headers['Idempotency-Key']).endsWith('_customer')
      ? customerResendStatus
      : resendStatus;
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status,
    });
  }
  if (target.includes('teamsbot.rwas.team')) {
    teamsRequests.push(init);
    return new Response(null, { status: teamsStatus });
  }
  throw new Error(`Unexpected runtime fetch: ${target}`);
};
console.error = (...args) => runtimeErrors.push(args);

const invokeRuntime = async (payload) => {
  const request = new Request(
    'https://www.rogerwilcoaviation.com/api/contact',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return runContactRuntime(
    request,
    { RESEND_API_KEY: 'test-resend', TEAMS_RELAY_TOKEN: 'test-teams' },
    new URL(request.url),
  );
};

try {
  const registeredBuild = {
    requestId: 'rwas_axis_registered_001',
    name: 'Test Pilot',
    email: 'pilot@example.com',
    phone: '605-555-0100',
    reason: 'quote',
    product: 'AXIS Certified System Build',
    aircraftYear: '1980',
    aircraftMake: 'Cessna',
    aircraftModel: 'R182',
    aircraftSerialNumber: 'R182-001',
    nNumber: 'N12345',
    aircraftStatus: 'registered',
    plannerKind: 'certified',
    source: 'facebook',
    utm_campaign: 'axis-launch',
    message: 'Please review this preliminary certified AXIS build.',
    components: [
      {
        title: 'AXIS Display',
        sku: 'TEST-001',
        quantity: 1,
        unitPrice: 1000,
        extendedPrice: 1000,
      },
    ],
    advisories: ['Confirm the installation kit.'],
  };
  const firstResponse = await invokeRuntime(registeredBuild);
  const retryResponse = await invokeRuntime(registeredBuild);
  assert.equal(firstResponse.status, 200);
  assert.equal(retryResponse.status, 200);
  assert.equal(
    resendRequests[0].headers['Idempotency-Key'],
    registeredBuild.requestId,
  );
  assert.equal(
    resendRequests[1].headers['Idempotency-Key'],
    `${registeredBuild.requestId}_customer`,
  );
  assert.equal(resendRequests[0].body, resendRequests[2].body);
  assert.equal(resendRequests[1].body, resendRequests[3].body);
  const customerReceipt = JSON.parse(resendRequests[1].body);
  assert.deepEqual(customerReceipt.to, [registeredBuild.email]);
  assert.match(customerReceipt.subject, /Your RWAS AXIS preliminary build/);
  assert.match(customerReceipt.text, /Selected equipment/);
  for (const expected of [
    'Phone: 605-555-0100',
    'Aircraft: 1980 Cessna R182',
    'Serial Number: R182-001',
    'Aircraft status: registered',
    'UTM campaign: axis-launch',
    'Selected equipment:',
    'Confirm the installation kit.',
  ]) {
    assert.match(resendRequests[0].body, new RegExp(expected));
  }

  const embeddedInventoryResponse = await invokeRuntime({
    ...registeredBuild,
    requestId: 'rwas_axis_embedded_inventory_003',
    message:
      'AXIS Certified preliminary build handoff\n\n1 × AXIS Display (TEST-001) — $1,000\n\nPlanner advisories:\n- Confirm the installation kit.',
  });
  assert.equal(embeddedInventoryResponse.status, 200);
  const embeddedInventoryEmail = JSON.parse(resendRequests.at(-1).body);
  for (const representation of [
    embeddedInventoryEmail.text,
    embeddedInventoryEmail.html,
  ]) {
    assert.equal(
      (representation.match(/TEST-001/g) || []).length,
      1,
      'AXIS component inventory must appear once per email representation when already embedded in the planner message.',
    );
    assert.equal(
      (representation.match(/Confirm the installation kit\./g) || []).length,
      1,
      'AXIS advisories must appear once per email representation when already embedded in the planner message.',
    );
  }

  const experimentalResponse = await invokeRuntime({
    ...registeredBuild,
    requestId: 'rwas_axis_experimental_002',
    product: 'AXIS Experimental System Build',
    plannerKind: 'experimental',
    aircraftYear: '',
    aircraftMake: "Van's",
    aircraftModel: 'RV-10',
    aircraftSerialNumber: '',
    nNumber: '',
    aircraftStatus: 'under-construction',
  });
  assert.equal(experimentalResponse.status, 200);

  teamsStatus = 500;
  const teamsFailureResponse = await invokeRuntime({
    ...registeredBuild,
    requestId: 'rwas_axis_teams_failure_003',
  });
  assert.equal(teamsFailureResponse.status, 502);

  teamsStatus = 200;
  customerResendStatus = 500;
  const customerFailureResponse = await invokeRuntime({
    ...registeredBuild,
    requestId: 'rwas_axis_customer_failure_004',
  });
  assert.equal(customerFailureResponse.status, 502);

  customerResendStatus = 200;
  resendStatus = 500;
  const resendFailureResponse = await invokeRuntime({
    ...registeredBuild,
    requestId: 'rwas_axis_resend_failure_005',
  });
  assert.equal(resendFailureResponse.status, 502);
  assert.ok(teamsRequests.length >= 3);
  assert.ok(
    runtimeErrors.some(([message]) =>
      String(message).includes('Teams send failed after email success'),
    ),
  );
  assert.ok(
    runtimeErrors.some(([message]) =>
      String(message).includes('email send failed'),
    ),
  );
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}

console.log(
  'AXIS funnel smoke passed: delivery, validation, draft, landing, pricing, and publication contracts.',
);
