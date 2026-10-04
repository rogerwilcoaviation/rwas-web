import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fixture } from './fixture.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const widget = await readFile('public/jerry-widget.js', 'utf8');
const origin = 'http://localhost';
const cases = [
  {
    name: 'plain staging guard',
    status: 503,
    body: 'Staging destination not allowed',
    message: 'Aircraft listing service is temporarily unavailable.',
  },
  {
    name: 'backend failure',
    status: 500,
    body: '{"error":"private backend detail"}',
    message: 'Aircraft listing service is temporarily unavailable.',
  },
  {
    name: 'expired session',
    status: 401,
    body: '{}',
    message: 'Your seller session has expired. Sign in again to continue.',
  },
  {
    name: 'ownership denial',
    status: 403,
    body: '{}',
    message: 'Your account cannot access this listing conversation.',
  },
  {
    name: 'rate limit',
    status: 429,
    body: '{}',
    message: 'Too many requests. Wait a moment before trying again.',
  },
  {
    name: 'network failure',
    abort: true,
    message: 'Aircraft listing service is temporarily unavailable.',
  },
  {
    name: 'general chat failure',
    general: true,
    status: 503,
    body: '{}',
    message: 'Chat is temporarily unavailable.',
  },
  {
    name: 'empty chat reply',
    general: true,
    status: 200,
    body: '{}',
    message: 'Chat is temporarily unavailable.',
  },
  {
    name: 'saved draft outage',
    draft: true,
    status: 503,
    body: 'Staging destination not allowed',
    message: 'Aircraft listing service is temporarily unavailable.',
  },
  {
    name: 'saved draft expired session',
    draft: true,
    status: 401,
    body: '{}',
    message: 'Your seller session has expired. Sign in again to continue.',
  },
];
const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const scenario of cases) {
    const f = fixture();
    // Real seller implementation, disposable storage and captured test mail only.
    const token = await f.login('unattended-seller@example.test');
    const context = await browser.newContext();
    const errors = [];
    let failed = false;
    let recovered = false;
    let apiCalls = 0;
    await context.addInitScript(
      ({ token }) => {
        sessionStorage.setItem(
          'rwas_sale_v2',
          JSON.stringify({ token, email: 'unattended-seller@example.test' }),
        );
      },
      { token },
    );
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.href === origin + '/aircraft-for-sale') {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><head></head><body><script src="/jerry-widget.js"></script></body></html>',
        });
      } else if (url.href === origin + '/jerry-widget.js') {
        await route.fulfill({
          contentType: 'application/javascript',
          body: widget,
        });
      } else if (
        url.href === origin + '/api/aircraft-sale/intake' ||
        url.href === origin + '/api/aircraft-sale/draft' ||
        url.href === 'https://rogerwilcoaviation.com/api/chat'
      ) {
        apiCalls++;
        if (!failed) {
          failed = true;
          if (scenario.abort) await route.abort();
          else
            await route.fulfill({
              status: scenario.status,
              contentType: scenario.body.startsWith('{')
                ? 'application/json'
                : 'text/plain',
              body: scenario.body,
            });
        } else if (scenario.general) {
          recovered = true;
          await route.fulfill({ json: { reply: 'Synthetic chat recovered.' } });
        } else {
          const response = scenario.draft
            ? await f.call('/draft', 'GET', undefined, token)
            : await f.call(
                '/intake',
                'POST',
                route.request().postDataJSON(),
                token,
              );
          assert.equal(response.status, 200);
          recovered = true;
          await route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: await response.text(),
          });
        }
      } else {
        // No requests ever leave this browser fixture.
        await route.abort();
      }
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin + '/aircraft-for-sale');
      await page
        .getByRole('button', { name: 'Chat with Captain Jerry' })
        .click();
      const text = scenario.general
        ? 'Hello'
        : scenario.draft
          ? 'submit'
          : 'I want to list my aircraft';
      await page.locator('.jerry-widget-text-input').fill(text);
      await page.locator('.jerry-widget-send').click();
      const alert = page.getByRole('alert');
      await alert.waitFor();
      assert.ok((await alert.textContent()).startsWith(scenario.message));
      assert.ok((await alert.textContent()).includes('saved in this tab'));
      assert.ok(
        !(await alert.textContent()).includes('private backend detail'),
      );
      assert.ok(
        !(await alert.textContent()).includes(
          'Staging destination not allowed',
        ),
      );
      await page.waitForFunction(
        () => !document.querySelector('.jerry-widget-send').disabled,
      );
      assert.equal(Object.keys(f.state().listings).length, 0);
      const history = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('jerry-chat-history')),
      );
      assert.equal(history.at(-1).content, text);
      // Reconnect/session renewal is simulated by the fixture, never by bypassing auth.
      await page.locator('.jerry-widget-text-input').fill(text);
      await page.locator('.jerry-widget-send').click();
      await page.waitForFunction(
        (expected) => {
          const history = JSON.parse(
            sessionStorage.getItem('jerry-chat-history'),
          );
          return (
            history.at(-1).role === 'assistant' &&
            history.at(-1).content.includes(expected)
          );
        },
        scenario.general
          ? 'Synthetic chat recovered.'
          : scenario.draft
            ? 'Review your details in the seller panel'
            : 'What is your aircraft N-number?',
      );
      await page.waitForFunction(
        () => !document.querySelector('.jerry-widget-send').disabled,
      );
      assert.equal(await alert.isVisible(), false);
      assert.equal(recovered, true);
      assert.equal(apiCalls, 2);
      assert.equal(Object.keys(f.state().listings).length, 0);
      assert.deepEqual(errors, []);
      results.push({
        case: scenario.name,
        result: 'PASS',
        user: 'unattended-seller@example.test',
        scope: 'disposable local fixture only',
      });
      console.log(
        'PASS ' + scenario.name + ': saved conversation and recovery',
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (process.env.CHAT_EVIDENCE_PATH)
    await writeFile(
      process.env.CHAT_EVIDENCE_PATH,
      JSON.stringify(
        { results, externalRequests: 0, liveAccountsCreated: 0 },
        null,
        2,
      ),
    );
}
