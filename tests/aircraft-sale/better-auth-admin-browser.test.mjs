import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const origin = 'https://www.rogerwilcoaviation.com';
const base = '/api/aircraft-sale';
const auth = base + '/identity';
const directory = new URL(
  '../../app/seller-accounts/SellerAccounts.tsx',
  import.meta.url,
).pathname;
const bundlePromise = (async () => {
  const output = join(
    await mkdtemp(join(tmpdir(), 'rwas-identity-admin-ui-')),
    'admin.js',
  );
  await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import SellerAccounts from ${JSON.stringify(directory)}; createRoot(document.getElementById('root')).render(React.createElement(SellerAccounts));`,
      resolveDir: process.cwd(),
      sourcefile: 'better-auth-admin-browser.tsx',
      loader: 'tsx',
    },
    outfile: output,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2022'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return readFile(output, 'utf8');
})();

async function fixture(run, initial = {}) {
  const state = {
    enabled: true,
    canManage: true,
    actor: 'identity-admin-id',
    sessionId: 'admin-session',
    mutationActor: null,
    mutationSessionId: null,
    denied: false,
    banned: false,
    authorityDuration: 3_600_000,
    delayedList: null,
    ...initial,
  };
  const requests = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      assert.equal(url.origin, origin, 'No external service is contacted.');
      if (url.pathname === '/fixture.js')
        return route.fulfill({
          contentType: 'text/javascript',
          body: await bundlePromise,
        });
      if (url.pathname === '/seller-accounts')
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      const body = request.postData() ? JSON.parse(request.postData()) : null;
      requests.push({
        path: url.pathname,
        search: url.search,
        method: request.method(),
        body,
        operator: {
          userId: request.headers()['x-rwas-identity-user'] || null,
          sessionId: request.headers()['x-rwas-identity-session'] || null,
        },
      });
      const json = (value, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(value),
        });
      if (url.pathname === base + '/admin/accounts')
        return json({
          accounts: [],
          total: 0,
          nextCursor: null,
          actor: 'access-admin@example.test',
          canManage: state.canManage,
          expiresAt: Date.now() + state.authorityDuration,
          manageUntil: state.canManage
            ? Date.now() + state.authorityDuration
            : null,
        });
      if (url.pathname === base + '/auth/methods')
        return json({
          methods: state.enabled ? ['better-auth'] : ['password'],
        });
      if (url.pathname === auth + '/get-session')
        return json({
          user: {
            id: state.actor,
            email: 'access-admin@example.test',
            role: 'user',
            emailVerified: true,
            twoFactorEnabled: true,
          },
          session: {
            id: state.sessionId,
            token: 'fixture-admin-token-not-rendered',
            userId: state.actor,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(),
            mfaVerifiedAt: Date.now(),
          },
        });
      if (url.pathname === auth + '/admin/list-users') {
        if (state.delayedList) await state.delayedList;
        if (state.denied)
          return json(
            { code: 'MFA_REQUIRED', message: 'PRIVATE-PROVIDER-ERROR' },
            403,
          );
        const offset = Number(url.searchParams.get('offset') || 0);
        assert.equal(url.searchParams.get('limit'), '20');
        return json({
          users: [
            {
              id: offset ? 'identity-second-page' : 'identity-target',
              name: 'Synthetic identity',
              email: offset ? 'next@example.test' : 'target@example.test',
              emailVerified: true,
              banned: state.banned,
            },
          ],
          total: 21,
        });
      }
      if (url.pathname === auth + '/admin/list-user-sessions')
        return json({
          sessions: [
            {
              id: 'identity-session-target',
              token: 'fixture-sensitive-session-token',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            },
          ],
        });
      if (
        [
          '/admin/ban-user',
          '/admin/unban-user',
          '/admin/revoke-user-session',
          '/admin/revoke-user-sessions',
        ].some((path) => url.pathname === auth + path) &&
        (request.headers()['x-rwas-identity-user'] !==
          (state.mutationActor || state.actor) ||
          request.headers()['x-rwas-identity-session'] !==
            (state.mutationSessionId || state.sessionId))
      )
        return json(
          { code: 'SESSION_CHANGED', message: 'Operator changed' },
          403,
        );
      if (url.pathname === auth + '/admin/ban-user') {
        state.banned = true;
        return json({ user: { id: body.userId, banned: true } });
      }
      if (url.pathname === auth + '/admin/unban-user') {
        state.banned = false;
        return json({ user: { id: body.userId, banned: false } });
      }
      if (
        [
          auth + '/admin/revoke-user-session',
          auth + '/admin/revoke-user-sessions',
        ].includes(url.pathname)
      )
        return json({ success: true });
      return json({ error: 'Unexpected fixture request' }, 404);
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(origin + '/seller-accounts');
    await page
      .getByRole('button', { name: 'Load accounts', exact: true })
      .waitFor();
    await run({ page, state, requests });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
}

async function loadIdentity(page) {
  await page
    .getByRole('button', { name: 'Load accounts', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Load identity accounts', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'View identity identity-target', exact: true })
    .waitFor();
}

test('identity service is untouched until Access authority and Better Auth mode are established', async () => {
  await fixture(
    async ({ page, requests }) => {
      assert.equal(requests.length, 0);
      await page
        .getByRole('button', { name: 'Load accounts', exact: true })
        .click();
      await page
        .getByText('Signed in as access-admin@example.test.', { exact: false })
        .waitFor();
      await page.waitForTimeout(50);
      assert.equal(
        requests.some((request) => request.path.startsWith(auth)),
        false,
      );
      assert.equal(
        await page
          .getByRole('region', {
            name: 'Identity account administration',
            exact: true,
          })
          .count(),
        0,
      );
    },
    { enabled: false },
  );
});

test('official client pagination and confirmed target-specific mutations never render session tokens', async () => {
  await fixture(async ({ page, requests }) => {
    await loadIdentity(page);
    await page
      .getByRole('button', { name: 'Next identity page', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'View identity identity-second-page',
        exact: true,
      })
      .waitFor();
    assert.equal(
      requests
        .filter((request) => request.path.endsWith('/list-users'))
        .at(-1)
        .search.includes('offset=20'),
      true,
    );
    await page
      .getByRole('button', { name: 'Previous identity page', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Review identity suspension', exact: true })
      .click();
    assert.equal(
      requests.some((request) => request.path.endsWith('/ban-user')),
      false,
    );
    assert.match(
      await page
        .getByRole('region', {
          name: 'Confirm identity operation',
          exact: true,
        })
        .innerText(),
      /identity-target/,
    );
    await page
      .getByRole('button', { name: 'Cancel identity operation', exact: true })
      .click();
    assert.equal(
      requests.some((request) => request.path.endsWith('/ban-user')),
      false,
    );
    await page
      .getByRole('button', {
        name: 'Review revocation of identity session identity-session-target',
        exact: true,
      })
      .click();
    assert.match(
      await page
        .getByRole('region', {
          name: 'Confirm identity operation',
          exact: true,
        })
        .innerText(),
      /identity-session-target/,
    );
    assert.equal(
      (await page.locator('body').innerText()).includes(
        'fixture-sensitive-session-token',
      ),
      false,
    );
    assert.equal(
      (await page.locator('body').innerText()).includes(
        'fixture-admin-token-not-rendered',
      ),
      false,
    );
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByText(
        'Revoke identity session completed for identity identity-target.',
        { exact: false },
      )
      .waitFor();
    assert.deepEqual(
      requests.find((request) => request.path.endsWith('/revoke-user-session'))
        .body,
      { sessionToken: 'fixture-sensitive-session-token' },
    );
    assert.equal(
      requests.filter((request) =>
        request.path.endsWith('/revoke-user-session'),
      ).length,
      1,
    );
    await page
      .getByRole('button', { name: 'Load identity accounts', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Review identity suspension', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByText('Suspend identity sign-in completed', { exact: false })
      .waitFor();
    assert.equal(
      requests.find((request) => request.path.endsWith('/ban-user')).body
        .userId,
      'identity-target',
    );
    await page
      .getByRole('button', { name: 'Load identity accounts', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', {
        name: 'Review identity reinstatement',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByText('Reinstate identity sign-in completed', { exact: false })
      .waitFor();
    assert.equal(
      requests.find((request) => request.path.endsWith('/unban-user')).body
        .userId,
      'identity-target',
    );
    await page
      .getByRole('button', { name: 'Load identity accounts', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', {
        name: 'Review all identity session revocation',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByText('Revoke all identity sessions completed', { exact: false })
      .waitFor();
    assert.deepEqual(
      requests.find((request) => request.path.endsWith('/revoke-user-sessions'))
        .body,
      { userId: 'identity-target' },
    );
    for (const operation of requests.filter((request) =>
      /\/(?:ban-user|unban-user|revoke-user-session|revoke-user-sessions)$/.test(
        request.path,
      ),
    ))
      assert.deepEqual(operation.operator, {
        userId: 'identity-admin-id',
        sessionId: 'admin-session',
      });
  });
});

test('an operator cookie change after preflight is rejected against the displayed immutable IDs', async () => {
  await fixture(async ({ page, state, requests }) => {
    await loadIdentity(page);
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Review identity suspension', exact: true })
      .click();
    // The session read still sees A; the action arrives with a concurrently
    // replaced shared cookie for B. The server must compare against headers A.
    state.mutationActor = 'other-authorized-operator';
    state.mutationSessionId = 'other-operator-session';
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByRole('region', {
        name: 'Identity account administration',
        exact: true,
      })
      .getByRole('alert')
      .waitFor();
    assert.equal(state.banned, false);
    const attempts = requests.filter((request) =>
      request.path.endsWith('/ban-user'),
    );
    assert.equal(attempts.length, 1);
    assert.deepEqual(attempts[0].operator, {
      userId: 'identity-admin-id',
      sessionId: 'admin-session',
    });
    assert.equal(
      (await page.locator('body').innerText()).includes('target@example.test'),
      false,
    );
  });
});

test('a replacement session for the same operator requires a fresh directory read before mutation', async () => {
  await fixture(async ({ page, state, requests }) => {
    await loadIdentity(page);
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Review identity suspension', exact: true })
      .click();
    state.sessionId = 'same-user-new-session';
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByRole('region', {
        name: 'Identity account administration',
        exact: true,
      })
      .getByRole('alert')
      .waitFor();
    assert.equal(
      requests.some((request) => request.path.endsWith('/ban-user')),
      false,
    );
    assert.equal(state.banned, false);
    assert.equal(
      (await page.locator('body').innerText()).includes('target@example.test'),
      false,
    );
  });
});

test('identity mismatch or MFA denial clears private state without a mutation or raw provider error', async () => {
  await fixture(async ({ page, state, requests }) => {
    await loadIdentity(page);
    await page
      .getByRole('button', {
        name: 'View identity identity-target',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: 'Review identity suspension', exact: true })
      .click();
    state.actor = 'different-identity-id';
    await page
      .getByRole('button', { name: 'Confirm identity operation', exact: true })
      .click();
    await page
      .getByRole('region', {
        name: 'Identity account administration',
        exact: true,
      })
      .getByRole('alert')
      .waitFor();
    assert.equal(
      requests.some((request) => request.path.endsWith('/ban-user')),
      false,
    );
    assert.equal(
      (await page.locator('body').innerText()).includes('target@example.test'),
      false,
    );
    state.denied = true;
    await page
      .getByRole('button', { name: 'Load identity accounts', exact: true })
      .click();
    await page
      .getByText('Identity administration requires', { exact: false })
      .waitFor();
    assert.equal(
      (await page.locator('body').innerText()).includes(
        'PRIVATE-PROVIDER-ERROR',
      ),
      false,
    );
  });
});

test('Access expiration unmounts the identity directory and blocks a delayed private readback', async () => {
  await fixture(
    async ({ page, state }) => {
      await page
        .getByRole('button', { name: 'Load accounts', exact: true })
        .click();
      let release;
      state.delayedList = new Promise((resolve) => {
        release = resolve;
      });
      await page
        .getByRole('button', { name: 'Load identity accounts', exact: true })
        .click();
      await page
        .getByText('Administrator access expired.', { exact: false })
        .waitFor();
      release();
      await page.waitForTimeout(50);
      assert.equal(
        await page
          .getByRole('region', {
            name: 'Identity account administration',
            exact: true,
          })
          .count(),
        0,
      );
      assert.equal(
        (await page.locator('body').innerText()).includes(
          'target@example.test',
        ),
        false,
      );
    },
    { authorityDuration: 400 },
  );
});
