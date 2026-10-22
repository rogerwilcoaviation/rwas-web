import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { build } from 'esbuild';

const { chromium } = await import(
  '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const exportDir = process.env.ACCOUNT_FOCUS_EXPORT
  ? resolve(process.env.ACCOUNT_FOCUS_EXPORT)
  : null;
const preimage = process.env.ACCOUNT_FOCUS_PREIMAGE === '1';
const sourcePath = preimage
  ? '/Users/rwas/Documents/Codex/2026-10-01/task/seller-staff-publication-local-20261018/source/app/seller-accounts/SellerAccounts.tsx'
  : resolve('app/seller-accounts/SellerAccounts.tsx');
const sourceBytes = await readFile(sourcePath);
const origin = 'http://127.0.0.1:43123';
const baseTime = new Date('2026-10-18T12:00:00Z').getTime();
const evidenceDir = resolve('../accounts');
await mkdir(evidenceDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  mode: exportDir ? 'ACTUAL_NEXT_EXPORT' : 'FULL_ACTUAL_COMPONENT',
  exportDir,
  preimage,
  component: {
    path: sourcePath,
    sha256: createHash('sha256').update(sourceBytes).digest('hex'),
  },
  scope:
    'Keyboard focus only; local synthetic account API responses, no apply operation. Every browser request is intercepted and external requests are aborted. No provider, mail, credentials, account mutation, deployment or Recovery workflow.',
  cases: [],
  staticAssets: [],
  limits: [
    'Chromium keyboard and DOM focus assertions do not establish screen-reader audio or all-browser accessibility certification.',
    'Account responses and authority deadlines are synthetic fixtures; this verifies focus behavior, not hosted authorization or account operations.',
    'The React unmount case is available in direct-component mode. Built mode verifies the rendered Next export with its actual layout and assets.',
    'Both stopped Recovery tasks remain held. The old frozen candidate is read-only.',
  ],
};
const bundle = exportDir
  ? null
  : (
      await build({
        stdin: {
          contents: `import React from 'react';
import { createRoot } from 'react-dom/client';
import SellerAccounts from ${JSON.stringify(sourcePath)};
const root = createRoot(document.querySelector('#root'));
window.unmountLocalAccounts = () => root.unmount();
root.render(React.createElement(SellerAccounts));`,
          sourcefile: 'local-accounts-focus.tsx',
          resolveDir: process.cwd(),
          loader: 'tsx',
        },
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'iife',
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
      })
    ).outputFiles[0].text;
let browser;
test.before(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ['--disable-background-networking'],
  });
});
test.after(async () => {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  report.passed = report.cases.filter(
    (entry) => entry.status === 'PASS',
  ).length;
  report.failed = report.cases.filter(
    (entry) => entry.status === 'FAIL',
  ).length;
  report.status = report.failed ? 'FAIL' : 'PASS';
  await writeFile(
    resolve(
      evidenceDir,
      exportDir
        ? 'account-preview-focus-built.json'
        : preimage
          ? 'account-preview-focus-preimage.json'
          : 'account-preview-focus-component.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
});

const summary = (id, name) => ({
  id,
  name,
  email: id + '@example.test',
  status: 'active',
  adminSuspended: false,
  securityHeld: false,
  listingCount: 0,
  activeSessions: 1,
  createdAt: baseTime - 86400000,
});
const accounts = [
  summary('account-a', 'Seller A'),
  summary('account-b', 'Seller B'),
];
const snapshot = (page) =>
  page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim(),
    id: document.activeElement?.id,
    disabled: document.activeElement?.matches(':disabled'),
  }));
async function focused(locator, message) {
  assert.equal(
    await locator.evaluate((element) => element === document.activeElement),
    true,
    message,
  );
}
async function waitBarrier(promise) {
  let timeout;
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(Error('Preview fixture barrier was not reached')),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
async function setup(entry, hold = false) {
  entry.requests = [];
  entry.externalBlocked = [];
  entry.pageErrors = [];
  entry.routeErrors = [];
  const authority = {
    actor: 'staff@example.test',
    canManage: true,
    expiresAt: baseTime + 120000,
    manageUntil: baseTime + 60000,
  };
  let release, captured, delivered;
  const gate = new Promise((done) => {
    release = done;
  });
  const previewCaptured = new Promise((done) => {
    captured = done;
  });
  const previewDelivered = new Promise((done) => {
    delivered = done;
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    serviceWorkers: 'block',
  });
  await context.route('**/*', async (route) => {
    try {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        entry.externalBlocked.push(url.origin + url.pathname);
        return route.abort();
      }
      if (url.pathname.startsWith('/api/aircraft-sale/admin/accounts')) {
        const path = url.pathname.replace(
          '/api/aircraft-sale/admin/accounts',
          '',
        );
        entry.requests.push({ method: request.method(), path });
        const input = request.postData()
          ? JSON.parse(request.postData())
          : null;
        if (path.endsWith('/apply'))
          throw Error('Account mutation forbidden in focus test');
        let body;
        if (!path)
          body = { accounts, total: 2, nextCursor: null, ...authority };
        else {
          const account = accounts.find(
            (value) => path.split('/')[1] === value.id,
          );
          assert.ok(
            account,
            'Only synthetic fixture accounts may be requested',
          );
          body = path.endsWith('/preview')
            ? {
                accountId: account.id,
                confirmation: 'synthetic-preview-confirmation',
                operation: input.operation,
                proposedChanges: input.changes || null,
                sessionsToRevoke: input.operation === 'update-profile' ? 0 : 1,
                securityHoldRemains: false,
                changedFields: input.changes ? ['name'] : [],
              }
            : {
                account: {
                  ...account,
                  phone: '',
                  location: '',
                  loginMethods: ['email-code'],
                  sessions: [],
                  listings: [],
                  hasSavedDraft: false,
                  mediaCount: 0,
                },
                audit: [],
                ...authority,
              };
        }
        const held =
          (hold === true && path.endsWith('/preview')) ||
          (hold === 'detail-b' && path === '/account-b');
        if (held) {
          captured();
          await gate;
        }
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
        if (held || path.endsWith('/preview')) delivered();
        return;
      }
      if (exportDir) {
        let assetPath = resolve(
          exportDir,
          '.' + decodeURIComponent(url.pathname),
        );
        if (!assetPath.startsWith(exportDir + sep))
          throw Error('Static path is outside export');
        if (!extname(assetPath)) assetPath += '.html';
        const bytes = await readFile(assetPath);
        if (!report.staticAssets.some((entry) => entry.path === assetPath))
          report.staticAssets.push({
            path: assetPath,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
        const types = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.json': 'application/json',
        };
        return route.fulfill({
          contentType: types[extname(assetPath)] || 'application/octet-stream',
          body: bytes,
        });
      }
      if (url.pathname === '/panel.js')
        return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (url.pathname === '/seller-accounts')
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
        });
      throw Error('Unexpected local request ' + url.pathname);
    } catch (error) {
      entry.routeErrors.push(error.message);
      await route.abort().catch(() => {});
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => entry.pageErrors.push(error.message));
  await page.clock.install({ time: new Date(baseTime) });
  await page.goto(origin + '/seller-accounts');
  await page
    .getByRole('button', { name: 'Load accounts', exact: true })
    .waitFor();
  if (exportDir) await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    const sentinel = document.createElement('button');
    sentinel.id = 'focus-sentinel';
    sentinel.textContent = 'After accounts';
    document.body.append(sentinel);
  });
  await page
    .getByRole('button', { name: 'Load accounts', exact: true })
    .press('Enter');
  await page
    .getByRole('button', {
      name: 'View account account-a@example.test',
      exact: true,
    })
    .press('Enter');
  await page
    .getByRole('region', { name: 'Selected account', exact: true })
    .getByRole('heading', { name: 'Seller A', exact: true })
    .waitFor();
  return { page, context, release, previewCaptured, previewDelivered };
}
async function runCase(name, fn, hold = false) {
  const entry = { name, status: 'RUNNING' };
  report.cases.push(entry);
  let s;
  try {
    s = await setup(entry, hold);
    await fn(s, entry);
    assert.deepEqual(entry.pageErrors, []);
    assert.deepEqual(entry.routeErrors, []);
    assert.ok(
      entry.requests.every((request) => !request.path.endsWith('/apply')),
    );
    entry.status = 'PASS';
  } catch (error) {
    entry.status = 'FAIL';
    entry.failure = error.stack;
    if (s) entry.finalFocus = await snapshot(s.page).catch(() => null);
    throw error;
  } finally {
    s?.release();
    await s?.context.close();
  }
}
async function previewKeyboard(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('region', { name: 'Confirm account operation', exact: true })
    .waitFor();
  return trigger;
}

test(
  'keyboard preview focuses its confirmation heading and Cancel restores each initiating control after reenablement',
  { timeout: 20000 },
  () =>
    runCase('three-preview-keyboard-cancellation', async ({ page }, entry) => {
      entry.transitions = [];
      await page
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Corrected Seller A');
      for (const name of [
        'Preview contact update',
        'Preview suspension',
        'Preview session revocation',
      ]) {
        const trigger = await previewKeyboard(page, name);
        const region = page.getByRole('region', {
          name: 'Confirm account operation',
          exact: true,
        });
        const afterPreview = await snapshot(page);
        assert.equal(
          afterPreview.tag,
          'H3',
          'Preview must focus its readable confirmation heading',
        );
        await focused(
          region.getByRole('heading'),
          'Confirmation heading receives focus',
        );
        assert.equal(await trigger.isDisabled(), true);
        await page.keyboard.press('Tab');
        await focused(
          region.getByRole('button', {
            name: 'Confirm operation',
            exact: true,
          }),
          'First Tab reaches Confirm',
        );
        await page.keyboard.press('Tab');
        await focused(
          region.getByRole('button', { name: 'Cancel operation', exact: true }),
          'Second Tab reaches Cancel',
        );
        await page.keyboard.press('Enter');
        await region.waitFor({ state: 'detached' });
        assert.equal(await trigger.isDisabled(), false);
        await focused(
          trigger,
          'Cancel returns to its exact enabled initiating button',
        );
        entry.transitions.push({
          trigger: name,
          afterPreview,
          afterCancel: await snapshot(page),
        });
      }
    }),
);

test(
  'account navigation discards the old confirmation focus and cancellation returns to the new account control',
  { timeout: 15000 },
  () =>
    runCase(
      'account-navigation',
      async (s, entry) => {
        const { page } = s;
        await previewKeyboard(page, 'Preview suspension');
        const viewB = page.getByRole('button', {
          name: 'View account account-b@example.test',
          exact: true,
        });
        await viewB.press('Enter');
        await waitBarrier(s.previewCaptured);
        await page.locator('#focus-sentinel').focus();
        s.release();
        await waitBarrier(s.previewDelivered);
        await page
          .getByRole('region', { name: 'Selected account', exact: true })
          .getByRole('heading', { name: 'Seller B', exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole('region', {
              name: 'Confirm account operation',
              exact: true,
            })
            .count(),
          0,
        );
        await focused(
          page.locator('#focus-sentinel'),
          'Opening B does not restore focus into account A',
        );
        const trigger = await previewKeyboard(
          page,
          'Preview session revocation',
        );
        await page
          .getByRole('button', { name: 'Cancel operation', exact: true })
          .press('Enter');
        await focused(trigger, 'New B preview owns cancellation focus');
        entry.finalFocus = await snapshot(page);
      },
      'detail-b',
    ),
);

test(
  'late preview response cannot steal focus after management authority expires',
  { timeout: 15000 },
  () =>
    runCase(
      'late-preview-after-management-expiry',
      async (s, entry) => {
        const trigger = s.page.getByRole('button', {
          name: 'Preview suspension',
          exact: true,
        });
        await trigger.press('Enter');
        await waitBarrier(s.previewCaptured);
        await s.page.locator('#focus-sentinel').focus();
        await s.page.clock.fastForward(60001);
        await s.page.getByText(/Read-only access/).waitFor();
        s.release();
        await waitBarrier(s.previewDelivered);
        await s.page.clock.runFor(1);
        assert.equal(
          await s.page
            .getByRole('region', {
              name: 'Confirm account operation',
              exact: true,
            })
            .count(),
          0,
        );
        assert.equal(await trigger.isDisabled(), true);
        await focused(
          s.page.locator('#focus-sentinel'),
          'Late response cannot focus disabled account controls',
        );
        entry.finalFocus = await snapshot(s.page);
      },
      true,
    ),
);

test(
  'authority expiry clears confirmation without restoring focus into removed account controls',
  { timeout: 15000 },
  () =>
    runCase('confirmation-after-authority-expiry', async ({ page }, entry) => {
      await previewKeyboard(page, 'Preview suspension');
      await page.locator('#focus-sentinel').focus();
      await page.clock.fastForward(120001);
      await page
        .getByRole('alert')
        .filter({ hasText: 'Administrator access expired' })
        .waitFor();
      assert.equal(
        await page
          .getByRole('region', { name: 'Selected account', exact: true })
          .count(),
        0,
      );
      await focused(
        page.locator('#focus-sentinel'),
        'Expired authority cannot restore old account focus',
      );
      entry.finalFocus = await snapshot(page);
    }),
);

if (!exportDir)
  test(
    'unmount ignores pending preview focus when its delayed response arrives',
    { timeout: 15000 },
    () =>
      runCase(
        'unmount-with-preview-in-flight',
        async (s, entry) => {
          await s.page
            .getByRole('button', { name: 'Preview suspension', exact: true })
            .press('Enter');
          await waitBarrier(s.previewCaptured);
          await s.page.locator('#focus-sentinel').focus();
          await s.page.evaluate(() => window.unmountLocalAccounts());
          s.release();
          await waitBarrier(s.previewDelivered);
          await s.page.clock.runFor(1);
          assert.equal(await s.page.getByRole('main').count(), 0);
          await focused(
            s.page.locator('#focus-sentinel'),
            'Unmounted account view cannot move focus',
          );
          entry.finalFocus = await snapshot(s.page);
        },
        true,
      ),
  );
