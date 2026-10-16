import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const source = new URL(
  '../../app/aircraft-for-sale/seller-request-facade.ts',
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
const { createSellerRequestFacade } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(result.outputFiles[0].text).toString('base64')
);
const canonical = 'https://www.rogerwilcoaviation.com';
const envelope = () => ({
  provider: 'clerk-production',
  token: 'ordinary-seller-token',
  csrf: 'seller-csrf',
});
function fixture(options = {}) {
  let snapshot = { session: envelope(), generation: 1 };
  let rejected = 0;
  let headerCalls = 0;
  const facade = createSellerRequestFacade({
    read: () => snapshot,
    origin: () => options.origin || canonical,
    reject: () => {
      rejected++;
      snapshot = { session: null, generation: snapshot.generation + 1 };
    },
    headers: async (session) => {
      headerCalls++;
      if (options.failure) throw options.failure;
      if (options.gate) await options.gate;
      return {
        Authorization: 'Bearer ' + session.token,
        'X-RWAS-CSRF': session.csrf,
        'X-Clerk-Session-Token': options.missingJwt ? '' : 'fresh-clerk-jwt',
      };
    },
  });
  return {
    ...facade,
    change: (session) => {
      snapshot = { session, generation: snapshot.generation + 1 };
    },
    rejected: () => rejected,
    calls: () => headerCalls,
    session: () => snapshot.session,
  };
}

test('widget facade returns fresh Clerk and CSRF headers only for the two exact canonical seller paths', async () => {
  const value = fixture();
  for (const path of [
    '/api/aircraft-sale/draft',
    '/api/aircraft-sale/intake',
  ]) {
    const headers = await value.requestHeaders(path);
    assert.equal(headers.Authorization, 'Bearer ordinary-seller-token');
    assert.equal(headers['X-RWAS-CSRF'], 'seller-csrf');
    assert.equal(headers['X-Clerk-Session-Token'], 'fresh-clerk-jwt');
  }
  for (const path of [
    'https://elsewhere.test/api/aircraft-sale/intake',
    '//elsewhere.test/api/aircraft-sale/intake',
    '/api/aircraft-sale/intake?next=x',
    '/api/aircraft-sale/uploads',
    '/api/aircraft-sale/auth/clerk-production/link/start',
  ])
    await assert.rejects(value.requestHeaders(path), { status: 403 });
  assert.equal(value.calls(), 2);
  for (const origin of [
    'https://rogerwilcoaviation.com',
    'http://www.rogerwilcoaviation.com',
    'https://preview.example.test',
  ]) {
    const wrong = fixture({ origin });
    await assert.rejects(wrong.requestHeaders('/api/aircraft-sale/intake'), {
      status: 403,
    });
    assert.equal(wrong.calls(), 0);
  }
});

test('missing identity, missing CSRF, and restricted owner proofs cannot become widget credentials', async () => {
  const value = fixture();
  for (const session of [
    null,
    {
      purpose: 'clerk-owner',
      token: 'restricted-owner-proof',
      ownerCsrf: 'owner-only',
    },
  ]) {
    value.change(session);
    await assert.rejects(value.requestHeaders('/api/aircraft-sale/intake'), {
      status: 401,
    });
  }
  value.change({
    provider: 'clerk-production',
    token: 'ordinary-seller-token',
  });
  await assert.rejects(value.requestHeaders('/api/aircraft-sale/intake'), {
    status: 403,
  });
  assert.equal(value.calls(), 0);
  const missing = fixture({ missingJwt: true });
  await assert.rejects(missing.requestHeaders('/api/aircraft-sale/draft'), {
    status: 401,
  });
});

test('sign-out or replacement while Clerk headers are pending rejects the captured request', async () => {
  for (const successor of [null, { ...envelope(), token: 'successor-token' }]) {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const value = fixture({ gate });
    const pending = value.requestHeaders('/api/aircraft-sale/intake');
    value.change(successor);
    release();
    await assert.rejects(pending, { status: 401 });
    assert.equal(value.session(), successor);
    assert.equal(value.rejected(), 0);
  }
});

test('a rejected old widget bearer cannot sign out a replacement seller', () => {
  const value = fixture();
  value.change({ ...envelope(), token: 'successor-token' });
  value.sessionRejected('ordinary-seller-token');
  assert.equal(value.rejected(), 0);
  value.sessionRejected('successor-token');
  assert.equal(value.rejected(), 1);
  assert.equal(value.session(), null);
});

test('token-refresh outages remain retryable while confirmed authentication denial keeps its status', async () => {
  for (const failure of [
    new TypeError('Failed to fetch'),
    Object.assign(new Error('Provider unavailable'), { status: 503 }),
    Object.assign(new Error('Rate limited'), { status: 429 }),
    Object.assign(new Error('Upstream failure'), { status: 502 }),
  ]) {
    const value = fixture({ failure });
    await assert.rejects(value.requestHeaders('/api/aircraft-sale/intake'), {
      status: failure.status === 429 ? 429 : 503,
    });
    assert.equal(value.session().token, 'ordinary-seller-token');
    assert.equal(value.rejected(), 0);
  }
  for (const status of [401, 403]) {
    const value = fixture({
      failure: Object.assign(new Error('Authentication denied'), { status }),
    });
    await assert.rejects(value.requestHeaders('/api/aircraft-sale/intake'), {
      status,
    });
  }
});
