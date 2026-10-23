// Actual built Next page + disposable seller store. No provider credentials or hosted writes.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { fixture, create, fields, submit, approve } from './fixture.mjs';
import { advisoryResearch } from './jerry-research-fixture.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);
const base = resolve('out');
const html = await readFile(resolve(base, 'seller-review.html'), 'utf8');
assert.match(html, /name="robots" content="noindex, nofollow"/);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = resolve(base, '.' + url.pathname);
    if (!path.startsWith(base + '/')) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!extname(path)) path += '.html';
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml',
    };
    const bytes = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const f = fixture();
const owner = await f.login();
const first = await create(f, owner, { ...fields, model: 'First Review' });
const second = await create(f, owner, { ...fields, model: 'Second Review' });
for (const listing of [first, second])
  assert.equal((await submit(f, owner, listing)).status, 200);
const seeded = f.state();
seeded.listings[first.id].jerryReview = advisoryResearch;
f.durable.set('state', seeded);
let browser;
const checkpoints = [],
  blocked = [],
  errors = [],
  decisions = [];
let queueFailure;
let availabilityFailure;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      blocked.push(url.origin);
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith('/api/aircraft-sale/')) {
      await route.continue();
      return;
    }
    if (url.pathname.endsWith('/admin/listings') && queueFailure) {
      const failure = queueFailure;
      queueFailure = undefined;
      await route.fulfill(failure);
      return;
    }
    if (url.pathname.endsWith('/auth/methods') && availabilityFailure) {
      const failure = availabilityFailure;
      availabilityFailure = undefined;
      if (failure === 'timeout') return;
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill(failure);
      return;
    }
    const input = request.postData()
      ? JSON.parse(request.postData())
      : undefined;
    if (url.pathname.endsWith('/admin/review')) decisions.push(input);
    const response = await f.call(
      url.pathname.replace('/api/aircraft-sale', ''),
      request.method(),
      input,
      'fixture-reviewer',
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(origin + '/seller-review');
  const load = page.getByRole('button', { name: 'Load Review Queue' });
  assert.equal(
    await page.getByText('No listings are awaiting review.').count(),
    0,
  );
  queueFailure = {
    status: 401,
    contentType: 'application/json',
    body: '{"error":"unauthorized"}',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  checkpoints.push('Unauthorized queue request gives staff sign-in guidance');
  queueFailure = {
    status: 200,
    contentType: 'text/html',
    body: '<html>Access login</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  checkpoints.push(
    'Access HTML prompts staff sign-in without JSON parsing details',
  );
  queueFailure = {
    status: 503,
    contentType: 'application/json',
    body: '{"error":"private diagnostic"}',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Staff review is unavailable' })
    .waitFor();
  assert.ok(
    !(await page.locator('main').getByRole('alert').innerText()).includes(
      'private diagnostic',
    ),
  );
  checkpoints.push('Unavailable review shows a bounded error');
  queueFailure = {
    status: 200,
    contentType: 'application/json',
    body: '{not json',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Review unavailable' })
    .waitFor();
  queueFailure = {
    status: 200,
    contentType: 'application/json',
    body: '{"results":[]}',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Review unavailable' })
    .waitFor();
  checkpoints.push('Invalid JSON and invalid queue schema fail visibly');
  queueFailure = {
    status: 200,
    contentType: 'application/json',
    body: '{"listings":[]}',
  };
  await load.click();
  await page.getByText('No listings are awaiting review.').waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  checkpoints.push('Successful empty queue is explicitly confirmed');
  await load.click();
  const firstCard = page.locator('main section').filter({
    has: page.getByRole('heading', { name: '2000 Synthetic First Review' }),
  });
  const secondCard = page.locator('main section').filter({
    has: page.getByRole('heading', { name: '2000 Synthetic Second Review' }),
  });
  await firstCard.waitFor();
  await page.getByText('2 listings are awaiting review.').waitFor();
  checkpoints.push('Successful pending queue reports its count');
  await firstCard
    .getByText(advisoryResearch.summary, { exact: true })
    .waitFor();
  assert.equal(
    await firstCard
      .getByRole('link', { name: 'Open research source 1', exact: true })
      .getAttribute('href'),
    advisoryResearch.evidence.faa.sources[0],
  );
  assert.equal(f.state().listings[first.id].status, 'pending');
  checkpoints.push(
    'Jerry advisory evidence and FAA sources render without approving a listing',
  );
  for (const availability of [
    { publicListings: false },
    {},
    { publicListings: 'true' },
  ]) {
    availabilityFailure = {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(availability),
    };
    await load.click();
    await page.getByText('2 listings are awaiting review.').waitFor();
    assert.equal(
      await firstCard
        .getByRole('button', { name: 'Approve and Publish' })
        .isDisabled(),
      true,
    );
    assert.equal(
      await firstCard
        .getByRole('button', { name: 'Request Changes' })
        .isEnabled(),
      true,
    );
    await page
      .getByText(
        'Ordinary publication is unavailable. You can still request changes.',
      )
      .waitFor();
  }
  checkpoints.push(
    'Disabled, missing and nonboolean publication availability keep approval disabled',
  );
  for (const failure of [
    {
      status: 503,
      contentType: 'application/json',
      body: '{"error":"unavailable"}',
    },
    {
      status: 200,
      contentType: 'text/html',
      body: '<html>Access login</html>',
    },
    'network',
    'timeout',
  ]) {
    availabilityFailure = failure;
    await load.click();
    await page.getByText('2 listings are awaiting review.').waitFor();
    assert.equal(
      await firstCard
        .getByRole('button', { name: 'Approve and Publish' })
        .isDisabled(),
      true,
    );
    assert.equal(
      await firstCard
        .getByRole('button', { name: 'Request Changes' })
        .isEnabled(),
      true,
    );
  }
  assert.deepEqual(decisions, []);
  checkpoints.push(
    'Availability HTTP, HTML, network and timeout failures preserve queue and reject access without publishing',
  );
  await load.click();
  await page.getByText('2 listings are awaiting review.').waitFor();
  assert.equal(
    await firstCard
      .getByRole('button', { name: 'Approve and Publish' })
      .isEnabled(),
    true,
  );
  checkpoints.push(
    'Fresh explicit server availability restores the approval control',
  );
  await firstCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Private note before session expiry');
  queueFailure = {
    status: 403,
    contentType: 'text/html',
    body: '<html>Expired Access session</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  await load.click();
  await firstCard.waitFor();
  assert.equal(
    await firstCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    '',
  );
  checkpoints.push(
    'Expired staff access clears visible private records and unsent notes',
  );
  await firstCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Correct first record only');
  await secondCard
    .getByRole('textbox', { name: 'Review note' })
    .fill('Correct second record only');
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  await load.click();
  await page
    .getByText(
      'Ordinary publication is unavailable. You can still request changes.',
    )
    .waitFor();
  assert.equal(
    await firstCard
      .getByRole('button', { name: 'Approve and Publish' })
      .isDisabled(),
    true,
  );
  await firstCard.getByRole('button', { name: 'Request Changes' }).click();
  await firstCard.waitFor({ state: 'detached' });
  assert.equal(
    f.state().listings[first.id].reviewNote,
    'Correct first record only',
  );
  assert.equal(
    await secondCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    'Correct second record only',
  );
  checkpoints.push(
    'Notes remain isolated by listing and revision after a decision',
  );
  checkpoints.push(
    'Staff can request changes while ordinary publication is disabled',
  );
  f.env.PUBLIC_LISTINGS_ENABLED = 'true';
  await load.click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('main section button')].some(
      (button) =>
        button.textContent.trim() === 'Approve and Publish' && !button.disabled,
    ),
  );
  const oldRevision = f.state().listings[second.id].revision;
  const editedResponse = await f.call(
    '/listings/' + second.id,
    'PUT',
    {
      ...fields,
      model: 'Second Review',
      description: 'Changed while awaiting staff review',
    },
    owner,
  );
  assert.equal(editedResponse.status, 200);
  const edited = (await editedResponse.json()).listing;
  assert.equal((await submit(f, owner, edited)).status, 200);
  await secondCard.getByRole('button', { name: 'Approve and Publish' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Listing changed' })
    .waitFor();
  await page.waitForFunction(
    (revision) =>
      document
        .querySelector('main section')
        ?.textContent.includes('Revision ' + revision),
    f.state().listings[second.id].revision,
  );
  assert.equal(f.state().listings[second.id].status, 'pending');
  assert.ok(f.state().listings[second.id].revision > oldRevision);
  assert.equal(
    await secondCard.getByRole('textbox', { name: 'Review note' }).inputValue(),
    '',
  );
  checkpoints.push(
    'Stale approval is rejected, latest revision loaded, old note discarded',
  );
  await secondCard.getByRole('button', { name: 'Approve and Publish' }).click();
  await secondCard.getByRole('button', { name: 'Unpublish Listing' }).waitFor();
  assert.equal(f.state().listings[second.id].status, 'active');
  assert.equal(decisions.at(-1).note, '');
  checkpoints.push(
    'Explicit approval of the refreshed revision succeeds in disposable fixture',
  );
  const publishedRevision = f.state().listings[second.id].revision;
  const changed = (
    await (
      await f.call(
        '/listings/' + second.id,
        'PUT',
        {
          ...fields,
          model: 'Second Review',
          description: 'Changed after publication',
        },
        owner,
      )
    ).json()
  ).listing;
  assert.equal((await submit(f, owner, changed)).status, 200);
  assert.equal((await approve(f, changed)).status, 200);
  await secondCard.getByRole('button', { name: 'Unpublish Listing' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Listing changed' })
    .waitFor();
  await page.waitForFunction(
    (revision) =>
      [...document.querySelectorAll('main section')].some(
        (card) =>
          card.textContent.includes('Revision ' + revision) &&
          [...card.querySelectorAll('button')].some(
            (button) =>
              button.textContent.trim() === 'Unpublish Listing' &&
              !button.disabled,
          ),
      ),
    changed.revision,
  );
  assert.equal(f.state().listings[second.id].status, 'active');
  assert.ok(changed.revision > publishedRevision);
  checkpoints.push(
    'Stale unpublish is rejected and refreshes the current published revision',
  );
  await secondCard.getByRole('button', { name: 'Unpublish Listing' }).click();
  await secondCard.waitFor({ state: 'detached' });
  const unpublished = f.state().listings[second.id];
  assert.equal(unpublished.status, 'draft');
  assert.equal(unpublished.revision, changed.revision + 1);
  assert.equal(unpublished.approvedRevision, null);
  assert.equal(
    (
      await f.call(
        '/listing/' + second.id + '/status',
        'POST',
        { status: 'active' },
        owner,
      )
    ).status,
    409,
  );
  checkpoints.push(
    'Published row is reachable and Staff unpublish revokes approval and seller resume',
  );

  const qa = await create(f, owner, { ...fields, model: 'Scoped QA' });
  const otherOwner = await f.login('other-qa@example.test');
  const otherQa = await create(f, otherOwner, {
    ...fields,
    model: 'Other Seller QA',
  });
  await submit(f, owner, qa);
  await submit(f, otherOwner, otherQa);
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  await load.click();
  await page.getByText('2 listings are awaiting review.').waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Publish QA Test Temporarily' })
      .count(),
    0,
  );
  const malformedQueue = await (
    await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer')
  ).json();
  malformedQueue.listings.find((l) => l.id === qa.id).reviewActions =
    'acceptance-approve';
  malformedQueue.listings.find((l) => l.id === otherQa.id).reviewActions = [
    'unknown-action',
  ];
  queueFailure = {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(malformedQueue),
  };
  const malformedResponse = page.waitForResponse((response) =>
    response.url().endsWith('/admin/listings'),
  );
  await load.click();
  await malformedResponse;
  await page.waitForFunction(() => {
    const button = document.querySelector('main button');
    return (
      button &&
      !button.disabled &&
      button.textContent.trim() === 'Load Review Queue'
    );
  });
  assert.equal(
    await page
      .getByRole('button', { name: 'Publish QA Test Temporarily' })
      .count(),
    0,
  );
  checkpoints.push(
    'Malformed and unknown Staff action metadata cannot create QA controls',
  );
  const scope = {
    listingId: qa.id,
    ownerId: f.state().listings[qa.id].ownerId,
    revision: qa.revision,
    expiresAt: Date.now() + 120000,
  };
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify(scope);
  await load.click();
  const qaCard = page.locator('main section').filter({
    has: page.getByRole('heading', {
      name: '2000 Synthetic Scoped QA',
      exact: true,
    }),
  });
  const otherQaCard = page.locator('main section').filter({
    has: page.getByRole('heading', {
      name: '2000 Synthetic Other Seller QA',
      exact: true,
    }),
  });
  await qaCard
    .getByRole('button', { name: 'Publish QA Test Temporarily' })
    .waitFor();
  assert.equal(
    await otherQaCard
      .getByRole('button', { name: 'Publish QA Test Temporarily' })
      .count(),
    0,
  );
  assert.equal(
    await qaCard
      .getByRole('button', { name: 'Approve and Publish' })
      .isDisabled(),
    true,
  );
  assert.equal(
    await otherQaCard
      .getByRole('button', { name: 'Approve and Publish' })
      .isDisabled(),
    true,
  );
  await qaCard
    .getByRole('button', { name: 'Publish QA Test Temporarily' })
    .click();
  await qaCard.getByRole('button', { name: 'Unpublish QA Test' }).waitFor();
  assert.equal(f.state().listings[qa.id].status, 'pending');
  assert.equal(
    f.state().listings[qa.id].acceptancePublicUntil,
    scope.expiresAt,
  );
  assert.deepEqual(
    (await (await f.call('/browse')).json()).listings.map((l) => l.id),
    [qa.id],
  );
  assert.equal(f.state().listings[otherQa.id].acceptancePublicUntil, undefined);
  checkpoints.push(
    'Only the exact server-scoped QA listing exposes temporary publication and becomes public',
  );
  delete f.env.CLERK_ACCEPTANCE_SCOPE;
  f.env.CLERK_ACCEPTANCE_ENABLED = 'false';
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
  await load.click();
  await qaCard.getByRole('button', { name: 'Unpublish QA Test' }).waitFor();
  await qaCard.getByRole('button', { name: 'Unpublish QA Test' }).click();
  await qaCard
    .getByRole('button', { name: 'Unpublish QA Test' })
    .waitFor({ state: 'detached' });
  assert.equal(f.state().listings[qa.id].status, 'pending');
  assert.equal(f.state().listings[qa.id].acceptancePublicUntil, undefined);
  assert.equal(f.state().listings[qa.id].acceptanceApprovedRevision, undefined);
  assert.equal(f.state().listings[otherQa.id].status, 'pending');
  checkpoints.push(
    'Staff can remove QA publication after scope and global acceptance are disabled',
  );
  queueFailure = {
    status: 403,
    contentType: 'text/html',
    body: '<html>Expired Access session</html>',
  };
  await load.click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sign in with your approved staff account' })
    .waitFor();
  assert.equal(await page.locator('main section').count(), 0);
  assert.deepEqual(errors, []);
  // Existing global integrations may be attempted; all external requests are aborted.
  await writeFile(
    'tests/aircraft-sale/review-browser-results.json',
    JSON.stringify(
      {
        checkpoints,
        pageErrors: errors.length,
        externalRequestsBlocked: blocked.length,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: checkpoints.length,
      checkpoints,
      pageErrors: errors.length,
      externalRequestsBlocked: blocked.length,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
