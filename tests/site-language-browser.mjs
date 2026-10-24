import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const fixtureServer = process.env.LANGUAGE_ORIGIN
  ? null
  : await (
      await import('./fixtures/site-language-server.mjs')
    ).languageServer();
const origin = process.env.LANGUAGE_ORIGIN || fixtureServer.origin;
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || '/tmp/rwas-language-release',
);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const width of process.env.LANGUAGE_REAL_ONLY === 'true'
    ? []
    : [1440, 390, 320]) {
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/api/aircraft-sale/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json: path.endsWith('/auth/methods')
          ? {
              methods: ['better-auth'],
              betterAuth: {
                providers: ['password', 'google'],
                legacyLink: false,
              },
            }
          : path.endsWith('/get-session')
            ? null
            : path.endsWith('/browse')
              ? { listings: [] }
              : {},
      });
    });
    await page.goto(origin + '/');
    await page.locator('[data-site-language-control]').waitFor();
    const initial = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        return el
          ? JSON.parse(JSON.stringify(el.getBoundingClientRect()))
          : null;
      };
      return {
        slot: rect('.site-language-slot'),
        credentials: rect('.bs-credentials'),
        phone: rect('a[href^="tel:"]'),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(initial.slot.y >= initial.credentials.bottom - 1);
    assert.equal(initial.overflow, false);
    assert.ok(initial.slot.y > 100);
    // Only the provider is simulated in this pass. Public catalog, real page structure,
    // preference persistence, dynamic dialogs, and client node updates are exercised.
    await page.route('**/_site-language/common.*.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({ response, json: { ...data, translations: {} } });
    });
    const entries = new Map();
    let posts = [];
    await page.route('**/api/site-language/catalog?*', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      for (const entry of data.entries) entries.set(entry.id, entry);
      if (data.commonPath) {
        const common = await (
          await page.request.get(origin + data.commonPath)
        ).json();
        for (const entry of common.entries) entries.set(entry.id, entry);
      }
      await route.fulfill({ response, json: data });
    });
    await page.route('**/api/site-language', async (route) => {
      const body = route.request().postDataJSON();
      posts.push(body);
      assert.deepEqual(Object.keys(body).sort(), ['ids', 'language', 'path']);
      assert.ok(body.ids.every((id) => entries.has(id)));
      await route.fulfill({
        json: {
          language: body.language,
          translations: Object.fromEntries(
            body.ids.map((id) => [
              id,
              body.language.toUpperCase() + ' • ' + entries.get(id).text,
            ]),
          ),
        },
      });
    });
    const heading = await page.locator('h1').first().textContent();
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-site-language-control] [role="status"]')
          ?.textContent === 'Traducción automática',
    );
    assert.match(await page.locator('h1').first().textContent(), /^ES • /);
    assert.equal(await page.locator('html').getAttribute('lang'), 'es');
    if (width >= 1000) {
      await page.locator('a[href="/services"]:visible').first().click();
      await page.waitForURL('**/services');
    } else await page.goto(origin + '/services');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-site-language-control] [role="status"]')
          ?.textContent === 'Traducción automática',
    );
    assert.match(await page.locator('h1').first().textContent(), /^ES • /);
    await page.reload();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-site-language-control] [role="status"]')
          ?.textContent === 'Traducción automática',
    );
    assert.equal(
      await page.locator('button[lang="es"]').getAttribute('aria-pressed'),
      'true',
    );
    const product = (
      await readdir(resolve('.vercel/output/static/products'))
    ).find((name) => name.endsWith('.html'));
    for (const path of [
      '/products/' + product.replace('.html', ''),
      '/pt-br',
      '/es',
      '/newspaper/index.html',
    ]) {
      await page.goto(origin + path);
      await page.waitForFunction(
        () =>
          document.querySelector('[data-site-language-control] [role="status"]')
            ?.textContent === 'Traducción automática',
      );
      assert.equal(await page.locator('html').getAttribute('lang'), 'es');
      assert.equal(
        await page.locator('[data-site-language-control]').count(),
        1,
      );
      if (path === '/newspaper/index.html') {
        // This archived page already has a fixed-width masthead. The added
        // language row must fit independently of that pre-existing content.
        const bar = await page.locator('.site-language-slot').boundingBox();
        assert.ok(bar.x + bar.width <= width + 1);
      } else
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          width + 'px ' + path,
        );
    }
    await page.goto(origin + '/aircraft-for-sale');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-site-language-control] [role="status"]')
          ?.textContent === 'Traducción automática',
    );
    const login = page
      .locator('button')
      .filter({ hasText: /User Login/ })
      .first();
    await login.click();
    await page.locator('input[type="email"]').first().waitFor();
    await page
      .locator('input[type="email"]')
      .first()
      .fill('private-seller@example.test');
    await page.evaluate(() => {
      localStorage.setItem('rwas-language', 'pt-BR');
      window.dispatchEvent(
        new CustomEvent('rwas:language-changed', {
          detail: { language: 'pt-BR' },
        }),
      );
    });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-site-language-control] [role="status"]')
          ?.textContent === 'Tradução automática',
    );
    assert.equal(
      await page.locator('input[type="email"]').first().inputValue(),
      'private-seller@example.test',
    );
    assert.doesNotMatch(JSON.stringify(posts), /private-seller/);
    await page.evaluate(() => {
      localStorage.setItem('rwas-language', 'en');
      window.dispatchEvent(
        new CustomEvent('rwas:language-changed', {
          detail: { language: 'en' },
        }),
      );
    });
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(
      await page.locator('input[type="email"]').first().inputValue(),
      'private-seller@example.test',
    );
    await page.goto(origin + '/');
    await page.locator('[data-site-language-control]').waitFor();
    assert.equal(await page.locator('h1').first().textContent(), heading);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: artifacts + '/home-' + width + '.png',
      fullPage: false,
    });
    report.push({
      width,
      position: initial,
      requests: posts.length,
      passed: true,
    });
    await context.close();
  }
  // Actual provider pass, without route mocks. Covers both languages and full reload.
  if (process.env.LANGUAGE_LIVE_AI === 'true') {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    for (const language of ['es', 'pt-BR']) {
      await page.goto(origin + '/');
      await page.locator('[data-site-language-control]').waitFor();
      const start = Date.now();
      await page
        .getByRole('button', {
          name: language === 'es' ? 'Español' : 'Português do Brasil',
          exact: true,
        })
        .click();
      await page.waitForFunction(
        () =>
          /^(Traducción automática|Tradução automática)$/.test(
            document.querySelector(
              '[data-site-language-control] [role="status"]',
            )?.textContent || '',
          ),
        {},
        { timeout: 180000 },
      );
      const text = await page.locator('body').innerText();
      assert.match(
        text,
        language === 'es'
          ? /servicio|Servicios|aeronaves|Mantenimiento/i
          : /serviço|Serviços|aeronaves|Manutenção/i,
      );
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      await page.screenshot({
        path: artifacts + '/live-home-' + language + '.png',
        fullPage: false,
      });
      report.push({
        language,
        realProvider: true,
        seconds: (Date.now() - start) / 1000,
        heading: await page.locator('h1').first().innerText(),
      });
      await page.goto(origin + '/services');
      await page.waitForFunction(
        () =>
          /^(Traducción automática|Tradução automática)$/.test(
            document.querySelector(
              '[data-site-language-control] [role="status"]',
            )?.textContent || '',
          ),
        {},
        { timeout: 120000 },
      );
      await page.goto(origin + '/contact');
      await page.waitForFunction(
        () =>
          /^(Traducción automática|Tradução automática)$/.test(
            document.querySelector(
              '[data-site-language-control] [role="status"]',
            )?.textContent || '',
          ),
        {},
        { timeout: 180000 },
      );
      assert.equal(await page.locator('html').getAttribute('lang'), language);
    }
    await context.close();
  }
  await writeFile(
    artifacts + '/browser-report.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await fixtureServer?.close();
}
