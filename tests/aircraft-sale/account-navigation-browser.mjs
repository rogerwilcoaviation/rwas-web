// Actual Next export, synthetic seller APIs, and no external browser traffic.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fixture } from './fixture.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const exported = resolve('out');
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || '/tmp/rwas-account-navigation',
);
await mkdir(artifacts, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    );
    if (!extname(path)) path += request.headers.rsc === '1' ? '.txt' : '.html';
    const file = resolve(exported, '.' + path);
    assert.ok(file.startsWith(exported + '/'));
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
          '.txt': 'text/x-component',
        }[extname(file)] || 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const f = fixture();
f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
const token = await f.login('navigation@example.test');
const now = new Date().toISOString();
const identity = {
  user: {
    id: 'navigation-user',
    email: 'navigation@example.test',
    name: 'Synthetic Seller',
    emailVerified: true,
    twoFactorEnabled: false,
  },
  session: {
    id: 'navigation-session',
    token: 'synthetic-private-identity-token',
    createdAt: now,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
};
const report = {
  scope:
    'Actual local Next export with synthetic seller and identity APIs. No hosted account, email, or security operation.',
  checks: [],
  pageErrors: [],
  consoleErrors: [],
  blocked: [],
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  });
  await context.addInitScript(
    ({ token }) => {
      sessionStorage.setItem(
        'rwas_sale_v2',
        JSON.stringify({
          provider: 'better-auth',
          token,
          csrf: 'synthetic-csrf',
          email: 'navigation@example.test',
          name: 'Synthetic Seller',
          identityUserId: 'navigation-user',
          identitySessionId: 'navigation-session',
        }),
      );
    },
    { token },
  );
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      report.blocked.push(url.origin);
      return route.abort();
    }
    if (['/api/track', '/api/rum'].includes(url.pathname))
      return route.fulfill({ status: 204 });
    const json = (value) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: value,
      });
    if (url.pathname === '/api/aircraft-sale/auth/methods')
      return json({
        methods: ['better-auth'],
        betterAuth: { providers: ['password'], legacyLink: false },
      });
    if (url.pathname === '/api/aircraft-sale/identity/get-session')
      return json(identity);
    if (url.pathname === '/api/aircraft-sale/identity/list-sessions')
      return json([identity.session]);
    if (url.pathname.startsWith('/api/aircraft-sale/identity/'))
      throw Error('Unexpected identity operation: ' + url.pathname);
    if (url.pathname.startsWith('/api/aircraft-sale/')) {
      const input = request.postData()
        ? JSON.parse(request.postData())
        : undefined;
      const response = await f.call(
        url.pathname.replace('/api/aircraft-sale', '') + url.search,
        request.method(),
        input,
        token,
        { Origin: origin },
      );
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.setDefaultTimeout(10000);
  await page.goto(origin + '/aircraft-for-sale');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const tabs = dialog.getByRole('tablist', { name: 'Account index' });
  const activePanel = dialog.getByRole('tabpanel');
  await activePanel
    .getByRole('heading', { name: 'Contact profile', exact: true })
    .waitFor();
  assert.equal(await activePanel.count(), 1);
  const indexBox = await tabs.boundingBox();
  const panelBox = await activePanel.boundingBox();
  assert.ok(
    indexBox.x + indexBox.width < panelBox.x,
    'Desktop index sits to the left of the main body',
  );
  await dialog.getByLabel('name', { exact: true }).fill('Unsaved contact name');
  const profileTab = tabs.getByRole('tab', {
    name: 'Contact profile',
    exact: true,
  });
  await profileTab.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(
    await tabs
      .getByRole('tab', { name: 'Contact email', exact: true })
      .getAttribute('aria-selected'),
    'true',
  );
  await activePanel
    .getByLabel('New email', { exact: true })
    .fill('unsaved@example.test');
  await page.keyboard.press('Shift+Tab');
  await profileTab.click();
  assert.equal(
    await activePanel.getByLabel('name', { exact: true }).inputValue(),
    'Unsaved contact name',
  );
  await tabs.getByRole('tab', { name: 'Contact email', exact: true }).click();
  assert.equal(
    await activePanel.getByLabel('New email', { exact: true }).inputValue(),
    'unsaved@example.test',
  );
  await tabs
    .getByRole('tab', { name: 'Sign-in and security', exact: true })
    .click();
  await activePanel
    .getByText('Sign-in email: navigation@example.test', { exact: true })
    .waitFor();
  await activePanel.getByLabel('Current password', { exact: true }).waitFor();
  await tabs
    .getByRole('tab', { name: 'Sign-in and security', exact: true })
    .focus();
  await page.keyboard.press('End');
  await activePanel
    .getByRole('heading', { name: 'Delete account', exact: true })
    .waitFor();
  await page.keyboard.press('Home');
  assert.equal(await profileTab.getAttribute('aria-selected'), 'true');
  report.checks.push(
    'Left index, one visible section, arrow/Home/End navigation, security content, and unsaved form preservation',
  );

  async function inspect(label) {
    const result = await dialog.evaluate((root) => ({
      width: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      dialogWidth: root.clientWidth,
      contentWidth: root.scrollWidth,
      fonts: [
        ...root.querySelectorAll(
          'h2,h3,h4,p,label,button,input,textarea,select',
        ),
      ]
        .filter((element) => element.getClientRects().length)
        .map((element) => ({
          text: element.textContent.trim().slice(0, 45),
          family: getComputedStyle(element).fontFamily,
        })),
    }));
    assert.ok(
      result.pageWidth <= result.width,
      label + ': no horizontal page overflow',
    );
    assert.ok(
      result.contentWidth <= result.dialogWidth + 1,
      label + ': no horizontal dialog overflow',
    );
    assert.ok(result.fonts.length > 5);
    assert.ok(
      result.fonts.every((font) => /^Arial(?:,|$)/.test(font.family)),
      JSON.stringify(result.fonts),
    );
    assert.equal(await activePanel.count(), 1);
    await dialog.screenshot({
      path: join(artifacts, `seller-account-${label}.png`),
    });
    report.checks.push({ label, ...result });
  }
  await inspect('desktop-profile');
  await tabs
    .getByRole('tab', { name: 'Sign-in and security', exact: true })
    .click();
  await inspect('desktop-security');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    'Contact profile',
    'Contact email',
    'Sign-in and security',
    'Active sessions',
    'Delete account',
  ]) {
    await tabs.getByRole('tab', { name, exact: true }).click();
    await inspect('mobile-' + name.toLowerCase().replaceAll(' ', '-'));
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await profileTab.click();
  await inspect('narrow-profile');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.passed = true;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await writeFile(
    join(artifacts, 'account-navigation-results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.checks.length,
    artifacts,
  }),
);
