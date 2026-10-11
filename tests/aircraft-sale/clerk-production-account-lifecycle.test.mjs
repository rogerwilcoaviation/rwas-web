import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const sellerSource = new URL(
  '../../app/aircraft-for-sale/seller-auth-panel.tsx',
  import.meta.url,
).pathname;
const panelSource = new URL(
  '../../app/aircraft-for-sale/clerk-production-panel.tsx',
  import.meta.url,
).pathname;
const browserSource = new URL(
  '../../app/aircraft-for-sale/clerk-production-browser.ts',
  import.meta.url,
).pathname;
const origin = 'https://www.rogerwilcoaviation.com';
const fixtureSession = {
  provider: 'clerk-production',
  token: 'fixture-rwas-session',
  csrf: 'fixture-rwas-csrf',
  email: 'contact@example.test',
  name: 'Fixture Seller',
};
const fixtureOwnerSession = {
  token: 'fixture-existing-rwas-owner',
  email: 'contact@example.test',
  name: 'Fixture Seller',
};
const canonicalJwt = [
  'e30',
  Buffer.from(JSON.stringify({ azp: origin })).toString('base64url'),
  'fixture-signature',
].join('.');

async function bundleHarness(mode = 'seller') {
  const result = await build({
    stdin: {
      contents: [
        'import React, { useState } from "react";',
        'import { createRoot } from "react-dom/client";',
        mode === 'seller'
          ? 'import Panel from ' + JSON.stringify(sellerSource) + ';'
          : 'import { ClerkProductionAccountPanel as Panel } from ' +
            JSON.stringify(panelSource) +
            ';',
        'const state = globalThis.__CLERK_ACCOUNT_STATE__;',
        'function Parent() {',
        ' const [version, setVersion] = useState(0);',
        ' state.rerender = () => setVersion(value => value + 1);',
        ' return React.createElement("div", { "data-version": version }, React.createElement(Panel));',
        '}',
        'const root = createRoot(document.querySelector("#root"));',
        'state.unmountRoot = () => root.unmount();',
        'root.render(React.createElement(Parent));',
      ].join('\n'),
      resolveDir: process.cwd(),
      sourcefile: 'clerk-account-lifecycle-harness.ts',
      loader: 'ts',
    },
    write: false,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION': '"true"',
    },
    plugins: [
      {
        name: 'local-official-sdk-account-fixture',
        setup(builder) {
          builder.onResolve(
            { filter: /^\.\/clerk-production-browser$/ },
            (args) =>
              [sellerSource, panelSource].includes(args.importer)
                ? { path: 'fixture', namespace: 'clerk-account' }
                : null,
          );
          builder.onLoad(
            { filter: /^fixture$/, namespace: 'clerk-account' },
            () => ({
              loader: 'js',
              resolveDir: process.cwd(),
              contents: [
                'import { ClerkProductionBrowser, clerkProductionFailureTelemetry, isClerkProductionMethodEnabled } from ' +
                  JSON.stringify(browserSource) +
                  ';',
                'export { clerkProductionFailureTelemetry, isClerkProductionMethodEnabled };',
                'const state = globalThis.__CLERK_ACCOUNT_STATE__;',
                'const listeners = new Set();',
                'const makeSession = () => ({ id: "sess_fixture", clearCache() {}, async getToken(options) { state.tokenOptions.push(options); return state.canonicalJwt; } });',
                'const clerk = {',
                ' session: state.initialProviderSession || sessionStorage.getItem("rwas_fixture_provider_active") === "1" ? makeSession() : null,',
                ' user: { id: "user_fixture", updatedAt: new Date(1000), primaryEmailAddress: { emailAddress: "signin@example.test" } },',
                ' addListener(listener) { state.listenerAdds++; listeners.add(listener); listener({ session: clerk.session, user: clerk.user }); return () => { state.listenerRemoves++; listeners.delete(listener); }; },',
                ' openUserProfile(options) { const element = options.getContainer(); state.profileContainer = element; state.profileMounts++; state.profileOptions.push({ containerConnected: element.isConnected, insideDialog: Boolean(element.closest("dialog")) }); element.dataset.clerkAccountFixture = "mounted"; element.textContent = "Identity settings fixture"; const secondary = document.createElement("button"); secondary.textContent = "Fixture secondary settings"; secondary.onclick = () => { const input = document.createElement("input"); input.setAttribute("aria-label", "Fixture sign-in email"); input.dataset.clerkSecondaryFixture = "mounted"; options.getContainer().append(input); }; element.append(secondary); },',
                ' closeUserProfile() { const element = state.profileContainer; if (!element) return; state.profileUnmounts++; delete element.dataset.clerkAccountFixture; element.textContent = ""; state.profileContainer = null; },',
                ' mountSignIn(element) { state.signInMounts++; element.dataset.clerkSignInFixture = "mounted"; element.textContent = "Identity sign-in fixture"; },',
                ' unmountSignIn(element) { state.signInUnmounts++; delete element.dataset.clerkSignInFixture; element.textContent = ""; },',
                ' mountSignUp(element) { this.mountSignIn(element); },',
                ' unmountSignUp(element) { this.unmountSignIn(element); },',
                ' async signOut() { state.providerSignOuts++; if (state.failProviderSignOut) throw new Error("fixture unavailable"); clerk.session = null; state.emit(); },',
                '};',
                'state.emit = () => { for (const listener of [...listeners]) listener({ session: clerk.session, user: clerk.user }); };',
                'state.updateUser = () => { clerk.user.updatedAt = new Date(clerk.user.updatedAt.getTime() + 1000); state.emit(); };',
                'state.endProviderSession = () => { clerk.session = null; state.emit(); };',
                'state.switchProviderSession = () => { clerk.session.id = "sess_other"; state.emit(); };',
                'state.providerEmail = () => clerk.user.primaryEmailAddress.emailAddress;',
                'const client = new ClerkProductionBrowser(clerk, fetch);',
                'export const getClerkProductionBrowser = async () => { if (state.delayBrowser) await new Promise(resolve => { state.releaseBrowser = resolve; }); return client; };',
              ].join('\n'),
            }),
          );
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}

async function fixturePage(browser, bundle, options = {}) {
  const page = await browser.newPage();
  const calls = [];
  let contactEmail = fixtureSession.email;
  let rejectedAccountStatus = 0;
  await page.addInitScript(
    ({
      session,
      token,
      delayBrowser,
      failProviderSignOut,
      initialProviderSession,
    }) => {
      if (session)
        sessionStorage.setItem('rwas_sale_v2', JSON.stringify(session));
      globalThis.__CLERK_ACCOUNT_STATE__ = {
        canonicalJwt: token,
        delayBrowser,
        failProviderSignOut,
        initialProviderSession,
        listenerAdds: 0,
        listenerRemoves: 0,
        profileMounts: 0,
        profileUnmounts: 0,
        profileOptions: [],
        providerSignOuts: 0,
        signInMounts: 0,
        signInUnmounts: 0,
        tokenOptions: [],
      };
    },
    {
      session:
        options.storeSession === false
          ? null
          : options.sessionEnvelope || fixtureSession,
      token: canonicalJwt,
      delayBrowser: options.delayBrowser === true,
      failProviderSignOut: options.failProviderSignOut === true,
      initialProviderSession: options.initialProviderSession !== false,
    },
  );
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    assert.equal(url.origin, origin, 'all requests are intercepted fixtures');
    if (url.pathname === '/panel.js')
      return route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: bundle,
      });
    if (url.pathname.startsWith('/api/aircraft-sale/')) {
      const call = {
        path: url.pathname.slice('/api/aircraft-sale'.length),
        method: request.method(),
        headers: request.headers(),
        body: request.postDataJSON(),
      };
      calls.push(call);
      let body;
      let status = 200;
      if (call.path === '/auth/methods')
        body = {
          methods: ['clerk-production'],
          emailCode: options.linkAvailable === true,
          ...(options.linkAvailable
            ? { existingAccountLink: 'fresh-email-code-session' }
            : {}),
        };
      else if (call.path === '/auth/clerk-production/link/start')
        body = { nonce: 'fixture-link-nonce', csrf: 'fixture-link-start-csrf' };
      else if (call.path === '/auth/clerk-production/link/finish') {
        if (options.linkFinishGate) await options.linkFinishGate;
        status = options.rejectLink ? 403 : 200;
        body = options.rejectLink
          ? { error: 'Connection rejected.' }
          : {
              ok: true,
              session: fixtureSession.token,
              csrf: fixtureSession.csrf,
            };
      } else if (call.path === '/account' && call.method === 'GET') {
        if (options.accountGate) await options.accountGate;
        status = rejectedAccountStatus || 200;
        body = rejectedAccountStatus
          ? { error: 'Session was revoked.' }
          : {
              profile: {
                email: contactEmail,
                name: 'Fixture Seller',
                phone: '',
                location: '',
              },
              loginMethods: ['clerk-production'],
              sessions: [
                {
                  id: 'fixture-rwas-session',
                  current: true,
                  createdAt: 1000,
                  expiresAt: Date.now() + 60000,
                },
              ],
            };
      } else if (call.path === '/account/email-code') body = { ok: true };
      else if (call.path === '/account/email') {
        contactEmail = call.body.email.trim().toLowerCase();
        body = { ok: true, email: contactEmail };
      } else if (call.path === '/logout') {
        status = options.logoutStatus || 200;
        body =
          status === 200 ? { ok: true } : { error: 'Fixture logout rejected.' };
      } else assert.fail('Unexpected fixture request: ' + call.path);
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }
    assert.equal(url.pathname, '/aircraft-for-sale');
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div><script src="/panel.js"></script></body></html>',
    });
  });
  await page.goto(origin + '/aircraft-for-sale' + (options.search || ''));
  return {
    page,
    calls,
    rejectAccount: (status = 401) => {
      rejectedAccountStatus = status;
    },
  };
}

async function openSettings(page) {
  await page
    .getByRole('button', { name: 'Manage sign-in and security' })
    .click();
  await page.locator('[data-clerk-account-fixture]').waitFor();
}

test('controlled UserProfile opens in its supplied container and closes with its component', async () => {
  const bundle = await bundleHarness('account');
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, calls } = await fixturePage(browser, bundle, {
      storeSession: false,
    });
    await openSettings(page);
    for (let index = 0; index < 3; index += 1)
      await page.evaluate(() => globalThis.__CLERK_ACCOUNT_STATE__.rerender());
    await page.waitForFunction(
      () => document.querySelector('[data-version]').dataset.version === '3',
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        mounts: globalThis.__CLERK_ACCOUNT_STATE__.profileMounts,
        options: globalThis.__CLERK_ACCOUNT_STATE__.profileOptions,
      })),
      {
        mounts: 1,
        options: [{ containerConnected: true, insideDialog: false }],
      },
    );
    await page.evaluate(() => globalThis.__CLERK_ACCOUNT_STATE__.unmountRoot());
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
      ),
      1,
    );
    assert.deepEqual(calls, []);
  } finally {
    await browser.close();
  }
});

test('late SDK load cannot mount account settings after component removal', async () => {
  const bundle = await bundleHarness('account');
  const browser = await chromium.launch({ headless: true });
  try {
    const { page } = await fixturePage(browser, bundle, {
      storeSession: false,
      delayBrowser: true,
    });
    await page.waitForFunction(() =>
      Boolean(globalThis.__CLERK_ACCOUNT_STATE__.releaseBrowser),
    );
    await page.evaluate(() => {
      globalThis.__CLERK_ACCOUNT_STATE__.unmountRoot();
      globalThis.__CLERK_ACCOUNT_STATE__.releaseBrowser();
    });
    await page.evaluate(() => Promise.resolve());
    assert.deepEqual(
      await page.evaluate(() => ({
        mounts: globalThis.__CLERK_ACCOUNT_STATE__.profileMounts,
        unmounts: globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
      })),
      { mounts: 0, unmounts: 0 },
    );
  } finally {
    await browser.close();
  }
});

test('native account dialog exposes usable Sign Out and clears both session layers', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, calls } = await fixturePage(browser, bundle);
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await openSettings(page);
    assert.deepEqual(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.profileOptions,
      ),
      [{ containerConnected: true, insideDialog: true }],
    );
    await dialog
      .getByRole('button', { name: 'Fixture secondary settings' })
      .click();
    await dialog
      .getByLabel('Fixture sign-in email')
      .fill('fixture@example.test');
    assert.equal(
      await dialog
        .locator('[data-clerk-secondary-fixture]')
        .evaluate((element) => element.closest('dialog').open),
      true,
    );
    assert.equal(await dialog.evaluate((element) => element.open), true);
    await dialog.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.waitForFunction(
      () =>
        !sessionStorage.getItem('rwas_sale_v2') &&
        globalThis.__CLERK_ACCOUNT_STATE__.providerSignOuts === 1,
    );
    await page.locator('dialog').waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('dialog').evaluate((element) => element.open),
      false,
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        profileUnmounts: globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
        listenerAdds: globalThis.__CLERK_ACCOUNT_STATE__.listenerAdds,
        listenerRemoves: globalThis.__CLERK_ACCOUNT_STATE__.listenerRemoves,
        sharedSession: window.rwasSaleSession,
      })),
      {
        profileUnmounts: 1,
        listenerAdds: 1,
        listenerRemoves: 1,
        sharedSession: null,
      },
    );
    const logout = calls.find((call) => call.path === '/logout');
    assert.equal(logout.method, 'POST');
    assert.equal(
      logout.headers.authorization,
      'Bearer ' + fixtureSession.token,
    );
    assert.equal(logout.headers['x-rwas-csrf'], fixtureSession.csrf);
    assert.equal(logout.headers['x-clerk-session-token'], canonicalJwt);
  } finally {
    await browser.close();
  }
});

test('provider user changes revalidate existing RWAS access and preserve password revocation', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const fixture = await fixturePage(browser, bundle);
    const { page, calls } = fixture;
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await openSettings(page);
    const before = calls.filter((call) => call.path === '/account').length;
    fixture.rejectAccount();
    await page.evaluate(() => globalThis.__CLERK_ACCOUNT_STATE__.updateUser());
    await page
      .getByRole('alert')
      .getByText('Your secure session ended. Please sign in again.', {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
      null,
    );
    assert.equal(
      calls.filter((call) => call.path === '/account').length,
      before + 1,
    );
    assert.equal(
      calls.some((call) => /\/auth\/clerk-production\//.test(call.path)),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.listenerRemoves,
      ),
      1,
    );
    const validation = calls.at(-1);
    assert.equal(
      validation.headers.authorization,
      'Bearer ' + fixtureSession.token,
    );
    assert.equal(validation.headers['x-rwas-csrf'], fixtureSession.csrf);
    assert.equal(validation.headers['x-clerk-session-token'], canonicalJwt);
  } finally {
    await browser.close();
  }
});

test('provider sign-out or session switch removes RWAS access without a new handoff', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const action of ['endProviderSession', 'switchProviderSession']) {
      const { page, calls } = await fixturePage(browser, bundle);
      await page.waitForFunction(
        () => globalThis.__CLERK_ACCOUNT_STATE__.listenerAdds === 1,
      );
      await page.evaluate(
        (name) => globalThis.__CLERK_ACCOUNT_STATE__[name](),
        action,
      );
      await page.getByRole('alert').waitFor();
      assert.equal(
        await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
        null,
      );
      assert.equal(
        calls.some((call) => /\/auth\/clerk-production\//.test(call.path)),
        false,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('terminal provider denial clears local access while transient validation failure retains the listener', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const status of [403, 503]) {
      const fixture = await fixturePage(browser, bundle);
      const { page, calls } = fixture;
      await page.getByRole('button', { name: 'Account', exact: true }).click();
      await openSettings(page);
      fixture.rejectAccount(status);
      const response = page.waitForResponse(
        (value) =>
          value.url().endsWith('/account') && value.status() === status,
      );
      await page.evaluate(() =>
        globalThis.__CLERK_ACCOUNT_STATE__.updateUser(),
      );
      await response;
      if (status === 403) {
        await page.getByRole('alert').waitFor();
        assert.equal(
          await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
          null,
        );
      } else {
        assert.equal(
          await page.evaluate(
            () => JSON.parse(sessionStorage.getItem('rwas_sale_v2')).token,
          ),
          fixtureSession.token,
        );
        assert.equal(
          await page.evaluate(
            () => globalThis.__CLERK_ACCOUNT_STATE__.listenerRemoves,
          ),
          0,
        );
        fixture.rejectAccount(401);
        await page.evaluate(() =>
          globalThis.__CLERK_ACCOUNT_STATE__.updateUser(),
        );
        await page.getByRole('alert').waitFor();
      }
      assert.equal(
        calls.some((call) => /\/auth\/clerk-production\//.test(call.path)),
        false,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('RWAS contact-email verification does not mutate the sign-in email', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, calls } = await fixturePage(browser, bundle);
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await openSettings(page);
    await dialog
      .getByRole('heading', { name: 'Change RWAS contact email' })
      .waitFor();
    await dialog
      .getByLabel('New email', { exact: true })
      .fill('new-contact@example.test');
    await dialog.getByRole('button', { name: 'Send New Email Code' }).click();
    await dialog.getByLabel('New email code', { exact: true }).fill('123456');
    await dialog.getByRole('button', { name: 'Verify New Email' }).click();
    await dialog
      .getByText('Contact email: new-contact@example.test', { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() =>
        globalThis.__CLERK_ACCOUNT_STATE__.providerEmail(),
      ),
      'signin@example.test',
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(sessionStorage.getItem('rwas_sale_v2')).email,
      ),
      'new-contact@example.test',
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.profileMounts,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.listenerAdds,
      ),
      1,
    );
    assert.deepEqual(
      calls
        .filter((call) => call.path.startsWith('/account/email'))
        .map((call) => ({ path: call.path, body: call.body })),
      [
        {
          path: '/account/email-code',
          body: { email: 'new-contact@example.test' },
        },
        {
          path: '/account/email',
          body: { email: 'new-contact@example.test', code: '123456' },
        },
      ],
    );
    await page.evaluate(() => globalThis.__CLERK_ACCOUNT_STATE__.unmountRoot());
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.listenerRemoves,
      ),
      1,
    );
  } finally {
    await browser.close();
  }
});

test('successful RWAS logout stays cleared when provider sign-out fails', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const { page } = await fixturePage(browser, bundle, {
      failProviderSignOut: true,
    });
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await openSettings(page);
    await dialog.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page
      .getByRole('alert')
      .getByText(/You are signed out of RWAS/)
      .waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
      null,
    );
    assert.equal(await page.evaluate(() => window.rwasSaleSession), null);
    assert.equal(
      await page.evaluate(
        () => globalThis.__CLERK_ACCOUNT_STATE__.providerSignOuts,
      ),
      1,
    );
    await page.evaluate(() => {
      globalThis.__CLERK_ACCOUNT_STATE__.failProviderSignOut = false;
    });
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Finish secure sign-out' })
      .click();
    await page.waitForFunction(
      () => globalThis.__CLERK_ACCOUNT_STATE__.providerSignOuts === 2,
    );
    await page.locator('dialog').waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('dialog').evaluate((element) => element.open),
      false,
    );
  } finally {
    await browser.close();
  }
});

test('expired or denied RWAS logout still signs out Clerk; transient failure remains retryable', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const status of [401, 403, 503]) {
      const { page } = await fixturePage(browser, bundle, {
        logoutStatus: status,
      });
      await page.getByRole('button', { name: 'Account', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await openSettings(page);
      await dialog
        .getByRole('button', { name: 'Sign Out', exact: true })
        .click();
      if (status === 503) {
        await page.getByRole('alert').waitFor();
        assert.equal(
          await page.evaluate(
            () => JSON.parse(sessionStorage.getItem('rwas_sale_v2')).token,
          ),
          fixtureSession.token,
        );
        assert.equal(
          await page.evaluate(
            () => globalThis.__CLERK_ACCOUNT_STATE__.providerSignOuts,
          ),
          0,
        );
        assert.equal(await dialog.evaluate((element) => element.open), true);
      } else {
        await page.waitForFunction(
          () => globalThis.__CLERK_ACCOUNT_STATE__.providerSignOuts === 1,
        );
        await page.locator('dialog').waitFor({ state: 'hidden' });
        assert.equal(
          await page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
          null,
        );
        assert.equal(
          await page.locator('dialog').evaluate((element) => element.open),
          false,
        );
        assert.equal(
          await page.evaluate(
            () => globalThis.__CLERK_ACCOUNT_STATE__.profileUnmounts,
          ),
          1,
        );
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('existing seller requires an explicit connection and retains its owner session until finish succeeds', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  let releaseFinish;
  const linkFinishGate = new Promise((resolve) => {
    releaseFinish = resolve;
  });
  try {
    const { page, calls } = await fixturePage(browser, bundle, {
      sessionEnvelope: fixtureOwnerSession,
      linkAvailable: true,
      linkFinishGate,
      search: '?seller-auth=complete',
    });
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Open your account' }).click();
    await dialog
      .getByRole('button', { name: 'Connect RWAS secure sign-in', exact: true })
      .waitFor();
    assert.equal(
      calls.some((call) => /\/auth\/clerk-production\//.test(call.path)),
      false,
    );
    await dialog
      .getByRole('button', { name: 'Connect RWAS secure sign-in', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'rwas-finish-request',
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')),
      ),
      fixtureOwnerSession,
    );
    const linkCalls = calls.filter((call) =>
      call.path.startsWith('/auth/clerk-production/link/'),
    );
    assert.equal(linkCalls.length, 2);
    const proof = linkCalls[0].body.proof;
    assert.match(proof, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(linkCalls[0].body, { proof, confirm: true });
    assert.deepEqual(linkCalls[1].body, {
      nonce: 'fixture-link-nonce',
      proof,
      confirm: true,
    });
    for (const call of linkCalls) {
      assert.equal(
        call.headers.authorization,
        'Bearer ' + fixtureOwnerSession.token,
      );
      assert.equal(call.headers['x-rwas-link-proof'], proof);
      assert.equal(call.headers['x-clerk-session-token'], canonicalJwt);
    }
    assert.equal(
      linkCalls[1].headers['x-rwas-csrf'],
      'fixture-link-start-csrf',
    );
    const intent = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('rwas_sale_clerk_link_intent')),
    );
    assert.match(intent.fingerprint, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(
      JSON.stringify(intent).includes(fixtureOwnerSession.token),
      false,
    );
    releaseFinish();
    await page.waitForFunction(
      () =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')).provider ===
        'clerk-production',
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')),
      ),
      fixtureSession,
    );
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem('rwas_sale_clerk_link_intent'),
      ),
      null,
    );
    assert.equal(
      calls.some((call) => call.path === '/auth/clerk-production/start'),
      false,
    );
    assert.equal(
      calls.some((call) => call.path === '/auth/clerk-production/finish'),
      false,
    );
  } finally {
    releaseFinish?.();
    await browser.close();
  }
});

test('connection intent survives the SDK handoff route without copying the owner bearer', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, calls } = await fixturePage(browser, bundle, {
      sessionEnvelope: fixtureOwnerSession,
      linkAvailable: true,
      initialProviderSession: false,
    });
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Connect RWAS secure sign-in', exact: true })
      .click();
    await page.locator('[data-clerk-sign-in-fixture]').waitFor();
    await page.evaluate(() => {
      sessionStorage.setItem('rwas_fixture_provider_active', '1');
    });
    await page.goto(origin + '/aircraft-for-sale?seller-auth=complete');
    await page.waitForFunction(
      () =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')).provider ===
        'clerk-production',
    );
    assert.equal(
      calls.filter((call) => call.path === '/auth/clerk-production/link/start')
        .length,
      1,
    );
    assert.equal(
      calls.filter((call) => call.path === '/auth/clerk-production/link/finish')
        .length,
      1,
    );
    assert.equal(
      calls.some((call) => call.path === '/auth/clerk-production/start'),
      false,
    );
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem('rwas_sale_clerk_link_intent'),
      ),
      null,
    );
  } finally {
    await browser.close();
  }
});

test('rejected connection preserves the owner account and terminal failure through reload', async () => {
  const bundle = await bundleHarness();
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, calls } = await fixturePage(browser, bundle, {
      sessionEnvelope: fixtureOwnerSession,
      linkAvailable: true,
      rejectLink: true,
    });
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Connect RWAS secure sign-in', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'failed',
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')),
      ),
      fixtureOwnerSession,
    );
    assert.equal(
      calls.filter((call) =>
        call.path.startsWith('/auth/clerk-production/link/'),
      ).length,
      2,
    );
    await page.goto(origin + '/aircraft-for-sale?seller-auth=complete');
    await page.waitForFunction(
      () =>
        document.querySelector('[data-rwas-clerk-stage]')?.dataset
          .rwasClerkStage === 'failed',
    );
    assert.equal(
      calls.filter((call) =>
        call.path.startsWith('/auth/clerk-production/link/'),
      ).length,
      2,
    );
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2')),
      ),
      fixtureOwnerSession,
    );
    assert.match(
      await page.getByRole('alert').textContent(),
      /Further attempts in this tab are paused/,
    );
  } finally {
    await browser.close();
  }
});
