import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_AIRCRAFT_API,
  PUBLIC_SELLER_AIRCRAFT_API,
  marketplaceListingHref,
  marketplaceListingKey,
  marketplaceListingPhoto,
  publicMarketplaceListings,
  refreshPublicMarketplaceListings,
} from '../../lib/public-aircraft-marketplace.mjs';
import { approve, create, fields, fixture, pdf, png, submit } from './fixture.mjs';

const legacyUrl = LEGACY_AIRCRAFT_API + '/browse?include=sold';
const sellerUrl = PUBLIC_SELLER_AIRCRAFT_API + '/browse?include=sold';
const browse = (...listings) => Response.json({ listings });
const snapshot = (source, ...listings) =>
  publicMarketplaceListings({ listings }, source);

test('browse projection accepts only public source statuses and valid card fields', () => {
  const rows = [
    null,
    'listing',
    [],
    { id: '' },
    { id: 12 },
    { id: 'old', make: 'Synthetic', year: 2001 },
    { id: 'active', status: 'active', price: 1 },
    { id: 'sold', status: 'sold' },
    { id: 'bounded', status: 'pending' },
    { id: 'draft', status: 'draft' },
    { id: 'archived', status: 'archived' },
    { id: 'deleted', status: 'deleted' },
    { id: 'unexpected', status: 'public' },
  ];
  assert.deepEqual(
    snapshot('legacy', ...rows).map((listing) => listing.id),
    ['old', 'active', 'sold'],
  );
  assert.deepEqual(
    snapshot('seller', ...rows).map((listing) => listing.id),
    ['active', 'sold', 'bounded'],
  );
  for (const data of [null, [], {}, { listings: {} }, { listings: 'private' }])
    assert.deepEqual(publicMarketplaceListings(data, 'seller'), []);
  assert.deepEqual(publicMarketplaceListings({ listings: rows }, 'owner'), []);
});

test('projection drops owner/contact/review/document data and rejects document-shaped photos', () => {
  const [listing] = snapshot('seller', {
    id: 'synthetic-public',
    status: 'active',
    source: 'legacy',
    href: 'https://untrusted.example.test',
    ownerId: 'private-owner',
    sellerEmail: 'private@example.test',
    sellerPhone: 'private-phone',
    sellerName: 'Private Owner',
    fields: { description: 'private nested fields' },
    revision: 4,
    acceptancePublicUntil: 123,
    logbooks: { airframe: [{ key: 'private-record' }] },
    videos: [{ key: 'video' }],
    description: 'Not needed by a card',
    make: { private: 'bad type' },
    model: 'Fixture',
    year: 2000,
    price: Infinity,
    totalTime: false,
    engineTime: '100',
    sellerLocation: 'Synthetic location',
    photos: [
      null,
      { key: 'private-record', category: 'airframe', type: 'application/pdf' },
      { key: 'mislabelled-pdf', category: 'photos', type: 'application/pdf' },
      { key: 'untyped-record' },
      {
        key: 'public-photo',
        category: 'photos',
        type: 'image/png',
        ownerId: 'private-owner',
        listingId: 'synthetic-public',
        name: 'Private name.png',
      },
    ],
  });
  assert.deepEqual(listing, {
    id: 'synthetic-public',
    source: 'seller',
    status: 'active',
    model: 'Fixture',
    year: 2000,
    engineTime: '100',
    sellerLocation: 'Synthetic location',
    photos: [{ key: 'public-photo' }],
  });
  assert.doesNotMatch(JSON.stringify(listing), /private|record|owner|revision/i);
});

test('same-source duplicate IDs collapse while cross-source IDs keep their own links and keys', async () => {
  const listings = await refreshPublicMarketplaceListings(async (url) =>
    url === legacyUrl
      ? browse({ id: 'same', make: 'Legacy' }, { id: 'same', make: 'Duplicate' })
      : browse(
          { id: 'same', status: 'active', make: 'Seller' },
          { id: 'same', status: 'sold', make: 'Duplicate' },
        ),
  );
  assert.deepEqual(listings.map(marketplaceListingKey), ['legacy:same', 'seller:same']);
  assert.deepEqual(listings.map(marketplaceListingHref), [
    '/aircraft-for-sale/same',
    '/api/aircraft-sale/listing/same',
  ]);
  assert.deepEqual(listings.map((listing) => listing.make), ['Legacy', 'Seller']);
});

test('both public requests omit credentials and authorization and use only anonymous browse endpoints', async () => {
  const requests = [];
  await refreshPublicMarketplaceListings(async (url, options) => {
    requests.push({ url, options });
    return browse();
  });
  assert.deepEqual(requests.map(({ url }) => url), [legacyUrl, sellerUrl]);
  for (const { options } of requests) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('Accept'), 'application/json');
    assert.equal(headers.get('Authorization'), null);
    assert.equal(headers.get('Cookie'), null);
    assert.deepEqual([...headers.keys()], ['accept']);
  }
});

test('legacy source failure preserves its snapshot without hiding current seller listings', async () => {
  const fallback = snapshot('legacy', { id: 'existing-original' });
  const listings = await refreshPublicMarketplaceListings(async (url) => {
    if (url === legacyUrl) throw new Error('Synthetic legacy outage');
    return browse({ id: 'current-seller', status: 'active' });
  }, fallback);
  assert.deepEqual(listings.map(marketplaceListingKey), [
    'legacy:existing-original',
    'seller:current-seller',
  ]);
});

for (const failure of ['http', 'network', 'json', 'shape']) {
  test(`seller ${failure} failure contributes no cached seller publication`, async () => {
    const fallback = [
      ...snapshot('legacy', { id: 'old-original' }),
      ...snapshot('seller', { id: 'expired-publication', status: 'pending' }),
    ];
    const listings = await refreshPublicMarketplaceListings(async (url) => {
      if (url === legacyUrl) return browse({ id: 'fresh-original' });
      if (failure === 'http') return new Response(null, { status: 503 });
      if (failure === 'network') throw new Error('Synthetic seller outage');
      if (failure === 'json') return new Response('invalid json');
      return Response.json({ listing: { id: 'private-owner-response' } });
    }, fallback);
    assert.deepEqual(listings.map(marketplaceListingKey), ['legacy:fresh-original']);
  });
}

test('successful empty public responses clear snapshots; a disabled seller source does not blank legacy', async () => {
  const fallback = [
    ...snapshot('legacy', { id: 'removed-original' }),
    ...snapshot('seller', { id: 'withdrawn-seller', status: 'active' }),
  ];
  assert.deepEqual(
    await refreshPublicMarketplaceListings(async () => browse(), fallback),
    [],
  );
  const listings = await refreshPublicMarketplaceListings(async (url) =>
    url === legacyUrl ? browse({ id: 'still-original' }) : browse(),
  );
  assert.deepEqual(listings.map(marketplaceListingKey), ['legacy:still-original']);
});

test('links and images encode IDs/keys and retain each public source origin', () => {
  const legacy = snapshot('legacy', {
    id: 'same/id?query',
    photos: [{ key: 'original/photo one.png', contentType: 'image/png' }],
  })[0];
  const seller = snapshot('seller', {
    id: 'same/id?query',
    status: 'active',
    photos: [{ key: 'seller/photo one.png', category: 'photos', type: 'image/png' }],
  })[0];
  assert.equal(marketplaceListingHref(legacy), '/aircraft-for-sale/same%2Fid%3Fquery');
  assert.equal(marketplaceListingHref(seller), '/api/aircraft-sale/listing/same%2Fid%3Fquery');
  const legacyPhoto = marketplaceListingPhoto(legacy);
  assert.equal(
    legacyPhoto.src,
    LEGACY_AIRCRAFT_API + '/files/original%2Fphoto%20one.png?w=800&q=80',
  );
  assert.match(legacyPhoto.srcSet, /w=600&q=80 600w/);
  assert.deepEqual(marketplaceListingPhoto(seller), {
    src: '/api/aircraft-sale/files/seller%2Fphoto%20one.png',
    srcSet: undefined,
  });
  assert.deepEqual(marketplaceListingPhoto({ id: 'no-photo', source: 'seller' }), {
    src: null,
    srcSet: undefined,
  });
});

const fixtureFetcher = (f, legacy = []) => (url, options) =>
  url === legacyUrl
    ? Promise.resolve(browse(...legacy))
    : f.callRaw(new Request(new URL(url, 'http://localhost'), options));

test('real public browse contract exposes approved photos and keeps owned drafts/records out of discovery', async () => {
  const f = fixture();
  const owner = await f.login();
  const published = await create(f, owner, {
    ...fields,
    sellerName: 'Synthetic Owner',
    sellerPhone: '555-fixture',
  });
  const draft = await create(f, owner);
  const photo = (
    await (
      await f.call('/upload?listingId=' + published.id + '&category=photos&filename=fixture.png', 'POST', png, owner)
    ).json()
  ).file;
  const document = (
    await (
      await f.call('/upload?listingId=' + published.id + '&category=airframe&filename=fixture.pdf', 'POST', pdf, owner)
    ).json()
  ).file;
  const saved = f.state().listings[published.id];
  await submit(f, owner, saved);
  assert.equal((await approve(f, saved)).status, 200);
  const listings = await refreshPublicMarketplaceListings(fixtureFetcher(f));
  assert.equal(listings.length, 1);
  assert.equal(listings[0].id, published.id);
  assert.deepEqual(listings[0].photos, [{ key: photo.key }]);
  assert.doesNotMatch(JSON.stringify(listings), /ownerId|sellerName|sellerPhone|logbooks|revision/);
  assert.ok(!listings.some((listing) => listing.id === draft.id));
  const detail = await f.callRaw(new Request(
    new URL(marketplaceListingHref(listings[0]), 'http://localhost'),
    { headers: { Accept: 'text/html' } },
  ));
  assert.equal(detail.status, 200);
  assert.equal((await f.call('/files/' + encodeURIComponent(photo.key))).status, 200);
  assert.equal((await f.call('/files/' + encodeURIComponent(document.key))).status, 401);

  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  assert.deepEqual(await refreshPublicMarketplaceListings(fixtureFetcher(f), listings), []);
  assert.equal((await f.call('/listing/' + published.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 404);
});

test('bounded acceptance browse membership is authoritative and successful unpublication removes its card', async () => {
  const f = fixture();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const owner = await f.login();
  const ordinary = await create(f, owner);
  const bounded = await create(f, owner);
  await submit(f, owner, ordinary);
  await submit(f, owner, bounded);
  assert.deepEqual(await refreshPublicMarketplaceListings(fixtureFetcher(f)), []);
  assert.equal((await f.call('/admin/review', 'POST', {
    listingId: bounded.id,
    revision: bounded.revision,
    decision: 'acceptance-approve',
  }, 'fixture-reviewer')).status, 200);
  const listings = await refreshPublicMarketplaceListings(fixtureFetcher(f));
  assert.deepEqual(listings.map((listing) => [listing.id, listing.status]), [[bounded.id, 'pending']]);
  assert.doesNotMatch(JSON.stringify(listings), /acceptance|revision|ownerId|logbooks/);
  assert.equal((await f.call('/listing/' + ordinary.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 404);
  assert.equal((await f.call('/admin/review', 'POST', {
    listingId: bounded.id,
    revision: bounded.revision,
    decision: 'acceptance-unpublish',
  }, 'fixture-reviewer')).status, 200);
  assert.deepEqual(await refreshPublicMarketplaceListings(fixtureFetcher(f), listings), []);
});
