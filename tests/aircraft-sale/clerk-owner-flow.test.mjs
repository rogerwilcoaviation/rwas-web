import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const source = new URL(
  '../../app/aircraft-for-sale/clerk-owner-reauth.ts',
  import.meta.url,
).pathname;
const result = await build({
  entryPoints: [source],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
});
const { CLERK_OWNER_FLOW_KEY, readClerkOwnerFlow, storeClerkOwnerFlow } =
  await import(
    'data:text/javascript;base64,' +
      Buffer.from(result.outputFiles[0].text).toString('base64')
  );
const storage = () => {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
};
const now = 1000000;

test('owner transactions and proofs use dedicated purpose storage and cannot outlive their five-minute window', () => {
  const value = storage();
  const transaction = {
    purpose: 'clerk-owner',
    phase: 'reauth',
    requestedAt: now,
    state: 'expected-state',
    proof: 'a'.repeat(43),
    csrf: 'owner-start-csrf',
  };
  storeClerkOwnerFlow(value, transaction);
  assert.deepEqual(readClerkOwnerFlow(value, now), transaction);
  assert.equal(value.getItem('rwas_sale_v2'), null);
  assert.equal(value.getItem('rwas_sale_identity'), null);
  assert.equal(readClerkOwnerFlow(value, now - 1), null);
  assert.equal(readClerkOwnerFlow(value, now + 300000), null);
  const proof = {
    purpose: 'clerk-owner',
    phase: 'confirmation',
    requestedAt: now,
    token: 'restricted-owner-proof',
    ownerCsrf: 'owner-proof-csrf',
    expiresAt: now + 1000,
    email: 'owner@example.test',
    name: 'Existing Seller',
  };
  storeClerkOwnerFlow(value, proof);
  assert.deepEqual(readClerkOwnerFlow(value, now + 999), proof);
  assert.equal(readClerkOwnerFlow(value, now + 1000), null);
});

test('ordinary identity envelopes, malformed proofs, and mixed-purpose transactions are rejected by owner recovery', () => {
  const value = storage();
  for (const unsafe of [
    { state: 'ordinary-state', proof: 'ordinary-proof', link: false },
    {
      purpose: 'seller',
      phase: 'confirmation',
      requestedAt: now,
      token: 'ordinary-session',
    },
    {
      purpose: 'clerk-owner',
      phase: 'reauth',
      requestedAt: now,
      state: 'owner-state',
      proof: 'short',
      csrf: 'owner-start-csrf',
    },
    {
      purpose: 'clerk-owner',
      phase: 'confirmation',
      requestedAt: now,
      token: 'restricted-owner-proof',
      expiresAt: now + 1000,
      email: 'owner@example.test',
      name: 'Existing Seller',
    },
  ]) {
    value.setItem(CLERK_OWNER_FLOW_KEY, JSON.stringify(unsafe));
    assert.equal(readClerkOwnerFlow(value, now), null);
  }
  value.setItem(CLERK_OWNER_FLOW_KEY, '{invalid');
  assert.equal(readClerkOwnerFlow(value, now), null);
});
