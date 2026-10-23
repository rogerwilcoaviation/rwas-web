import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve, relative } from 'node:path';
import postcss from 'postcss';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const exported = resolve(process.env.TEST_EXPORT_DIR || 'out');
const artifacts = resolve(
  process.env.TEST_ARTIFACT_DIR || '/tmp/rwas-site-typography',
);
await mkdir(artifacts, { recursive: true });
const cssPolicies = new Map();
let exportDocumentsChecked = 0;
const nextErrorBootstraps = [];
const providerDiagnostics = [];
async function verifyExport(directory) {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory() && file.name !== '_next') await verifyExport(path);
    else if (file.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      if (!/<head\b/i.test(html)) continue;
      if (relative(exported, path).startsWith('cdn-cgi/')) {
        providerDiagnostics.push(relative(exported, path));
        continue;
      }
      if (/<html[^>]+id="__next_error__"/.test(html)) {
        nextErrorBootstraps.push(relative(exported, path));
        continue;
      }
      const stylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
        .filter(([tag]) => /rel=["']stylesheet["']/.test(tag))
        .map(([tag]) => tag.match(/href=["']([^"']+)["']/)?.[1])
        .filter((href) => href?.startsWith('/'));
      let hasPolicy = false;
      for (const href of stylesheets) {
        if (!cssPolicies.has(href)) {
          const css = postcss.parse(
            await readFile(join(exported, href.split('?')[0]), 'utf8'),
          );
          let found = false;
          css.walkRules((rule) => {
            if (
              !rule.selector
                .split(',')
                .some((selector) => selector.trim() === 'body *')
            )
              return;
            rule.walkDecls('font-family', (declaration) => {
              if (
                declaration.important &&
                /^Arial,\s*sans-serif$/.test(declaration.value)
              )
                found = true;
            });
          });
          cssPolicies.set(href, found);
        }
        if (cssPolicies.get(href)) hasPolicy = true;
      }
      assert.ok(
        hasPolicy,
        relative(exported, path) + ': shared Arial policy must be linked',
      );
      assert.ok(
        !/<link[^>]+as=["']font["']/.test(html),
        'No retired Google font preload: ' + path,
      );
      exportDocumentsChecked++;
    }
  }
}
await verifyExport(exported);

const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      exported,
      '.' +
        decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
    );
    assert.ok(file === exported || file.startsWith(exported + '/'));
    if ((await stat(file).catch(() => null))?.isDirectory()) {
      const index = join(file, 'index.html');
      file = (await stat(index).catch(() => null)) ? index : file + '.html';
    } else if (!extname(file))
      file += request.headers.rsc === '1' ? '.txt' : '.html';
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.txt': 'text/x-component',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.webp': 'image/webp',
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
  process.env.TYPOGRAPHY_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const product = (await readdir(join(exported, 'products'))).find((name) =>
  name.endsWith('.html'),
);
const article = (await readdir(join(exported, 'blog'))).find((name) =>
  name.endsWith('.html'),
);
const pages = [
  '/',
  '/about',
  '/contact',
  '/services',
  '/services/custom-printing-finishing',
  '/services/custom-printing-finishing/uv-printing',
  '/financing',
  '/collections',
  '/collections/garmin-dealer-install',
  '/products/' + product.replace('.html', ''),
  '/blog',
  '/blog/' + article.replace('.html', ''),
  '/axis-system-planner',
  '/axis-system-planner/certified',
  '/panel-planner',
  '/cart',
  '/aircraft-for-sale',
  '/seller-review',
  '/seller-accounts',
  '/work-order-system/',
  '/404.html',
];
const standalone = [];
async function publicHtml(directory) {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    if (file.isDirectory()) await publicHtml(join(directory, file.name));
    else if (file.name.endsWith('.html')) {
      const path = join(directory, file.name);
      if (/<head\b/i.test(await readFile(path, 'utf8')))
        standalone.push('/' + relative(resolve('public'), path));
    }
  }
}
await publicHtml(resolve('public'));
const report = {
  origin,
  source: process.env.TYPOGRAPHY_ORIGIN
    ? 'Live production assets with intercepted API responses'
    : 'Actual local Next export and standalone tools',
  exportDocumentsChecked,
  nextErrorBootstraps,
  providerDiagnostics,
  pages: [],
  blocked: [],
  pageErrors: [],
  failures: [],
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || request.resourceType() === 'media') {
      report.blocked.push(url.origin + url.pathname);
      return route.abort();
    }
    if (url.pathname === '/api/aircraft-sale/auth/methods')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          methods: ['better-auth'],
          betterAuth: { providers: ['password'], legacyLink: false },
        },
      });
    if (url.pathname === '/api/aircraft-sale/browse')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: { listings: [] },
      });
    if (
      url.pathname.includes('/api/') ||
      url.pathname.startsWith('/rwas-ops-api') ||
      url.pathname === '/cdn-cgi/rum'
    )
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        json: { error: 'Unavailable in the read-only typography fixture' },
      });
    assert.equal(
      request.method(),
      'GET',
      'Typography checks never submit a form',
    );
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  async function inspect(path, width, checkOverflow) {
    await page.setViewportSize({ width, height: 1000 });
    const target =
      process.env.TYPOGRAPHY_ORIGIN && path === '/404.html'
        ? '/typography-missing-20261022'
        : path;
    const response = await page.goto(origin + target, { waitUntil: 'load' });
    assert.equal(
      response.status(),
      process.env.TYPOGRAPHY_ORIGIN && path === '/404.html' ? 404 : 200,
      path,
    );
    await page.evaluate(() => document.fonts.ready);
    if (path === '/financing') {
      await page.getByText('$300.57', { exact: true }).waitFor();
      await page.locator('main input[type="number"]').first().fill('30000');
      await page.getByText('$601.14', { exact: true }).waitFor();
    }
    const result = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('body *')].filter(
        (element) => {
          if (
            !element.getClientRects().length ||
            getComputedStyle(element).visibility === 'hidden'
          )
            return false;
          return (
            ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(
              element.tagName,
            ) ||
            [...element.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
            )
          );
        },
      );
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        overflowElements: [...document.querySelectorAll('body *')]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return (
              box.width > 0 && (box.right > innerWidth + 1 || box.left < -1)
            );
          })
          .map((element) => ({
            tag: element.tagName,
            class: element.className?.toString(),
            text: element.textContent.trim().slice(0, 65),
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
          }))
          .slice(-15),
        textElements: elements.length,
        mediaOnly:
          elements.length === 0 && !!document.querySelector('video,canvas'),
        nonArial: elements
          .filter(
            (element) =>
              !/^Arial(?:,|$)/.test(getComputedStyle(element).fontFamily),
          )
          .map((element) => ({
            tag: element.tagName,
            text: element.textContent.trim().slice(0, 70),
            font: getComputedStyle(element).fontFamily,
          }))
          .slice(0, 20),
      };
    });
    report.pages.push({ path, width, ...result });
    assert.ok(
      result.textElements > 0 || result.mediaOnly,
      path + ': rendered text or media exists',
    );
    assert.deepEqual(
      result.nonArial,
      [],
      path + ': every visible text element and control uses Arial',
    );
    if (checkOverflow)
      assert.ok(
        result.documentWidth <= width + 1,
        `${path}: horizontal overflow at ${width}px (${result.documentWidth}px)`,
      );
    if (['/', '/contact', '/financing', '/work-order-system/'].includes(path))
      await page.screenshot({
        path: join(
          artifacts,
          `${path === '/' ? 'home' : path.replaceAll('/', '-')}-${width}.png`,
        ),
        fullPage: true,
      });
  }
  for (const width of [1440, 390, 320]) {
    for (const path of pages) {
      if (
        process.env.TYPOGRAPHY_ORIGIN &&
        ['/seller-review', '/seller-accounts'].includes(path)
      )
        continue;
      try {
        await inspect(path, width, true);
      } catch (error) {
        report.failures.push(error.message);
      }
    }
    for (const path of standalone) {
      try {
        await inspect(path, width, false);
      } catch (error) {
        report.failures.push(error.message);
      }
    }
  }
  await page.emulateMedia({ media: 'print' });
  for (const path of ['/', '/brochures/papa-alpha-tools/index.html']) {
    try {
      await inspect(path, 1440, false);
    } catch (error) {
      report.failures.push('Print: ' + error.message);
    }
  }
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await writeFile(
    join(artifacts, 'typography-results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    passed: report.passed,
    pagesChecked: report.pages.length,
    artifacts,
  }),
);
