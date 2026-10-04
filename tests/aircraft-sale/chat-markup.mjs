import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const widget = await readFile('public/jerry-widget.js', 'utf8');
const before = execFileSync('git', ['show', 'a72e67e:public/jerry-widget.js'], {
  encoding: 'utf8',
});
const origin = 'http://localhost';
const note =
  'If you would like to list before the end of the intake, simply say "list it" at any time.';
const reply =
  "Great — let's get your aircraft listed.\n\nFirst, what's the tail number (N-number)?\n\n<em>" +
  note +
  '</em>';
const malicious =
  '<em onclick="globalThis.pwned=1">Unsafe</em><img src=x onerror="globalThis.pwned=1"><script>globalThis.pwned=1</script>';
const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const mode of ['before', 'history', 'json', 'stream', 'unsafe']) {
    const context = await browser.newContext({
      viewport: { width: 393, height: 800 },
    });
    const errors = [];
    let chatCalls = 0;
    await context.addInitScript(
      ({ reply, mode }) => {
        sessionStorage.setItem(
          'jerry-chat-history',
          JSON.stringify([
            { role: 'user', content: 'I want to list my aircraft for sale.' },
            { role: 'assistant', content: reply },
            ...(['before', 'history'].includes(mode)
              ? []
              : [
                  {
                    role: 'user',
                    content: '<em>User input stays literal</em>',
                  },
                ]),
          ]),
        );
      },
      { reply, mode },
    );
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === origin + '/aircraft-for-sale') {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><head><meta charset="utf-8"></head><body><script src="/jerry-widget.js"></script></body></html>',
        });
      } else if (url === origin + '/jerry-widget.js') {
        await route.fulfill({
          contentType: 'application/javascript',
          body: mode === 'before' ? before : widget,
        });
      } else if (url === 'https://rogerwilcoaviation.com/api/chat') {
        chatCalls++;
        if (mode === 'stream') {
          const tokens = [
            "Great — let's get your aircraft listed.\n\n",
            "First, what's the tail number (N-number)?\n\n<em>",
            note,
            '</em>',
          ];
          const frames =
            tokens
              .map(
                (token) =>
                  'data: ' + JSON.stringify({ token, done: false }) + '\n\n',
              )
              .join('') +
            'data: ' +
            JSON.stringify({ done: true }) +
            '\n\n';
          await route.fulfill({
            contentType: 'text/event-stream',
            body: frames,
          });
        } else {
          await route.fulfill({
            json: { reply: mode === 'unsafe' ? malicious : reply },
          });
        }
      } else {
        throw new Error('Unexpected browser request: ' + url);
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
      const firstReply = page
        .locator('.jerry-widget-row.assistant .jerry-widget-msg')
        .first();
      if (mode === 'before') {
        assert.ok((await firstReply.textContent()).includes('<em>'));
        assert.equal(await firstReply.locator('em').count(), 0);
      } else {
        assert.ok(!(await firstReply.textContent()).includes('<em>'));
        assert.equal(
          await firstReply.locator('em').first().textContent(),
          note,
        );
      }
      const user = page
        .locator('.jerry-widget-row.user .jerry-widget-msg')
        .last();
      assert.equal(
        await user.textContent(),
        ['before', 'history'].includes(mode)
          ? 'I want to list my aircraft for sale.'
          : '<em>User input stays literal</em>',
      );
      assert.equal(await user.locator('em').count(), 0);
      if (['json', 'stream', 'unsafe'].includes(mode)) {
        await page.locator('.jerry-widget-text-input').fill('Hello');
        await page.locator('.jerry-widget-send').click();
        await page.waitForFunction(
          () => !document.querySelector('.jerry-widget-send').disabled,
        );
        const latest = page
          .locator('.jerry-widget-row.assistant .jerry-widget-msg')
          .last();
        assert.equal(chatCalls, 1);
        if (mode === 'unsafe') {
          assert.ok((await latest.textContent()).includes(malicious));
          assert.equal(
            await latest.locator('img, script, em[onclick], [onerror]').count(),
            0,
          );
          // The widget adds one trusted manual-form link after the response text.
          const handlers = latest.locator('[onclick]');
          assert.equal(await handlers.count(), 1);
          assert.equal(
            await handlers.textContent(),
            'Prefer to fill out the form manually?',
          );
          assert.equal(await handlers.getAttribute('href'), '#sell');
          assert.equal(await page.evaluate(() => globalThis.pwned), undefined);
        } else {
          assert.equal(await latest.locator('em').first().textContent(), note);
          assert.ok(!(await latest.textContent()).includes('<em>'));
          assert.equal(
            await latest.locator('em').last().textContent(),
            'Your progress is saved privately. Review details and submit from the seller panel.',
          );
        }
      }
      assert.deepEqual(errors, []);
      if (
        process.env.CHAT_MARKUP_EVIDENCE_DIR &&
        ['before', 'history'].includes(mode)
      )
        await page.screenshot({
          path:
            process.env.CHAT_MARKUP_EVIDENCE_DIR +
            '/chat-markup-' +
            mode +
            '.png',
        });
      results.push({
        mode,
        result: 'PASS',
        scope: 'intercepted mobile browser; no live chat or account requests',
      });
      console.log('PASS ' + mode);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (process.env.CHAT_MARKUP_EVIDENCE_DIR)
    await writeFile(
      process.env.CHAT_MARKUP_EVIDENCE_DIR + '/chat-markup-results.json',
      JSON.stringify(results, null, 2),
    );
}
