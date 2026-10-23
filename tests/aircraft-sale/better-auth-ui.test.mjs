import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const output = join(
  await mkdtemp(join(tmpdir(), 'rwas-better-ui-')),
  'fixture.js',
);
const panel = new URL(
  '../../app/aircraft-for-sale/better-auth-panel.tsx',
  import.meta.url,
).pathname;
const parent = new URL(
  '../../app/aircraft-for-sale/seller-auth-panel.tsx',
  import.meta.url,
).pathname;
await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Panel,{BetterAuthAccountPanel,BetterAuthDeleteAccount} from ${JSON.stringify(panel)}; import Seller from ${JSON.stringify(parent)}; const state=globalThis.__TEST__; const Component=state.parent?Seller:state.deletion?BetterAuthDeleteAccount:state.account?BetterAuthAccountPanel:Panel; const target=state.expectedTarget||{userId:'fixture-user',sessionId:'fixture-session'}; const props=state.deletion?{expectedTarget:target,identityOnly:!!state.identityOnly,deleteBusiness:async()=>{state.businessDeletes=(state.businessDeletes||0)+1},onComplete:()=>state.deleted=true}:state.account?{expectedTarget:target,onIdentityEnded:()=>state.ended=true}:{providers:state.providers||['password'],linkOwner:state.linkOwner,onSignedIn:value=>state.signedIn=value}; const root=createRoot(document.getElementById('root')); state.unmount=()=>root.unmount(); root.render(React.createElement(Component,{...props,initialMode:state.initialMode}));`,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  outfile: output,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_SELLER_CLERK_PRODUCTION': '"true"',
  },
});
const bundle = await readFile(output, 'utf8');
const googleLogo=await readFile(new URL('../../public/auth/google-g.png',import.meta.url));
const origin = 'https://www.rogerwilcoaviation.com';
const base = '/api/aircraft-sale/identity';
function identity(state) {
  return state.active
    ? {
        user: {
          id: state.subject || 'fixture-user',
          email: 'seller@example.test',
          name: 'Fixture Seller',
          emailVerified: true,
          twoFactorEnabled: !!state.factor,
          role: 'user',
        },
        session: {
          id: state.sessionId || 'fixture-session',
          token: 'fixture-session-token',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          requiresMfa: !!state.requiresMfa,
          mfaVerifiedAt: state.verified ? new Date().toISOString() : null,
        },
      }
    : null;
}
async function fixture(options = {}) {
  const state = { active: false, requests: [], bridge: 0, ...options };
  let signInStarted;
  state.signInStarted = new Promise((resolve) => {
    signInStarted = resolve;
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(
    (options) => {
      globalThis.__TEST__ = options;
      if (options.stored)
        sessionStorage.setItem('rwas_sale_v2', JSON.stringify(options.stored));
    },
    {
      parent: !!options.parent,
      initialMode: options.initialMode,
      account: !!options.account,
      providers: options.providers,
      stored: options.stored,
      deletion: options.deletion,
      linkOwner: options.linkOwner,
      expectedTarget: options.expectedTarget,
      identityOnly: options.identityOnly,
    },
  );
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (state.methodsCrossOrigin && url.origin === 'https://untrusted.fixture.test' && url.pathname === '/discovery') {
      // Intercepted negative control only: no request reaches an external host.
      return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',json:{methods:['better-auth'],betterAuth:{providers:['password'],legacyLink:false}}});
    }
    assert.equal(
      url.origin,
      origin,
      'No external provider request is allowed in this fixture.',
    );
    if(url.pathname==='/auth/google-g.png')return route.fulfill({contentType:'image/png',body:googleLogo});
    if (url.pathname === '/fixture.js')
      return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (url.pathname === '/rwas-analytics.js')
      return route.fulfill({contentType:'application/javascript',body:'// No analytics transport in local fixtures.'});
    if (url.pathname === '/aircraft-for-sale')
      return route.fulfill({
        contentType: 'text/html',
        body: '<div id="root"></div><script src="/fixture.js"></script>',
      });
    const path = url.pathname;
    let body = {};
    let status = 200;
    const headers = {};
    const requestHeaders = request.headers();
    state.requests.push({
      path,
      method: request.method(),
      body: request.postDataJSON?.(),
      authorization: request.headers().authorization,
      csrf: request.headers()['x-rwas-csrf'],
      sellerQa: request.headers()['x-rwas-seller-qa'],
      targetUser: requestHeaders['x-rwas-identity-user'],
      targetSession: requestHeaders['x-rwas-identity-session'],
      targetChallenge: requestHeaders['x-rwas-identity-challenge'],
    });
    const publicPaths = [
      '/sign-in/email',
      '/sign-up/email',
      '/request-password-reset',
      '/reset-password',
      '/send-verification-email',
    ];
    const isSensitive =
      path.startsWith(base + '/') &&
      !publicPaths.some((suffix) => path === base + suffix) &&
      !['/get-session', '/list-sessions'].some(
        (suffix) => path === base + suffix,
      );
    const hasTarget = !!(
      requestHeaders['x-rwas-identity-user'] ||
      requestHeaders['x-rwas-identity-session']
    );
    const pendingVerification =
      !state.active &&
      state.pendingMfa &&
      ['/two-factor/verify-totp', '/two-factor/verify-backup-code'].some(
        (suffix) => path === base + suffix,
      );
    const matchesTarget = pendingVerification
      ? requestHeaders['x-rwas-identity-user'] ===
          (state.subject || 'fixture-user') &&
        requestHeaders['x-rwas-identity-session'] === 'pending-mfa' &&
        requestHeaders['x-rwas-identity-challenge'] === state.pendingMfa
      : state.active &&
        requestHeaders['x-rwas-identity-user'] ===
          (state.subject || 'fixture-user') &&
        requestHeaders['x-rwas-identity-session'] ===
          (state.sessionId || 'fixture-session') &&
        !requestHeaders['x-rwas-identity-challenge'];
    if ((isSensitive || hasTarget) && !matchesTarget) {
      status = 409;
      body = {
        code: 'IDENTITY_CHANGED',
        message: 'Your secure sign-in changed. Start again.',
      };
    } else if (path === base + '/get-session') body = identity(state);
    else if (path === base + '/list-sessions')
      body = [
        {
          id: 'fixture-session',
          token: 'fixture-session-token',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ];
    else if (path === base + '/sign-in/email') {
      signInStarted();
      if (state.delaySignIn)
        await new Promise((resolve) => {
          state.releaseSignIn = resolve;
        });
      if (state.deny) {
        status = 401;
        body = {
          code: 'INVALID_EMAIL_OR_PASSWORD',
          message: 'Invalid email or password',
        };
      } else if (state.factor) {
        body = { twoFactorRedirect: true };
        state.active = false;
        state.pendingMfa = 'fixture-pending-challenge';
        headers['X-RWAS-Identity-User'] = state.subject || 'fixture-user';
        headers['X-RWAS-Identity-Session'] = 'pending-mfa';
        headers['X-RWAS-Identity-Challenge'] = state.pendingMfa;
      } else {
        state.active = true;
        body = { token: 'fixture-cookie', user: identity(state).user };
      }
    } else if (path === base + '/sign-in/social')
      body = {
        url:
          origin +
          '/aircraft-for-sale?seller-auth=identity&seller-auth-qa=better-auth',
        redirect: false,
      };
    else if (path === base + '/sign-up/email')
      body = {
        token: null,
        user: { id: 'unverified-fixture', email: 'seller@example.test' },
      };
    else if (
      path === base + '/two-factor/verify-totp' ||
      path === base + '/two-factor/verify-backup-code'
    ) {
      state.active = true;
      state.factor = true;
      state.verified = true;
      state.pendingMfa = null;
      if (state.rotateOnVerify) state.sessionId = 'rotated-fixture-session';
      body = { token: 'fixture-cookie', user: identity(state).user };
    } else if (path === base + '/two-factor/enable')
      body = {
        method: 'totp',
        totpURI: 'otpauth://totp/fixture?secret=LOCALFIXTURE',
        backupCodes: ['local-recovery-one', 'local-recovery-two'],
      };
    else if (path === base + '/sign-out') {
      state.active = false;
      body = { success: true };
    } else if (path === base + '/delete-user') {
      if (state.failDelete) {
        state.failDelete = false;
        status = 503;
        body = {
          code: 'UNAVAILABLE',
          message: 'Identity deletion is not confirmed.',
        };
      } else {
        state.deletedUsers = [
          ...(state.deletedUsers || []),
          state.subject || 'fixture-user',
        ];
        state.active = false;
        body = { success: true, message: 'User deleted' };
      }
    } else if (
      path === '/api/aircraft-sale/auth/better-auth' ||
      path === '/api/aircraft-sale/auth/better-auth/link'
    ) {
      state.bridge++;
      body = {
        session: state.rotateOnVerify
          ? 'rotated-rwas-session'
          : 'fixture-rwas-session',
        csrf: state.rotateOnVerify ? 'rotated-rwas-csrf' : 'fixture-csrf',
        email: 'seller@example.test',
        name: 'Fixture Seller',
        identityUserId: state.subject || 'fixture-user',
        identitySessionId: state.sessionId || 'fixture-session',
      };
      if (state.deletionPending) {
        status = 409;
        body = {
          error: 'Seller account was removed; finish identity deletion.',
          code: 'ACCOUNT_DELETION_PENDING',
        };
      }
    } else if (path === '/api/aircraft-sale/auth/methods') {
      if (state.methodsRedirect || state.methodsCrossOrigin)
        return route.fulfill({status:302,headers:{Location:state.methodsCrossOrigin?'https://untrusted.fixture.test/discovery':origin+'/redirected-methods'},body:''});
      if (state.methodsUnavailable) {
        status=503; body={error:'Methods unavailable.'};
      } else body =
        (state.legacyMode || (state.qaGuard && request.headers()['x-rwas-seller-qa'] !== 'better-auth'))
          ? { methods: ['password', 'google'], emailCode: true }
          : {
              methods: ['better-auth'],
              emailCode: false,
              betterAuth: { providers: state.providers || ['password'], legacyLink: !!state.modernLegacy },
              legacyMethods: state.modernLegacy ? ['password'] : [],
            };
    } else if (path === '/redirected-methods')
      body={methods:['better-auth'],emailCode:false,betterAuth:{providers:['password'],legacyLink:false}};
    else if (path === '/api/aircraft-sale/account')
      body = {
        profile: {
          email: 'seller@example.test',
          name: 'Fixture Seller',
          phone: '',
          location: '',
        },
        sessions: [],
      };
    else if (path === '/api/aircraft-sale/logout') body = { ok: true };
    else if (
      [
        base + '/request-password-reset',
        base + '/reset-password',
        base + '/send-verification-email',
        base + '/change-password',
        base + '/change-email',
        base + '/revoke-other-sessions',
      ].includes(path)
    )
      body = { status: true };
    else throw new Error('Unexpected fixture request: ' + path);
    if (
      status === 200 &&
      path.startsWith(base + '/') &&
      (isSensitive || path === base + '/sign-in/email') &&
      state.active
    ) {
      headers['X-RWAS-Identity-User'] = state.subject || 'fixture-user';
      headers['X-RWAS-Identity-Session'] = state.sessionId || 'fixture-session';
      if (isSensitive) state.effects = [...(state.effects || []), path];
    }
    return route.fulfill({
      status,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto(origin + '/aircraft-for-sale' + (options.search || ''));
  return { state, page, close: () => browser.close() };
}
async function credentials(page) {
  await page.getByLabel('Email', { exact: true }).fill('seller@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('Local fixture password 123!');
}

test('marketplace entry offers signup and login, with listing actions only after sign-in', async () => {
  const f = await fixture({ parent: true });
  try {
    const listingAction = f.page.getByRole('button', { name: 'Create a Listing', exact: true });
    assert.equal(await listingAction.count(), 0);
    await f.page.getByRole('button', { name: 'Create Account', exact: true }).click();
    const dialog = f.page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Create your account', exact: true }).waitFor();
    assert.equal(f.state.requests.some((request) => request.path.endsWith('/sign-up/email')), false);
    await dialog.getByRole('button', { name: 'Close seller panel', exact: true }).click();
    await f.page.getByRole('button', { name: 'User Login', exact: true }).click();
    assert.equal(await dialog.getByLabel('Name', { exact: true }).count(), 0);
    await credentials(dialog);
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await listingAction.waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'User Login', exact: true }).count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Create Account', exact: true }).count(), 0);
    await f.page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await f.page.getByRole('button', { name: 'User Login', exact: true }).waitFor();
    assert.equal(await listingAction.count(), 0);
    assert.equal(f.state.bridge, 1);
  } finally {
    await f.close();
  }
});

test('User Login excludes signup and legacy access', async () => {
  const f = await fixture({ parent: true, modernLegacy: true });
  try {
    await f.page
      .getByRole('button', { name: 'User Login', exact: true })
      .click();
    const d = f.page.getByRole('dialog');
    await d.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(
      await d.getByRole('button', { name: /create.*account/i }).count(),
      0,
    );
    assert.equal(
      await d
        .getByText('Access an older RWAS account', { exact: true })
        .count(),
      0,
    );
    await d
      .getByRole('link', { name: 'Forgot password?', exact: true })
      .click();
    await d
      .getByRole('button', { name: 'Send reset email', exact: true })
      .waitFor();
    assert.equal(
      f.state.requests.some((r) => r.path === '/api/aircraft-sale/auth/start'),
      false,
    );
  } finally {
    await f.close();
  }
});
test('recovery hyperlink destination opens recovery directly', async () => {
  const f = await fixture({ parent: true, search: '?seller-auth=forgot' });
  try {
    await f.page
      .getByRole('button', { name: 'Send reset email', exact: true })
      .waitFor();
  } finally {
    await f.close();
  }
});

test('real client password login creates the bound RWAS session without loading Clerk', async () => {
  const f = await fixture();
  try {
    await credentials(f.page);
    await f.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await f.page.waitForFunction(() => !!globalThis.__TEST__.signedIn);
    assert.equal(f.state.bridge, 1);
    const signed = await f.page.evaluate(() => globalThis.__TEST__.signedIn);
    assert.equal(signed.provider, 'better-auth');
    assert.equal(signed.csrf, 'fixture-csrf');
    assert.equal(
      f.state.requests.some((item) => item.path.includes('clerk')),
      false,
    );
    assert.equal(
      await f.page.getByRole('button', { name: 'Continue with Apple' }).count(),
      0,
    );
  } finally {
    await f.close();
  }
});
test('Google signup starts the existing social flow without submitting empty email signup fields', async () => {
  const f = await fixture({
    initialMode: 'signup',
    providers: ['password', 'google'],
  });
  try {
    const button = f.page.getByRole('button', {
      name: 'Sign up with Google',
      exact: true,
    });
    await button.waitFor();
    assert.equal(await button.getAttribute('type'), 'button');
    assert.equal(
      await button.locator('img').getAttribute('src'),
      '/auth/google-g.png',
    );
    await Promise.all([
      f.page.waitForResponse((response) =>
        response.url().endsWith('/sign-in/social'),
      ),
      button.click(),
    ]);
    const request = f.state.requests.find(
      (item) => item.path === base + '/sign-in/social',
    );
    assert.equal(request.body.provider, 'google');
    assert.equal(
      request.body.callbackURL,
      origin + '/aircraft-for-sale?seller-auth=identity',
    );
    assert.equal(
      f.state.requests.some((item) => item.path === base + '/sign-up/email'),
      false,
    );
  } finally {
    await f.close();
  }
});

test('unverified signup waits for email and never creates seller access', async () => {
  const f = await fixture({initialMode:'signup'});
  try {
    await f.page.getByLabel('Name', { exact: true }).fill('Fixture Seller');
    await credentials(f.page);
    await f.page
      .getByRole('button', { name: 'Create your account', exact: true })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'Check your email' })
      .waitFor();
    assert.equal(f.state.bridge, 0);
    assert.equal(
      await f.page.getByLabel('Password', { exact: true }).count(),
      0,
    );
    const call = f.state.requests.find((item) =>
      item.path.endsWith('/sign-up/email'),
    );
    assert.equal(
      call.body.callbackURL,
      origin + '/aircraft-for-sale?seller-auth=identity',
    );
  } finally {
    await f.close();
  }
});
test('login denial stays visible and cannot bridge', async () => {
  const f = await fixture({ deny: true });
  try {
    await credentials(f.page);
    await f.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'Invalid email or password' })
      .waitFor();
    assert.equal(f.state.bridge, 0);
    assert.equal(
      await f.page.getByLabel('Password', { exact: true }).inputValue(),
      '',
    );
  } finally {
    await f.close();
  }
});
test('reset token is removed from URL and sent only to the reset endpoint', async () => {
  const f = await fixture({
    search: '?seller-auth=reset&token=local-fixture-reset-token',
  });
  try {
    await f.page
      .getByLabel('New password', { exact: true })
      .fill('Local replacement password 123!');
    assert.equal(f.page.url().includes('token='), false);
    await f.page
      .getByRole('button', { name: 'Choose a new password', exact: true })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'Password changed' })
      .waitFor();
    const requests = f.state.requests.filter((item) => item.body?.token);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, base + '/reset-password');
    assert.equal(f.state.bridge, 0);
    assert.equal(await f.page.evaluate(() => sessionStorage.length), 0);
  } finally {
    await f.close();
  }
});
test('credential and OAuth MFA gates require official verification before seller bridging', async () => {
  for (const social of [false, true]) {
    const f = await fixture({
      factor: true,
      active: social,
      requiresMfa: true,
    });
    try {
      if (!social) {
        await credentials(f.page);
        await f.page
          .getByRole('button', { name: 'Sign in', exact: true })
          .click();
      }
      await f.page
        .getByLabel('Authenticator code', { exact: true })
        .fill('123456');
      assert.equal(f.state.bridge, 0);
      await f.page.getByRole('button', { name: 'Verify', exact: true }).click();
      await f.page.waitForFunction(() => !!globalThis.__TEST__.signedIn);
      assert.equal(f.state.bridge, 1);
      assert.equal(
        f.state.requests.some((item) =>
          item.path.endsWith('/two-factor/verify-totp'),
        ),
        true,
      );
    } finally {
      await f.close();
    }
  }
});
test('security settings enroll MFA with the real client and render recovery codes locally', async () => {
  const f = await fixture({ account: true, active: true });
  try {
    await f.page.getByText('Sign-in email: seller@example.test').waitFor();
    await f.page
      .getByLabel('Password for security changes', { exact: false })
      .fill('Local fixture password 123!');
    await f.page
      .getByRole('button', { name: 'Set up authenticator', exact: true })
      .click();
    await f.page
      .getByRole('img', { name: 'Authenticator setup QR code', exact: true })
      .waitFor();
    assert.equal(
      await f.page
        .getByLabel('Authenticator setup URI', { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await f.page.getByText('local-recovery-one', { exact: true }).count(),
      0,
    );
    await f.page
      .getByText('Can’t scan? Set up manually', { exact: true })
      .click();
    const manual = f.page.getByLabel('Authenticator setup URI', {
      exact: true,
    });
    await manual.waitFor();
    assert.equal(
      await manual.inputValue(),
      'otpauth://totp/fixture?secret=LOCALFIXTURE',
    );
    await f.page
      .getByText('Can’t scan? Set up manually', { exact: true })
      .click();
    await f.page.waitForFunction(
      () =>
        !document.querySelector(
          'textarea[aria-label="Authenticator setup URI"]',
        ),
    );
    await f.page.getByText('Show recovery codes', { exact: true }).click();
    await f.page.getByText('local-recovery-one', { exact: true }).waitFor();
    assert.equal(
      f.state.requests.find((item) => item.path.endsWith('/two-factor/enable'))
        .body.method,
      'totp',
    );
    await f.page
      .getByLabel('Authenticator code', { exact: true })
      .fill('123456');
    await f.page
      .getByRole('button', { name: 'Verify authenticator', exact: true })
      .click();
    await f.page.getByText('Two-factor authentication is enabled.').waitFor();
    assert.equal(
      await f.page
        .getByRole('img', { name: 'Authenticator setup QR code', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await f.page
        .getByLabel('Authenticator setup URI', { exact: true })
        .count(),
      0,
    );
    assert.equal(
      f.state.requests.some((item) => item.path.includes('clerk')),
      false,
    );
  } finally {
    await f.close();
  }
});

test('mandatory MFA enrollment can finish before business access is issued', async () => {
  const f = await fixture({ active: true, requiresMfa: true });
  try {
    await f.page
      .getByText(
        'Two-factor authentication is required before seller access is available.',
      )
      .waitFor();
    assert.equal(f.state.bridge, 0);
    const next = f.page.getByRole('button', {
      name: 'Continue to seller account',
      exact: true,
    });
    assert.equal(await next.isDisabled(), true);
    await f.page
      .getByRole('button', { name: 'Set up authenticator', exact: true })
      .click();
    await f.page
      .getByRole('img', { name: 'Authenticator setup QR code', exact: true })
      .waitFor();
    await f.page
      .getByLabel('Authenticator code', { exact: true })
      .fill('123456');
    await f.page
      .getByRole('button', { name: 'Verify authenticator', exact: true })
      .click();
    await next.waitFor();
    await next.click();
    await f.page.waitForFunction(() => !!globalThis.__TEST__.signedIn);
    assert.equal(f.state.bridge, 1);
  } finally {
    await f.close();
  }
});

test('parent restores only a current cookie and clears RWAS access after cookie loss', async () => {
  const stored = {
    provider: 'better-auth',
    token: 'fixture-rwas-session',
    csrf: 'fixture-csrf',
    email: 'seller@example.test',
    name: 'Fixture Seller',
    identityUserId: 'fixture-user',
    identitySessionId: 'fixture-session',
  };
  const f = await fixture({
    parent: true,
    active: true,
    stored,
    search: '?seller-auth-qa=better-auth',
  });
  try {
    await f.page
      .getByRole('button', { name: 'Account', exact: true })
      .waitFor();
    f.state.active = false;
    await f.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'Your sign-in session ended' })
      .waitFor();
    assert.equal(
      await f.page.evaluate(() => sessionStorage.getItem('rwas_sale_v2')),
      null,
    );
    assert.equal(
      f.state.requests.some((item) => item.path.includes('clerk')),
      false,
    );
    assert.equal(f.state.bridge, 0);
  } finally {
    await f.close();
  }
});

test('partial deletion retries only identity cleanup and never repeats business deletion', async () => {
  const f = await fixture({ deletion: true, active: true, failDelete: true });
  try {
    await f.page
      .getByLabel('Current RWAS contact email', { exact: true })
      .fill('seller@example.test');
    await f.page
      .getByRole('button', { name: 'Permanently delete account', exact: true })
      .click();
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'Identity deletion is not confirmed' })
      .waitFor();
    assert.equal(
      await f.page.evaluate(() => globalThis.__TEST__.businessDeletes),
      1,
    );
    assert.equal(
      await f.page.evaluate(() => !!globalThis.__TEST__.deleted),
      false,
    );
    await f.page
      .getByRole('button', {
        name: 'Finish secure identity deletion',
        exact: true,
      })
      .click();
    await f.page.waitForFunction(() => !!globalThis.__TEST__.deleted);
    assert.equal(
      await f.page.evaluate(() => globalThis.__TEST__.businessDeletes),
      1,
    );
    assert.equal(
      f.state.requests.filter((item) => item.path.endsWith('/delete-user'))
        .length,
      2,
    );
  } finally {
    await f.close();
  }
});

test('exact deletion-pending code resumes identity cleanup after a page reload', async () => {
  const f = await fixture({ active: true, deletionPending: true });
  try {
    await f.page
      .getByRole('button', {
        name: 'Finish secure identity deletion',
        exact: true,
      })
      .waitFor();
    assert.equal(
      f.state.requests.some((item) => item.path.endsWith('/delete-user')),
      false,
    );
    await f.page
      .getByRole('button', {
        name: 'Finish secure identity deletion',
        exact: true,
      })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'were deleted' })
      .waitFor();
    assert.equal(f.state.bridge, 1);
    assert.equal(
      f.state.requests.filter((item) => item.path.endsWith('/delete-user'))
        .length,
      1,
    );
  } finally {
    await f.close();
  }
});

test('existing-account linking requires explicit confirmation of the same verified identity', async () => {
  const f = await fixture({
    active: true,
    linkOwner: { token: 'old-owner-fixture' },
  });
  try {
    const confirm = f.page.getByRole('button', {
      name: 'Connect this verified login',
      exact: true,
    });
    await confirm.waitFor();
    assert.equal(f.state.bridge, 0);
    f.state.subject = 'different-fixture-identity';
    await confirm.click();
    assert.equal(
      f.state.bridge,
      0,
      'A stale confirmed identity must never be replaced by the new cookie.',
    );
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'secure sign-in changed' })
      .waitFor();
    assert.equal(f.state.bridge, 0);
    assert.equal(
      await f.page.evaluate(() => !!globalThis.__TEST__.signedIn),
      false,
    );
  } finally {
    await f.close();
  }
});

test('a closed panel cannot create seller access from a late sign-in result', async () => {
  const f = await fixture({ delaySignIn: true });
  try {
    await credentials(f.page);
    await f.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await f.state.signInStarted;
    await f.page.evaluate(() => globalThis.__TEST__.unmount());
    const response = f.page.waitForResponse((value) =>
      value.url().endsWith('/sign-in/email'),
    );
    f.state.releaseSignIn();
    await (await response).finished();
    await f.page.waitForTimeout(50);
    assert.equal(f.state.bridge, 0);
    assert.equal(
      await f.page.evaluate(() => !!globalThis.__TEST__.signedIn),
      false,
    );
  } finally {
    await f.close();
  }
});

test('successful MFA session rotation refreshes the bound RWAS session and request headers', async () => {
  const stored = {
    provider: 'better-auth',
    token: 'fixture-rwas-session',
    csrf: 'fixture-csrf',
    email: 'seller@example.test',
    name: 'Fixture Seller',
    identityUserId: 'fixture-user',
    identitySessionId: 'fixture-session',
  };
  const f = await fixture({
    parent: true,
    active: true,
    stored,
    rotateOnVerify: true,
    search: '?seller-auth-qa=better-auth',
  });
  try {
    await f.page.getByRole('button', { name: 'Account', exact: true }).click();
    await f.page.getByRole('tab', { name: 'Sign-in and security', exact: true }).click();
    await f.page.getByText('Sign-in email: seller@example.test').waitFor();
    await f.page
      .getByLabel('Password for security changes', { exact: false })
      .fill('Local fixture password 123!');
    await f.page
      .getByRole('button', { name: 'Set up authenticator', exact: true })
      .click();
    await f.page
      .getByLabel('Authenticator code', { exact: true })
      .fill('123456');
    await f.page
      .getByRole('button', { name: 'Verify authenticator', exact: true })
      .click();
    await f.page.waitForFunction(
      () =>
        JSON.parse(sessionStorage.getItem('rwas_sale_v2') || 'null')?.token ===
        'rotated-rwas-session',
    );
    const bridge = f.state.requests.find((item) =>
      item.path.endsWith('/auth/better-auth'),
    );
    assert.equal(bridge.body.expectedUserId, 'fixture-user');
    assert.equal(bridge.body.expectedSessionId, 'rotated-fixture-session');
    await f.page.getByRole('tab', { name: 'Contact profile', exact: true }).click();
    await f.page
      .getByRole('button', { name: 'Save Profile', exact: true })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'Profile updated' })
      .waitFor();
    const update = f.state.requests.find(
      (item) => item.path.endsWith('/account') && item.method === 'PATCH',
    );
    assert.equal(update.authorization, 'Bearer rotated-rwas-session');
    assert.equal(update.csrf, 'rotated-rwas-csrf');
  } finally {
    await f.close();
  }
});

test('stale account panels bind every sensitive mutation to the displayed identity and session', async () => {
  const actions = [
    {
      path: '/change-email',
      run: async (page) => {
        await page
          .getByLabel('New sign-in email', { exact: true })
          .fill('new@example.test');
        await page
          .getByRole('button', {
            name: 'Verify new sign-in email',
            exact: true,
          })
          .click();
      },
    },
    {
      path: '/change-password',
      run: async (page) => {
        await page
          .getByLabel('Current password', { exact: true })
          .fill('Local fixture password 123!');
        await page
          .getByLabel('New password', { exact: true })
          .fill('Local replacement password 123!');
        await page
          .getByRole('button', { name: 'Change password', exact: true })
          .click();
      },
    },
    {
      path: '/revoke-other-sessions',
      run: async (page) => {
        await page
          .getByRole('button', { name: 'Sign out other devices', exact: true })
          .click();
      },
    },
    {
      path: '/two-factor/enable',
      run: async (page) => {
        await page
          .getByRole('button', { name: 'Set up authenticator', exact: true })
          .click();
      },
    },
    {
      path: '/two-factor/disable',
      factor: true,
      run: async (page) => {
        await page
          .getByRole('button', { name: 'Disable authenticator', exact: true })
          .click();
      },
    },
    {
      path: '/two-factor/generate-backup-codes',
      factor: true,
      run: async (page) => {
        await page
          .getByRole('button', { name: 'Replace recovery codes', exact: true })
          .click();
      },
    },
  ];
  for (const action of actions) {
    const f = await fixture({
      account: true,
      active: true,
      factor: !!action.factor,
    });
    try {
      await f.page.getByText('Sign-in email: seller@example.test').waitFor();
      f.state.subject = 'other-user';
      f.state.sessionId = 'other-session';
      await action.run(f.page);
      await f.page
        .getByRole('alert')
        .filter({ hasText: 'secure sign-in changed' })
        .waitFor();
      const request = f.state.requests.find(
        (item) => item.path === base + action.path,
      );
      assert.equal(request.targetUser, 'fixture-user', action.path);
      assert.equal(request.targetSession, 'fixture-session', action.path);
      assert.deepEqual(
        f.state.effects || [],
        [],
        action.path + ' must not affect B',
      );
    } finally {
      await f.close();
    }
  }
});

test('a replaced session for the same user is rejected rather than silently adopted', async () => {
  const f = await fixture({ account: true, active: true });
  try {
    await f.page.getByText('Sign-in email: seller@example.test').waitFor();
    f.state.sessionId = 'replacement-same-user-session';
    await f.page
      .getByRole('button', { name: 'Sign out other devices', exact: true })
      .click();
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'secure sign-in changed' })
      .waitFor();
    assert.deepEqual(f.state.effects || [], []);
    const request = f.state.requests.find(
      (item) => item.path === base + '/revoke-other-sessions',
    );
    assert.equal(request.targetSession, 'fixture-session');
  } finally {
    await f.close();
  }
});

test('resuming A identity deletion cannot delete a newly signed-in B account', async () => {
  const f = await fixture({ deletion: true, active: true, failDelete: true });
  try {
    await f.page
      .getByLabel('Current RWAS contact email', { exact: true })
      .fill('seller@example.test');
    await f.page
      .getByRole('button', { name: 'Permanently delete account', exact: true })
      .click();
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'Identity deletion is not confirmed' })
      .waitFor();
    f.state.subject = 'other-user';
    f.state.sessionId = 'other-session';
    await f.page
      .getByRole('button', {
        name: 'Finish secure identity deletion',
        exact: true,
      })
      .click();
    await f.page
      .getByRole('alert')
      .filter({ hasText: 'secure sign-in changed' })
      .waitFor();
    assert.deepEqual(f.state.deletedUsers || [], []);
    assert.equal(
      await f.page.evaluate(() => globalThis.__TEST__.businessDeletes),
      1,
    );
    assert.equal(
      await f.page.evaluate(() => !!globalThis.__TEST__.deleted),
      false,
    );
    const requests = f.state.requests.filter(
      (item) => item.path === base + '/delete-user',
    );
    assert.equal(requests.length, 2);
    assert.ok(
      requests.every(
        (item) =>
          item.targetUser === 'fixture-user' &&
          item.targetSession === 'fixture-session',
      ),
    );
  } finally {
    await f.close();
  }
});

test('pending MFA cannot verify another active user or a replaced signed challenge', async () => {
  for (const replacement of [
    'active-other',
    'pending-other',
    'pending-same-user',
  ]) {
    const f = await fixture({ factor: true, requiresMfa: true });
    try {
      await credentials(f.page);
      await f.page
        .getByRole('button', { name: 'Sign in', exact: true })
        .click();
      await f.page
        .getByLabel('Authenticator code', { exact: true })
        .fill('123456');
      if (replacement === 'active-other') {
        f.state.active = true;
        f.state.subject = 'other-user';
        f.state.sessionId = 'other-session';
      } else {
        f.state.pendingMfa = 'replacement-pending-challenge';
        if (replacement === 'pending-other') f.state.subject = 'other-user';
      }
      await f.page.getByRole('button', { name: 'Verify', exact: true }).click();
      await f.page
        .getByRole('alert')
        .filter({ hasText: 'secure sign-in changed' })
        .waitFor();
      const verify = f.state.requests.find(
        (item) => item.path === base + '/two-factor/verify-totp',
      );
      assert.equal(verify.targetUser, 'fixture-user');
      assert.equal(verify.targetSession, 'pending-mfa');
      assert.equal(verify.targetChallenge, 'fixture-pending-challenge');
      assert.equal(!!f.state.verified, false);
      assert.equal(f.state.bridge, 0);
    } finally {
      await f.close();
    }
  }
});

test('matching displayed account target permits a security change', async () => {
  const f = await fixture({ account: true, active: true });
  try {
    await f.page.getByText('Sign-in email: seller@example.test').waitFor();
    await f.page
      .getByRole('button', { name: 'Sign out other devices', exact: true })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'Other sign-in sessions revoked' })
      .waitFor();
    const request = f.state.requests.find(
      (item) => item.path === base + '/revoke-other-sessions',
    );
    assert.equal(request.targetUser, 'fixture-user');
    assert.equal(request.targetSession, 'fixture-session');
    assert.deepEqual(f.state.effects, [base + '/revoke-other-sessions']);
  } finally {
    await f.close();
  }
});

test('ordinary and invalid QA entries retain Auth0 discovery and UI without identity calls', async () => {
  for (const search of [
    '',
    '?seller-auth-qa=wrong',
    '?seller-auth-qa=better-auth&seller-auth-qa=better-auth',
  ]) {
    const f = await fixture({ parent: true, qaGuard: true, search });
    try {
      await f.page
        .getByRole('button', { name: 'User Login', exact: true })
        .click();
      await f.page
        .getByRole('button', { name: 'Email and password', exact: true })
        .waitFor();
      await f.page
        .getByRole('button', { name: 'Continue with Google', exact: true })
        .waitFor();
      assert.equal(
        await f.page
          .getByRole('region', { name: 'User secure sign-in', exact: true })
          .count(),
        0,
      );
      const methods = f.state.requests.find(
        (item) => item.path === '/api/aircraft-sale/auth/methods',
      );
      assert.equal(methods.sellerQa, undefined);
      assert.equal(
        f.state.requests.some((item) => item.path.startsWith(base + '/')),
        false,
      );
      assert.equal(f.state.bridge, 0);
    } finally {
      await f.close();
    }
  }
});

test('exact explicit QA entry opts into Better Auth discovery and can complete its bound password flow', async () => {
  const f = await fixture({
    parent: true,
    qaGuard: true,
    search: '?seller-auth-qa=better-auth',
  });
  try {
    await f.page
      .getByRole('button', { name: 'User Login', exact: true })
      .click();
    await f.page
      .getByRole('region', { name: 'User secure sign-in', exact: true })
      .waitFor();
    await credentials(f.page);
    await f.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await f.page
      .getByRole('button', { name: 'Account', exact: true })
      .waitFor();
    assert.equal(
      f.state.requests.find(
        (item) => item.path === '/api/aircraft-sale/auth/methods',
      ).sellerQa,
      'better-auth',
    );
    assert.equal(f.state.bridge, 1);
    assert.equal(
      f.state.requests.some((item) => item.path.includes('clerk')),
      false,
    );
  } finally {
    await f.close();
  }
});

test('QA mode without explicit opt-in discards a Better Auth envelope and preserves legacy discovery', async () => {
  const stored = {
    provider: 'better-auth',
    token: 'fixture-rwas-session',
    csrf: 'fixture-csrf',
    email: 'seller@example.test',
    name: 'Fixture Seller',
    identityUserId: 'fixture-user',
    identitySessionId: 'fixture-session',
  };
  const f = await fixture({ parent: true, qaGuard: true, active: true, stored });
  try {
    await f.page.waitForFunction(
      () => sessionStorage.getItem('rwas_sale_v2') === null,
    );
    assert.equal(
      await f.page
        .getByRole('button', { name: 'Account', exact: true })
        .count(),
      0,
    );
    assert.equal(
      f.state.requests.some((item) => item.path.startsWith(base + '/')),
      false,
    );
    assert.equal(f.state.bridge, 0);
  } finally {
    await f.close();
  }
});

test('QA signup verification, password recovery and social callbacks preserve only the fixed explicit QA marker', async () => {
  for (const flow of ['signup', 'forgot', 'social']) {
    const f = await fixture({
      providers: ['password', 'google'],
      search: '?seller-auth-qa=better-auth',
      initialMode: flow === 'signup' ? 'signup' : 'login',
    });
    try {
      if (flow === 'signup') {
        await f.page.getByLabel('Name', { exact: true }).fill('Fixture Seller');
        await credentials(f.page);
        await f.page
          .getByRole('button', { name: 'Create your account', exact: true })
          .click();
        await f.page
          .getByRole('status')
          .filter({ hasText: 'Check your email' })
          .waitFor();
        await f.page
          .getByRole('button', {
            name: 'Resend verification email',
            exact: true,
          })
          .click();
        await f.page
          .getByRole('status')
          .filter({ hasText: 'a new email has been sent' })
          .waitFor();
        for (const suffix of ['/sign-up/email', '/send-verification-email']) {
          const request = f.state.requests.find(
            (item) => item.path === base + suffix,
          );
          const callback = new URL(request.body.callbackURL);
          assert.equal(callback.origin, origin);
          assert.equal(callback.pathname, '/aircraft-for-sale');
          assert.equal(callback.searchParams.get('seller-auth'), 'identity');
          assert.equal(
            callback.searchParams.get('seller-auth-qa'),
            'better-auth',
          );
        }
      } else if (flow === 'forgot') {
        await f.page
          .getByRole('link', { name: 'Forgot password?', exact: true })
          .click();
        await f.page
          .getByLabel('Email', { exact: true })
          .fill('seller@example.test');
        await f.page
          .getByRole('button', { name: 'Send reset email', exact: true })
          .click();
        await f.page
          .getByRole('status')
          .filter({ hasText: 'password-reset email has been sent' })
          .waitFor();
        const request = f.state.requests.find(
          (item) => item.path === base + '/request-password-reset',
        );
        const callback = new URL(request.body.redirectTo);
        assert.equal(callback.origin, origin);
        assert.equal(callback.searchParams.get('seller-auth'), 'reset');
        assert.equal(
          callback.searchParams.get('seller-auth-qa'),
          'better-auth',
        );
      } else {
        await Promise.all([
          f.page.waitForResponse((response) =>
            response.url().endsWith('/sign-in/social'),
          ),
          f.page
            .getByRole('button', { name: 'Continue with Google', exact: true })
            .click(),
        ]);
        const request = f.state.requests.find(
          (item) => item.path === base + '/sign-in/social',
        );
        for (const key of ['callbackURL', 'errorCallbackURL']) {
          const callback = new URL(request.body[key]);
          assert.equal(callback.origin, origin);
          assert.equal(callback.searchParams.get('seller-auth'), 'identity');
          assert.equal(
            callback.searchParams.get('seller-auth-qa'),
            'better-auth',
          );
        }
      }
    } finally {
      await f.close();
    }
  }
});

test('an explicit QA reset callback enters only the reset flow and removes its URL token', async () => {
  const f = await fixture({
    parent: true,
    qaGuard: true,
    search:
      '?seller-auth=reset&seller-auth-qa=better-auth&token=local-fixture-reset-token',
  });
  try {
    await f.page
      .getByLabel('New password', { exact: true })
      .fill('Local replacement password 123!');
    assert.equal(new URL(f.page.url()).searchParams.has('token'), false);
    assert.equal(
      new URL(f.page.url()).searchParams.get('seller-auth-qa'),
      'better-auth',
    );
    await f.page
      .getByRole('button', { name: 'Choose a new password', exact: true })
      .click();
    await f.page
      .getByRole('status')
      .filter({ hasText: 'Password changed' })
      .waitFor();
    assert.equal(
      f.state.requests.find(
        (item) => item.path === '/api/aircraft-sale/auth/methods',
      ).sellerQa,
      'better-auth',
    );
    assert.equal(f.state.requests.filter((item) => item.body?.token).length, 1);
    assert.equal(
      f.state.requests.find((item) => item.body?.token).path,
      base + '/reset-password',
    );
    assert.equal(f.state.bridge, 0);
  } finally {
    await f.close();
  }
});


test('public mode uses advertised Better Auth without a QA marker and completes bound password sign-in', async () => {
  const f=await fixture({parent:true});
  try{
    await f.page.getByRole('button',{name:'User Login',exact:true}).click();
    await f.page.getByRole('region',{name:'User secure sign-in',exact:true}).waitFor();
    const methods=f.state.requests.find(r=>r.path==='/api/aircraft-sale/auth/methods');
    assert.equal(methods.sellerQa,undefined);
    assert.equal(await f.page.getByRole('button',{name:'Continue with Google',exact:true}).count(),0);
    assert.equal(await f.page.getByRole('button',{name:'Continue with Apple',exact:true}).count(),0);
    await credentials(f.page);
    await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await f.page.getByRole('button',{name:'Account',exact:true}).waitFor();
    assert.equal(f.state.bridge,1);
    assert.equal(f.state.requests.some(r=>r.path.includes('clerk')),false);
  }finally{await f.close();}
});

test('public mode restores only the matching stored immutable identity without QA opt-in', async () => {
  const stored={provider:'better-auth',token:'fixture-rwas-session',csrf:'fixture-csrf',email:'seller@example.test',name:'Fixture Seller',identityUserId:'fixture-user',identitySessionId:'fixture-session'};
  for(const changedIdentity of [false,true]){
    const f=await fixture({parent:true,active:true,stored,...(changedIdentity?{subject:'different-user'}:{})});
    try{
      if(!changedIdentity){
        await f.page.getByRole('button',{name:'Account',exact:true}).waitFor();
        assert.equal(await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('rwas_sale_v2')).identityUserId),'fixture-user');
      }else{
        await f.page.waitForFunction(()=>sessionStorage.getItem('rwas_sale_v2')===null);
        assert.equal(await f.page.getByRole('button',{name:'Account',exact:true}).count(),0);
      }
      assert.equal(f.state.requests.find(r=>r.path==='/api/aircraft-sale/auth/methods').sellerQa,undefined);
      assert.ok(f.state.requests.some(r=>r.path===base+'/get-session'));
      assert.equal(f.state.bridge,0,'session restoration never adopts or relinks another identity');
    }finally{await f.close();}
  }
});

test('public reset callback needs no QA marker and sends its token only to the reset endpoint', async () => {
  const f=await fixture({parent:true,search:'?seller-auth=reset&token=local-public-reset-token'});
  try{
    await f.page.getByLabel('New password',{exact:true}).fill('Local replacement password 123!');
    assert.equal(new URL(f.page.url()).searchParams.has('token'),false);
    assert.equal(new URL(f.page.url()).searchParams.has('seller-auth-qa'),false);
    await f.page.getByRole('button',{name:'Choose a new password',exact:true}).click();
    await f.page.getByRole('status').filter({hasText:'Password changed'}).waitFor();
    const tokenRequests=f.state.requests.filter(r=>r.body?.token);
    assert.equal(tokenRequests.length,1);assert.equal(tokenRequests[0].path,base+'/reset-password');
    assert.equal(f.state.bridge,0);
  }finally{await f.close();}
});

test('legacy, unavailable, redirected and cross-origin discovery never activate Better Auth identity flows', async () => {
  for(const options of [{legacyMode:true},{methodsUnavailable:true},{methodsRedirect:true},{methodsCrossOrigin:true}]){
    const f=await fixture({parent:true,search:'?seller-auth=identity',...options});
    try{
      if(options.legacyMode){
        await f.page.getByRole('button',{name:'User Login',exact:true}).click();
        await f.page.getByRole('button',{name:'Email and password',exact:true}).waitFor();
      }else{
        await f.page.waitForFunction(()=>!new URL(location.href).searchParams.has('seller-auth'));
      }
      assert.equal(await f.page.getByRole('region',{name:'User secure sign-in',exact:true}).count(),0);
      assert.equal(f.state.requests.some(r=>r.path.startsWith(base+'/')),false);
      assert.equal(f.state.bridge,0);
    }finally{await f.close();}
  }
});
