import assert from 'node:assert/strict';
import { resolve } from 'node:path';
export async function checkAutosave({
  page,
  f,
  token,
  origin,
  width,
  artifacts,
  proofreader,
  onPageError,
}) {
  const context = page.context();
  const clear = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('rwas-listing-recovery-v1:'))
        .forEach((key) => localStorage.removeItem(key)),
    );
  const current = async () =>
    (await (await f.call('/draft', 'GET', undefined, token)).json()).draft;
  let dialog = page.getByRole('dialog');
  if (await dialog.isVisible())
    await dialog
      .getByRole('button', { name: 'Close seller panel', exact: true })
      .click();
  await clear();
  await f.call('/draft', 'DELETE', undefined, token, { Origin: origin });
  await page
    .getByRole('button', { name: 'Create a Listing', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'List manually', exact: true })
    .click();
  await dialog
    .getByLabel('What would you like to list?', { exact: true })
    .selectOption('parts');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog
    .getByLabel('Listing category', { exact: true })
    .selectOption('components-engines');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  async function jump(label) {
    const index = dialog.getByLabel('Listing step index', { exact: true });
    await index.waitFor();
    const values = await index
      .locator('option')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent, value: node.value })),
      );
    const choice = values.find(
      (choice) =>
        choice.text.replace(/^\d+\. /, '').replace(/ \(Required\)$/, '') ===
        label,
    );
    assert.ok(choice);
    await index.selectOption(choice.value);
  }
  await jump('Listing title');
  await dialog
    .locator('#listing-step-input')
    .fill('Automatically retained part');
  await jump('Year');
  await dialog.locator('#listing-step-input').fill('19');
  await jump('Description');
  proofreader.autosaveNetworkFailures = 1;
  const synced = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      new URL(r.url()).pathname.endsWith('/draft/autosave') &&
      r.request().postDataJSON().values.description ===
        '  First line\nSecond line  ',
  );
  await dialog
    .locator('#listing-step-input')
    .fill('  First line\nSecond line  ');
  assert.equal((await synced).status(), 200);
  assert.equal(
    proofreader.autosaveNetworkFailures,
    0,
    'A transient browser network failure is consumed and retried',
  );
  await dialog
    .getByText('All changes saved online.', { exact: true })
    .waitFor();
  assert.equal(
    (await current()).values.year,
    '19',
    'Incomplete numeric typing is retained privately',
  );
  assert.equal(
    (await current()).values.description,
    '  First line\nSecond line  ',
  );
  const expected = '  First line\nSecond line  \nImmediate close recovery';
  proofreader.autosaveOffline = true;
  await dialog.locator('#listing-step-input').fill(expected);
  const newPage = await context.newPage();
  newPage.on('pageerror', onPageError);
  await page.close();
  page = newPage;
  proofreader.autosaveOffline = false;
  await page.goto(origin + '/aircraft-for-sale');
  dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Resume Saved Draft', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Resume manually', exact: true })
    .click();
  await dialog.getByLabel('Description', { exact: true }).waitFor();
  assert.equal(
    (await dialog.getByLabel('Description', { exact: true }).innerText()).replace(/\u00a0/g, ' '),
    expected,
    'Closing the page before debounce recovers every character on this device',
  );
  await dialog
    .getByText('All changes saved online.', { exact: true })
    .waitFor();
  assert.equal((await current()).values.description, expected);
  await jump('Listing title');
  proofreader.autosaveOffline = true;
  await dialog.locator('#listing-step-input').fill('Offline recovery part');
  await dialog
    .getByRole('button', { name: 'Retry saving online', exact: true })
    .waitFor();
  assert.equal((await current()).values.title, 'Automatically retained part');
  proofreader.autosaveOffline = false;
  await dialog
    .getByRole('button', { name: 'Retry saving online', exact: true })
    .click();
  await dialog
    .getByText('All changes saved online.', { exact: true })
    .waitFor();
  assert.equal((await current()).values.title, 'Offline recovery part');
  await page.screenshot({
    path: resolve(artifacts, 'autosave-recovered-' + width + '.png'),
  });
  await jump('Year');
  assert.equal(await dialog.locator('#listing-step-input').inputValue(), '19');
  await dialog.locator('#listing-step-input').fill('2000');
  await dialog.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await dialog
    .getByText('Draft saved. Add media, then submit for review.', {
      exact: true,
    })
    .waitFor();
  const listing = Object.values(f.state().listings).find(
    (l) => l.fields.title === 'Offline recovery part',
  );
  assert.ok(listing);
  assert.equal(listing.status, 'draft');
  await jump('Description');
  await dialog.locator('#listing-step-input').fill('Linked listing recovery');
  await dialog
    .getByText('All changes saved online.', { exact: true })
    .waitFor();
  assert.equal(
    (await current()).listingId,
    listing.id,
    'Later autosaves retain the server listing identity',
  );
  const other = await f.call(
    '/listings',
    'POST',
    {
      make: 'Other',
      model: 'Fixture',
      year: 2000,
      price: 5,
      nNumber: 'N456AB',
      sellerLocation: 'Synthetic Airport',
    },
    token,
    { 'Idempotency-Key': 'other-listing-autosave-check' },
  );
  assert.equal(other.status, 201);
  await dialog
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  // Force the regular Edit flow to recover from the server, not local storage.
  await clear();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog
    .locator('.seller-listing')
    .filter({ hasText: 'Other Fixture' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'A different unfinished draft is saved' })
    .waitFor();
  assert.equal(
    (await current()).listingId,
    listing.id,
    'Another listing cannot replace the saved draft',
  );
  assert.equal((await current()).values.description, 'Linked listing recovery');
  await dialog
    .locator('.seller-listing')
    .filter({ hasText: 'Offline recovery part' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await dialog.getByRole('button', { name: /Edit current listing/ }).waitFor();
  await dialog.getByRole('button', { name: /Edit current listing/ }).click();
  await jump('Description');
  assert.equal(
    (await dialog.getByLabel('Description', { exact: true }).innerText()).replace(/\u00a0/g, ' ').trim(),
    (listing.fields.description || '').trim(),
    'Edit current listing starts from the current listing, not the saved changes',
  );
  assert.equal((await current()).values.description, 'Linked listing recovery', 'Viewing current details does not discard the saved draft');
  await dialog.getByRole('button', { name: 'Close seller panel', exact: true }).click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog.locator('.seller-listing').filter({ hasText: 'Offline recovery part' }).getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByRole('button', { name: /Resume saved changes/ }).click();
  await dialog
    .getByLabel('Description', { exact: true })
    .waitFor({ timeout: 4000 });
  assert.equal(
    (await dialog.getByLabel('Description', { exact: true }).innerText()).replace(/\u00a0/g, ' '),
    'Linked listing recovery',
    'Edit on the listing restores its saved online changes',
  );
  await dialog
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Resume Saved Draft', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Resume manually', exact: true })
    .click();
  await dialog.getByLabel('Description', { exact: true }).waitFor();
  assert.equal(
    (await dialog.getByLabel('Description', { exact: true }).innerText()).replace(/\u00a0/g, ' '),
    'Linked listing recovery',
  );
  const before = Object.keys(f.state().listings).length;
  await dialog.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await dialog
    .getByText('Draft saved. Add media, then submit for review.', {
      exact: true,
    })
    .waitFor();
  assert.equal(Object.keys(f.state().listings).length, before);
  assert.equal(
    f.state().listings[listing.id].fields.description,
    'Linked listing recovery',
  );
  await dialog
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await clear();
  f.restart();
  await page.reload();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  await dialog
    .locator('.seller-listing')
    .filter({ hasText: 'Offline recovery part' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await jump('Description');
  assert.equal(
    (await dialog.getByLabel('Description', { exact: true }).innerText()).replace(/\u00a0/g, ' '),
    'Linked listing recovery',
    'Applied draft edits survive a backend restart and browser reload',
  );
  await dialog
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
  return page;
}
