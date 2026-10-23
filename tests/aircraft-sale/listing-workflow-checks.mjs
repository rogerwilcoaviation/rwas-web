import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { png, pdf } from './fixture.mjs';

export async function showWorkflowReview(page) {
  const review = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Review draft', exact: true });
  if (await review.count()) await review.click();
  await page
    .getByRole('heading', { name: 'Review your listing', exact: true })
    .waitFor();
}

export async function openWorkflowItem(page, label) {
  await showWorkflowReview(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Edit ' + label, exact: true })
    .click();
}

// Exercises the real exported UI with disposable backend data and intercepted
// proofreading. This module also runs against a deployed bundle in acceptance.
export async function checkListingWorkflow({
  page,
  dialog,
  f,
  width,
  artifacts,
  proofreader,
}) {
  const label = (name) => dialog.getByLabel(name, { exact: true });
  const button = (name) => dialog.getByRole('button', { name, exact: true });
  const next = () =>
    dialog
      .locator('.listing-workflow form')
      .getByRole('button', { name: /^(Continue|Skip for now)$/ })
      .click();
  const original = 'Synthetic aircraft have 1234 hours. History are unknown.';
  const revised = 'Synthetic aircraft has 1234 hours. History is unknown.';
  await label('Make').fill('');
  await next();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'Make is required' })
    .waitFor();
  assert.equal(await dialog.locator('#listing-step-input').count(), 1);
  await button('Save Draft').click();
  await dialog
    .getByText('Draft saved. Add media, then submit for review.', {
      exact: true,
    })
    .waitFor();
  assert.equal(Object.values(f.state().listings).length, 1);
  assert.equal(Object.values(f.state().listings)[0].status, 'draft');
  // Resume the incomplete saved listing without losing its server identity.
  await button('Close seller panel').click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog
    .locator('.seller-listing')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  assert.equal(await label('Make').inputValue(), '');
  await label('Make').fill('Synthetic');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/listings\/[^/]+$/.test(new URL(response.url()).pathname),
    ),
    button('Save Draft').click(),
  ]);
  assert.equal(Object.values(f.state().listings)[0].fields.make, 'Synthetic');
  await next();
  await label('Model').fill('Test Model');
  await next();
  await label('Year').fill('1902');
  await next();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'Enter a year from 1903' })
    .waitFor();
  await label('Year').fill('2000');
  await next();
  await label('Asking price (USD)').fill('0');
  await next();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'greater than $0' })
    .waitFor();
  await label('Asking price (USD)').fill('123456');
  await next();
  await label('Description').fill(original);
  assert.equal(await dialog.locator('#listing-step-input').count(), 1);
  proofreader.mode = 'success';
  await button('Ask Jerry to proofread').click();
  await label('Suggested description').or(dialog.getByRole('alert')).waitFor();
  assert.equal(
    await label('Suggested description').count(),
    1,
    await dialog.innerText(),
  );
  assert.equal(await label('Description').inputValue(), original);
  assert.equal(await label('Suggested description').inputValue(), revised);
  await button('Keep my original').click();
  assert.equal(await label('Description').inputValue(), original);
  proofreader.mode = 'numbers';
  await button('Ask Jerry to proofread').click();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'changed numerical details' })
    .waitFor();
  assert.equal(await label('Description').inputValue(), original);
  proofreader.mode = 'failure';
  await button('Ask Jerry to proofread').click();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'could not proofread' })
    .waitFor();
  assert.equal(await label('Description').inputValue(), original);
  proofreader.mode = 'network';
  await button('Ask Jerry to proofread').click();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'could not be reached' })
    .waitFor();
  assert.equal(await label('Description').inputValue(), original);
  proofreader.mode = 'success';
  await button('Ask Jerry to proofread').click();
  await button('Use Jerry’s suggestion').click();
  assert.equal(await label('Description').inputValue(), revised);
  await button('Undo Jerry’s edit').click();
  assert.equal(await label('Description').inputValue(), original);
  proofreader.mode = 'slow';
  const sent = page.waitForRequest(
    (request) => request.url() === 'https://rogerwilcoaviation.com/api/chat',
  );
  await button('Ask Jerry to proofread').click();
  await sent;
  await label('Description').fill(original + ' New seller wording.');
  proofreader.release();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  assert.equal(await label('Suggested description').count(), 0);
  assert.equal(
    await label('Description').inputValue(),
    original + ' New seller wording.',
  );
  await label('Description').fill(original);
  if (proofreader.liveSmoke) {
    const source =
      'Synthetic proofreading test. The records has not been reviewed.';
    await label('Description').fill(source);
    proofreader.mode = 'live';
    await button('Ask Jerry to proofread').click();
    await label('Suggested description')
      .or(dialog.getByRole('alert'))
      .waitFor({ timeout: 60000 });
    assert.equal(
      await label('Suggested description').count(),
      1,
      await dialog.innerText(),
    );
    assert.equal(await label('Description').inputValue(), source);
    proofreader.liveResult = {
      source,
      suggestion: await label('Suggested description').inputValue(),
    };
    await button('Keep my original').click();
    await label('Description').fill(original);
  }
  await page.screenshot({
    path: resolve(artifacts, `workflow-description-${width}.png`),
  });
  await next();
  await label('N-number').fill('invalid');
  await next();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'valid US N-number' })
    .waitFor();
  await label('N-number').fill('');
  // Back navigation preserves entered text; optional items can be skipped.
  await button('Back').click();
  assert.equal(await label('Description').inputValue(), original);
  await next();
  for (
    let count = 0;
    count < 19 && (await dialog.locator('#listing-step-input').count());
    count++
  ) {
    const lastDetail = await label('Range').count();
    if (await label('Damage history').count())
      assert.equal(
        await label('Damage history').getAttribute('maxlength'),
        '300',
      );
    await next();
    if (lastDetail) break;
  }
  await dialog.getByRole('heading', { name: 'Photos', exact: true }).waitFor();
  assert.equal(await dialog.locator('input[type=file]').count(), 1);
  assert.equal(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
    true,
    'Upload step fits inside the dialog',
  );
  assert.match(
    await dialog.innerText(),
    /50 MB \(52,428,800 bytes\) per photo/,
  );
  const beforeUploads = proofreader.uploads;
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'wrong.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'unsupported format' })
    .waitFor();
  if (width === 1440) {
    const temporary = await mkdtemp(join(tmpdir(), 'rwas-oversized-upload-'));
    const path = join(temporary, 'too-large.png');
    const file = await open(path, 'w');
    await file.truncate(50 * 1024 * 1024 + 1);
    await file.close();
    try {
      await dialog.locator('input[type=file]').setInputFiles(path);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    await dialog
      .getByRole('alert')
      .filter({ hasText: 'exceeds the 50 MB' })
      .waitFor();
  }
  assert.equal(
    proofreader.uploads,
    beforeUploads,
    'Rejected files never reach the upload API',
  );
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  });
  await dialog.getByText('Photos (1)', { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(artifacts, `workflow-photos-${width}.png`),
  });
  await button('Continue').click();
  await dialog.getByRole('heading', { name: 'Videos', exact: true }).waitFor();
  await button('Skip for now').click();
  await dialog
    .getByRole('heading', { name: 'Airframe logbooks', exact: true })
    .waitFor();
  assert.match(await dialog.innerText(), /PDF only.*50 MB.*per document/);
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'records.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await dialog.getByText('Airframe logbooks (1)', { exact: true }).waitFor();
  await button('Continue').click();
  for (let count = 0; count < 4; count++) await button('Skip for now').click();
  await dialog
    .getByRole('heading', { name: 'Review your listing', exact: true })
    .waitFor();
  await button('Edit Model').click();
  await label('Model').fill('Updated Model');
  await button('Review draft').click();
  await page.screenshot({
    path: resolve(artifacts, `workflow-review-${width}.png`),
  });
  assert.ok(await button('Submit for Review').isEnabled());
  assert.equal(Object.values(f.state().listings)[0].status, 'draft');
  await button('Submit for Review').click();
  await dialog.getByText('pending', { exact: true }).waitFor();
  const listing = Object.values(f.state().listings)[0];
  assert.equal(listing.fields.model, 'Updated Model');
  assert.equal(listing.fields.description, original);
  assert.equal(listing.status, 'pending');
  assert.equal(
    Object.values(f.state().files).filter(
      (file) => file.listingId === listing.id && file.category === 'photos',
    ).length,
    1,
  );
  assert.equal(
    Object.values(f.state().files).filter(
      (file) => file.listingId === listing.id && file.category === 'airframe',
    ).length,
    1,
  );
  assert.equal(Object.values(f.state().listings).length, 1);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
}
