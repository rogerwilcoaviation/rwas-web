import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conditionFields,
  conditionReport,
  conditionRatingLabels,
  clearInapplicableConditionFields,
  listingCategories,
  listingFormValues,
  listingPayload,
  newListingFields,
} from '../../lib/marketplace/schema.mjs';
import { validateDraftField } from '../../lib/marketplace/draft-validation.mjs';
import { cleanListing } from '../../workers/aircraft-sale/listing-fields.mjs';
import { publicMarketplaceListings } from '../../lib/public-aircraft-marketplace.mjs';
import { fixture, fields, create, submit, approve } from './fixture.mjs';

const typedAircraft = {
  ...fields,
  workflowVersion: '3',
  listingType: 'aircraft',
  category: 'piston-single-aircraft',
  condition: 'Used',
  description: 'Synthetic condition fixture.',
  currency: 'USD',
  transactionType: 'sale',
  priceMode: 'amount',
  specifications: {},
};
const response = async (r, status = 200) => {
  assert.equal(r.status, status, await r.clone().text());
  return r.json();
};

test('condition questions follow category applicability, including legacy aircraft', () => {
  assert.deepEqual(
    conditionReport(fields).map((row) => row.side),
    ['exterior', 'interior'],
  );
  for (const category of listingCategories) {
    const values = {
      listingType: category.type,
      category: category.id,
      workflowVersion: '3',
    };
    const both =
      category.type === 'aircraft' ||
      category.type === 'hangars' ||
      category.id === 'flight-simulators' ||
      [
        'ground-support-equipment-fuel-trucks',
        'ground-support-equipment-fire-trucks-fire-equipment',
      ].includes(category.id);
    const exterior =
      category.id === 'drones' ||
      category.id.startsWith('ground-support-equipment-');
    assert.deepEqual(
      conditionReport(values).map((row) => row.side),
      both ? ['exterior', 'interior'] : exterior ? ['exterior'] : [],
      category.id,
    );
    for (const row of conditionReport(values)) {
      assert.equal(row.rating, null, category.id + ' must not infer a rating');
      assert.equal(row.notes, '');
    }
  }
  assert.deepEqual(conditionFields({ workflowVersion: '3' }), []);
});

test('star fields expose optional canonical choices with one shared scale', () => {
  assert.deepEqual(conditionRatingLabels, [
    '',
    'Poor',
    'Fair',
    'Good',
    'Very good',
    'Excellent',
  ]);
  const ratings = conditionFields(typedAircraft).filter(
    (field) => field.type === 'rating',
  );
  assert.equal(ratings.length, 2);
  for (const field of ratings) {
    assert.equal(field.required, false);
    assert.deepEqual(
      field.options.map((option) => option.value),
      ['1', '2', '3', '4', '5'],
    );
    assert.equal(validateDraftField(field, ''), '');
    for (const value of ['1', '2', '3', '4', '5'])
      assert.equal(validateDraftField(field, value), '');
    for (const value of ['0', '6', '-1', '2.5', '3.0', '05', '1e0', 'NaN'])
      assert.match(validateDraftField(field, value), /1 to 5/);
  }
});

test('the API accepts only whole stars and retains an explicit unknown', () => {
  for (const raw of [1, 2, 3, 4, 5, '1', ' 2 ', '3', '4', '5']) {
    const saved = cleanListing({ ...typedAircraft, exteriorRating: raw });
    assert.equal(saved.exteriorRating, Number(raw));
  }
  for (const raw of [
    0,
    6,
    -1,
    1.5,
    '2.0',
    '05',
    '1e0',
    'Infinity',
    'five',
    true,
    null,
    {},
    [],
  ]) {
    assert.throws(
      () => cleanListing({ ...typedAircraft, exteriorRating: raw }),
      { status: 400 },
    );
  }
  assert.equal(
    cleanListing({ ...typedAircraft, exteriorRating: ' ' }).exteriorRating,
    '',
  );
  assert.equal(Object.hasOwn(cleanListing(fields), 'exteriorRating'), false);
});

test('non-applicable reports are rejected while explicit clearing remains accepted', () => {
  const part = { listingType: 'parts', category: 'components-engines' };
  for (const key of [
    'exteriorRating',
    'interiorRating',
    'exteriorConditionNotes',
    'interiorConditionNotes',
  ]) {
    assert.throws(
      () =>
        cleanListing({ ...part, [key]: key.endsWith('Rating') ? 3 : 'Detail' }),
      /does not support/,
    );
    assert.equal(cleanListing({ ...part, [key]: '' })[key], '');
  }
  assert.equal(
    cleanListing({
      listingType: 'other',
      category: 'drones',
      exteriorRating: 2,
    }).exteriorRating,
    2,
  );
  assert.throws(
    () =>
      cleanListing({
        listingType: 'other',
        category: 'drones',
        interiorRating: 2,
      }),
    /does not support interior/,
  );
});

test('notes preserve the existing bounded text and explicit clears defeat legacy fallback', () => {
  const notes = 'Confirmed wear.\n' + 'x'.repeat(9984);
  assert.equal(
    cleanListing({ ...typedAircraft, exteriorConditionNotes: notes })
      .exteriorConditionNotes,
    notes,
  );
  assert.throws(
    () =>
      cleanListing({
        ...typedAircraft,
        interiorConditionNotes: 'x'.repeat(10001),
      }),
    /too long/,
  );
  const existing = {
    ...typedAircraft,
    specifications: {
      'exterior-exterior-notes': 'Old exterior notes',
      'interior-interior-notes': 'Old interior notes',
    },
  };
  assert.equal(conditionReport(existing)[0].notes, 'Old exterior notes');
  assert.equal(
    listingFormValues(existing, [])[`exteriorConditionNotes`],
    'Old exterior notes',
  );
  const cleared = { ...existing, exteriorConditionNotes: '' };
  assert.equal(conditionReport(cleared)[0].notes, '');
  assert.equal(listingFormValues(cleared, []).exteriorConditionNotes, '');
});

test('forms use one condition report instead of duplicate legacy specification-note questions', () => {
  const questions = newListingFields(typedAircraft, []);
  for (const key of [
    'exteriorRating',
    'interiorRating',
    'exteriorConditionNotes',
    'interiorConditionNotes',
  ])
    assert.equal(questions.filter((field) => field.name === key).length, 1);
  assert.ok(
    !questions.some((field) =>
      ['spec:exterior-exterior-notes', 'spec:interior-interior-notes'].includes(
        field.name,
      ),
    ),
  );
});

test('category changes clear hidden condition fields without mutating the form input', () => {
  const values = {
    listingType: 'other',
    category: 'drones',
    exteriorRating: '4',
    interiorRating: '3',
    exteriorConditionNotes: 'Paint wear',
    interiorConditionNotes: 'Cabin wear',
    title: 'Synthetic drone',
  };
  const updated = clearInapplicableConditionFields(values);
  assert.equal(values.interiorRating, '3');
  assert.equal(updated.interiorRating, '');
  assert.equal(updated.interiorConditionNotes, '');
  assert.equal(updated.exteriorRating, '4');
  assert.equal(updated.title, values.title);
  const payload = listingPayload({
    ...values,
    listingType: 'parts',
    category: 'components-engines',
  });
  for (const key of [
    'exteriorRating',
    'interiorRating',
    'exteriorConditionNotes',
    'interiorConditionNotes',
  ])
    assert.equal(payload[key], '');
});

test('public cards allowlist valid stars while keeping condition notes and private fields out', () => {
  const result = publicMarketplaceListings(
    {
      listings: [
        {
          id: 'fixture',
          status: 'active',
          listingType: 'aircraft',
          exteriorRating: '4',
          interiorRating: 5,
          exteriorConditionNotes: 'Private-to-detail text',
          interiorConditionNotes: 'Other detail text',
          ownerId: 'not-public',
          specifications: { secret: 'not-public' },
        },
      ],
    },
    'seller',
  )[0];
  assert.equal(result.exteriorRating, 4);
  assert.equal(result.interiorRating, 5);
  for (const key of [
    'exteriorConditionNotes',
    'interiorConditionNotes',
    'ownerId',
    'specifications',
  ])
    assert.equal(Object.hasOwn(result, key), false);
  for (const raw of [0, 6, 2.5, '2.0', true, null, {}]) {
    const item = publicMarketplaceListings(
      { listings: [{ id: 'fixture', status: 'active', exteriorRating: raw }] },
      'seller',
    )[0];
    assert.equal(Object.hasOwn(item, 'exteriorRating'), false);
  }
});

test('legacy listings remain unrated and accept rating-only PUT edits with durable public projection', async () => {
  const f = fixture(),
    owner = await f.login();
  const listing = await create(f, owner);
  assert.equal(conditionReport(listing)[0].rating, null);
  const edited = (
    await response(
      await f.call(
        '/listings/' + listing.id,
        'PUT',
        {
          exteriorRating: '4',
          interiorRating: 3,
          exteriorConditionNotes: 'Honest <wear> detail.',
        },
        owner,
      ),
    )
  ).listing;
  assert.equal(edited.exteriorRating, 4);
  assert.equal(edited.make, fields.make);
  f.restart();
  const saved = (
    await response(await f.call('/my-listings', 'GET', undefined, owner))
  ).listings.find((item) => item.id === listing.id);
  assert.equal(saved.interiorRating, 3);
  assert.equal(saved.exteriorConditionNotes, 'Honest <wear> detail.');
  await response(await submit(f, owner, saved));
  await response(await approve(f, saved));
  const published = (await response(await f.call('/listing/' + listing.id)))
    .listing;
  assert.equal(published.exteriorRating, 4);
  assert.equal(published.interiorRating, 3);
  assert.equal(published.exteriorConditionNotes, 'Honest <wear> detail.');
  assert.equal(Object.hasOwn(published, 'ownerId'), false);
  const cleared = (
    await response(
      await f.call(
        '/listings/' + listing.id,
        'PUT',
        { exteriorRating: '', exteriorConditionNotes: '' },
        owner,
      ),
    )
  ).listing;
  assert.equal(cleared.exteriorRating, '');
  assert.equal(cleared.exteriorConditionNotes, '');
  assert.equal(cleared.interiorRating, 3);
  assert.equal(cleared.status, 'draft');
  assert.equal((await f.call('/listing/' + listing.id)).status, 401);
});

test('a saved category-switch payload clears old reports in the real partial-PUT merge', async () => {
  const f = fixture(),
    owner = await f.login();
  const listing = await create(f, owner, {
    ...typedAircraft,
    exteriorRating: 5,
    interiorRating: 4,
    exteriorConditionNotes: 'Aircraft paint',
    interiorConditionNotes: 'Aircraft cabin',
  });
  const switchPayload = listingPayload({
    listingType: 'parts',
    category: 'components-engines',
    specifications: {},
    exteriorRating: '5',
    interiorRating: '4',
    exteriorConditionNotes: 'Aircraft paint',
    interiorConditionNotes: 'Aircraft cabin',
    condition: 'Serviceable',
    title: 'Synthetic engine',
  });
  const result = (
    await response(
      await f.call('/listings/' + listing.id, 'PUT', switchPayload, owner),
    )
  ).listing;
  for (const key of [
    'exteriorRating',
    'interiorRating',
    'exteriorConditionNotes',
    'interiorConditionNotes',
  ])
    assert.equal(result[key], '');
  assert.deepEqual(conditionReport(result), []);
  f.restart();
  const resumed = (
    await response(await f.call('/my-listings', 'GET', undefined, owner))
  ).listings.find((item) => item.id === listing.id);
  assert.deepEqual(conditionReport(resumed), []);
});

test('clearing migrated notes does not resurrect legacy specification notes after persistence', async () => {
  const f = fixture(),
    owner = await f.login();
  const listing = await create(f, owner, {
    ...typedAircraft,
    specifications: {
      'exterior-exterior-notes': 'Legacy paint note',
      'interior-interior-notes': 'Legacy cabin note',
    },
  });
  const values = listingFormValues(listing, []);
  assert.equal(values.exteriorConditionNotes, 'Legacy paint note');
  const updated = (
    await response(
      await f.call(
        '/listings/' + listing.id,
        'PUT',
        { exteriorConditionNotes: '' },
        owner,
      ),
    )
  ).listing;
  f.restart();
  const reread = (
    await response(await f.call('/my-listings', 'GET', undefined, owner))
  ).listings.find((item) => item.id === listing.id);
  assert.equal(conditionReport(updated)[0].notes, '');
  assert.equal(conditionReport(reread)[0].notes, '');
  assert.equal(conditionReport(reread)[1].notes, 'Legacy cabin note');
});
