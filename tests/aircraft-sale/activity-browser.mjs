// Rendered production export + real in-memory log API. All private requests are
// intercepted; no production accounts, telemetry or listings are written.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fixture } from './fixture.mjs';
import { advisoryResearch } from './jerry-research-fixture.mjs';
import { ActivityLog } from '../../workers/aircraft-sale/activity-log.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const exported = resolve(
  process.env.TEST_EXPORT_DIR || '.vercel/output/static',
);
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || '/tmp/rwas-activity-browser',
);
await mkdir(artifacts, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (!extname(pathname)) pathname += '.html';
    const file = resolve(exported, '.' + pathname);
    assert.ok(file.startsWith(exported + '/'));
    const bytes = await readFile(file);
    res.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
        }[extname(file)] || 'application/octet-stream',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const local = 'http://127.0.0.1:' + server.address().port;
const origin =
  process.env.MARKETPLACE_ORIGIN || 'https://www.rogerwilcoaviation.com';
const browser = await chromium.launch({ headless: true });
const report = {
  scope:
    'Production UI assets with synthetic intercepted private APIs; no live writes.',
  admin: [],
  tracker: [],
  errors: [],
};
try {
  for (const width of [1440, 390]) {
    const f = fixture();
    Object.assign(f.env, {
      AUTH_REDIRECT_URI: origin + '/aircraft-for-sale',
      ACCOUNT_ADMIN_SITE_ORIGIN: origin,
      ACCOUNT_ADMIN_AUTH: {
        fetch: async () =>
          Response.json({
            actor: 'admin@example.test',
            scope: 'seller-accounts',
            expiresAt: Date.now() + 3600000,
            authenticatedAt: Date.now(),
          }),
      },
    });
    const log = new ActivityLog(f.ctx.storage);
    await log.append(
      Array.from({ length: 110 }, (_, n) => ({
        at: Date.now() - 100000 + n,
        requestId: crypto.randomUUID(),
        actor: {
          type: 'account',
          id: 'synthetic-owner-' + (n % 2),
          email: n % 2 ? 'other@example.test' : 'owner@example.test',
        },
        action: 'Synthetic listing review',
        route: '/admin/review',
        resourceId: 'listing-fixture',
        source: 'server',
        result: n % 3 ? 'success' : 'failure',
        status: n % 3 ? 200 : 409,
        durationMs: n + 1,
        details: { decision: 'approve', revision: n },
      })),
    );
    const johnSession = await f.login('john@halsted.team');
    const seeded = f.state(),
      john = Object.values(seeded.profiles).find(
        (profile) => profile.email === 'john@halsted.team',
      );
    john.jerryReview = {
      ...advisoryResearch,
      summary: 'Existing account recommendation for troubleshooting.',
    };
    await f.ctx.storage.put('state', seeded);
    const conversationId = crypto.randomUUID();
    await log.append([
      ...[0, 1].map((n) => ({
        at: Date.now(),
        requestId: crypto.randomUUID(),
        actor: { type: 'account', id: john.id, email: john.email },
        action: 'Jerry conversation',
        route: '/aircraft-for-sale',
        source: 'browser',
        result: 'success',
        status: 200,
        details: {
          conversation: {
            id: conversationId,
            mode: 'general',
            messages: [
              {
                role: 'user',
                content: n
                  ? 'What should I compare?'
                  : 'Can you help with this aircraft?',
              },
              {
                role: 'assistant',
                content: n
                  ? 'Compare hours, equipment and maintenance records.'
                  : 'Yes. Tell me about the aircraft.',
              },
            ],
          },
        },
      })),
      {
        at: Date.now(),
        requestId: crypto.randomUUID(),
        actor: { type: 'account', id: john.id, email: john.email },
        action: 'jerry.research',
        route: '/research',
        resourceId: john.id,
        source: 'system',
        result: 'success',
        details: {
          kind: 'account',
          review: advisoryResearch,
          reviewScope: 'historical-snapshot',
        },
      },
    ]);
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: 'block',
    });
    await context.addInitScript(() =>
      sessionStorage.setItem(
        'rwas_sale_v2',
        JSON.stringify({
          provider: 'better-auth',
          token: 'synthetic-business-session',
          csrf: 'synthetic-csrf',
          email: 'admin@example.test',
          name: 'Synthetic Admin',
          identityUserId: 'synthetic-admin',
          identitySessionId: 'synthetic-identity-session',
        }),
      ),
    );
    let unavailable = false;
    const paths = [];
    await context.route('**/*', async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin !== origin) return route.abort();
      const json = (value, status = 200) =>
        route.fulfill({ status, json: value });
      if (url.pathname.startsWith('/api/aircraft-sale/')) {
        paths.push({ path: url.pathname, method: req.method() });
        if (url.pathname.endsWith('/identity/get-session'))
          return json({
            user: {
              id: 'synthetic-admin',
              email: 'admin@example.test',
              name: 'Synthetic Admin',
              emailVerified: true,
              role: 'admin',
            },
            session: {
              id: 'synthetic-identity-session',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          });
        if (url.pathname.endsWith('/auth/methods'))
          return json({
            methods: ['better-auth'],
            betterAuth: { providers: ['password', 'google'] },
            publicListings: true,
          });
        if (url.pathname.endsWith('/account/access'))
          return json({
            role: 'admin',
            profileId: 'synthetic-admin',
            canManageAdministrators: true,
          });
        if (
          url.pathname.includes('/staff/activity') ||
          url.pathname.endsWith('/activity')
        ) {
          if (unavailable && url.pathname.endsWith('/staff/activity'))
            return json(
              { error: 'Synthetic activity service unavailable.' },
              503,
            );
          const response = await f.call(
            url.pathname
              .replace('/api/aircraft-sale', '')
              .replace('/staff/', '/admin/') + url.search,
            req.method(),
            req.postData() ? JSON.parse(req.postData()) : undefined,
            url.pathname.includes('/staff/activity')
              ? 'synthetic-admin'
              : undefined,
            { Origin: origin },
          );
          return route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: await response.text(),
          });
        }
        return json({
          listings: [],
          accounts: [],
          tickets: [],
          methods: [],
          admins: [],
          role: 'admin',
          canManage: true,
        });
      }
      if (
        url.pathname.includes('/api/') ||
        url.pathname.startsWith('/cdn-cgi/')
      )
        return route.fulfill({ status: 204 });
      assert.equal(
        req.method(),
        'GET',
        'Only public assets leave this fixture',
      );
      if (process.env.MARKETPLACE_ORIGIN) return route.continue();
      return route.fulfill({
        response: await route.fetch({ url: local + url.pathname + url.search }),
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(origin + '/aircraft-for-sale');
    await page.getByRole('tab', { name: 'Activity log', exact: true }).click();
    const section = page.getByRole('region', {
      name: 'Aviation Exchange activity log',
    });
    await section
      .getByRole('cell', { name: 'Synthetic listing review', exact: false })
      .first()
      .waitFor();
    assert.equal(await section.locator('tbody tr').count(), 50);
    await section.getByRole('button', { name: 'Older events' }).click();
    await section.getByText('Page 2', { exact: true }).waitFor();
    await section.getByRole('button', { name: 'Newer events' }).click();
    await section.getByText('Page 1', { exact: true }).waitFor();
    await section
      .getByLabel('Search account, action or request ID')
      .fill('owner@example.test');
    await section.getByLabel('Result', { exact: true }).selectOption('failure');
    await section.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('.exchange-log tbody tr')
          ?.textContent.includes('owner@example.test') &&
        !document
          .querySelector('.exchange-log [role="status"]')
          ?.textContent.includes('Loading'),
    );
    assert.ok((await section.locator('tbody tr').count()) > 0);
    for (const row of await section.locator('tbody tr').allTextContents()) {
      assert.ok(row.includes('owner@example.test'));
      assert.ok(row.includes('failure'));
      assert.ok(row.includes('HTTP 409'));
    }
    await section.getByRole('button', { name: 'View details' }).first().click();
    await section.getByText('UTC timestamp', { exact: true }).waitFor();
    await section
      .getByLabel('Search account, action or request ID')
      .fill('nothing-matches');
    await section.getByRole('button', { name: 'Apply filters' }).click();
    await section.getByText('No activity matches these filters.').waitFor();
    unavailable = true;
    await section.getByRole('button', { name: 'Refresh log' }).click();
    await section.getByRole('alert').waitFor();
    assert.ok(
      (await section.getByRole('alert').textContent()).includes(
        'Synthetic activity service unavailable',
      ),
    );
    unavailable = false;
    await section.getByRole('button', { name: 'Clear filters' }).click();
    await section
      .getByRole('cell', { name: 'Synthetic listing review', exact: false })
      .first()
      .waitFor();
    await section
      .getByLabel('Event type', { exact: true })
      .selectOption('conversation');
    await section.getByRole('button', { name: 'Apply filters' }).click();
    await section
      .getByRole('button', { name: 'View conversation' })
      .first()
      .waitFor();
    await section
      .getByRole('button', { name: 'View conversation' })
      .first()
      .click();
    const transcript = section.getByRole('region', {
      name: 'Jerry conversation transcript',
    });
    await transcript
      .getByText('Can you help with this aircraft?', { exact: true })
      .waitFor();
    await transcript
      .getByText('Compare hours, equipment and maintenance records.', {
        exact: true,
      })
      .waitFor();
    assert.ok(
      (
        await section
          .getByRole('complementary', { name: 'Activity details' })
          .textContent()
      ).includes('john@halsted.team'),
    );
    await page.screenshot({
      path: resolve(artifacts, 'conversation-' + width + '.png'),
      fullPage: true,
    });
    await section
      .getByLabel('Event type', { exact: true })
      .selectOption('review');
    await section.getByRole('button', { name: 'Apply filters' }).click();
    await section
      .getByRole('button', { name: 'View recommendation' })
      .first()
      .click();
    await section
      .getByRole('region', { name: 'Jerry review recommendation' })
      .waitFor();
    await section
      .getByRole('region', { name: 'Jerry research and recommendation' })
      .waitFor();
    await page.screenshot({
      path: resolve(artifacts, 'recommendation-' + width + '.png'),
      fullPage: true,
    });
    await section
      .getByLabel('Search account, action or request ID')
      .fill('john@halsted.team');
    await section
      .getByRole('button', { name: 'Load existing Jerry reports' })
      .click();
    await section
      .getByRole('button', { name: 'View current recommendation' })
      .first()
      .click();
    await section
      .getByText('Existing account recommendation for troubleshooting.', {
        exact: true,
      })
      .waitFor();
    await section.getByRole('button', { name: 'Clear filters' }).click();
    await section
      .getByRole('cell', { name: 'Synthetic listing review', exact: false })
      .first()
      .waitFor();
    await page.screenshot({
      path: resolve(artifacts, 'activity-log-' + width + '.png'),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      'Wide table must scroll inside its container',
    );
    assert.ok(paths.some((r) => r.path.endsWith('/staff/activity')));
    report.admin.push({
      width,
      filters: 'passed',
      paging: 'passed',
      details: 'passed',
      empty: 'passed',
      retry: 'passed',
      overflow: 'passed',
      conversations: 'passed',
      reviewSnapshots: 'passed',
      existingReports: 'passed',
      verifiedAccount: 'john@halsted.team',
    });
    await context.close();
  }
  // Isolated tracker verifies scope and metadata without a customer account.
  const script = await readFile('public/aviation-exchange-activity.js', 'utf8');
  const context = await browser.newContext({ serviceWorkers: 'block' }),
    batches = [],
    conversations = [];
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === '/api/aircraft-sale/activity/conversation') {
      conversations.push(req.postDataJSON());
      return route.fulfill({ status: 202, json: { ok: true } });
    }
    if (url.pathname === '/api/aircraft-sale/activity') {
      batches.push(req.postDataJSON());
      return route.fulfill({ status: 202, json: { ok: true } });
    }
    if (
      url.pathname === '/api/chat' &&
      (req.postData() || '').includes('NETWORK-CHAT')
    )
      return route.abort();
    if (
      url.pathname === '/api/chat' &&
      (req.postData() || '').includes('STREAM-CHAT')
    )
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"token":"Here "}\ndata: {"token":"are details."}\ndata: {"done":true,"cleanReply":"Here are the details."}\n',
      });
    if (
      url.pathname === '/api/chat' &&
      (req.postData() || '').includes('Please compare')
    )
      return route.fulfill({
        status: 200,
        json: {
          reply: 'Check the hours and records. Data: compare like-for-like.',
        },
      });
    if (url.pathname === '/api/chat')
      return route.fulfill({
        status: 503,
        json: { error: 'PRIVATE-ERROR-MESSAGE' },
      });
    return route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><button>Save Draft</button><input type="password" id="private"><section class="listing-workflow" data-exchange-step="3"></section></body></html>',
    });
  });
  const page = await context.newPage();
  await page.goto(origin + '/services');
  await page.addScriptTag({ content: script });
  await page.waitForTimeout(1800);
  assert.equal(batches.length, 0);
  await page.goto(origin + '/aircraft-for-sale');
  await page.addScriptTag({ content: script });
  await page.locator('#private').fill('PRIVATE-PASSWORD');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.evaluate(async () => {
    await fetch('/api/chat', { method: 'POST', body: 'PRIVATE-MESSAGE' });
    document
      .querySelector('[data-exchange-step]')
      .setAttribute('data-exchange-step', '4');
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'PRIVATE-STACK-AND-ERROR' }),
    );
  });
  await page.waitForTimeout(1800);
  const events = batches.flatMap((b) => b.events);
  for (const action of [
    'page.view',
    'control.click',
    'field.change',
    'draft.step',
    'chat.request',
    'client.error',
  ])
    assert.ok(
      events.some((e) => e.action === action),
      action,
    );
  assert.ok(events.some((e) => e.control === 'save-draft'));
  assert.ok(events.some((e) => e.status === 503));
  assert.ok(!JSON.stringify(events).includes('PRIVATE-'));
  await page.evaluate(async () => {
    window.rwasSaleSession = {
      identityUserId: 'john-identity',
      token: 'fixture-only',
      csrf: 'fixture-csrf',
    };
    window.rwasSellerAuthReady = true;
    window.rwasSellerRequestHeaders = async () => ({
      Authorization: 'Bearer fixture-only',
      'X-RWAS-CSRF': 'fixture-csrf',
    });
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Please compare this listing' }],
      }),
    });
  });
  await page.waitForTimeout(1800);
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].user, 'Please compare this listing');
  assert.equal(
    conversations[0].assistant,
    'Check the hours and records. Data: compare like-for-like.',
  );
  assert.equal(conversations[0].accountRef, 'john-identity');
  assert.ok(!JSON.stringify(conversations).includes('fixture-only'));
  await page.evaluate(async () => {
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'NETWORK-CHAT question' }],
      }),
    }).catch(() => {});
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'STREAM-CHAT question' }],
      }),
    });
  });
  await page.waitForTimeout(1800);
  assert.equal(conversations.length, 3);
  assert.equal(
    conversations.find((turn) => turn.user === 'NETWORK-CHAT question').status,
    0,
  );
  assert.equal(
    conversations.find((turn) => turn.user === 'NETWORK-CHAT question')
      .assistant,
    '',
  );
  assert.equal(
    conversations.find((turn) => turn.user === 'STREAM-CHAT question')
      .assistant,
    'Here are the details.',
  );

  const before = batches.length;
  await page.evaluate(() => history.pushState(null, '', '/services'));
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.waitForTimeout(1800);
  assert.equal(
    batches.length,
    before,
    'Tracker must stop outside Aviation Exchange after navigation',
  );
  report.tracker.push({
    outsideScope: 'excluded',
    clientErrors: 'passed',
    draftSteps: 'passed',
    chatResults: 'passed',
    credentialsAndFormText: 'excluded',
    conversationCapture: 'passed',
    allPagesMarketplaceOnly: events.every((e) =>
      e.page.startsWith('/aircraft-for-sale'),
    ),
  });
  await context.close();
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await writeFile(
    resolve(artifacts, 'report.json'),
    JSON.stringify(report, null, 2),
  );
}
