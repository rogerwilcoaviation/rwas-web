import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clerkProductionConfig,
  sellerPublicListingsEnabled,
} from '../../workers/aircraft-sale/clerk-production.mjs';
import { fixture, create, submit, approve } from './fixture.mjs';

const request = new Request('https://www.rogerwilcoaviation.com/api/aircraft-sale/auth/methods');
const privateMode = {
  CLERK_PRODUCTION_ENABLED: 'true',
  CLERK_PRODUCTION_SECRET_KEY: 'sk_live_synthetic_not_a_credential',
  PUBLIC_LISTINGS_ENABLED: 'false',
};

test('private Clerk acceptance mode remains the default and rejects an implicit public rollout', () => {
  assert.ok(clerkProductionConfig(privateMode, request));
  assert.equal(sellerPublicListingsEnabled(privateMode), false);
  assert.ok(clerkProductionConfig({ ...privateMode, CLERK_ACCEPTANCE_ENABLED: 'true' }, request));
  assert.throws(
    () => clerkProductionConfig({ ...privateMode, PUBLIC_LISTINGS_ENABLED: 'true' }, request),
    (error) => error.status === 503 && error.authStage === 'runtime-config',
  );
});

test('persistent Clerk publication requires both explicit flags and a separate acceptance mode', () => {
  const publicMode = { ...privateMode, PUBLIC_LISTINGS_ENABLED: 'true', CLERK_PUBLIC_LISTINGS_ENABLED: 'true' };
  assert.ok(clerkProductionConfig(publicMode, request));
  assert.equal(sellerPublicListingsEnabled(publicMode), true);
  for (const invalid of [
    { ...publicMode, CLERK_ACCEPTANCE_ENABLED: 'true' },
    { ...publicMode, PUBLIC_LISTINGS_ENABLED: 'false' },
    { ...privateMode, CLERK_PUBLIC_LISTINGS_ENABLED: 'yes' },
    { ...privateMode, PUBLIC_LISTINGS_ENABLED: undefined },
  ]) assert.throws(() => clerkProductionConfig(invalid, request), (error) => error.status === 503);
  assert.equal(sellerPublicListingsEnabled({ ...publicMode, CLERK_ACCEPTANCE_ENABLED: 'true' }), false);
  assert.equal(sellerPublicListingsEnabled({ PUBLIC_LISTINGS_ENABLED: 'true' }), true);
});

test('Staff approval, anonymous browse and detail use the same closed Clerk publication gate', async () => {
  const f = fixture();
  const owner = await f.login();
  const listing = await create(f, owner);
  await submit(f, owner, listing);
  Object.assign(f.env, privateMode, { PUBLIC_LISTINGS_ENABLED: 'true' });
  assert.equal((await approve(f, listing)).status, 409);
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
  assert.equal((await f.call('/listing/' + listing.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 404);
  f.env.CLERK_PUBLIC_LISTINGS_ENABLED = 'true';
  assert.equal((await approve(f, listing)).status, 200);
  assert.equal((await (await f.call('/browse')).json()).listings[0].id, listing.id);
  assert.equal((await f.call('/listing/' + listing.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 200);
  f.env.CLERK_PUBLIC_LISTINGS_ENABLED = 'false';
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
  assert.equal((await f.call('/listing/' + listing.id, 'GET', undefined, undefined, { Accept: 'text/html' })).status, 404);
});
