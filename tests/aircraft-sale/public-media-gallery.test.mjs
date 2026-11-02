import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, submit, approve, png, mp4, pdf } from './fixture.mjs';
import { chromium } from '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs';

test('public gallery shows one photo or video at a time and exposes only published logbooks', async () => {
  const f = fixture(),
    owner = await f.login(),
    listing = await create(f, owner);
  for (const [category, name, bytes] of [
    ['photos', 'one.png', png],
    ['photos', 'two.png', png],
    ['videos', 'clip.mp4', mp4],
    ['airframe', 'logbook.pdf', pdf],
    ['misc', 'private.pdf', pdf],
  ]) {
    const response = await f.call(
      `/upload?listingId=${listing.id}&category=${category}&filename=${name}`,
      'POST',
      bytes,
      owner,
    );
    assert.equal(response.status, 200);
  }
  const current = (
    await (await f.call('/my-listings', 'GET', undefined, owner)).json()
  ).listings.find((l) => l.id === listing.id);
  assert.equal((await submit(f, owner, current)).status, 200);
  assert.equal((await approve(f, current)).status, 200);
  const response = await f.call(
    `/listing/${listing.id}`,
    'GET',
    undefined,
    undefined,
    { Accept: 'text/html' },
  );
  const html = await response.text();
  assert.match(html, /1 other private records held by the seller/);
  assert.match(html, /logbook\.pdf/);
  assert.doesNotMatch(html, /private\.pdf/);
  const stored = f.state().files;
  const logbook = Object.values(stored).find(
    (file) => file.category === 'airframe',
  );
  const other = Object.values(stored).find((file) => file.category === 'misc');
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(logbook.key))).status,
    200,
  );
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(other.key))).status,
    401,
  );
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent(html);
      const gallery = page.locator('section.media');
      assert.equal(await gallery.locator('.media-item:visible').count(), 1);
      assert.equal(await gallery.locator('.media-item:visible img').count(), 1);
      await gallery.getByLabel('Show photo 1 of 3').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(
        await gallery.getByLabel('Show photo 2 of 3').isChecked(),
        true,
      );
      await gallery.locator('label[for=listing-media-1]').click();
      assert.equal(await gallery.locator('.media-item:visible').count(), 1);
      assert.match(
        await gallery.locator('.media-item:visible img').getAttribute('alt'),
        /two/,
      );
      await gallery.locator('label[for=listing-media-2]').click();
      assert.equal(
        await gallery.locator('.media-item:visible video').count(),
        1,
      );
      await gallery.locator('label[for=listing-media-0]').click();
      assert.equal(await gallery.locator('.media-item:visible img').count(), 1);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('airframe, engine and propeller logbooks are public only for published or sold listings', async () => {
  const f = fixture(),
    owner = await f.login(),
    listing = await create(f, owner);
  const documents = [];
  for (const category of ['airframe', 'powerplant', 'propeller', 'misc']) {
    const response = await f.call(
      `/upload?listingId=${listing.id}&category=${category}&filename=${category}.pdf`,
      'POST',
      pdf,
      owner,
    );
    assert.equal(response.status, 200);
    documents.push({ category, ...(await response.json()).file });
  }
  for (const file of documents)
    assert.equal(
      (await f.call('/files/' + encodeURIComponent(file.key))).status,
      401,
    );
  const current = f.state().listings[listing.id];
  assert.equal((await submit(f, owner, current)).status, 200);
  assert.equal((await approve(f, current)).status, 200);
  for (const expectedStatus of ['active', 'sold']) {
    if (expectedStatus === 'sold')
      assert.equal(
        (
          await f.call(
            '/listing/' + listing.id + '/status',
            'POST',
            { status: 'sold' },
            owner,
          )
        ).status,
        200,
      );
    for (const file of documents) {
      const response = await f.call('/files/' + encodeURIComponent(file.key));
      assert.equal(
        response.status,
        file.category === 'misc' ? 401 : 200,
        `${expectedStatus}: ${file.category}`,
      );
    }
  }
  assert.equal(
    (
      await f.call(
        '/listing/' + listing.id + '/status',
        'POST',
        { status: 'archived' },
        owner,
      )
    ).status,
    200,
  );
  for (const file of documents)
    assert.equal(
      (await f.call('/files/' + encodeURIComponent(file.key))).status,
      401,
    );
});
