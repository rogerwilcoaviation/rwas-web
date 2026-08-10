# Avionics Customer Journey Webpage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an accessible cinematic RWAS webpage that explains the real avionics upgrade journey, routes customers into Panel Planner or standardized discovery intake, and makes no unsupported authority, price, schedule, or RTS promise.

**Architecture:** Build a new server-rendered Next.js route from a typed content model, with a small client component only for optional expandable detail. Reuse existing RWAS-owned imagery and the current broadsheet shell, then forward qualified avionics intake from the existing Cloudflare contact function into the RWAS Ops shadow intake endpoint without making the website submission dependent on that secondary handoff.

**Tech Stack:** Next.js App Router, React, TypeScript, Cloudflare Pages Functions, existing broadsheet CSS, Zod/react-hook-form, Node smoke scripts

## Global Constraints

- Primary location copy is `KYKN · Yankton, South Dakota`; do not reference Sioux Falls or KFSD.
- The page is manufacturer-neutral; Garmin is an example and delivery supplement where applicable.
- Concepts are planning sketches, not approved configurations, fabrication authority, installation data, or quotes.
- RSM/QCM, Operations Specifications, Capability List, Forms Manual, Training Program, qualified personnel, and current technical data govern repair-station work.
- QuantumMX and required controlled continuity records remain authoritative until a separately approved controlled cutover.
- No additional billable work proceeds without documented customer approval.
- Payment copy uses generic proposal, equipment/parts-or-progress, and final-delivery milestones; no percentages or exact terms.
- No duration, warranty, eligibility, or installation promise is generated from customer form data.
- `Return to Service Complete` is described only as an authorized post-inspection action.
- Existing untracked repository files and backup files are not modified or committed.

---

## File Structure

- `data/avionicsJourney.ts` — typed public copy for eight cinematic scenes, ten detailed phases, CTA destinations, and authority disclaimer.
- `components/journey/AvionicsJourney.tsx` — semantic server-rendered page body.
- `components/journey/JourneyDetails.tsx` — progressively enhanced expandable two-lane detail.
- `app/avionics-upgrade-process/page.tsx` — metadata, JSON-LD, broadsheet shell, and page composition.
- `app/avionics-upgrade-process/page.css` — cinematic layout, reduced-motion, focus, and responsive behavior.
- `components/shared/ContactForm.tsx` — avionics-upgrade reason and optional mission fields.
- `functions/api/contact.ts` — validates the expanded payload, preserves email/Teams routing, and performs idempotent shadow intake handoff.
- `components/shared/broadsheet/BroadsheetNav.tsx` — adds `How It Works` without removing existing routes.
- `app/page.tsx` — adds a homepage pathway into the journey.
- `app/panel-planner/page.tsx` — adds the concept-to-project next step.
- `app/sitemap.ts` — includes the route.
- `scripts/avionics-journey-smoke.mjs` — source, build, copy, location, and CTA checks.
- `scripts/seo-smoke-check.mjs` — adds production route metadata/canonical checks.
- `package.json` — adds `journey:smoke`.

### Task 1: Typed Public Narrative and Copy Guardrails

**Files:**
- Create: `data/avionicsJourney.ts`
- Create: `scripts/avionics-journey-smoke.mjs`
- Modify: `package.json:scripts`

**Interfaces:**
- Consumes: approved eight-scene public narrative and ten-phase detailed lifecycle.
- Produces: `AVIONICS_JOURNEY_SCENES`, `AVIONICS_JOURNEY_PHASES`, `AVIONICS_JOURNEY_CTA`, and `AVIONICS_AUTHORITY_NOTE`.

- [ ] **Step 1: Write the failing content smoke test**

```js
assert.equal(AVIONICS_JOURNEY_SCENES.length, 8);
assert.equal(AVIONICS_JOURNEY_PHASES.length, 10);
assert.equal(AVIONICS_JOURNEY_CTA.primary.href, 'https://panelplanner.rwas.team/customer');
assert.equal(AVIONICS_JOURNEY_CTA.secondary.href, '/contact?reason=avionics-upgrade&source=avionics-journey');
assert.ok(AVIONICS_AUTHORITY_NOTE.includes('authorized return-to-service'));
```

- [ ] **Step 2: Run and verify the content module is absent**

Run: `node scripts/avionics-journey-smoke.mjs --content`

Expected: FAIL with module-not-found for `data/avionicsJourney.ts`.

- [ ] **Step 3: Implement the typed content model**

```ts
export type JourneyScene = {
  id: 'vision' | 'imagine' | 'design' | 'approve' | 'prepare' | 'build' | 'verify' | 'supported';
  eyebrow: string;
  title: string;
  promise: string;
  detail: string;
  media: { src: string; alt: string; kind: 'image' | 'video' };
};
```

Use only existing RWAS assets: `/newspaper/images/r182_panel.webp`, `/newspaper/images/n5171s_panel.webp`, `/images/blog/panel-planner-r182-concept-tool.jpg`, `/images/blog/custom-uv-printed-aircraft-panels/carbon-fiber-aluminum-sample.jpg`, and `/videos/social/rwas-panel-fabrication-9x16-safe-20260806.mp4`. Every scene must include final customer copy, not internal notes.

- [ ] **Step 4: Add forbidden-copy scanning**

```js
for (const forbidden of ['Sioux Falls', 'KFSD', 'guaranteed schedule', 'automatic RTS', 'FAA approved workflow']) {
  assert.equal(JSON.stringify({ AVIONICS_JOURNEY_SCENES, AVIONICS_JOURNEY_PHASES }).includes(forbidden), false);
}
```

Run: `node scripts/avionics-journey-smoke.mjs --content`

Expected: PASS with eight scenes, ten phases, correct CTAs, and zero forbidden terms.

- [ ] **Step 5: Commit the narrative model**

```bash
git add data/avionicsJourney.ts scripts/avionics-journey-smoke.mjs package.json
git commit -m "feat: define avionics journey public narrative"
```

### Task 2: Cinematic, Server-Rendered Journey Page

**Files:**
- Create: `components/journey/AvionicsJourney.tsx`
- Create: `components/journey/JourneyDetails.tsx`
- Create: `app/avionics-upgrade-process/page.tsx`
- Create: `app/avionics-upgrade-process/page.css`
- Modify: `scripts/avionics-journey-smoke.mjs`

**Interfaces:**
- Consumes: typed content model and existing broadsheet layout components.
- Produces: `/avionics-upgrade-process` with eight narrative scenes, ten accessible details, three CTAs, and a controlled-process explanation.

- [ ] **Step 1: Add failing page structure assertions**

```js
for (const text of [
  'From Vision to Flight', 'Imagine', 'Design', 'Approve', 'Prepare',
  'Build', 'Verify and Fly', 'Supported', 'Controlled From Start to Finish',
]) assert.ok(pageSource.includes(text));
assert.ok(pageSource.includes('<h1'));
assert.ok(pageSource.includes('prefers-reduced-motion'));
```

- [ ] **Step 2: Run the page smoke and verify the route is missing**

Run: `node scripts/avionics-journey-smoke.mjs --page`

Expected: FAIL because `app/avionics-upgrade-process/page.tsx` does not exist.

- [ ] **Step 3: Implement semantic page composition**

```tsx
export default function AvionicsUpgradeProcessPage() {
  return <BroadsheetLayout>
    <Dateline /><Masthead />
    <BroadsheetNav activeHref="/avionics-upgrade-process" />
    <CredentialsBar /><BulletinBar />
    <main id="main-content" className="journey-page">
      <AvionicsJourney />
    </main>
    <BroadsheetFooter />
  </BroadsheetLayout>;
}
```

Use a single `<h1>`, ordered phase navigation, true headings, descriptive CTA text, and native `<details>/<summary>` for the two-lane depth so content remains usable without client JavaScript.

- [ ] **Step 4: Implement cinematic styling without motion dependency**

```css
.journey-scene { min-height: min(78vh, 820px); display: grid; align-items: end; }
.journey-scene__media { object-fit: cover; }
@media (prefers-reduced-motion: reduce) {
  .journey-scene, .journey-scene * { animation: none !important; transition: none !important; }
}
```

Maintain readable contrast over media with an opaque gradient, keep body copy at least 16px, support 320px through desktop, and provide visible keyboard focus.

- [ ] **Step 5: Build and verify server-rendered copy**

Run: `npm run lint && npm run build && node scripts/avionics-journey-smoke.mjs --page`

Expected: lint/build pass and built HTML contains the headline, scene headings, authority note, and CTAs before client JavaScript.

- [ ] **Step 6: Commit the page**

```bash
git add components/journey/AvionicsJourney.tsx components/journey/JourneyDetails.tsx app/avionics-upgrade-process/page.tsx app/avionics-upgrade-process/page.css scripts/avionics-journey-smoke.mjs
git commit -m "feat: add cinematic avionics customer journey page"
```

### Task 3: Standardized Avionics Discovery Intake

**Files:**
- Modify: `components/shared/ContactForm.tsx:54-104,135-163,182-219,265-520`
- Modify: `functions/api/contact.ts:30-68,138-209,211-342,345-430`
- Modify: `app/contact.css`
- Modify: `scripts/avionics-journey-smoke.mjs`

**Interfaces:**
- Consumes: `reason=avionics-upgrade`, source attribution, optional Panel Planner URL, existing Turnstile/Resend/Teams flow, and RWAS Ops `/v1/avionics-lifecycle/intake`.
- Produces: validated discovery fields and best-effort idempotent Ops shadow intake keyed by the website ticket ID.

- [ ] **Step 1: Add failing intake-schema assertions**

```js
for (const field of ['missionSummary', 'currentPainPoints', 'mustHaveCapabilities', 'desiredTiming', 'panelPlannerUrl']) {
  assert.ok(contactSource.includes(field));
  assert.ok(functionSource.includes(field));
}
assert.ok(functionSource.includes('RWAS_OPS_API_URL'));
assert.ok(functionSource.includes('RWAS_OPS_INTAKE_TOKEN'));
```

- [ ] **Step 2: Run and verify the fields are absent**

Run: `node scripts/avionics-journey-smoke.mjs --intake`

Expected: FAIL on `missionSummary`.

- [ ] **Step 3: Add the conditional customer fields**

```ts
reason: z.enum(['quote', 'general', 'service', 'papa-alpha', 'aircraft-sales', 'avionics-upgrade']),
missionSummary: z.string().max(1000).optional().or(z.literal('')),
currentPainPoints: z.string().max(1000).optional().or(z.literal('')),
mustHaveCapabilities: z.string().max(1000).optional().or(z.literal('')),
desiredTiming: z.string().max(240).optional().or(z.literal('')),
panelPlannerUrl: z.string().url().max(500).optional().or(z.literal('')),
```

Show these fields only for `avionics-upgrade`. Keep budget optional and free-text if later added; do not introduce fixed budget brackets in this plan. Explain that submitted concepts remain subject to RWAS review.

- [ ] **Step 4: Forward the normalized intake after primary contact delivery**

```ts
async function sendToOpsShadow(env: Env, payload: ContactPayload, ticketId: string) {
  if (!env.RWAS_OPS_API_URL || !env.RWAS_OPS_INTAKE_TOKEN) return { ok: false, skipped: true };
  return fetch(`${env.RWAS_OPS_API_URL}/v1/avionics-lifecycle/intake`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.RWAS_OPS_INTAKE_TOKEN}`,
      'idempotency-key': ticketId,
    },
    body: JSON.stringify(normalizeAvionicsIntake(payload, ticketId)),
  });
}
```

Attempt this only after Resend succeeds. If the Ops bridge fails, still return the successful website ticket and log a non-secret failure for staff follow-up; never expose tokens or internal errors to the customer.

- [ ] **Step 5: Verify validation, email continuity, and degraded bridge behavior**

Run: `npm run lint && npm run build && node scripts/avionics-journey-smoke.mjs --intake`

Expected: form and function schemas match, existing reasons still validate, missing Ops env does not break email/Teams submission, and the handoff uses the ticket ID as idempotency key.

- [ ] **Step 6: Commit the intake handoff**

```bash
git add components/shared/ContactForm.tsx functions/api/contact.ts app/contact.css scripts/avionics-journey-smoke.mjs
git commit -m "feat: add standardized avionics discovery intake"
```

### Task 4: Navigation, Panel Planner Handoff, and Homepage Path

**Files:**
- Modify: `components/shared/broadsheet/BroadsheetNav.tsx:14-26`
- Modify: `app/page.tsx`
- Modify: `app/panel-planner/page.tsx:118-211`
- Modify: `scripts/avionics-journey-smoke.mjs`

**Interfaces:**
- Consumes: the new page route and existing Panel Planner URL.
- Produces: discoverable entry points and consistent concept-to-reviewed-project copy.

- [ ] **Step 1: Add failing route-link assertions**

```js
assert.ok(navSource.includes("href: '/avionics-upgrade-process'"));
assert.ok(homeSource.includes('/avionics-upgrade-process'));
assert.ok(panelSource.includes('/avionics-upgrade-process'));
assert.ok(panelSource.includes('What happens after your concept'));
```

- [ ] **Step 2: Run and verify missing links**

Run: `node scripts/avionics-journey-smoke.mjs --links`

Expected: FAIL because the route is not in primary navigation.

- [ ] **Step 3: Add concise pathways without displacing store/service links**

```ts
{ href: '/avionics-upgrade-process', label: 'How It Works' },
```

Add a homepage feature linking to the journey and a Panel Planner section titled `What happens after your concept` that links to Design, Approve, Prepare, Build, Verify, Deliver, and Support. Preserve the existing concept disclaimer.

- [ ] **Step 4: Build and verify links**

Run: `npm run lint && npm run build && node scripts/avionics-journey-smoke.mjs --links`

Expected: all links resolve in the static build and existing Panel Planner CTAs remain unchanged.

- [ ] **Step 5: Commit discoverability**

```bash
git add components/shared/broadsheet/BroadsheetNav.tsx app/page.tsx app/panel-planner/page.tsx scripts/avionics-journey-smoke.mjs
git commit -m "feat: connect website to avionics customer journey"
```

### Task 5: SEO, Structured Data, and Public Regression Gate

**Files:**
- Modify: `app/avionics-upgrade-process/page.tsx`
- Modify: `app/sitemap.ts:11-36`
- Modify: `scripts/seo-smoke-check.mjs`
- Modify: `scripts/avionics-journey-smoke.mjs`

**Interfaces:**
- Consumes: final page copy and route URL.
- Produces: canonical metadata, Open Graph image, `Service`/`BreadcrumbList` JSON-LD, sitemap entry, and production smoke coverage.

- [ ] **Step 1: Add failing SEO checks**

```js
assert.equal(metadata.canonical, 'https://www.rogerwilcoaviation.com/avionics-upgrade-process');
assert.ok(pageSource.includes("'@type': 'Service'"));
assert.ok(pageSource.includes("'@type': 'BreadcrumbList'"));
assert.ok(sitemapSource.includes("'avionics-upgrade-process'"));
```

- [ ] **Step 2: Run and verify SEO checks fail**

Run: `npm run journey:smoke && npm run seo:smoke`

Expected: FAIL on missing sitemap/production route checks.

- [ ] **Step 3: Add metadata and truthful structured data**

```ts
export const metadata = genPageMetadata({
  title: 'Avionics Upgrades — From Vision to Flight at RWAS',
  description: 'See how RWAS at KYKN in Yankton turns an avionics vision into a reviewed plan, controlled installation, authorized return to service, delivery, training, and support.',
  canonical: 'https://www.rogerwilcoaviation.com/avionics-upgrade-process',
});
```

Use `Service` and `BreadcrumbList`; do not add ratings, prices, offers, durations, or policy structured data. Reference the organization `@id` already used by the site.

- [ ] **Step 4: Run local release checks**

Run: `npm run lint && npm run build:cloudflare && npm run journey:smoke`

Expected: lint, Cloudflare build, and journey checks pass.

- [ ] **Step 5: Deploy to preview and test customer paths**

Run: `npm run deploy:preview`

Expected: preview deployment succeeds. Manually verify desktop and 390px mobile: page load, reduced-motion behavior, all details controls, Panel Planner CTA, advisor CTA, intake validation, successful test submission without a real order, and browser back navigation.

- [ ] **Step 6: Run production-safe SEO smoke against preview URL**

Run: `RWAS_BASE_URL=https://preview.rwas-web.pages.dev npm run seo:smoke`

Expected: HTTP 200, one H1, canonical URL, metadata, Organization reference, and all three journey CTAs pass on the fixed Cloudflare Pages `preview` branch URL.

- [ ] **Step 7: Commit the release gate; do not publish production without final review**

```bash
git add app/avionics-upgrade-process/page.tsx app/sitemap.ts scripts/seo-smoke-check.mjs scripts/avionics-journey-smoke.mjs
git commit -m "test: gate avionics journey page release"
```

Production deployment is a separate explicit action after copy, controlled-process, accessibility, mobile, intake, and preview review.
