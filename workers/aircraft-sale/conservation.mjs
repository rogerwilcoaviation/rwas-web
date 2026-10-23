// Digest-only, nonpersistent conservation reads. No credentials or customer
// values are returned; no durable state or R2 mutation is performed here.
export const CONSERVATION_BUCKETS = Object.freeze([
  'profiles', 'identities', 'listings', 'drafts', 'files', 'idempotency',
]);
export const CONSERVATION_EXCLUDED_BUCKETS = Object.freeze([
  'identitySecurity', 'authTransactions', 'authEvents', 'auth0EventReceipts',
  'securityOperations', 'accountAdminOperations', 'accountRemovalOperations', 'sessions', 'codes',
  'mailRequests', 'mailSequences', 'rates', 'audit', 'outbox', 'supportTickets',
]);
export const CONSERVATION_LIMITS = Object.freeze({
  maxRecords: 10000,
  maxRecordBytes: 2 * 1024 * 1024,
  maxStateBytes: 32 * 1024 * 1024,
  recordPageSize: 100,
  maxMediaObjects: 10000,
  maxInventoryPages: 100,
  maxInventoryMetadataBytes: 8 * 1024 * 1024,
  maxObjectBytes: 512 * 1024 * 1024,
  maxInventoryBytes: 1024 * 1024 * 1024 * 1024,
  maxCaptures: 4,
  captureTtlMs: 10 * 60 * 1000,
  pageTimeoutMs: 20000,
});
export const CONSERVATION_SCHEMA = Object.freeze({
  schema: 1,
  algorithm: 'SHA-256',
  canonicalization: 'sorted-JSON-keys-UTF8-v1',
  record: 'canonical JSON {bucket,key,value}; every value field retained',
  recordId: 'bucket + colon + SHA256(seller-v2-record-key-v1 NUL bucket NUL key)',
  mediaId: 'SHA256(seller-v2-media-key-v1 NUL key)',
  mediaMetadata: 'R2 key/version/size/etag/uploaded/storageClass/httpMetadata/customMetadata plus GET checksums/ssecKeyMd5 and complete GET/HEAD range representations',
  includedBuckets: CONSERVATION_BUCKETS,
  excludedBuckets: CONSERVATION_EXCLUDED_BUCKETS,
  mediaScope: 'entire-MEDIA-binding; no prefix or listing/status filtering',
  durableLayout: 'seller_records(bucket TEXT,record_key TEXT,value TEXT); no other user tables or KV records',
  stability: 'per-page business root and version checks; final whole inventory recheck; not cross-store atomicity',
  limits: CONSERVATION_LIMITS,
});
const knownBuckets = new Set([
  ...CONSERVATION_BUCKETS, ...CONSERVATION_EXCLUDED_BUCKETS,
]);
const encoder = new TextEncoder();
const hex = (value) => Array.from(new Uint8Array(value),
  (x) => x.toString(16).padStart(2, '0')).join('');
const mediaMetadataReasons = new Set([
  'MEDIA_KEY', 'MEDIA_VERSION', 'MEDIA_ETAG', 'MEDIA_SIZE', 'MEDIA_UPLOADED',
  'MEDIA_STORAGE_CLASS', 'HTTP_METADATA_CONTAINER', 'HTTP_CACHE_EXPIRY',
  'HTTP_METADATA_VALUE', 'CUSTOM_METADATA_CONTAINER', 'CUSTOM_METADATA_VALUE',
]);
export class ConservationError extends Error {
  constructor(status, code, metadataReason) {
    super('Conservation capture unavailable. Start a fresh capture after resolving the reported condition.');
    this.status = status;
    this.code = code;
    if (code === 'INVALID_MEDIA_METADATA' && mediaMetadataReasons.has(metadataReason))
      this.metadataReason = metadataReason;
  }
}
const reject = (status, code, reason) => { throw new ConservationError(status, code, reason); };
export function canonicalConservationJson(value, depth = 0) {
  if (depth > 64) reject(409, 'UNSUPPORTED_BUSINESS_VALUE');
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0))
      reject(409, 'UNSUPPORTED_BUSINESS_VALUE');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (Object.getPrototypeOf(value) !== Array.prototype ||
        Object.getOwnPropertySymbols(value).length || keys.length !== value.length ||
        Object.getOwnPropertyNames(value).length !== value.length + 1 ||
        keys.some((key, i) => key !== String(i)) ||
        Object.values(Object.getOwnPropertyDescriptors(value)).some((x) => x.get || x.set))
      reject(409, 'UNSUPPORTED_BUSINESS_VALUE');
    return '[' + value.map((x) => canonicalConservationJson(x, depth + 1)).join(',') + ']';
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    if (Object.getOwnPropertySymbols(value).length ||
        Object.values(Object.getOwnPropertyDescriptors(value)).some((x) => x.get || x.set))
      reject(409, 'UNSUPPORTED_BUSINESS_VALUE');
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonicalConservationJson(value[key], depth + 1)).join(',') + '}';
  }
  reject(409, 'UNSUPPORTED_BUSINESS_VALUE');
}
export const conservationSha256 = async (value) => hex(await crypto.subtle.digest(
  'SHA-256', typeof value === 'string' ? encoder.encode(value) : value,
));
export const conservationRecordId = async (bucket, key) => bucket + ':' +
  await conservationSha256('seller-v2-record-key-v1\0' + bucket + '\0' + key);
export const conservationMediaId = (key) =>
  conservationSha256('seller-v2-media-key-v1\0' + key);
const wellFormed = (value) => {
  // TextEncoder replaces lone surrogates. Reject them in opaque-ID inputs so
  // distinct stored keys cannot become the same UTF-8 byte sequence.
  for (const character of value) {
    const point = character.codePointAt(0);
    if (point >= 0xd800 && point <= 0xdfff) return false;
  }
  return true;
};
const validKey = (key) => typeof key === 'string' && key.length > 0 &&
  encoder.encode(key).byteLength <= 1024 && !key.includes('\0') && wellFormed(key);

// Read known business rows directly. Never pass capture through loadState/saveState:
// loadState intentionally ignores unknown persisted namespaces in normal routing.
export async function loadConservationRows(storage, { allowMemoryFixture = false } = {}) {
  if (storage.sql) {
    const tables = storage.sql.exec(
      "SELECT name, type FROM sqlite_schema WHERE type IN ('table','view') AND substr(name,1,7) <> 'sqlite_'",
    ).toArray();
    if (!tables.some((x) => x.name === 'seller_records' && x.type === 'table') ||
        tables.some((x) => !['seller_records', '_cf_KV', '_cf_METADATA'].includes(x.name) || x.type !== 'table'))
      reject(409, 'UNKNOWN_PERSISTED_SCHEMA');
    const columns = storage.sql.exec('PRAGMA table_xinfo(seller_records)').toArray();
    const expected = [['bucket', 1], ['record_key', 2], ['value', 0]];
    if (columns.length !== expected.length || columns.some((x, i) =>
      x.name !== expected[i][0] || x.type !== 'TEXT' || x.notnull !== 1 ||
      x.pk !== expected[i][1] || x.dflt_value !== null || x.hidden !== 0))
      reject(409, 'UNKNOWN_PERSISTED_SCHEMA');
    // workerd reserves _cf_KV for the native KV interface. The documented
    // __cf_kv spelling is user-accessible in the reviewed runtime, not an alias.
    // Always prove native KV empty, even when its deferred table is absent.
    if (typeof storage.list !== 'function') reject(503, 'KV_SCOPE_UNAVAILABLE');
    let kv;
    try { kv = await storage.list({ limit: 1 }); }
    catch { reject(503, 'KV_SCOPE_UNAVAILABLE'); }
    if (!(kv instanceof Map)) reject(503, 'KV_SCOPE_UNAVAILABLE');
    if (kv.size) reject(409, 'UNEXPECTED_KV_STATE');
    const buckets = storage.sql.exec('SELECT DISTINCT bucket FROM seller_records').toArray();
    if (buckets.some((row) => !knownBuckets.has(row.bucket)))
      reject(409, 'UNKNOWN_PERSISTED_BUCKET');
    const total = storage.sql.exec(
      "SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(value AS BLOB))),0) AS bytes FROM seller_records WHERE bucket IN ('profiles','identities','listings','drafts','files','idempotency')",
    ).toArray();
    if (total.length !== 1 || !Number.isSafeInteger(total[0].count) || total[0].count < 0 ||
        !Number.isSafeInteger(total[0].bytes) || total[0].bytes < 0)
      reject(409, 'INVALID_BUSINESS_ROW');
    if (total[0].count > CONSERVATION_LIMITS.maxRecords || total[0].bytes > CONSERVATION_LIMITS.maxStateBytes)
      reject(413, 'BUSINESS_BYTE_LIMIT');
    const rows = storage.sql.exec(
      "SELECT bucket, record_key, value FROM seller_records WHERE bucket IN ('profiles','identities','listings','drafts','files','idempotency') ORDER BY bucket, record_key LIMIT 10001",
    ).toArray();
    if (rows.length > CONSERVATION_LIMITS.maxRecords) reject(413, 'RECORD_LIMIT');
    return rows.map((row) => {
      if (!CONSERVATION_BUCKETS.includes(row.bucket) || !validKey(row.record_key) ||
          typeof row.value !== 'string' || encoder.encode(row.value).byteLength > CONSERVATION_LIMITS.maxRecordBytes)
        reject(409, 'INVALID_BUSINESS_ROW');
      let value;
      try { value = JSON.parse(row.value); } catch { reject(409, 'INVALID_BUSINESS_ROW'); }
      // The existing writer uses JSON.stringify. This also rejects ambiguous
      // duplicate-field JSON instead of silently normalizing away a field.
      if (JSON.stringify(value) !== row.value) reject(409, 'INVALID_BUSINESS_ROW');
      return { bucket: row.bucket, key: row.record_key, value };
    });
  }
  if (!allowMemoryFixture) reject(503, 'SQLITE_CAPTURE_REQUIRED');
  const state = await storage.get('state'); // Explicit memory-only test seam.
  if (!state) return [];
  if (state.version !== 2 || Object.keys(state).some((x) => x !== 'version' && !knownBuckets.has(x)))
    reject(409, 'UNKNOWN_PERSISTED_BUCKET');
  const rows = [];
  for (const bucket of CONSERVATION_BUCKETS) {
    const values = state[bucket] || {};
    if (!values || Object.getPrototypeOf(values) !== Object.prototype)
      reject(409, 'INVALID_BUSINESS_ROW');
    for (const [key, value] of Object.entries(values)) rows.push({ bucket, key, value });
  }
  return rows;
}

function budget(signal, now) {
  const started = now();
  const check = () => {
    if (signal?.aborted) reject(499, 'CAPTURE_CANCELLED');
    if (now() - started > CONSERVATION_LIMITS.pageTimeoutMs)
      reject(504, 'PAGE_TIME_LIMIT');
  };
  return { check, async wait(operation) {
    check();
    const promise = typeof operation === 'function' ? operation() : operation;
    let timer;
    let abort;
    const cancelled = new Promise((_, fail) => {
      timer = setTimeout(() => fail(new ConservationError(504, 'PAGE_TIME_LIMIT')),
        Math.max(1, CONSERVATION_LIMITS.pageTimeoutMs - (now() - started)));
      abort = () => fail(new ConservationError(499, 'CAPTURE_CANCELLED'));
      signal?.addEventListener('abort', abort, { once: true });
    });
    try { const value = await Promise.race([promise, cancelled]); check(); return value; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  } };
}

async function businessSnapshot(rows, work) {
  if (!Array.isArray(rows) || rows.length > CONSERVATION_LIMITS.maxRecords)
    reject(413, 'RECORD_LIMIT');
  const records = [], seen = new Set(), references = new Set();
  const counts = Object.fromEntries(CONSERVATION_BUCKETS.map((x) => [x, 0]));
  let bytes = 0;
  for (const row of rows) {
    work.check();
    if (!CONSERVATION_BUCKETS.includes(row.bucket) || !validKey(row.key) ||
        !row.value || Object.getPrototypeOf(row.value) !== Object.prototype)
      reject(409, 'INVALID_BUSINESS_ROW');
    const key = row.bucket + '\0' + row.key;
    if (seen.has(key)) reject(409, 'DUPLICATE_BUSINESS_ROW');
    seen.add(key);
    const canonical = canonicalConservationJson(row);
    const length = encoder.encode(canonical).byteLength;
    bytes += length;
    if (length > CONSERVATION_LIMITS.maxRecordBytes || bytes > CONSERVATION_LIMITS.maxStateBytes)
      reject(413, 'BUSINESS_BYTE_LIMIT');
    if (row.bucket === 'files') {
      if (row.value.key !== row.key) reject(409, 'INVALID_FILE_REFERENCE');
      references.add(row.key); // Includes deleting records and deleted listings.
    }
    records.push({ bucket: row.bucket,
      objectId: await conservationRecordId(row.bucket, row.key),
      fullFieldsSha256: await conservationSha256(canonical), fullFieldsBytes: length });
    counts[row.bucket]++;
  }
  records.sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
  return { records, references, counts,
    root: await conservationSha256(canonicalConservationJson(records)) };
}

const httpFields = new Set(['contentType', 'contentLanguage', 'contentDisposition',
  'contentEncoding', 'cacheControl', 'cacheExpiry']);
function inventoryMetadata(object) {
  if (!object || !validKey(object.key))
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_KEY');
  if (typeof object.version !== 'string' || !object.version || object.version.length > 1024)
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_VERSION');
  if (typeof object.etag !== 'string' || !object.etag || object.etag.length > 1024)
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_ETAG');
  if (!Number.isSafeInteger(object.size) || object.size < 0)
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_SIZE');
  if (object.size > CONSERVATION_LIMITS.maxObjectBytes) reject(413, 'OBJECT_BYTE_LIMIT');
  if (!(object.uploaded instanceof Date) || !Number.isFinite(object.uploaded.getTime()))
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_UPLOADED');
  // Actual local workerd can report an empty native marker. Preserve that exact
  // value in the digest; it is not evidence of either documented storage class.
  if (object.storageClass !== undefined && !['', 'Standard', 'InfrequentAccess'].includes(object.storageClass))
    reject(409, 'INVALID_MEDIA_METADATA', 'MEDIA_STORAGE_CLASS');
  const httpMetadata = {};
  if (object.httpMetadata !== undefined &&
      (!object.httpMetadata || Object.getPrototypeOf(object.httpMetadata) !== Object.prototype))
    reject(409, 'INVALID_MEDIA_METADATA', 'HTTP_METADATA_CONTAINER');
  for (const [key, value] of Object.entries(object.httpMetadata || {})) {
    if (!httpFields.has(key)) reject(409, 'UNSUPPORTED_MEDIA_METADATA');
    // Native JSG structs can expose unset optional fields as enumerable undefined.
    // Normalize only known unset fields; every defined metadata value stays bound.
    if (value === undefined) continue;
    if (key === 'cacheExpiry') {
      if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
        reject(409, 'INVALID_MEDIA_METADATA', 'HTTP_CACHE_EXPIRY');
      httpMetadata[key] = value.toISOString();
    } else {
      if (typeof value !== 'string') reject(409, 'INVALID_MEDIA_METADATA', 'HTTP_METADATA_VALUE');
      httpMetadata[key] = value;
    }
  }
  const customMetadata = object.customMetadata || {};
  if (object.customMetadata !== undefined && !object.customMetadata)
    reject(409, 'INVALID_MEDIA_METADATA', 'CUSTOM_METADATA_CONTAINER');
  if (Object.getPrototypeOf(customMetadata) !== Object.prototype)
    reject(409, 'INVALID_MEDIA_METADATA', 'CUSTOM_METADATA_CONTAINER');
  if (Object.values(customMetadata).some((x) => typeof x !== 'string'))
    reject(409, 'INVALID_MEDIA_METADATA', 'CUSTOM_METADATA_VALUE');
  const metadata = { key: object.key, version: object.version, size: object.size,
    etag: object.etag, uploaded: object.uploaded.toISOString(),
    storageClass: object.storageClass ?? null, httpMetadata, customMetadata };
  if (encoder.encode(canonicalConservationJson(metadata)).byteLength > 32768)
    reject(413, 'MEDIA_METADATA_LIMIT');
  return metadata;
}

async function inventory(media, work) {
  if (!media || typeof media.list !== 'function' || typeof media.get !== 'function' ||
      typeof media.head !== 'function') reject(503, 'MEDIA_UNAVAILABLE');
  let cursor, pages = 0, bytes = 0, metadataBytes = 0;
  const entries = [], keys = new Set(), cursors = new Set();
  do {
    if (++pages > CONSERVATION_LIMITS.maxInventoryPages) reject(413, 'INVENTORY_PAGE_LIMIT');
    const page = await work.wait(() => media.list({ limit: 1000, cursor,
      include: ['httpMetadata', 'customMetadata'] }));
    if (!page || !Array.isArray(page.objects) || page.objects.length > 1000 ||
        typeof page.truncated !== 'boolean' ||
        (page.delimitedPrefixes && page.delimitedPrefixes.length))
      reject(409, 'INVALID_INVENTORY_PAGE');
    for (const object of page.objects) {
      work.check();
      const metadata = inventoryMetadata(object);
      if (keys.has(metadata.key)) reject(409, 'DUPLICATE_MEDIA_KEY');
      keys.add(metadata.key);
      bytes += metadata.size;
      metadataBytes += encoder.encode(canonicalConservationJson(metadata)).byteLength;
      if (entries.length >= CONSERVATION_LIMITS.maxMediaObjects ||
          !Number.isSafeInteger(bytes) || bytes > CONSERVATION_LIMITS.maxInventoryBytes ||
          metadataBytes > CONSERVATION_LIMITS.maxInventoryMetadataBytes)
        reject(413, 'INVENTORY_LIMIT');
      entries.push({ key: metadata.key, metadata,
        objectKey: await conservationMediaId(metadata.key),
        inventoryMetadataSha256: await conservationSha256(canonicalConservationJson(metadata)) });
    }
    if (!page.truncated) break;
    if (typeof page.cursor !== 'string' || !page.cursor || page.cursor.length > 8192 ||
        cursors.has(page.cursor)) reject(409, 'INVALID_INVENTORY_CURSOR');
    cursors.add(page.cursor);
    cursor = page.cursor;
  } while (true);
  entries.sort((a, b) => a.objectKey < b.objectKey ? -1 : a.objectKey > b.objectKey ? 1 : 0);
  const root = await conservationSha256(canonicalConservationJson(entries.map((x) =>
    ({ objectKey: x.objectKey, inventoryMetadataSha256: x.inventoryMetadataSha256 }))));
  return { entries, keys, bytes, root };
}

function checksumMetadata(object) {
  const checksums = {};
  for (const name of ['md5', 'sha1', 'sha256', 'sha384', 'sha512']) {
    const value = object.checksums?.[name];
    if (value === undefined) continue;
    if (!(value instanceof ArrayBuffer) ||
        value.byteLength !== ({ md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64 })[name])
      reject(409, 'INVALID_MEDIA_CHECKSUM');
    checksums[name] = hex(value);
  }
  if (object.ssecKeyMd5 !== undefined &&
      (typeof object.ssecKeyMd5 !== 'string' || !/^[a-fA-F0-9]{32}$/.test(object.ssecKeyMd5)))
    reject(409, 'INVALID_MEDIA_CHECKSUM');
  return { checksums, ssecKeyMd5: object.ssecKeyMd5 ?? null };
}

function completeMediaRange(object) {
  if (object.range === undefined) return null;
  const range = object.range;
  if (!range || Object.getPrototypeOf(range) !== Object.prototype ||
      Object.getOwnPropertySymbols(range).length)
    reject(409, 'MEDIA_CHANGED');
  const keys = Object.keys(range).sort().join(',');
  if (Object.getOwnPropertyNames(range).length !== Object.keys(range).length ||
      !['length,offset', 'length,offset,suffix'].includes(keys) ||
      Object.values(Object.getOwnPropertyDescriptors(range)).some((x) => x.get || x.set) ||
      (Object.hasOwn(range, 'suffix') && range.suffix !== undefined) ||
      !Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.length) ||
      range.offset !== 0 || range.length !== object.size)
    reject(409, 'MEDIA_CHANGED');
  return { offset: range.offset, length: range.length };
}

async function hashMedia(media, entry, work, makeDigestStream) {
  const object = await work.wait(() => media.get(entry.key,
    { onlyIf: { etagMatches: entry.metadata.etag } }));
  let reader, writer;
  let bytes = 0;
  try {
    if (!object || !object.body ||
        await conservationSha256(canonicalConservationJson(inventoryMetadata(object))) !==
          entry.inventoryMetadataSha256)
      reject(409, 'MEDIA_CHANGED');
    const bodyRange = completeMediaRange(object);
    const extraMetadata = checksumMetadata(object);
    let digestStream;
    try { digestStream = makeDigestStream(); } catch { reject(503, 'STREAM_DIGEST_UNAVAILABLE'); }
    if (!digestStream || !digestStream.digest || typeof digestStream.getWriter !== 'function')
      reject(503, 'STREAM_DIGEST_UNAVAILABLE');
    // Workers' DigestStream does not retain byte contents. No arrayBuffer download
    // or customer-byte buffering; count each chunk against the pinned length.
    reader = object.body.getReader();
    writer = digestStream.getWriter();
    // Always observe digest rejection, including when a stream is aborted.
    const digest = Promise.resolve(digestStream.digest);
    digest.catch(() => {});
    while (true) {
      const { done, value } = await work.wait(() => reader.read());
      if (done) break;
      if (!(value instanceof Uint8Array)) reject(409, 'INVALID_MEDIA_BODY');
      bytes += value.byteLength;
      if (bytes > entry.metadata.size || bytes > CONSERVATION_LIMITS.maxObjectBytes)
        reject(409, 'MEDIA_LENGTH_MISMATCH');
      await work.wait(() => writer.write(value));
    }
    if (bytes !== entry.metadata.size) reject(409, 'MEDIA_LENGTH_MISMATCH');
    await work.wait(() => writer.close());
    const bytesSha256 = hex(await work.wait(digest));
    if (!/^[a-f0-9]{64}$/.test(bytesSha256)) reject(503, 'STREAM_DIGEST_UNAVAILABLE');
    const current = await work.wait(() => media.head(entry.key));
    if (!current || await conservationSha256(canonicalConservationJson(inventoryMetadata(current))) !==
        entry.inventoryMetadataSha256 ||
        canonicalConservationJson(checksumMetadata(current)) !== canonicalConservationJson(extraMetadata))
      reject(409, 'MEDIA_CHANGED');
    const headRange = completeMediaRange(current);
    return { objectKey: entry.objectKey, bytesSha256, bytes,
      inventoryMetadataSha256: entry.inventoryMetadataSha256,
      metadataSha256: await conservationSha256(canonicalConservationJson({ ...entry.metadata,
        ...extraMetadata, bodyRange, headRange })) };
  } catch (error) {
    if (reader) reader.cancel().catch(() => {});
    else if (typeof object?.body?.cancel === 'function') object.body.cancel().catch(() => {});
    if (writer) writer.abort().catch(() => {});
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
  }
}

export function isConservationRequest(request) {
  const path = new URL(request.url).pathname;
  return path === '/admin/accounts/_conservation/capture' ||
    path === '/api/aircraft-sale/admin/accounts/_conservation/capture';
}

export class ConservationCapture {
  constructor({ loadRows, media, now = Date.now,
    makeDigestStream = () => new crypto.DigestStream('SHA-256') }) {
    this.loadRows = loadRows;
    this.media = media;
    this.now = now;
    this.makeDigestStream = makeDigestStream;
    this.cursors = new Map();
  }
  async handle(request, actor) {
    // SellerStore reauthorizes Staff on EVERY request before reaching this code.
    const url = new URL(request.url);
    if (request.method !== 'GET') reject(405, 'READ_ONLY_METHOD');
    if (url.protocol !== 'https:' ||
        (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) ||
        (request.headers.has('Sec-Fetch-Site') &&
          !['none', 'same-origin'].includes(request.headers.get('Sec-Fetch-Site'))))
      reject(403, 'ORIGIN_REJECTED');
    if (typeof actor !== 'string' || !actor.trim() || actor.length > 500 || !wellFormed(actor))
      reject(403, 'STAFF_ACTOR_REQUIRED');
    if (Array.from(url.searchParams.keys()).some((x) => x !== 'cursor') ||
        url.searchParams.getAll('cursor').length > 1)
      reject(400, 'INVALID_CAPTURE_REQUEST');
    const cursor = url.searchParams.get('cursor');
    if (cursor !== null && !/^[a-f0-9-]{36}$/.test(cursor))
      reject(400, 'INVALID_CAPTURE_CURSOR');
    const work = budget(request.signal, this.now);
    for (const [key, capture] of this.cursors)
      if (capture.expiresAt <= this.now()) this.cursors.delete(key);
    const actorSha256 = await conservationSha256('seller-conservation-actor-v1\0' + actor);
    let capture;
    try {
      if (cursor === null) {
        if (this.cursors.size >= CONSERVATION_LIMITS.maxCaptures)
          reject(429, 'CAPTURE_CAPACITY');
        const state = await businessSnapshot(await work.wait(() => this.loadRows()), work);
        const objects = await inventory(this.media, work);
        if (Array.from(state.references).some((x) => !objects.keys.has(x)))
          reject(409, 'REFERENCED_MEDIA_MISSING');
        capture = { captureId: crypto.randomUUID(), actorSha256,
          expiresAt: this.now() + CONSERVATION_LIMITS.captureTtlMs,
          state, objects, recordOffset: 0, mediaOffset: 0, sequence: 0 };
      } else {
        capture = this.cursors.get(cursor);
        if (!capture || capture.actorSha256 !== actorSha256)
          reject(410, 'CAPTURE_CURSOR_UNAVAILABLE');
        this.cursors.delete(cursor); // Single-use; uncertain delivery starts over.
        const state = await businessSnapshot(await work.wait(() => this.loadRows()), work);
        if (state.root !== capture.state.root) reject(409, 'BUSINESS_STATE_CHANGED');
        capture.sequence++;
      }
      let phase = 'start', records = [], media = [], complete = false;
      if (cursor !== null) {
        if (capture.recordOffset < capture.state.records.length) {
          phase = 'records';
          records = capture.state.records.slice(capture.recordOffset,
            capture.recordOffset + CONSERVATION_LIMITS.recordPageSize);
          capture.recordOffset += records.length;
        } else if (capture.mediaOffset < capture.objects.entries.length) {
          phase = 'media';
          media = [await hashMedia(this.media, capture.objects.entries[capture.mediaOffset],
            work, this.makeDigestStream)];
          capture.mediaOffset++;
        } else {
          phase = 'complete';
          const objects = await inventory(this.media, work);
          if (objects.root !== capture.objects.root) reject(409, 'MEDIA_INVENTORY_CHANGED');
          complete = true;
        }
      }
      const schemaSha256 = await conservationSha256(canonicalConservationJson(CONSERVATION_SCHEMA));
      const endpointAlgorithmSha256 = await conservationSha256('seller-conservation-algorithm-v1\0' +
        canonicalConservationJson(CONSERVATION_SCHEMA));
      work.check();
      const nextCursor = complete ? null : crypto.randomUUID();
      if (nextCursor) this.cursors.set(nextCursor, capture);
      return { schema: 1, type: 'RWAS_SELLER_CONSERVATION_PAGE',
        captureId: capture.captureId,
        schemaSha256,
        endpointAlgorithmSha256,
        scope: { store: 'seller-v2', includedBuckets: CONSERVATION_BUCKETS,
          excludedBuckets: CONSERVATION_EXCLUDED_BUCKETS,
          media: 'entire-MEDIA-binding', atomicAcrossStores: false },
        stateRootSha256: capture.state.root, inventoryRootSha256: capture.objects.root,
        recordCounts: capture.state.counts, recordCount: capture.state.records.length,
        mediaCount: capture.objects.entries.length, mediaBytes: capture.objects.bytes,
        sequence: capture.sequence, phase, records, media, nextCursor, complete,
        observedAt: new Date(this.now()).toISOString() };
    } catch (error) {
      // No failed, cancelled, stale or partially read page can continue capture.
      if (cursor && capture?.actorSha256 === actorSha256) this.cursors.delete(cursor);
      if (error instanceof ConservationError) throw error;
      reject(503, 'CAPTURE_READ_FAILED');
    }
  }
}
