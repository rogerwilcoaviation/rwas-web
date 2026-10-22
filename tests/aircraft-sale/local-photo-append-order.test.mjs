import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, create, png, pdf, mp4 } from './fixture.mjs';

let outboundAttempts = 0;
globalThis.fetch = () => {
  outboundAttempts++;
  throw new Error('Photo ordering fixture prohibits external requests.');
};

async function setup() {
  const f = fixture();
  const owner = await f.login('photo-order-owner@example.test');
  const listing = await create(f, owner);
  const checkedJson = async (response) => {
    assert.equal(response.status, 200);
    return response.json();
  };
  return {
    f,
    listing,
    upload: async (name, category = 'photos', bytes = png) =>
      (
        await checkedJson(
          await f.call(
            '/upload?' +
              new URLSearchParams({
                listingId: listing.id,
                category,
                filename: name,
              }),
            'POST',
            bytes,
            owner,
          ),
        )
      ).file,
    remove: async (file) =>
      checkedJson(
        await f.call(
          '/delete-file',
          'POST',
          { listingId: listing.id, category: file.category, fileKey: file.key },
          owner,
        ),
      ),
    reorder: async (files) =>
      (
        await checkedJson(
          await f.call(
            '/listings/' + listing.id + '/photos/order',
            'PUT',
            { order: files.map(({ key }) => key) },
            owner,
          ),
        )
      ).photos,
    photos: async () =>
      (
        await checkedJson(await f.call('/my-listings', 'GET', undefined, owner))
      ).listings.find(({ id }) => id === listing.id).photos,
  };
}

test('photo uploads append after surviving photo order without changing current files', async (t) => {
  await t.test(
    'sparse deletions retain the surviving cover and append across restart',
    async () => {
      const s = await setup();
      const photos = [];
      for (let index = 0; index < 6; index++)
        photos.push(await s.upload('sparse-' + index + '.png'));
      assert.deepEqual(
        photos.map(({ order }) => order),
        [0, 1, 2, 3, 4, 5],
      );
      for (const photo of photos.slice(0, 5)) await s.remove(photo);
      const cover = structuredClone(s.f.state().files[photos[5].key]);
      const appended = await s.upload('sparse-appended.png');
      assert.equal(
        appended.order,
        6,
        'append must follow maximum surviving photo order',
      );
      assert.deepEqual(
        s.f.state().files[cover.key],
        cover,
        'existing photo metadata must stay unchanged',
      );
      assert.deepEqual(
        (await s.photos()).map(({ key }) => key),
        [cover.key, appended.key],
      );
      s.f.restart();
      assert.deepEqual(
        (await s.photos()).map(({ key }) => key),
        [cover.key, appended.key],
      );
    },
  );

  await t.test(
    'explicit reorder intent survives later deletions and append',
    async () => {
      const s = await setup();
      const photos = [];
      for (let index = 0; index < 5; index++)
        photos.push(await s.upload('reordered-' + index + '.png'));
      const desired = [photos[3], photos[1], photos[4], photos[0], photos[2]];
      assert.deepEqual(
        (await s.reorder(desired)).map(({ key }) => key),
        desired.map(({ key }) => key),
      );
      for (const photo of [photos[3], photos[4], photos[0]])
        await s.remove(photo);
      const survivors = [photos[1], photos[2]].map(({ key }) =>
        structuredClone(s.f.state().files[key]),
      );
      assert.deepEqual(
        survivors.map(({ order }) => order),
        [1, 4],
      );
      const appended = await s.upload('reordered-appended.png');
      assert.equal(appended.order, 5);
      for (const survivor of survivors)
        assert.deepEqual(
          s.f.state().files[survivor.key],
          survivor,
          'append must not renumber a reordered survivor',
        );
      assert.deepEqual(
        (await s.photos()).map(({ key }) => key),
        [photos[1].key, photos[2].key, appended.key],
      );
    },
  );

  await t.test(
    'video and private document interleaving does not determine photo order',
    async () => {
      const s = await setup();
      const video = await s.upload('before.mp4', 'videos', mp4);
      const document = await s.upload('before.pdf', 'airframe', pdf);
      const first = await s.upload('first.png');
      assert.equal(
        first.order,
        0,
        'a listing without photos starts photo order at zero',
      );
      const laterVideo = await s.upload('between.mp4', 'videos', mp4);
      const second = await s.upload('second.png');
      assert.equal(second.order, 1);
      const laterDocument = await s.upload('between.pdf', 'powerplant', pdf);
      assert.deepEqual(
        [video, document, laterVideo, laterDocument].map(({ order }) => order),
        [0, 1, 3, 5],
        'nonphoto upload ordering retains its existing behavior',
      );
      await s.remove(first);
      const existing = structuredClone(s.f.state().files);
      const appended = await s.upload('third.png');
      assert.equal(appended.order, 2);
      for (const [key, file] of Object.entries(existing))
        assert.deepEqual(
          s.f.state().files[key],
          file,
          'append must preserve all existing media metadata',
        );
      assert.deepEqual(
        (await s.photos()).map(({ key }) => key),
        [second.key, appended.key],
      );
    },
  );

  assert.equal(outboundAttempts, 0);
});
