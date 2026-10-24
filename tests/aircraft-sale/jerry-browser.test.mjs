import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serviceFixture } from './jerry-fixture.mjs';
import { jerryWebsite } from '../../workers/aircraft-sale/jerry-service.mjs';
import { listingCategories } from '../../lib/marketplace/schema.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const moduleSource = await readFile(
  new URL('../../public/jerry-account-chat.mjs', import.meta.url),
  'utf8',
);
const widgetSource = await readFile(
  new URL('../../public/jerry-widget.js', import.meta.url),
  'utf8',
);
async function fixture(run) {
  const f = await serviceFixture(),
    browser = await chromium.launch({ headless: true }),
    context = await browser.newContext({
      viewport: { width: 393, height: 850 },
    });
  const errors = [],
    requests = [];
  await context.addInitScript(() => {
    sessionStorage.setItem(
      'jerry-chat-history',
      JSON.stringify([
        { role: 'assistant', content: 'LEGACY PRIVATE MUST NOT IMPORT' },
      ]),
    );
    window.rwasSellerRequestHeaders = async () => ({
      Authorization: 'Bearer fixture-token',
    });
  });
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    requests.push(url.pathname);
    if (url.pathname === '/jerry-account-chat.mjs')
      return route.fulfill({
        contentType: 'application/javascript',
        body: moduleSource,
      });
    if (url.pathname === '/jerry-widget.js')
      return route.fulfill({
        contentType: 'application/javascript',
        body: widgetSource,
      });
    if (
      url.pathname === '/api/jerry/context' ||
      url.pathname === '/api/jerry/website'
    ) {
      try {
        const data = url.pathname.endsWith('/context')
          ? { operation: 'context' }
          : JSON.parse(req.postData());
        const result = await jerryWebsite(f.env, { ...data, proof: f.proof });
        await route.fulfill({ json: result });
      } catch (error) {
        try {
          await route.fulfill({
            status: error.status || 503,
            json: { error: error.message, code: error.code },
          });
        } catch {}
      }
      return;
    }
    if (url.pathname === '/aircraft-for-sale' || url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><body><script src="/jerry-widget.js"></script></body></html>',
      });
    return route.fulfill({
      status: 404,
      body: 'Synthetic fixture route unavailable',
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await run({ f, page, context, requests });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
const open = async (page) => {
  await page.goto('http://localhost/aircraft-for-sale');
  await page.waitForSelector('.jerry-account-chat', { state: 'attached' });
  await page.locator('.jerry-widget-bubble').click();
};
const send = async (page, text) => {
  await page
    .locator('.jerry-widget-text-input,.jerry-widget-input input')
    .fill(text);
  await page.locator('.jerry-widget-input button').click();
};
test('account switch during conversation creation cannot submit the first account’s text under the second account', async () =>
  fixture(async ({ f, page }) => {
    await open(page);
    let release,
      started,
      held = false;
    const begun = new Promise((r) => {
      started = r;
    });
    await page.route('**/api/jerry/website', async (route) => {
      const body = JSON.parse(route.request().postData());
      if (body.operation === 'list' && !held) {
        held = true;
        started();
        await new Promise((r) => {
          release = r;
        });
      }
      await route.fallback();
    });
    await send(page, 'OLD ACCOUNT PRIVATE TEXT');
    await begun;
    f.identity.subject = 'synthetic-second-account';
    await page.evaluate(() =>
      document.dispatchEvent(new CustomEvent('rwas:session-changed')),
    );
    await page
      .getByRole('button', { name: 'New conversation', exact: true })
      .waitFor();
    await send(page, 'Second account question');
    await page
      .getByText('Synthetic reply N123AB, 145.', { exact: true })
      .waitFor();
    release();
    await page.waitForTimeout(100);
    const second = [...f.objects].find(
      ([key]) => !key.startsWith(f.owner + ':'),
    )[1];
    const turns = [...second.existing.values()].filter((v) => v.input);
    assert.deepEqual(
      turns.map((t) => t.input.message),
      ['Second account question'],
    );
    assert.equal(
      await page.getByText('OLD ACCOUNT PRIVATE TEXT', { exact: true }).count(),
      0,
    );
  }));
test('failed reply recovery keeps a separately typed next message and blocks premature advancement', async () =>
  fixture(async ({ f, page }) => {
    f.relay(async () => new Response('', { status: 503 }));
    await open(page);
    await send(page, 'First synthetic question');
    await page
      .getByRole('button', { name: 'Retry this message', exact: true })
      .waitFor();
    await send(page, 'Keep this next message');
    await page
      .getByText(
        'A message is awaiting a result. Retry it before sending another.',
        { exact: true },
      )
      .waitFor();
    f.relay(async () => Response.json({ reply: 'Recovered original message' }));
    await page
      .getByRole('button', { name: 'Retry this message', exact: true })
      .click();
    await page
      .getByText('Recovered original message', { exact: true })
      .waitFor();
    assert.equal(
      await page.locator('.jerry-widget-input input').inputValue(),
      'Keep this next message',
    );
    assert.equal(
      (
        await f.call('read', {
          id: (await f.call('list', {})).conversations[0].id,
        })
      ).turns.length,
      1,
    );
  }));
test('saved work offers manual or Jerry resume and keeps the original manual fields', async () =>
  fixture(async ({ f, page, requests }) => {
    const values = {
      workflowVersion: '3',
      listingType: 'tools',
      category: listingCategories.find((c) => c.type === 'tools').id,
      title: 'Saved synthetic tool',
      description: 'Keep this description',
      sellerLocation: 'Synthetic location',
    };
    assert.equal(
      (
        await f.f.call(
          '/draft/autosave',
          'PUT',
          { expectedRevision: null, values, step: 2 },
          f.proof.authorization.slice(7),
        )
      ).status,
      200,
    );
    await open(page);
    await page
      .getByRole('button', { name: 'My saved work', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Resume with Jerry', exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: 'Resume with Jerry', exact: true })
      .click();
    await page
      .getByText('Continuing your saved draft.', { exact: false })
      .waitFor();
    assert.equal(f.f.state().drafts[f.profile.id].fields.title, values.title);
    assert.equal(
      f.f.state().drafts[f.profile.id].fields.description,
      values.description,
    );
    await page.evaluate(() => {
      window.manualResumes = 0;
      document.addEventListener(
        'rwas:open-manual-form',
        () => window.manualResumes++,
      );
    });
    await page
      .getByRole('button', { name: 'Continue manually', exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.manualResumes), 1);
    assert.equal(f.relayCalls(), 0);
    assert.ok(!requests.includes('/api/aircraft-sale/listings'));
  }));
test('browser saves by account, resumes after reload and another device, and deletes without legacy import', async () =>
  fixture(async ({ f, page, context }) => {
    await open(page);
    await send(page, 'Synthetic browser question');
    await page
      .getByText('Synthetic reply N123AB, 145.', { exact: true })
      .waitFor();
    if (process.env.JERRY_SCREENSHOT)
      await page.screenshot({ path: process.env.JERRY_SCREENSHOT });
    assert.equal(
      await page.getByText('LEGACY PRIVATE MUST NOT IMPORT').count(),
      0,
    );
    await page.reload();
    await page.locator('.jerry-widget-bubble').click();
    await page
      .locator('.jerry-widget-chat')
      .getByText('Synthetic browser question', { exact: true })
      .waitFor();
    assert.equal(f.relayCalls(), 1);
    const second = await context.newPage();
    await open(second);
    const id = (await f.call('list', {})).conversations[0].id;
    await second.getByRole('combobox').selectOption(id);
    await second
      .locator('.jerry-widget-chat')
      .getByText('Synthetic browser question', { exact: true })
      .waitFor();
    page.once('dialog', (d) => d.accept());
    await page
      .getByRole('button', { name: 'Delete conversation', exact: true })
      .click();
    await page.getByText('Conversation deleted.', { exact: true }).waitFor();
    await second
      .locator('.jerry-widget-chat')
      .getByText('Synthetic browser question', { exact: true })
      .waitFor({ state: 'detached' });
    assert.equal((await f.call('list', {})).conversations.length, 0);
    const stored = await page.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(sessionStorage)
            .filter((k) => k.startsWith('rwas-jerry-v1:'))
            .map((k) => [k, sessionStorage.getItem(k)]),
        ),
      ),
    );
    assert.ok(!stored.includes('Synthetic browser question'));
  }));
test('guest history remains separate until affirmative consent, locale changes preserve typed input', async () =>
  fixture(async ({ f, page }) => {
    f.signedIn(false);
    await open(page);
    await send(page, 'Synthetic guest question');
    await page
      .getByText('Synthetic reply N123AB, 145.', { exact: true })
      .waitFor();
    f.signedIn(true);
    await page.evaluate(() =>
      document.dispatchEvent(new CustomEvent('rwas:session-changed')),
    );
    await page
      .getByRole('button', { name: 'Attach guest conversation', exact: true })
      .waitFor();
    assert.equal((await f.call('list', {})).conversations.length, 0);
    await page
      .getByRole('button', { name: 'Attach guest conversation', exact: true })
      .click();
    await page
      .locator('.jerry-widget-chat')
      .getByText('Synthetic guest question', { exact: true })
      .waitFor();
    const c = (await f.call('list', {})).conversations[0];
    assert.equal((await f.call('read', { id: c.id })).turns.length, 2);
    await page.locator('.jerry-widget-input input').fill('Unsent typed input');
    await page.evaluate(() => {
      localStorage.setItem('rwas-language', 'pt-BR');
      window.dispatchEvent(new CustomEvent('rwas:language-changed'));
    });
    await page.getByRole('button', { name: 'Enviar', exact: true }).waitFor();
    assert.equal(
      await page.locator('.jerry-widget-input input').inputValue(),
      'Unsent typed input',
    );
  }));
test('sign-out during an in-flight reply clears private rendering and late completion cannot repaint it', async () =>
  fixture(async ({ f, page }) => {
    let release, started;
    const begun = new Promise((r) => {
      started = r;
    });
    f.relay(async () => {
      started();
      await new Promise((r) => {
        release = r;
      });
      return Response.json({ reply: 'PRIVATE LATE RESPONSE' });
    });
    await open(page);
    await send(page, 'Private pending question');
    await begun;
    f.signedIn(false);
    await page.evaluate(() =>
      document.dispatchEvent(new CustomEvent('rwas:session-changed')),
    );
    await page
      .getByText('Guest chat stays in this tab.', { exact: false })
      .waitFor();
    release();
    await page.waitForTimeout(150);
    assert.equal(
      await page.getByText('PRIVATE LATE RESPONSE', { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText('Private pending question', { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.locator('.jerry-widget-input button').isEnabled(),
      true,
    );
  }));
