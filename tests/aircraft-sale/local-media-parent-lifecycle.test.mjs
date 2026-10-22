import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { fixture, create, fields } from './fixture.mjs';

const { chromium } = await import(
  '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const preimage = process.env.PARENT_MEDIA_PREIMAGE === '1';
const panelPath = preimage
  ? resolve('../../media/source/app/aircraft-for-sale/seller-auth-panel.tsx')
  : resolve('app/aircraft-for-sale/seller-auth-panel.tsx');
const origin = 'http://127.0.0.1:43119';
const panelSource = await readFile(panelPath, 'utf8');
const photo = await readFile(
  new URL('./media-fixtures/synthetic.png', import.meta.url),
);
const report = {
  startedAt: new Date().toISOString(),
  status: 'RUNNING',
  preimage,
  source: {
    path: panelPath,
    sha256: createHash('sha256').update(panelSource).digest('hex'),
    compiled:
      'Full actual SellerAuthPanel, including its actual SellerMedia child; no replacement parent callback or state logic.',
  },
  scope:
    'Headless Chromium with disposable local SellerStore fixtures. Every browser request is intercepted; external requests are rejected. No provider, account, mail service, deployment or Recovery workflow.',
  cases: [],
  limits: [
    'The full TSX panel is bundled by esbuild, not the frozen Next.js export. The separate frozen-frontend reproduction establishes that artifact impact.',
    'Backend requests execute the actual isolated SellerStore source through its in-memory fixture; this is not hosted Worker/SQLite/R2 acceptance.',
    'A committed upload is intentionally retained on A. A unchanged means its server-committed listing record is not changed by saving B.',
    'Clerk method detection returns false locally; provider clients and provider panels throw if invoked. No provider path may execute.',
    'Both stopped Recovery tasks remain held. No Recovery/reset bridge is inspected or exercised.',
  ],
};

const bundle = (
  await build({
    stdin: {
      contents: `import React from 'react';
import { createRoot } from 'react-dom/client';
import SellerAuthPanel from ${JSON.stringify(panelPath)};
window.__providerCalls = [];
createRoot(document.querySelector('#root')).render(React.createElement(SellerAuthPanel));`,
      resolveDir: process.cwd(),
      sourcefile: 'local-full-seller-parent.tsx',
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: ['es2022'],
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION': '"false"',
    },
    plugins: [
      {
        name: 'forbid-unused-provider-paths',
        setup(builder) {
          builder.onResolve(
            { filter: /^\.\/clerk-production-browser$/ },
            () => ({
              path: 'browser',
              namespace: 'forbidden-provider',
            }),
          );
          builder.onResolve({ filter: /^\.\/clerk-production-panel$/ }, () => ({
            path: 'panel',
            namespace: 'forbidden-provider',
          }));
          builder.onLoad(
            { filter: /.*/, namespace: 'forbidden-provider' },
            ({ path }) => ({
              loader: 'js',
              contents:
                path === 'browser'
                  ? `const forbidden = () => { window.__providerCalls.push('client'); throw Error('Provider client forbidden in local parent test'); };
export const getClerkProductionBrowser = forbidden;
export const configureClerkProductionQaCohort = () => ({ qaOnly: false, email: null });
export const isClerkProductionMethodEnabled = () => false;
export const CLERK_PRODUCTION_ORIGIN = 'https://www.rogerwilcoaviation.com';`
                  : `const forbidden = () => { window.__providerCalls.push('panel'); throw Error('Provider panel forbidden in local parent test'); };
export default forbidden;
export const ClerkProductionAccountPanel = forbidden;
export const ClerkOwnerIdentityPanel = forbidden;`,
            }),
          );
        },
      },
    ],
  })
).outputFiles[0].text;

let browser;
const nativeFetch = globalThis.fetch;
test.before(async () => {
  globalThis.fetch = () => {
    throw Error('External Node fetch forbidden in local parent test');
  };
  browser = await chromium.launch({
    headless: true,
    args: ['--disable-background-networking'],
  });
});
test.after(async () => {
  await browser?.close();
  globalThis.fetch = nativeFetch;
  report.finishedAt = new Date().toISOString();
  report.status = report.cases.every((entry) => entry.status === 'PASS')
    ? 'PASS'
    : 'FAIL';
  await writeFile(
    resolve(
      preimage
        ? '../media-parent-preimage-results.json'
        : '../media-parent-lifecycle-results.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
});

async function setup(mode, evidence) {
  const f = fixture();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.AUTH_REDIRECT_URI = origin + '/aircraft-for-sale';
  const token = await f.login('parent-lifecycle@example.test');
  const a = await create(f, token, { ...fields, model: 'Race A' });
  const b = await create(f, token, { ...fields, model: 'Race B' });
  assert.ok(a.id && b.id);
  evidence.listingA = a.id;
  evidence.listingB = b.id;
  evidence.requests = [];
  evidence.externalBlocked = [];
  evidence.pageErrors = [];
  evidence.routeErrors = [];
  let release;
  let reached;
  let uploadCount = 0;
  let heldRead = false;
  let committedA;
  const gate = new Promise((done) => {
    release = done;
  });
  const barrier = new Promise((done) => {
    reached = done;
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    serviceWorkers: 'block',
  });
  await context.addInitScript(
    ({ token }) => {
      sessionStorage.setItem(
        'rwas_sale_v2',
        JSON.stringify({
          token,
          email: 'parent-lifecycle@example.test',
          name: '',
        }),
      );
    },
    { token },
  );
  await context.route('**/*', async (route) => {
    try {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        evidence.externalBlocked.push(url.href);
        return route.abort();
      }
      if (url.pathname === '/panel.js')
        return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (url.pathname === '/aircraft-for-sale')
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
        });
      if (!url.pathname.startsWith('/api/aircraft-sale/')) {
        evidence.routeErrors.push('Unexpected local path ' + url.pathname);
        return route.abort();
      }
      const bytes = request.postDataBuffer();
      const response = await f.call(
        url.pathname.replace('/api/aircraft-sale', '') + url.search,
        request.method(),
        bytes?.length ? new Uint8Array(bytes) : undefined,
        undefined,
        request.headers(),
      );
      const body = Buffer.from(await response.arrayBuffer());
      const entry = {
        method: request.method(),
        path: url.pathname,
        status: response.status,
        listingId: url.searchParams.get('listingId'),
        filename: url.searchParams.get('filename'),
      };
      evidence.requests.push(entry);
      if (url.pathname.endsWith('/upload')) {
        uploadCount++;
        if (uploadCount === 1) {
          committedA = structuredClone(f.state().listings[a.id]);
          evidence.acceptedUpload = {
            status: response.status,
            listingId: url.searchParams.get('listingId'),
            storedFiles: Object.values(f.state().files).filter(
              (file) => file.listingId === a.id,
            ).length,
          };
          if (mode === 'success' || mode === 'error') {
            reached();
            await gate;
            if (mode === 'error') {
              entry.transport = 'aborted-after-server-commit';
              return route.abort('failed');
            }
          }
        }
      }
      if (
        mode === 'readback' &&
        uploadCount > 0 &&
        !heldRead &&
        url.pathname.endsWith('/my-listings')
      ) {
        heldRead = true;
        evidence.readbackHeld = true;
        reached();
        await gate;
      }
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body,
      });
    } catch (error) {
      evidence.routeErrors.push(error.message);
      await route.abort().catch(() => {});
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  await page.goto(origin + '/aircraft-for-sale');
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await page
    .locator('dialog article')
    .filter({ hasText: 'Race A' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel('Add photos', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Model', { exact: true }).inputValue(),
    'Race A',
  );
  return {
    f,
    a,
    b,
    page,
    context,
    release,
    barrier,
    uploadCount: () => uploadCount,
    committedA: () => committedA,
  };
}

async function openOther(s) {
  await s.page
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await s.page
    .getByRole('button', { name: 'My Listings', exact: true })
    .click();
  await s.page
    .locator('dialog article')
    .filter({ hasText: 'Race B' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  assert.equal(
    await s.page.getByLabel('Model', { exact: true }).inputValue(),
    'Race B',
  );
  await s.page.getByLabel('Model', { exact: true }).fill('Race B edited');
  await s.page
    .getByRole('group', { name: 'Photos (0)', exact: true })
    .waitFor();
}

async function saveAndProve(s, evidence, target, expectedModel) {
  await s.page.waitForLoadState('networkidle');
  evidence.beforeSave = {
    modelField: await s.page.getByLabel('Model', { exact: true }).inputValue(),
    photoGroup: await s.page
      .getByRole('group', { name: /^Photos \(/ })
      .getAttribute('aria-label'),
    photoText: await s.page.locator('dialog fieldset').first().innerText(),
    visibleAlerts: await s.page
      .locator('dialog [role=alert]')
      .allTextContents(),
  };
  assert.equal(evidence.beforeSave.modelField, expectedModel);
  const responsePromise = s.page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      /\/listings\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await s.page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  const response = await responsePromise;
  await response.finished();
  await s.page.waitForLoadState('networkidle');
  evidence.saveProof = {
    actualRequestPath: new URL(response.url()).pathname,
    expectedRequestPath: '/api/aircraft-sale/listings/' + target,
    status: response.status(),
    listingAModel: s.f.state().listings[s.a.id].fields.model,
    listingBModel: s.f.state().listings[s.b.id].fields.model,
    uploadRequests: s.uploadCount(),
    listingAUnchangedFromAcceptedUpload:
      JSON.stringify(s.f.state().listings[s.a.id]) ===
      JSON.stringify(s.committedA()),
  };
  assert.equal(evidence.saveProof.status, 200);
  assert.equal(
    evidence.saveProof.actualRequestPath,
    evidence.saveProof.expectedRequestPath,
    'Save must target the listing currently edited in the full parent',
  );
}

test(
  'full parent positive control refreshes committed media in the same editor and saves that listing',
  { timeout: 15000 },
  async () => {
    const evidence = {
      name: 'same-editor-positive-control',
      status: 'RUNNING',
    };
    report.cases.push(evidence);
    let s;
    try {
      s = await setup('normal', evidence);
      await s.page.getByLabel('Add photos', { exact: true }).setInputFiles({
        name: 'belongs-to-a.png',
        mimeType: 'image/png',
        buffer: photo,
      });
      await s.page
        .getByRole('group', { name: 'Photos (1)', exact: true })
        .waitFor();
      await s.page
        .getByRole('img', { name: 'belongs-to-a.png', exact: true })
        .waitFor();
      await saveAndProve(s, evidence, s.a.id, 'Race A');
      assert.equal(s.uploadCount(), 1);
      assert.deepEqual(evidence.externalBlocked, []);
      assert.deepEqual(evidence.pageErrors, []);
      assert.deepEqual(evidence.routeErrors, []);
      assert.deepEqual(await s.page.evaluate(() => window.__providerCalls), []);
      evidence.status = 'PASS';
    } catch (error) {
      evidence.status = 'FAIL';
      evidence.failure = error.stack;
      throw error;
    } finally {
      s?.release();
      await s?.context.close();
    }
  },
);

for (const mode of ['success', 'error', 'readback']) {
  test(
    'full parent retains editor B when A ' +
      mode +
      ' finishes after close/reopen',
    { timeout: 15000 },
    async () => {
      const evidence = {
        name: 'close-A-open-B-delayed-' + mode,
        status: 'RUNNING',
      };
      report.cases.push(evidence);
      let s;
      try {
        s = await setup(mode, evidence);
        const files = [
          { name: 'belongs-to-a.png', mimeType: 'image/png', buffer: photo },
        ];
        if (mode === 'success')
          files.push({
            name: 'must-not-dispatch.png',
            mimeType: 'image/png',
            buffer: photo,
          });
        await s.page
          .getByLabel('Add photos', { exact: true })
          .setInputFiles(files);
        await Promise.race([
          s.barrier,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(Error('Fixture response barrier was not reached')),
              5000,
            ),
          ),
        ]);
        assert.equal(evidence.acceptedUpload.status, 200);
        assert.equal(evidence.acceptedUpload.listingId, s.a.id);
        assert.equal(evidence.acceptedUpload.storedFiles, 1);
        await openOther(s);
        evidence.beforeRelease = {
          modelField: await s.page
            .getByLabel('Model', { exact: true })
            .inputValue(),
          expectedTarget: s.b.id,
          serverCommittedUpload: true,
          barrier:
            mode === 'readback' ? 'my-listings-readback' : 'upload-response',
        };
        s.release();
        await saveAndProve(s, evidence, s.b.id, 'Race B edited');
        assert.equal(evidence.saveProof.listingAModel, 'Race A');
        assert.equal(evidence.saveProof.listingBModel, 'Race B edited');
        assert.equal(
          evidence.saveProof.listingAUnchangedFromAcceptedUpload,
          true,
          'Saving B must leave all A listing state at its accepted-upload snapshot',
        );
        assert.equal(
          s.uploadCount(),
          1,
          'Closing A cancels any remaining upload batch dispatch',
        );
        assert.ok(
          !evidence.beforeSave.photoText.includes('belongs-to-a.png'),
          'A media cannot replace B media',
        );
        assert.deepEqual(
          evidence.beforeSave.visibleAlerts,
          [],
          'Stale A failure cannot enter B editor',
        );
        assert.deepEqual(evidence.externalBlocked, []);
        assert.deepEqual(evidence.pageErrors, []);
        assert.deepEqual(evidence.routeErrors, []);
        assert.deepEqual(
          await s.page.evaluate(() => window.__providerCalls),
          [],
        );
        evidence.status = 'PASS';
      } catch (error) {
        evidence.status = 'FAIL';
        evidence.failure = error.stack;
        throw error;
      } finally {
        s?.release();
        await s?.context.close();
      }
    },
  );
}
