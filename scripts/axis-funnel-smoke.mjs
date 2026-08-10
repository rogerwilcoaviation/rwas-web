import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contact = read('functions/api/contact.ts');
const form = read('components/shared/ContactForm.tsx');
const planner = read('components/shopify/AxisBuildPlanner.tsx');
const landing = read('app/axis-system-planner/page.tsx');
const sitemap = read('app/sitemap.ts');
const blog = JSON.parse(read('public/blog-articles.json'));
const axisArticle = blog.articles.find(
  (article) => article.id === 'build-your-garmin-axis-panel-with-rwas-20260807',
);

assert.match(contact, /'Idempotency-Key': requestId/);
assert.match(contact, /const emailSend = await sendViaResend/);
assert.match(contact, /sendToTeams\(env, payload, ticketId, requestId\)/);
assert.match(contact, /contact-form Teams send failed after email success/);
assert.match(contact, /aircraftStatus/);
assert.match(form, /legacy plain-string draft format/);
assert.match(form, /removeItem\('rwas-contact-draft'\)/);
assert.match(planner, /extendedPrice/);
assert.match(planner, /Garmin July 2026 Build-A-System Guide/);
assert.match(planner, /Submit Preliminary Build with Advisories/);
assert.match(landing, /Panel Layout Planner/);
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

console.log(
  'AXIS funnel smoke passed: delivery, validation, draft, landing, pricing, and publication contracts.',
);
