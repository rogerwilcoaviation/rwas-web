// Real exported UI, with all application APIs intercepted and disposable account data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fixture } from './fixture.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const exported = resolve(
  process.env.TEST_EXPORT_DIR || '.vercel/output/static',
);
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || '/tmp/rwas-marketplace-entry',
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
          '.svg': 'image/svg+xml',
          '.txt': 'text/x-component',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.woff2': 'font/woff2',
        }[extname(file)] || 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin =
  process.env.MARKETPLACE_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const report = {
  origin,
  scope:
    'Rendered marketplace with synthetic account APIs. No live sign-in, signup, emails, or listing operations.',
  checks: [],
  pageErrors: [],
};
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 320]) {
    for (const signedIn of [false, true]) {
      const f = fixture();
      f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
      const token = await f.login('marketplace@example.test');
      const now = new Date().toISOString();
      let active = signedIn;
      const identity = {
        user: {
          id: 'marketplace-user',
          email: 'marketplace@example.test',
          name: 'Synthetic User',
          emailVerified: true,
        },
        session: {
          id: 'marketplace-session',
          token: 'synthetic-identity',
          createdAt: now,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      };
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: 'block',
      });
      if (signedIn)
        await context.addInitScript(
          ({ token }) => {
            sessionStorage.setItem(
              'rwas_sale_v2',
              JSON.stringify({
                provider: 'better-auth',
                token,
                csrf: 'synthetic-csrf',
                email: 'marketplace@example.test',
                name: 'Synthetic User',
                identityUserId: 'marketplace-user',
                identitySessionId: 'marketplace-session',
              }),
            );
          },
          { token },
        );
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin || request.resourceType() === 'media')
          return route.abort();
        const json = (value) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            json: value,
          });
        if (url.pathname === '/api/aircraft-sale/auth/methods')
          return json({
            methods: ['better-auth'],
            betterAuth: { providers: ['password'], legacyLink: true },
            legacyMethods: ['password'],
          });
        if (url.pathname === '/api/aircraft-sale/browse')
          return json({ listings: [] });
        if (url.pathname === '/api/aircraft-sale/identity/get-session')
          return json(active ? identity : null);
        if (url.pathname === '/api/aircraft-sale/identity/sign-out') {
          active = false;
          return json({ success: true });
        }
        if (url.pathname.startsWith('/api/aircraft-sale/identity/'))
          throw Error('Unexpected identity operation: ' + url.pathname);
        if (url.pathname.startsWith('/api/aircraft-sale/')) {
          const response = await f.call(
            url.pathname.replace('/api/aircraft-sale', '') + url.search,
            request.method(),
            request.postData() ? JSON.parse(request.postData()) : undefined,
            token,
            { Origin: origin },
          );
          return route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: Buffer.from(await response.arrayBuffer()),
          });
        }
        if (
          url.pathname.includes('/api/') ||
          url.pathname.startsWith('/cdn-cgi/')
        )
          return route.fulfill({ status: 204 });
        assert.equal(
          request.method(),
          'GET',
          'Only public GET requests may leave the browser fixture',
        );
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(error.message));
      await page.goto(origin + '/aircraft-for-sale');
      const list = page.getByRole('button', {
        name: 'List Your Aircraft',
        exact: true,
      });
      const login = page.getByRole('button', {
        name: 'User Login',
        exact: true,
      });
      const signup = page.getByRole('button', {
        name: 'Create Account',
        exact: true,
      });
      await (signedIn ? list : login).waitFor();
      const body = await page.locator('main').innerText();
      assert.match(body, /aircraft or\s+aviation part/);
      assert.ok(body.includes('We do not vet seller'));
      assert.ok(!body.includes('vetted by a Part 145'));
      assert.equal(
        await page
          .getByRole('link', { name: 'Pre-Buy Inspection', exact: true })
          .count(),
        0,
      );
      const buttons = page.locator('.a4s-cta-row .a4s-cta-btn');
      const boxes = await buttons.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            height: box.height,
            font: getComputedStyle(element).fontFamily,
          };
        }),
      );
      for (const box of boxes) {
        assert.ok(box.x >= 0 && box.right <= width + 1 && box.height >= 44);
        assert.match(box.font, /^Arial(?:,|$)/);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          assert.ok(
            a.right <= b.x ||
              b.right <= a.x ||
              a.bottom <= b.y ||
              b.bottom <= a.y,
            'Account and browse controls do not overlap',
          );
        }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: resolve(
          artifacts,
          `marketplace-${width}-${signedIn ? 'signed-in' : 'signed-out'}.png`,
        ),
      });
      if (signedIn) {
        assert.equal(await login.count(), 0);
        assert.equal(await signup.count(), 0);
        await page
          .getByRole('button', { name: 'Sign Out', exact: true })
          .click();
        await login.waitFor();
        assert.equal(await list.count(), 0);
      } else {
        assert.equal(await list.count(), 0);
        await signup.click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Name', { exact: true }).waitFor();
        assert.equal(await dialog.getByText('Access an older RWAS account', { exact: true }).count(), 0);
        await dialog
          .getByRole('button', { name: 'Close seller panel', exact: true })
          .click();
        await login.click();
        await dialog
          .getByRole('button', { name: 'Sign in', exact: true })
          .waitFor();
        await dialog.getByText('Access an older RWAS account', { exact: true }).waitFor();
        assert.equal(await dialog.getByRole('button', { name: 'Older account: Email and password', exact: true }).isVisible(), false);
        assert.equal(
          await dialog.getByLabel('Name', { exact: true }).count(),
          0,
        );
        await dialog
          .getByRole('button', { name: 'Close seller panel', exact: true })
          .click();
      }
      report.checks.push({ width, signedIn, controls: boxes.length });
      await context.close();
    }
  }
  assert.deepEqual(report.pageErrors, []);
  await writeFile(
    resolve(artifacts, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: report.checks.length,
      pageErrors: report.pageErrors,
      artifacts,
    }),
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
