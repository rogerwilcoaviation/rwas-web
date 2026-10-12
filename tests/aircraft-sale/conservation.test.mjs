import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import {
  ConservationCapture, ConservationError, CONSERVATION_BUCKETS, CONSERVATION_LIMITS,
  CONSERVATION_SCHEMA, canonicalConservationJson, conservationMediaId,
  conservationRecordId, loadConservationRows, isConservationRequest,
} from '../../workers/aircraft-sale/conservation.mjs';

const endpoint = '/api/aircraft-sale/admin/accounts/_conservation/capture';
const origin = 'https://www.fixture.test';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const request = (cursor, options = {}) => new Request(origin + endpoint +
  (cursor ? '?cursor=' + cursor : ''), options);
const rows = () => [
  { bucket: 'profiles', key: 'private-owner-id', value: { id: 'private-owner-id',
    email: 'private-owner@example.test', name: 'Private name', futureBusinessField: { unicode: 'λ' } } },
  { bucket: 'identities', key: 'private-identity-key', value: { userId: 'private-owner-id', subject: 'private-provider-subject', method: 'password' } },
  { bucket: 'drafts', key: 'private-owner-id', value: { description: 'Private unsaved draft', intake: true, step: 2 } },
  { bucket: 'listings', key: 'private-listing-id', value: { id: 'private-listing-id', ownerId: 'private-owner-id', status: 'deleted', revision: 8, fields: { price: 10 } } },
  { bucket: 'files', key: 'listings/private-listing-id/misc/private.pdf', value: { key: 'listings/private-listing-id/misc/private.pdf', ownerId: 'private-owner-id', listingId: 'private-listing-id', deleting: true } },
  { bucket: 'idempotency', key: 'private-owner-id:private-submission', value: { id: 'private-listing-id', digest: 'prior-submission-digest' } },
];
function nodeDigestStream() {
  const hash = createHash('sha256');
  let finish, fail;
  const digest = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  const stream = new WritableStream({
    write(chunk) { hash.update(chunk); },
    close() { const result = hash.digest(); finish(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)); },
    abort() { fail(new Error('fixture stream cancelled')); },
  });
  stream.digest = digest;
  return stream;
}
function mediaFixture() {
  const objects = new Map();
  const calls = [];
  const add = (key, bytes = new Uint8Array([1, 2, 3]), extra = {}) => {
    objects.set(key, { key, version: 'version-' + objects.size, etag: sha(bytes),
      size: bytes.byteLength, uploaded: new Date('2026-10-11T00:00:00Z'), storageClass: 'Standard',
      httpMetadata: { contentType: 'application/octet-stream' }, customMetadata: { synthetic: 'private-metadata-value' },
      checksums: {}, bytes, ...extra });
  };
  add(rows().find((x) => x.bucket === 'files').key);
  add('orphan/private-orphan.pdf', new Uint8Array([4, 5]));
  add('orphan/zero-byte-object', new Uint8Array(0));
  const metadata = ({ bytes, ...object }) => structuredClone(object);
  const media = {
    async list(options) {
      calls.push({ method: 'list', options });
      assert.equal(options.prefix, undefined);
      assert.deepEqual(options.include, ['httpMetadata', 'customMetadata']);
      return { objects: [...objects.values()].map(metadata), truncated: false };
    },
    async get(key, options) {
      calls.push({ method: 'get', key, options });
      const object = objects.get(key);
      if (!object) return null;
      const data = metadata(object);
      if (options.onlyIf.etagMatches !== object.etag) return data;
      return { ...data, body: new ReadableStream({ start(controller) {
        // Multiple chunks exercise streaming rather than arrayBuffer hashing.
        controller.enqueue(object.bytes.slice(0, 1));
        controller.enqueue(object.bytes.slice(1));
        controller.close();
      } }) };
    },
    async head(key) { calls.push({ method: 'head', key }); return objects.has(key) ? metadata(objects.get(key)) : null; },
    put() { throw new Error('Capture must not PUT'); },
    delete() { throw new Error('Capture must not DELETE'); },
  };
  return { objects, calls, media, add, metadata };
}
function captureFixture(options = {}) {
  let data = rows(), reads = 0;
  const r2 = mediaFixture();
  const capture = new ConservationCapture({ loadRows: async () => { reads++; return structuredClone(data); },
    media: r2.media, makeDigestStream: nodeDigestStream, ...options });
  return { ...r2, capture, reads: () => reads, data: () => data, setRows: (value) => { data = value; } };
}
async function next(f, page, actor = 'account-admin@example.test', options) {
  return f.capture.handle(request(page.nextCursor, options), actor);
}
async function finish(f, start) {
  const pages = [start];
  while (!pages.at(-1).complete) {
    assert.ok(pages.length <= 11000);
    pages.push(await next(f, pages.at(-1)));
  }
  return pages;
}
const error = (code) => (x) => x.code === code;

test('complete digest-only pages conserve full business fields and entire media, including deleting/orphan/zero bytes', async () => {
  const f = captureFixture();
  const pages = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  assert.deepEqual(pages.map((x) => x.phase), ['start', 'records', 'media', 'media', 'media', 'complete']);
  const first = pages[0], last = pages.at(-1);
  assert.equal(first.complete, false);
  assert.equal(last.complete, true);
  assert.equal(last.nextCursor, null);
  assert.equal(first.recordCount, 6);
  assert.equal(first.mediaCount, 3);
  assert.deepEqual(first.recordCounts, Object.fromEntries(CONSERVATION_BUCKETS.map((x) => [x, 1])));
  const records = pages.flatMap((x) => x.records);
  assert.equal(first.stateRootSha256, sha(canonicalConservationJson(records)));
  const media = pages.flatMap((x) => x.media);
  const rootRows = media.map((x) => ({ objectKey: x.objectKey, inventoryMetadataSha256: x.inventoryMetadataSha256 }));
  assert.equal(first.inventoryRootSha256, sha(canonicalConservationJson(rootRows)));
  for (const [i, page] of pages.entries()) {
    assert.equal(page.sequence, i);
    assert.equal(page.captureId, first.captureId);
    assert.equal(page.schemaSha256, sha(canonicalConservationJson(CONSERVATION_SCHEMA)));
    assert.equal(page.endpointAlgorithmSha256, sha('seller-conservation-algorithm-v1\0' + canonicalConservationJson(CONSERVATION_SCHEMA)));
    assert.equal(page.stateRootSha256, first.stateRootSha256);
    assert.equal(page.inventoryRootSha256, first.inventoryRootSha256);
  }
  for (const object of f.objects.values()) {
    const descriptor = media.find((x) => x.objectKey === sha('seller-v2-media-key-v1\0' + object.key));
    assert.equal(descriptor.bytesSha256, sha(object.bytes));
    assert.equal(descriptor.bytes, object.bytes.byteLength);
  }
  const output = JSON.stringify(pages);
  for (const secret of ['private-owner-id', 'private-owner@example.test', 'Private name',
    'Private unsaved draft', 'private-provider-subject', 'private-listing-id', 'private-metadata-value', 'private-orphan.pdf'])
    assert.ok(!output.includes(secret), secret);
  assert.equal(f.calls.filter((x) => x.method === 'list').length, 2);
  assert.equal(f.calls.filter((x) => x.method === 'get').length, 3);
});

test('all business row fields affect the root; order of object properties does not', async () => {
  const f = captureFixture();
  const before = await f.capture.handle(request(), 'account-admin@example.test');
  const changed = rows(); changed[0].value.futureBusinessField.unicode = 'changed-private-value';
  f.setRows(changed);
  await assert.rejects(next(f, before), error('BUSINESS_STATE_CHANGED'));
  await assert.rejects(next(f, before), error('CAPTURE_CURSOR_UNAVAILABLE'));
  assert.equal(canonicalConservationJson({ b: 1, a: 'λ' }), '{"a":"λ","b":1}');
  assert.notEqual(canonicalConservationJson([1, 2]), canonicalConservationJson([2, 1]));
  const disguisedSparse = new Array(1); disguisedSparse.extra = 1;
  const symbolArray = [1]; symbolArray[Symbol('hidden')] = 2;
  for (const unsafe of [undefined, NaN, Infinity, -0, new Date(), [1, , 3],
    disguisedSparse, symbolArray, { a: undefined }, { a: Symbol('x') }])
    assert.throws(() => canonicalConservationJson(unsafe), error('UNSUPPORTED_BUSINESS_VALUE'));
  const invalidKey = captureFixture();
  invalidKey.setRows([{ bucket: 'profiles', key: '\ud800', value: {} }]);
  await assert.rejects(invalidKey.capture.handle(request(), 'account-admin@example.test'), error('INVALID_BUSINESS_ROW'));
});

test('record pagination is complete and cannot change ownership or skip rows via user-selected filters', async () => {
  const f = captureFixture();
  f.setRows(Array.from({ length: 125 }, (_, i) => ({ bucket: 'profiles', key: 'synthetic-' + i,
    value: { id: 'synthetic-' + i, privateContact: 'value-' + i } })));
  const start = await f.capture.handle(request(), 'account-admin@example.test');
  const pages = await finish(f, start);
  assert.deepEqual(pages.filter((x) => x.phase === 'records').map((x) => x.records.length), [100, 25]);
  assert.equal(new Set(pages.flatMap((x) => x.records.map((r) => r.objectId))).size, 125);
  await assert.rejects(f.capture.handle(new Request(origin + endpoint + '?prefix=listings/'), 'account-admin@example.test'), error('INVALID_CAPTURE_REQUEST'));
});

test('actor-bound one-use cursors, expiry and capacity never grant unauthenticated continuation', async () => {
  let now = Date.now();
  const f = captureFixture({ now: () => now });
  const start = await f.capture.handle(request(), 'account-admin@example.test');
  await assert.rejects(next(f, start, 'other-admin@example.test'), error('CAPTURE_CURSOR_UNAVAILABLE'));
  const page = await next(f, start);
  await assert.rejects(next(f, start), error('CAPTURE_CURSOR_UNAVAILABLE'));
  now += CONSERVATION_LIMITS.captureTtlMs + 1;
  await assert.rejects(next(f, page), error('CAPTURE_CURSOR_UNAVAILABLE'));
  for (let i = 0; i < 4; i++) await f.capture.handle(request(), 'account-admin@example.test');
  await assert.rejects(f.capture.handle(request(), 'account-admin@example.test'), error('CAPTURE_CAPACITY'));
});

test('missing referenced media includes deleting records and fails rather than suppressing references', async () => {
  const f = captureFixture();
  f.objects.delete(rows().find((x) => x.bucket === 'files').key);
  await assert.rejects(f.capture.handle(request(), 'account-admin@example.test'), error('REFERENCED_MEDIA_MISSING'));
});

test('malformed inventory pagination, repeated cursors and duplicate keys fail closed', async () => {
  for (const broken of [
    { objects: [], truncated: true },
    { objects: [], truncated: 'false' },
    { objects: [], truncated: false, delimitedPrefixes: ['hidden/'] },
  ]) {
    const f = captureFixture(); f.media.list = async () => broken;
    await assert.rejects(f.capture.handle(request(), 'account-admin@example.test'), error(broken.truncated === true ? 'INVALID_INVENTORY_CURSOR' : 'INVALID_INVENTORY_PAGE'));
  }
  const loop = captureFixture();
  loop.media.list = async () => ({ objects: [], truncated: true, cursor: 'same-cursor' });
  await assert.rejects(loop.capture.handle(request(), 'account-admin@example.test'), error('INVALID_INVENTORY_CURSOR'));
  const duplicate = captureFixture();
  const object = duplicate.metadata(duplicate.objects.values().next().value);
  duplicate.media.list = async () => ({ objects: [object, object], truncated: false });
  await assert.rejects(duplicate.capture.handle(request(), 'account-admin@example.test'), error('DUPLICATE_MEDIA_KEY'));
});

test('whole inventory follows multiple provider cursors and verifies the terminal pass', async () => {
  const f = captureFixture(); const values = [...f.objects.values()].map(f.metadata);
  const observed = [];
  f.media.list = async ({ cursor }) => {
    observed.push(cursor ?? null);
    return cursor === 'second' ? { objects: values.slice(1), truncated: false }
      : { objects: values.slice(0, 1), truncated: true, cursor: 'second' };
  };
  const pages = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  assert.equal(pages.at(-1).mediaCount, 3);
  assert.deepEqual(observed, [null, 'second', null, 'second']);
});

test('native empty storage-class marker is conserved distinctly from Standard and absent, while unknown values fail', async () => {
  const f = captureFixture();
  const standard = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  for (const object of f.objects.values()) object.storageClass = '';
  const empty = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  assert.notEqual(empty[0].inventoryRootSha256, standard[0].inventoryRootSha256);
  const standardMedia = standard.flatMap((x) => x.media), emptyMedia = empty.flatMap((x) => x.media);
  for (const object of emptyMedia) {
    const prior = standardMedia.find((x) => x.objectKey === object.objectKey);
    assert.equal(object.bytesSha256, prior.bytesSha256);
    assert.notEqual(object.metadataSha256, prior.metadataSha256);
  }
  for (const object of f.objects.values()) delete object.storageClass;
  const absent = await f.capture.handle(request(), 'account-admin@example.test');
  assert.notEqual(absent.inventoryRootSha256, empty[0].inventoryRootSha256);
  f.objects.values().next().value.storageClass = 'unrecognized-class';
  await assert.rejects(f.capture.handle(request(), 'account-admin@example.test'), error('INVALID_MEDIA_METADATA'));
});

test('known unset HTTP fields and full-range suffix preserve every complete-capture digest across LIST, GET, HEAD and terminal reads', async () => {
  const fields = ['contentType', 'contentLanguage', 'contentDisposition',
    'contentEncoding', 'cacheControl', 'cacheExpiry'];
  const prepare = (nativeAt) => {
    const f = captureFixture();
    const objects = [...f.objects.values()];
    objects[0].httpMetadata = {};
    objects[1].httpMetadata = { contentType: 'application/pdf', contentLanguage: '',
      contentDisposition: 'inline', contentEncoding: 'identity', cacheControl: 'private' };
    objects[2].httpMetadata = { cacheExpiry: new Date('2026-11-01T00:00:00Z') };
    const nativeHttp = (object) => ({ ...object, httpMetadata:
      { ...Object.fromEntries(fields.map((key) => [key, undefined])), ...object.httpMetadata } });
    const list = f.media.list, get = f.media.get, head = f.media.head;
    let lists = 0;
    f.media.list = async (...args) => {
      const page = await list(...args);
      const stage = ++lists === 1 ? 'list' : 'terminal';
      return nativeAt === 'all' || nativeAt === stage
        ? { ...page, objects: page.objects.map(nativeHttp) } : page;
    };
    for (const [method, read] of [['get', get], ['head', head]])
      f.media[method] = async (...args) => {
        const object = await read(...args), range = { offset: 0, length: object.size };
        return nativeAt === 'all' || nativeAt === method
          ? { ...nativeHttp(object), range: { ...range, suffix: undefined } }
          : { ...object, range };
      };
    return f;
  };
  const conserved = (pages) => pages.map(({ captureId, nextCursor, observedAt, ...page }) => page);
  const baseline = prepare('omitted');
  const expected = await finish(baseline, await baseline.capture.handle(request(), 'account-admin@example.test'));
  for (const nativeAt of ['list', 'get', 'head', 'terminal', 'all']) {
    const f = prepare(nativeAt);
    const pages = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
    assert.deepEqual(conserved(pages), conserved(expected), nativeAt);
    assert.deepEqual(['list', 'get', 'head'].map((method) =>
      f.calls.filter((call) => call.method === method).length), [2, 3, 3]);
    for (const object of f.objects.values()) {
      const descriptor = pages.flatMap((page) => page.media).find((item) =>
        item.objectKey === sha('seller-v2-media-key-v1\0' + object.key));
      const metadata = { key: object.key, version: object.version, size: object.size,
        etag: object.etag, uploaded: object.uploaded.toISOString(), storageClass: object.storageClass,
        httpMetadata: Object.fromEntries(Object.entries(object.httpMetadata).map(([key, value]) =>
          [key, value instanceof Date ? value.toISOString() : value])), customMetadata: object.customMetadata };
      assert.equal(descriptor.inventoryMetadataSha256, sha(canonicalConservationJson(metadata)));
      assert.equal(descriptor.metadataSha256, sha(canonicalConservationJson({ ...metadata,
        checksums: {}, ssecKeyMd5: null, bodyRange: { offset: 0, length: object.size },
        headRange: { offset: 0, length: object.size } })));
      assert.equal(descriptor.bytesSha256, sha(object.bytes));
      assert.equal(descriptor.bytes, object.size);
    }
  }
});

test('unset HTTP normalization retains defined metadata drift and rejects unknown undefined fields at every read stage', async () => {
  for (const stage of ['list', 'get', 'head', 'terminal']) {
    for (const invalid of ['unknown', 'changed']) {
      if (stage === 'list' && invalid === 'changed') continue;
      const f = captureFixture();
      for (const object of f.objects.values()) object.httpMetadata.cacheExpiry = undefined;
      const transform = (object) => ({ ...object, httpMetadata: { ...object.httpMetadata,
        ...(invalid === 'unknown' ? { unknownOptional: undefined } : { contentType: 'changed-defined-value' }) } });
      if (stage === 'list' || stage === 'terminal') {
        const list = f.media.list;
        let lists = 0;
        f.media.list = async (...args) => {
          const page = await list(...args);
          return ++lists === (stage === 'list' ? 1 : 2)
            ? { ...page, objects: page.objects.map(transform) } : page;
        };
      } else {
        const read = f.media[stage];
        f.media[stage] = async (...args) => transform(await read(...args));
      }
      await assert.rejects(async () => finish(f,
        await f.capture.handle(request(), 'account-admin@example.test')),
      error(invalid === 'unknown' ? 'UNSUPPORTED_MEDIA_METADATA'
        : stage === 'terminal' ? 'MEDIA_INVENTORY_CHANGED' : 'MEDIA_CHANGED'));
      assert.equal(f.capture.cursors.size, 0);
    }
  }
});

test('invalid media values stay fail-closed with only fixed metadataReason tags after account authorization', async () => {
  const cases = [
    [(object) => { object.key = 'private-invalid\0key'; }, 'MEDIA_KEY'],
    [(object) => { object.version = null; }, 'MEDIA_VERSION'],
    [(object) => { object.etag = ''; }, 'MEDIA_ETAG'],
    [(object) => { object.size = -1; }, 'MEDIA_SIZE'],
    [(object) => { object.uploaded = new Date(NaN); }, 'MEDIA_UPLOADED'],
    [(object) => { object.storageClass = 'private-unrecognized-class'; }, 'MEDIA_STORAGE_CLASS'],
    ...[null, [], 'private-invalid-container'].map((value) =>
      [(object) => { object.httpMetadata = value; }, 'HTTP_METADATA_CONTAINER']),
    ...['contentType', 'contentLanguage', 'contentDisposition', 'contentEncoding', 'cacheControl']
      .flatMap((key) => [null, 0, false, {}].map((value) =>
        [(object) => { object.httpMetadata[key] = value; }, 'HTTP_METADATA_VALUE'])),
    ...[null, 'private-invalid-date', 0, new Date(NaN)].map((value) =>
      [(object) => { object.httpMetadata.cacheExpiry = value; }, 'HTTP_CACHE_EXPIRY']),
    ...[null, []].map((value) =>
      [(object) => { object.customMetadata = value; }, 'CUSTOM_METADATA_CONTAINER']),
    ...[undefined, null, 0].map((value) =>
      [(object) => { object.customMetadata.synthetic = value; }, 'CUSTOM_METADATA_VALUE']),
    ...[undefined, null, 'private-unknown-value'].map((value) =>
      [(object) => { object.httpMetadata.privateUnknownField = value; }, undefined, 'UNSUPPORTED_MEDIA_METADATA']),
  ];
  let allowed = false, checks = 0;
  const store = new SellerStore({ storage: {} }, {
    ACCOUNT_ADMIN_SITE_ORIGIN: origin,
    ACCOUNT_ADMIN_AUTH: { fetch: async () => {
      checks++;
      return allowed ? Response.json({ actor: 'account-admin@example.test',
        scope: 'seller-accounts', expiresAt: Date.now() + 60000 }) : new Response(null, { status: 403 });
    } },
  });
  store.loadState = store.saveState = store.audit = () => { throw new Error('Capture must bypass ordinary persistence'); };
  const rejected = captureFixture();
  rejected.objects.values().next().value.httpMetadata.cacheControl = null;
  store.conservationCapture = rejected.capture;
  const denied = await store.fetch(request());
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).metadataReason, undefined);
  assert.equal(rejected.reads(), 0);
  assert.equal(rejected.calls.length, 0);
  allowed = true;
  for (const [mutate, metadataReason, code = 'INVALID_MEDIA_METADATA'] of cases) {
    const f = captureFixture();
    mutate(f.objects.values().next().value);
    store.conservationCapture = f.capture;
    const response = await store.fetch(request());
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: 'Conservation capture unavailable. Start a fresh capture after resolving the reported condition.',
      code, ...(metadataReason ? { metadataReason } : {}),
    });
    assert.equal(f.capture.cursors.size, 0);
    assert.ok(f.calls.every((call) => call.method === 'list'));
  }
  assert.equal(checks, cases.length + 1);
  assert.equal(new ConservationError(409, 'INVALID_MEDIA_METADATA', 'private-provider-payload').metadataReason, undefined);
  assert.equal(new ConservationError(409, 'MEDIA_CHANGED', 'MEDIA_KEY').metadataReason, undefined);
});

test('native full-object ranges include zero bytes and are hashed; partial and malformed ranges cannot yield complete', async () => {
  const bindRange = (f, rangeFor, response = 'both') => {
    const get = f.media.get, head = f.media.head;
    if (response !== 'head')
      f.media.get = async (...args) => { const object = await get(...args); return { ...object, range: rangeFor(object) }; };
    if (response !== 'get')
      f.media.head = async (...args) => { const object = await head(...args); return { ...object, range: rangeFor(object) }; };
  };
  const f = captureFixture();
  const absent = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  bindRange(f, (object) => ({ offset: 0, length: object.size }));
  const full = await finish(f, await f.capture.handle(request(), 'account-admin@example.test'));
  assert.ok(full.at(-1).complete);
  const prior = absent.flatMap((x) => x.media);
  assert.ok(full.flatMap((x) => x.media).some((x) => x.bytes === 0));
  for (const object of full.flatMap((x) => x.media)) {
    const previous = prior.find((x) => x.objectKey === object.objectKey);
    assert.equal(object.bytesSha256, previous.bytesSha256);
    assert.equal(object.inventoryMetadataSha256, previous.inventoryMetadataSha256);
    assert.notEqual(object.metadataSha256, previous.metadataSha256);
  }
  for (const rangeFor of [
    () => null,
    (object) => ({ offset: 1, length: object.size }),
    (object) => ({ offset: 0, length: object.size - 1 }),
    (object) => ({ offset: 0, length: object.size, suffix: 0 }),
    (object) => ({ offset: 0, length: object.size, suffix: null }),
    (object) => ({ offset: 0, length: object.size, suffix: 'unset' }),
    (object) => ({ offset: 0, length: object.size, extra: true }),
    (object) => ({ offset: 0, length: object.size, extra: undefined }),
    (object) => Object.defineProperty({ offset: 0, length: object.size }, 'suffix', { value: undefined }),
    (object) => ({ offset: 0, length: object.size, get suffix() { return undefined; } }),
    (object) => ({ offset: 0, length: object.size, [Symbol('extra')]: undefined }),
    () => ({ offset: 0, length: Infinity }),
  ]) {
    for (const response of ['get', 'head']) {
      const broken = captureFixture(); bindRange(broken, rangeFor, response);
      const start = await broken.capture.handle(request(), 'account-admin@example.test');
      await assert.rejects(next(broken, await next(broken, start)), error('MEDIA_CHANGED'));
    }
  }
});

test('version change before GET and after streamed body both invalidate capture', async () => {
  for (const moment of ['before', 'after']) {
    const f = captureFixture(); const start = await f.capture.handle(request(), 'account-admin@example.test');
    const records = await next(f, start);
    if (moment === 'before') for (const x of f.objects.values()) x.version = 'changed-version';
    else {
      const head = f.media.head;
      f.media.head = async (key) => { f.objects.get(key).version = 'changed-version'; return head(key); };
    }
    await assert.rejects(next(f, records), error('MEDIA_CHANGED'));
  }
});

test('short and oversized body lengths fail; terminal new orphan and metadata-only changes fail', async () => {
  for (const mismatch of [-1, 1]) {
    const f = captureFixture(); f.objects.delete('orphan/zero-byte-object');
    const start = await f.capture.handle(request(), 'account-admin@example.test');
    const records = await next(f, start);
    for (const x of f.objects.values()) x.bytes = new Uint8Array(Math.max(0, x.size + mismatch));
    await assert.rejects(next(f, records), error('MEDIA_LENGTH_MISMATCH'));
  }
  for (const drift of ['orphan', 'metadata']) {
    const f = captureFixture(); let page = await f.capture.handle(request(), 'account-admin@example.test');
    while (page.sequence < 4) page = await next(f, page);
    if (drift === 'orphan') f.add('unrelated/new-orphan-object');
    else f.objects.values().next().value.customMetadata.synthetic = 'metadata-only-change';
    await assert.rejects(next(f, page), error('MEDIA_INVENTORY_CHANGED'));
  }
});

test('object size, total record limits, unavailable stream hashing and cancellation cannot yield complete', async () => {
  const large = captureFixture(); large.objects.values().next().value.size = CONSERVATION_LIMITS.maxObjectBytes + 1;
  await assert.rejects(large.capture.handle(request(), 'account-admin@example.test'), error('OBJECT_BYTE_LIMIT'));
  const crowded = captureFixture(); crowded.setRows(new Array(CONSERVATION_LIMITS.maxRecords + 1));
  await assert.rejects(crowded.capture.handle(request(), 'account-admin@example.test'), error('RECORD_LIMIT'));
  const noStream = captureFixture({ makeDigestStream: () => { throw new Error('unavailable'); } });
  const start = await noStream.capture.handle(request(), 'account-admin@example.test');
  await assert.rejects(next(noStream, await next(noStream, start)), error('STREAM_DIGEST_UNAVAILABLE'));
  const aborted = captureFixture(); const controller = new AbortController(); controller.abort();
  await assert.rejects(aborted.capture.handle(request(undefined, { signal: controller.signal }), 'account-admin@example.test'), error('CAPTURE_CANCELLED'));
  assert.equal(aborted.reads(), 0);
});

test('SQL capture rejects unknown buckets/tables, generated columns, hidden KV, ambiguous JSON and oversized preflight before rows', async () => {
  let kvReads = 0;
  await assert.rejects(loadConservationRows({ get: async () => { kvReads++; return {}; } }), error('SQLITE_CAPTURE_REQUIRED'));
  assert.equal(kvReads, 0);
  const columns = ['bucket', 'record_key', 'value'].map((name, i) => ({ name, type: 'TEXT', notnull: 1, pk: [1, 2, 0][i], dflt_value: null, hidden: 0 }));
  function sqlFixture(change = {}) {
    const queries = [], kvOptions = [];
    const storage = { list: async (options) => { kvOptions.push(options); return change.kv || new Map(); }, sql: { exec(query) {
      queries.push(query);
      const result = query.includes('sqlite_schema') ? change.tables || [{ name: 'seller_records', type: 'table' }, { name: '_cf_KV', type: 'table' }]
        : query.includes('table_xinfo') ? change.columns || columns
          : query.includes('DISTINCT bucket') ? change.buckets || [{ bucket: 'profiles' }]
            : query.includes('COUNT(*)') ? change.total || [{ count: 1, bytes: 2 }]
              : change.rows || [{ bucket: 'profiles', record_key: 'synthetic', value: '{}' }];
      return { toArray: () => result };
    } } };
    return { storage, queries, kvOptions };
  }
  for (const tables of [undefined, [{ name: 'seller_records', type: 'table' }]]) {
    const nativeEmpty = sqlFixture({ tables });
    assert.deepEqual(await loadConservationRows(nativeEmpty.storage),
      [{ bucket: 'profiles', key: 'synthetic', value: {} }]);
    assert.deepEqual(nativeEmpty.kvOptions, [{ limit: 1 }]);
    assert.ok(!nativeEmpty.queries.some((query) => /(?:FROM|table_xinfo\()\s*_cf_KV/.test(query)));
  }
  for (const result of ['missing', 'throw', null, {}, []]) {
    const unavailable = sqlFixture();
    unavailable.storage.list = result === 'missing' ? undefined : async (options) => {
      unavailable.kvOptions.push(options);
      if (result === 'throw') throw new Error('NONSECRET_UNRETAINED_KV_ERROR');
      return result;
    };
    await assert.rejects(loadConservationRows(unavailable.storage), (failure) =>
      failure.code === 'KV_SCOPE_UNAVAILABLE' && failure.status === 503 &&
      !failure.message.includes('NONSECRET_UNRETAINED'));
    assert.deepEqual(unavailable.kvOptions, result === 'missing' ? [] : [{ limit: 1 }]);
    assert.ok(!unavailable.queries.some((query) => query.includes('DISTINCT bucket')));
  }
  for (const [name, type] of [['__cf_kv', 'table'], ['_cf_kv', 'table'], ['_CF_KV', 'table'],
    ['_cf_KV_extra', 'table'], ['_cf_OTHER', 'table'], ['_cf_KV', 'view'], ['__cf_kv', 'view']]) {
    const unknown = sqlFixture({ tables: [{ name: 'seller_records', type: 'table' }, { name, type }] });
    await assert.rejects(loadConservationRows(unknown.storage), error('UNKNOWN_PERSISTED_SCHEMA'));
    assert.equal(unknown.kvOptions.length, 0);
  }
  for (const [change, code] of [
    [{ buckets: [{ bucket: 'future_business' }] }, 'UNKNOWN_PERSISTED_BUCKET'],
    [{ tables: [{ name: 'seller_records', type: 'table' }, { name: 'sqliteExtra', type: 'table' }] }, 'UNKNOWN_PERSISTED_SCHEMA'],
    [{ tables: [{ name: 'seller_records', type: 'table' }, { name: 'sqliteExtra', type: 'view' }] }, 'UNKNOWN_PERSISTED_SCHEMA'],
    [{ columns: [...columns, { name: 'generated', hidden: 3 }] }, 'UNKNOWN_PERSISTED_SCHEMA'],
    [{ kv: new Map([['unknown-private-key', 'private-value']]) }, 'UNEXPECTED_KV_STATE'],
    [{ tables: [{ name: 'seller_records', type: 'table' }], kv: new Map([['unknown-private-key', 'private-value']]) }, 'UNEXPECTED_KV_STATE'],
    [{ rows: [{ bucket: 'profiles', record_key: 'synthetic', value: '{"same":1,"same":2}' }] }, 'INVALID_BUSINESS_ROW'],
    [{ total: [{ count: CONSERVATION_LIMITS.maxRecords + 1, bytes: 2 }] }, 'BUSINESS_BYTE_LIMIT'],
  ]) {
    const fixture = sqlFixture(change);
    await assert.rejects(loadConservationRows(fixture.storage), error(code));
    if (code === 'UNEXPECTED_KV_STATE') assert.deepEqual(fixture.kvOptions, [{ limit: 1 }]);
    assert.ok(fixture.queries.every((x) => /^(SELECT|PRAGMA)/.test(x)));
    if (change.total) assert.ok(!fixture.queries.some((x) => x.startsWith('SELECT bucket, record_key')));
  }
});

test('actual SellerStore interception requires separate account authority/origin and never loads/saves/audits on success or rejection', async () => {
  const data = Object.fromEntries(CONSERVATION_BUCKETS.map((x) => [x, {}]));
  for (const row of rows()) data[row.bucket][row.key] = row.value;
  data.version = 2; data.sessions = { 'private-auth-token': { userId: 'private-owner-id' } };
  const original = structuredClone(data); let reads = 0, saves = 0;
  const r2 = mediaFixture();
  const storage = { get: async () => { reads++; return structuredClone(data); }, put: async () => { saves++; throw new Error('unexpected write'); } };
  let identity = { actor: 'account-admin@example.test', scope: 'seller-accounts', expiresAt: Date.now() + 60000 };
  const env = { ACCOUNT_ADMIN_SITE_ORIGIN: origin, MEDIA: r2.media,
    ADMIN_AUTH: { fetch: async () => Response.json({ actor: 'listing-reviewer' }) },
    ACCOUNT_ADMIN_AUTH: { fetch: async (req) => req.headers.get('Authorization') === 'Bearer fixture-account-admin'
      ? Response.json(identity) : new Response(null, { status: 403 }) } };
  const store = new SellerStore({ storage }, env);
  store.loadState = () => { throw new Error('Capture must bypass normal loadState'); };
  store.saveState = () => { saves++; throw new Error('Capture must bypass saveState'); };
  store.audit = () => { throw new Error('Capture must not audit'); };
  store.conservationCapture = new ConservationCapture({ loadRows: () => loadConservationRows(storage, { allowMemoryFixture: true }), media: r2.media, makeDigestStream: nodeDigestStream });
  const call = (suffix = '', headers = {}, method = 'GET', urlOrigin = origin) => store.fetch(new Request(urlOrigin + endpoint + suffix,
    { method, headers: { Authorization: 'Bearer fixture-account-admin', ...headers } }));
  for (const token of ['', 'Bearer fixture-reviewer', 'Bearer fixture-seller'])
    assert.equal((await call('', { Authorization: token })).status, 403);
  assert.equal((await call('', { Origin: 'https://other.fixture.test' })).status, 403);
  assert.equal((await call('', {}, 'GET', 'https://other.fixture.test')).status, 403);
  assert.equal((await call('', {}, 'POST')).status, 405);
  assert.equal(reads, 0);
  for (const unsafe of [{ ...identity, scope: 'listing-review' }, { ...identity, actor: '' }, { ...identity, expiresAt: Date.now() - 1 }]) {
    const good = identity; identity = unsafe;
    assert.equal((await call()).status, 403); identity = good;
  }
  assert.equal(reads, 0);
  let response = await call(); assert.equal(response.status, 200);
  let page = await response.json();
  while (!page.complete) {
    // Changes to excluded auth bookkeeping are deliberate and visible in scope.
    data.sessions['private-auth-token'].expiresAt = Date.now();
    response = await call('?cursor=' + page.nextCursor); assert.equal(response.status, 200);
    page = await response.json();
  }
  assert.equal(saves, 0);
  for (const bucket of CONSERVATION_BUCKETS) assert.deepEqual(data[bucket], original[bucket]);
  data.future_business = { untouched: 'unknown-private-value' };
  assert.equal((await call()).status, 409);
  assert.equal(data.future_business.untouched, 'unknown-private-value');
  assert.equal(saves, 0);
  assert.ok(isConservationRequest(request()));
  assert.equal(isConservationRequest(new Request(origin + '/api/aircraft-sale/admin/accounts/_conservation/capture-extra')), false);
  assert.equal(await conservationRecordId('profiles', 'private-owner-id'), 'profiles:' + sha('seller-v2-record-key-v1\0profiles\0private-owner-id'));
  assert.equal(await conservationMediaId('private-key'), sha('seller-v2-media-key-v1\0private-key'));
});
