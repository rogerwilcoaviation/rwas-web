import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { request as httpRequest } from 'node:http';

// Reuse the installed Wrangler runtime without reading Wrangler configuration,
// invoking its CLI, or introducing a dependency on the older top-level runtime.
const wranglerRequire = createRequire(
  new URL('../../node_modules/wrangler/package.json', import.meta.url),
);
const { Miniflare, INTROSPECT_SQLITE_METHOD } = await import(
  wranglerRequire.resolve('miniflare')
);
const origin = 'http://127.0.0.1';
const reviewer = 'synthetic-native-media-reviewer';

test('native SQLite/R2 preserves private ranges, review fences and exact-prefix media cleanup across restarts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rwas-native-media-lifecycle-'));
  const mail = [];
  const outbound = [];
  let mf;
  let bucket;
  try {
    const [pdf, video, photo] = await Promise.all(
      ['synthetic.pdf', 'synthetic.mp4', 'synthetic.png'].map(
        async (name) =>
          new Uint8Array(
            await readFile(
              new URL('./media-fixtures/' + name, import.meta.url),
            ),
          ),
      ),
    );
    const script = (
      await build({
        // The product class predates RPC. A local-only DurableObject delegate
        // enables Miniflare's built-in SQLite introspection on the same native
        // storage; all business fetch/alarm work stays in the real SellerStore.
        stdin: {
          contents: `
            import { DurableObject } from 'cloudflare:workers';
            import worker, { SellerStore } from ${JSON.stringify(new URL('../../workers/aircraft-sale/worker.mjs', import.meta.url).pathname)};
            export class NativeMediaStore extends DurableObject {
              constructor(ctx, env) { super(ctx, env); this.store = new SellerStore(ctx, env); }
              fetch(request) { return this.store.fetch(request); }
              alarm() { return this.store.alarm(); }
            }
            export default worker;
          `,
          sourcefile: 'native-media-introspection-fixture.mjs',
          resolveDir: new URL('../../', import.meta.url).pathname,
        },
        external: ['cloudflare:workers'],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
      })
    ).outputFiles[0].text;
    const options = {
      modules: true,
      script,
      host: '127.0.0.1',
      port: 0,
      // Local-only Miniflare introspection; the product Worker is unchanged.
      unsafeLocalExplorer: true,
      compatibilityDate: '2026-09-01',
      durableObjects: {
        SELLER_STORE: { className: 'NativeMediaStore', useSQLite: true },
      },
      durableObjectsPersist: join(root, 'durable'),
      r2Buckets: ['MEDIA'],
      r2Persist: join(root, 'r2'),
      bindings: {
        EMAIL_CODE_LOGIN_ENABLED: 'true',
        PUBLIC_LISTINGS_ENABLED: 'true',
      },
      outboundService: async (request) => {
        const url = new URL(request.url);
        outbound.push(url.origin + url.pathname);
        throw new Error('Native media fixture prohibits external requests.');
      },
      serviceBindings: {
        MAILER: async (request) => {
          const message = await request.json();
          assert.match(message.to, /^[^@]+@example\.test$/);
          mail.push(message);
          return Response.json({ ok: true });
        },
        ADMIN_AUTH: async (request) =>
          request.headers.get('Authorization') === 'Bearer ' + reviewer
            ? Response.json({ actor: 'reviewer@example.test' })
            : new Response(null, { status: 403 }),
      },
    };
    const start = async () => {
      mf = new Miniflare(options);
      bucket = await mf.getR2Bucket('MEDIA');
    };
    const restart = async () => {
      await mf.dispose();
      mf = undefined;
      await start();
    };
    const call = async (path, method = 'GET', body, token, extra = {}) => {
      const raw = body instanceof Uint8Array;
      const payload =
        body === undefined
          ? undefined
          : raw
            ? Buffer.from(body)
            : Buffer.from(JSON.stringify(body));
      // A one-shot native HTTP request has a fresh socket and bounded body.
      // Transport errors fail this call; the fixture never retries a POST.
      const runtimeUrl = new URL('/api/aircraft-sale' + path, await mf.ready);
      return new Promise((resolve, reject) => {
        const request = httpRequest(
          runtimeUrl,
          {
            method,
            agent: false,
            headers: {
              Host: new URL(origin).host,
              ...(method !== 'GET' ? { Origin: origin } : {}),
              ...(token ? { Authorization: 'Bearer ' + token } : {}),
              ...(body !== undefined && !raw
                ? { 'Content-Type': 'application/json' }
                : {}),
              ...extra,
              ...(payload !== undefined
                ? { 'Content-Length': String(payload.byteLength) }
                : {}),
            },
          },
          (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.once('error', reject);
            response.once('end', () => {
              const headers = new Headers();
              for (let i = 0; i < response.rawHeaders.length; i += 2)
                headers.append(
                  response.rawHeaders[i],
                  response.rawHeaders[i + 1],
                );
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: response.statusCode,
                  headers,
                }),
              );
            });
          },
        );
        request.once('error', reject);
        request.end(payload);
      });
    };
    const checkedJson = async (response, status = 200) => {
      assert.equal(response.status, status);
      return response.json();
    };
    const login = async (email) => {
      await checkedJson(await call('/send-code', 'POST', { email }));
      assert.equal(mail.at(-1).to, email);
      const result = await checkedJson(
        await call('/check-code', 'POST', { email, code: mail.at(-1).code }),
      );
      assert.equal(typeof result.session, 'string');
      assert.ok(result.session);
      return result.session;
    };
    const fields = {
      make: 'Synthetic',
      model: 'Native Media Fixture',
      year: 2000,
      price: 1,
      nNumber: 'N123AB',
    };
    const create = async (token, idempotencyKey) =>
      (
        await checkedJson(
          await call('/listings', 'POST', fields, token, {
            'Idempotency-Key': idempotencyKey,
          }),
          201,
        )
      ).listing;
    const uploadOperations = new Map();
    const upload = async (listing, token, category, filename, bytes, type) => {
      const operation = {
        path:
          '/upload?' +
          new URLSearchParams({ listingId: listing.id, category, filename }),
        bytes: new Uint8Array(bytes),
        headers: {
          'Content-Type': type,
          'Idempotency-Key':
            'rwas-upload-v1.' + Date.now() + '.' + crypto.randomUUID(),
        },
      };
      const file = (
        await checkedJson(
          await call(operation.path, 'POST', bytes, token, operation.headers),
        )
      ).file;
      uploadOperations.set(file.key, operation);
      return file;
    };
    const repeatUpload = (file, token, changedBytes) => {
      const operation = uploadOperations.get(file.key);
      assert.ok(
        operation,
        'Only a recorded deliberate upload can be repeated.',
      );
      return call(
        operation.path,
        'POST',
        changedBytes ?? operation.bytes,
        token,
        operation.headers,
      );
    };
    const keys = async () =>
      (await bucket.list()).objects.map(({ key }) => key).sort();
    const nativeSql = async (sql, params = []) => {
      const namespace = await mf.getDurableObjectNamespace('SELLER_STORE');
      const stub = namespace.get(namespace.idFromName('seller-v2'));
      const [result] = await stub[INTROSPECT_SQLITE_METHOD]([{ sql, params }]);
      return result;
    };
    const protectedRows = async () => {
      const result = await nativeSql(
        "SELECT bucket, record_key, value FROM seller_records WHERE bucket IN ('profiles','sessions','identities','drafts','idempotency','files','listings') ORDER BY bucket, record_key",
      );
      assert.deepEqual(result.columns, ['bucket', 'record_key', 'value']);
      assert.equal(result.meta.rows_written, 0);
      return result.rows.map(([bucket, key, value]) => ({
        bucket,
        key,
        value: JSON.parse(value),
      }));
    };
    const receiptRows = (rows, ownerId) =>
      rows.filter(
        (row) =>
          row.bucket === 'idempotency' &&
          row.value.kind === 'upload-v1' &&
          row.value.ownerId === ownerId,
      );
    const status = async (listing, token, next) =>
      (
        await checkedJson(
          await call(
            '/listing/' + listing.id + '/status',
            'POST',
            { status: next },
            token,
          ),
        )
      ).listing;
    const owned = async (listing, token) => {
      const result = await checkedJson(
        await call('/my-listings', 'GET', undefined, token),
      );
      const found = result.listings.find(({ id }) => id === listing.id);
      assert.ok(found);
      return found;
    };
    const review = (listing, token = reviewer) =>
      call(
        '/admin/review',
        'POST',
        {
          listingId: listing.id,
          revision: listing.revision,
          decision: 'approve',
        },
        token,
      );
    const filePath = ({ key }) => '/files/' + encodeURIComponent(key);
    const publicHidden = async (listing) => {
      const browse = await checkedJson(await call('/browse'));
      assert.ok(!browse.listings.some(({ id }) => id === listing.id));
      assert.equal(
        (
          await call('/listing/' + listing.id, 'GET', undefined, undefined, {
            Accept: 'text/html',
          })
        ).status,
        404,
      );
    };
    const assertPrivatePdf = async (file, owner, foreign) => {
      const path = filePath(file);
      const headers = { Range: 'bytes=0-7' };
      assert.equal(
        (await call(path, 'GET', undefined, undefined, headers)).status,
        401,
      );
      assert.equal(
        (await call(path, 'GET', undefined, foreign, headers)).status,
        404,
      );
      const full = await call(path, 'GET', undefined, owner);
      assert.equal(full.status, 200);
      assert.deepEqual(new Uint8Array(await full.arrayBuffer()), pdf);
      const part = await call(path, 'GET', undefined, owner, headers);
      assert.equal(part.status, 206);
      assert.equal(
        part.headers.get('Content-Range'),
        'bytes 0-7/' + pdf.length,
      );
      assert.equal(part.headers.get('Content-Length'), '8');
      assert.equal(part.headers.get('Cache-Control'), 'no-store');
      assert.match(part.headers.get('Content-Disposition'), /^attachment;/);
      assert.deepEqual(
        new Uint8Array(await part.arrayBuffer()),
        pdf.slice(0, 8),
      );
    };

    await start();
    const owner = await login('native-owner@example.test');
    const foreign = await login('native-foreign@example.test');
    const listing = await create(owner, 'native-owner-listing');
    const foreignListing = await create(foreign, 'native-foreign-listing');
    const privatePdf = await upload(
      listing,
      owner,
      'airframe',
      'private-native-log.pdf',
      pdf,
      'application/pdf',
    );
    const publicVideo = await upload(
      listing,
      owner,
      'videos',
      'native-clip.mp4',
      video,
      'video/mp4',
    );
    const publicPhoto = await upload(
      listing,
      owner,
      'photos',
      'native-photo.png',
      photo,
      'image/png',
    );
    const foreignPdf = await upload(
      foreignListing,
      foreign,
      'airframe',
      'foreign-native-log.pdf',
      pdf,
      'application/pdf',
    );
    const ownerId = publicPhoto.ownerId;
    const foreignId = foreignPdf.ownerId;
    assert.match(ownerId, /^[0-9a-f-]{36}$/i);
    assert.notEqual(ownerId, foreignId);
    const uploadedRows = await protectedRows();
    const ownUploadedReceipts = receiptRows(uploadedRows, ownerId);
    const foreignUploadedReceipts = receiptRows(uploadedRows, foreignId);
    assert.equal(ownUploadedReceipts.length, 3);
    assert.equal(foreignUploadedReceipts.length, 1);
    for (const row of [...ownUploadedReceipts, ...foreignUploadedReceipts])
      assert.equal(row.value.status, 'complete');
    const originalUploadKeys = await keys();
    const originalOwnedListing = await owned(listing, owner);
    assert.equal(originalUploadKeys.length, 4);
    assert.deepEqual(
      (await checkedJson(await repeatUpload(publicPhoto, owner))).file,
      publicPhoto,
    );
    const concurrentReplays = await Promise.all([
      repeatUpload(publicPhoto, owner),
      repeatUpload(publicPhoto, owner),
      repeatUpload(publicPhoto, owner),
    ]);
    for (const response of concurrentReplays)
      assert.deepEqual((await checkedJson(response)).file, publicPhoto);
    assert.deepEqual(await keys(), originalUploadKeys);
    assert.deepEqual(await owned(listing, owner), originalOwnedListing);
    // A valid 1x1 PNG with a CRC-valid ancillary tEXt chunk before IEND.
    // An operation ID binds bytes as well as owner/listing/category/name.
    const changedPhoto = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAldEVYdGZpeHR1cmUAZGlzdGluY3QgdmFsaWQgdXBsb2FkIHBheWxvYWQ3v0PDAAAAAElFTkSuQmCC',
        'base64',
      ),
    );
    assert.notDeepEqual(changedPhoto, photo);
    assert.equal(
      (await repeatUpload(publicPhoto, owner, changedPhoto)).status,
      409,
    );
    const foreignReplay = await repeatUpload(publicPhoto, foreign);
    assert.equal(foreignReplay.status, 404);
    assert.ok(!(await foreignReplay.text()).includes(publicPhoto.key));
    const anonymousReplay = await repeatUpload(publicPhoto);
    assert.equal(anonymousReplay.status, 401);
    assert.ok(!(await anonymousReplay.text()).includes(publicPhoto.key));
    assert.deepEqual(await keys(), originalUploadKeys);
    assert.deepEqual(await owned(listing, owner), originalOwnedListing);
    const prefix = 'listings/' + listing.id + '/';
    const orphan = prefix + 'synthetic-orphan.bin';
    const neighbors = [
      [
        'listings/' + listing.id + '-neighbor/synthetic-retained.bin',
        new Uint8Array([1, 2, 3]),
      ],
      ['unrelated/synthetic-retained.bin', new Uint8Array([4, 5, 6])],
    ];
    await bucket.put(orphan, new Uint8Array([7, 8, 9]));
    for (const [key, bytes] of neighbors) await bucket.put(key, bytes);
    const before = await keys();
    assert.equal(before.filter((key) => key.startsWith(prefix)).length, 4);
    for (const file of [privatePdf, publicVideo, publicPhoto, foreignPdf])
      assert.ok(before.includes(file.key));

    await assertPrivatePdf(privatePdf, owner, foreign);
    const pending = await status(listing, owner, 'pending');
    assert.equal((await review(pending, owner)).status, 403);
    const approved = (await checkedJson(await review(pending))).listing;
    assert.equal(approved.status, 'active');
    const browse = await checkedJson(await call('/browse'));
    assert.ok(browse.listings.some(({ id }) => id === listing.id));
    assert.ok(!JSON.stringify(browse).includes(privatePdf.key));
    assert.ok(!JSON.stringify(browse).includes(privatePdf.name));
    await assertPrivatePdf(privatePdf, owner, foreign);
    const partialVideo = await call(
      filePath(publicVideo),
      'GET',
      undefined,
      undefined,
      { Range: 'bytes=4-11' },
    );
    assert.equal(partialVideo.status, 206);
    assert.equal(
      partialVideo.headers.get('Content-Range'),
      'bytes 4-11/' + video.length,
    );
    assert.equal(partialVideo.headers.get('Content-Length'), '8');
    assert.deepEqual(
      new Uint8Array(await partialVideo.arrayBuffer()),
      video.slice(4, 12),
    );
    assert.equal(
      (
        await call(filePath(publicVideo), 'GET', undefined, undefined, {
          Range: 'bytes=' + video.length + '-',
        })
      ).status,
      416,
    );
    const approvedRevision = approved.revision;
    const edited = (
      await checkedJson(
        await call(
          '/listings/' + listing.id,
          'PUT',
          { model: 'Edited Native Media' },
          owner,
        ),
      )
    ).listing;
    assert.equal(edited.status, 'draft');
    assert.ok(edited.revision > approvedRevision);
    await publicHidden(listing);
    assert.equal((await call(filePath(publicVideo))).status, 401);
    assert.deepEqual(await keys(), before);

    await restart();
    const persisted = await owned(listing, owner);
    assert.equal(persisted.model, 'Edited Native Media');
    assert.equal(persisted.revision, edited.revision);
    assert.equal(persisted.status, 'draft');
    assert.deepEqual(await keys(), before);
    assert.deepEqual(
      (await checkedJson(await repeatUpload(publicPhoto, owner))).file,
      publicPhoto,
    );
    assert.deepEqual(await owned(listing, owner), persisted);
    assert.deepEqual(await keys(), before);
    await assertPrivatePdf(privatePdf, owner, foreign);
    await status(listing, owner, 'pending');
    assert.equal((await review(approved)).status, 409);
    await publicHidden(listing);
    assert.equal(
      (await checkedJson(await review(persisted))).listing.status,
      'active',
    );

    assert.equal((await status(listing, owner, 'archived')).status, 'archived');
    await publicHidden(listing);
    assert.equal((await call(filePath(publicVideo))).status, 401);
    assert.deepEqual(await keys(), before);
    assert.equal((await status(listing, owner, 'restore')).status, 'draft');
    await publicHidden(listing);
    assert.equal(
      (
        await call(
          '/listings/' + listing.id,
          'DELETE',
          { confirm: listing.id },
          owner,
        )
      ).status,
      409,
    );
    assert.equal((await status(listing, owner, 'deleted')).status, 'deleted');
    assert.equal(
      (await call(filePath(privatePdf), 'GET', undefined, owner)).status,
      404,
    );
    assert.deepEqual(await keys(), before);
    assert.equal((await status(listing, owner, 'restore')).status, 'draft');
    await assertPrivatePdf(privatePdf, owner, foreign);
    assert.deepEqual(await keys(), before);
    await status(listing, owner, 'deleted');
    assert.equal(
      (
        await call(
          '/listings/' + listing.id,
          'DELETE',
          { confirm: listing.id },
          foreign,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          '/listings/' + listing.id,
          'DELETE',
          { confirm: 'wrong-listing' },
          owner,
        )
      ).status,
      409,
    );
    assert.deepEqual(await keys(), before);
    await checkedJson(
      await call(
        '/listings/' + listing.id,
        'DELETE',
        { confirm: listing.id },
        owner,
      ),
    );
    const retained = before.filter((key) => !key.startsWith(prefix));
    assert.deepEqual(await keys(), retained);

    await restart();
    assert.deepEqual(await keys(), retained);
    assert.equal(
      (await call('/listing/' + listing.id, 'GET', undefined, owner)).status,
      404,
    );
    assert.equal((await repeatUpload(publicPhoto, owner)).status, 404);
    assert.deepEqual(await keys(), retained);
    for (const file of [privatePdf, publicVideo, publicPhoto])
      assert.equal(
        (await call(filePath(file), 'GET', undefined, owner)).status,
        404,
      );
    assert.equal((await bucket.list({ prefix })).objects.length, 0);
    assert.equal(await bucket.get(orphan), null);
    for (const [key, bytes] of neighbors) {
      const object = await bucket.get(key);
      assert.ok(object);
      assert.deepEqual(new Uint8Array(await object.arrayBuffer()), bytes);
    }
    await assertPrivatePdf(foreignPdf, foreign, owner);
    assert.equal((await owned(foreignListing, foreign)).status, 'draft');
    assert.equal(
      (
        await call('/listings', 'POST', fields, owner, {
          'Idempotency-Key': 'native-owner-listing',
        })
      ).status,
      410,
    );
    // Listing purge keeps replay fences while the owner can still act.
    const afterPurgeRows = await protectedRows();
    assert.deepEqual(receiptRows(afterPurgeRows, ownerId), ownUploadedReceipts);
    assert.deepEqual(
      receiptRows(afterPurgeRows, foreignId),
      foreignUploadedReceipts,
    );
    const currentAccount = await checkedJson(
      await call('/account', 'GET', undefined, owner),
    );
    assert.equal(currentAccount.profile.id, ownerId);
    assert.equal(currentAccount.profile.email, 'native-owner@example.test');
    assert.ok(currentAccount.sessions.length > 0);
    // Email-code login has no provider identity. Seed a clearly synthetic
    // linked identity so native deletion must exercise that row family too.
    const fixtureIdentityKey = 'fixture-native-linked-identity';
    await nativeSql(
      'INSERT INTO seller_records(bucket,record_key,value) VALUES (?,?,?)',
      [
        'identities',
        fixtureIdentityKey,
        JSON.stringify({
          userId: ownerId,
          issuer: 'https://native-identity.example.test/',
          subject: 'fixture-native-owner',
          method: 'google',
        }),
      ],
    );
    const beforeAccountDelete = await protectedRows();
    assert.ok(
      beforeAccountDelete.some(
        (row) => row.bucket === 'identities' && row.value.userId === ownerId,
      ),
    );
    const otherIdempotencyRows = beforeAccountDelete.filter(
      (row) =>
        row.bucket === 'idempotency' &&
        !(row.value.kind === 'upload-v1' && row.value.ownerId === ownerId),
    );
    // Abort inside the real SQLite transaction after deleting an own upload
    // receipt. Every protected row must roll back, including profile/session/
    // identity deletion; the test removes this local-only trigger afterward.
    await nativeSql(
      `CREATE TRIGGER fixture_abort_account_delete AFTER DELETE ON seller_records WHEN OLD.bucket='idempotency' AND json_extract(OLD.value,'$.kind')='upload-v1' AND json_extract(OLD.value,'$.ownerId')='${ownerId}' BEGIN SELECT RAISE(ABORT, 'fixture account deletion interrupted'); END`,
    );
    try {
      assert.equal(
        (
          await call(
            '/account',
            'DELETE',
            { confirm: 'native-owner@example.test' },
            owner,
          )
        ).status,
        503,
      );
      assert.deepEqual(await protectedRows(), beforeAccountDelete);
      assert.equal(
        (await call('/account', 'GET', undefined, owner)).status,
        200,
      );
      assert.deepEqual(await keys(), retained);
    } finally {
      await nativeSql('DROP TRIGGER fixture_abort_account_delete');
    }
    await checkedJson(
      await call(
        '/account',
        'DELETE',
        { confirm: 'native-owner@example.test' },
        owner,
      ),
    );
    const assertDeletedOwner = async () => {
      const rows = await protectedRows();
      assert.equal(receiptRows(rows, ownerId).length, 0);
      assert.equal(
        rows.filter(
          (row) =>
            (row.bucket === 'profiles' && row.key === ownerId) ||
            (['sessions', 'identities'].includes(row.bucket) &&
              row.value.userId === ownerId),
        ).length,
        0,
      );
      assert.deepEqual(receiptRows(rows, foreignId), foreignUploadedReceipts);
      assert.deepEqual(
        rows.filter((row) => row.bucket === 'idempotency'),
        otherIdempotencyRows,
      );
      assert.equal(
        (await call('/account', 'GET', undefined, owner)).status,
        401,
      );
      assert.equal((await repeatUpload(publicPhoto, owner)).status, 401);
      assert.deepEqual(await keys(), retained);
    };
    await assertDeletedOwner();
    await restart();
    await assertDeletedOwner();
    const replacementSession = await login('native-owner@example.test');
    const replacementAccount = await checkedJson(
      await call('/account', 'GET', undefined, replacementSession),
    );
    assert.notEqual(replacementSession, owner);
    assert.match(replacementAccount.profile.id, /^[0-9a-f-]{36}$/i);
    assert.notEqual(replacementAccount.profile.id, ownerId);
    assert.equal(
      (await repeatUpload(publicPhoto, replacementSession)).status,
      404,
    );
    assert.deepEqual(
      (
        await checkedJson(
          await call('/my-listings', 'GET', undefined, replacementSession),
        )
      ).listings,
      [],
    );
    await assertDeletedOwner();
    await assertPrivatePdf(foreignPdf, foreign, replacementSession);
    assert.equal((await owned(foreignListing, foreign)).status, 'draft');
    for (const [key, bytes] of neighbors) {
      const object = await bucket.get(key);
      assert.ok(object);
      assert.deepEqual(new Uint8Array(await object.arrayBuffer()), bytes);
    }
    assert.equal((await bucket.list({ prefix })).objects.length, 0);
    assert.deepEqual(outbound, []);
  } finally {
    try {
      await mf?.dispose();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
