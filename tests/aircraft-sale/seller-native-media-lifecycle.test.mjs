import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

// Reuse the installed Wrangler runtime without reading Wrangler configuration,
// invoking its CLI, or introducing a dependency on the older top-level runtime.
const wranglerRequire = createRequire(
  new URL('../../node_modules/wrangler/package.json', import.meta.url),
);
const { Miniflare } = await import(wranglerRequire.resolve('miniflare'));
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
      ['synthetic.pdf', 'synthetic.mp4', 'synthetic.png'].map(async (name) =>
        new Uint8Array(
          await readFile(new URL('./media-fixtures/' + name, import.meta.url)),
        ),
      ),
    );
    const script = (
      await build({
        entryPoints: [
          new URL('../../workers/aircraft-sale/worker.mjs', import.meta.url)
            .pathname,
        ],
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
      compatibilityDate: '2026-09-01',
      durableObjects: {
        SELLER_STORE: { className: 'SellerStore', useSQLite: true },
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
      const response = await mf.dispatchFetch(
        origin + '/api/aircraft-sale' + path,
        {
          method,
          headers: {
            Connection: 'close',
            ...(method !== 'GET' ? { Origin: origin } : {}),
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(body !== undefined && !raw
              ? { 'Content-Type': 'application/json' }
              : {}),
            ...extra,
          },
          ...(body !== undefined
            ? { body: raw ? body : JSON.stringify(body) }
            : {}),
        },
      );
      return new Response(await response.arrayBuffer(), response);
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
    const upload = async (listing, token, category, filename, bytes, type) =>
      (
        await checkedJson(
          await call(
            '/upload?' +
              new URLSearchParams({
                listingId: listing.id,
                category,
                filename,
              }),
            'POST',
            bytes,
            token,
            { 'Content-Type': type },
          ),
        )
      ).file;
    const keys = async () =>
      (await bucket.list()).objects.map(({ key }) => key).sort();
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
        { listingId: listing.id, revision: listing.revision, decision: 'approve' },
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
      assert.equal(part.headers.get('Content-Range'), 'bytes 0-7/' + pdf.length);
      assert.equal(part.headers.get('Content-Length'), '8');
      assert.equal(part.headers.get('Cache-Control'), 'no-store');
      assert.match(part.headers.get('Content-Disposition'), /^attachment;/);
      assert.deepEqual(new Uint8Array(await part.arrayBuffer()), pdf.slice(0, 8));
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
    for (const file of [privatePdf, publicVideo, publicPhoto])
      assert.equal((await call(filePath(file), 'GET', undefined, owner)).status, 404);
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
    assert.deepEqual(outbound, []);
  } finally {
    try {
      await mf?.dispose();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
