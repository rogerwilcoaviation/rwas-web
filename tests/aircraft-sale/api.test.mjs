import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  fields,
  png,
  pdf,
  mp4,
  create,
  submit,
  approve,
} from './fixture.mjs';
globalThis.fetch = () => {
  throw Error('External network forbidden');
};
test('single-use codes, expiry, attempt lockout, malformed JSON and delivery failure', async () => {
  const f = fixture();
  assert.equal((await f.call('/send-code', 'POST', {})).status, 400);
  const t = await f.login();
  const code = f.mail.at(-1).code;
  assert.equal(
    (await f.call('/check-code', 'POST', { email: 'owner@example.test', code }))
      .status,
    400,
  );
  await f.call('/send-code', 'POST', { email: 'other@example.test' });
  for (let n = 0; n < 5; n++)
    assert.equal(
      (
        await f.call('/check-code', 'POST', {
          email: 'other@example.test',
          code: 'wrong',
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await f.call('/check-code', 'POST', {
        email: 'other@example.test',
        code: f.mail.at(-1).code,
      })
    ).status,
    400,
  );
  assert.equal((await f.call('/my-listings', 'GET', undefined, t)).status, 200);
  delete f.env.MAILER;
  assert.equal(
    (await f.call('/send-code', 'POST', { email: 'failure@example.test' }))
      .status,
    503,
  );
});
test('logout accepts a forwarded empty POST stream, revokes its session, and still rejects malformed nonempty JSON', async () => {
  const f = fixture();
  const session = await f.login();
  const request = (body) =>
    new Request('http://localhost/api/aircraft-sale/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session },
      body,
    });
  assert.equal((await f.callRaw(request('invalid JSON'))).status, 400);
  assert.equal(
    (await f.call('/account', 'GET', undefined, session)).status,
    200,
  );
  assert.equal((await f.callRaw(request(new Uint8Array(0)))).status, 200);
  assert.equal(
    (await f.call('/account', 'GET', undefined, session)).status,
    401,
  );
});

test('logout revokes token, profiles survive login; verified email change revokes other sessions', async () => {
  const f = fixture(),
    t = await f.login(),
    other = await f.login();
  await f.call(
    '/account',
    'PATCH',
    { name: 'Owner', phone: '555', location: 'Synthetic' },
    t,
  );
  await f.call('/account/email-code', 'POST', { email: 'new@example.test' }, t);
  assert.equal(
    (
      await f.call(
        '/account/email',
        'PUT',
        { email: 'new@example.test', code: f.mail.at(-1).code },
        t,
      )
    ).status,
    200,
  );
  assert.equal((await f.call('/account', 'GET', undefined, other)).status, 401);
  assert.equal(
    (await (await f.call('/account', 'GET', undefined, t)).json()).profile.name,
    'Owner',
  );
  await f.call('/logout', 'POST', {}, t);
  assert.equal((await f.call('/account', 'GET', undefined, t)).status, 401);
  const again = await f.login('new@example.test');
  assert.equal(
    (await (await f.call('/account', 'GET', undefined, again)).json()).profile
      .name,
    'Owner',
  );
});
test('private draft CRUD cannot access another user draft', async () => {
  const f = fixture(),
    a = await f.login(),
    b = await f.login('other@example.test');
  assert.equal((await f.call('/draft', 'PUT', fields)).status, 401);
  await f.call('/draft', 'PUT', fields, a);
  assert.equal(
    (await (await f.call('/draft', 'GET', undefined, b)).json()).draft,
    null,
  );
  assert.equal(
    (
      await f.call(
        '/draft',
        'PUT',
        { ...fields, email: 'owner@example.test' },
        b,
      )
    ).status,
    400,
  );
});
test('create idempotency and serialized concurrent writes survive restart', async () => {
  const f = fixture(),
    t = await f.login();
  const [a, b] = await Promise.all([
    create(f, t, fields, 'a'),
    create(f, t, fields, 'b'),
  ]);
  assert.notEqual(a.id, b.id);
  assert.equal((await create(f, t, fields, 'a')).id, a.id);
  assert.equal(Object.keys(f.state().listings).length, 2);
  assert.equal(
    (
      await f.call('/listings', 'POST', { ...fields, model: 'different' }, t, {
        'Idempotency-Key': 'a',
      })
    ).status,
    409,
  );
  f.restart();
  assert.equal(
    (await (await f.call('/my-listings', 'GET', undefined, t)).json()).listings
      .length,
    2,
  );
});
test('approval cannot be bypassed; edit invalidates approval; revision fence protects review', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  for (const status of ['paused', 'active', 'sold'])
    assert.equal(
      (await f.call('/listing/' + l.id + '/status', 'POST', { status }, t))
        .status,
      409,
    );
  await submit(f, t, l);
  assert.equal((await approve(f, l)).status, 200);
  await f.call('/listing/' + l.id + '/status', 'POST', { status: 'paused' }, t);
  assert.equal(
    (
      await f.call(
        '/listing/' + l.id + '/status',
        'POST',
        { status: 'active' },
        t,
      )
    ).status,
    200,
  );
  const edited = (
    await (
      await f.call('/listings/' + l.id, 'PUT', { model: 'Changed' }, t)
    ).json()
  ).listing;
  assert.equal(edited.status, 'draft');
  assert.equal(
    (
      await f.call(
        '/listing/' + l.id + '/status',
        'POST',
        { status: 'active' },
        t,
      )
    ).status,
    409,
  );
  await submit(f, t, edited);
  assert.equal((await approve(f, l)).status, 409);
  assert.equal((await approve(f, edited)).status, 200);
});
test('archive and trash private; restore draft; permanent delete gated and error retry retains record', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  await f.call(
    '/upload?listingId=' + l.id + '&category=photos&filename=a.png',
    'POST',
    png,
    t,
  );
  await f.call(
    '/listing/' + l.id + '/status',
    'POST',
    { status: 'archived' },
    t,
  );
  assert.equal((await f.call('/listing/' + l.id)).status, 401);
  await f.call(
    '/listing/' + l.id + '/status',
    'POST',
    { status: 'restore' },
    t,
  );
  assert.equal(f.state().listings[l.id].status, 'draft');
  assert.equal(
    (await f.call('/listings/' + l.id, 'DELETE', { confirm: l.id }, t)).status,
    409,
  );
  await f.call(
    '/listing/' + l.id + '/status',
    'POST',
    { status: 'deleted' },
    t,
  );
  f.deleteFailure(true);
  assert.equal(
    (await f.call('/listings/' + l.id, 'DELETE', { confirm: l.id }, t)).status,
    503,
  );
  assert.ok(f.state().listings[l.id]);
  f.deleteFailure(false);
  assert.equal(
    (await f.call('/listings/' + l.id, 'DELETE', { confirm: l.id }, t)).status,
    200,
  );
  assert.equal(f.objects.size, 0);
});
test('owned photos/PDF/video, reorder, foreign delete forbidden, private files and publish media-only', async () => {
  const f = fixture(),
    a = await f.login(),
    b = await f.login('other@example.test'),
    l = await create(f, a),
    other = await create(f, b);
  const upload = async (category, name, body) =>
    (
      await (
        await f.call(
          '/upload?listingId=' +
            l.id +
            '&category=' +
            category +
            '&filename=' +
            name,
          'POST',
          body,
          a,
        )
      ).json()
    ).file;
  const one = await upload('photos', 'one.png', png),
    two = await upload('photos', 'two.png', png),
    doc = await upload('airframe', 'record.pdf', pdf),
    video = await upload('videos', 'clip.mp4', mp4);
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(doc.key))).status,
    401,
  );
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(doc.key), 'GET', undefined, b))
      .status,
    404,
  );
  assert.equal(
    (
      await f.call(
        '/delete-file',
        'POST',
        { listingId: other.id, category: 'photos', fileKey: one.key },
        b,
      )
    ).status,
    404,
  );
  assert.ok(f.objects.has(one.key));
  assert.equal(
    (
      await f.call(
        '/listings/' + l.id + '/photos/order',
        'PUT',
        { order: [two.key, one.key] },
        a,
      )
    ).status,
    200,
  );
  const saved = f.state().listings[l.id];
  await submit(f, a, saved);
  await approve(f, saved);
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(video.key))).status,
    200,
  );
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(one.key))).headers.get(
      'Cache-Control',
    ),
    'no-store',
  );
  assert.equal(
    (await f.call('/files/' + encodeURIComponent(doc.key))).status,
    401,
  );
});
test('validation rejects missing year/price on submission, arbitrary fields, unsupported category/junk docs/video', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t, { make: 'Incomplete' });
  assert.equal((await submit(f, t, l)).status, 400);
  assert.equal(
    (
      await f.call(
        '/listings/' + l.id,
        'PUT',
        { photos: [{ key: 'foreign' }] },
        t,
      )
    ).status,
    400,
  );
  for (const [cat, name] of [
    ['invalid', 'x.pdf'],
    ['airframe', 'x.pdf'],
    ['videos', 'x.mp4'],
    ['photos', 'x.heic'],
  ])
    assert.equal(
      (
        await f.call(
          '/upload?listingId=' +
            l.id +
            '&category=' +
            cat +
            '&filename=' +
            name,
          'POST',
          new Uint8Array([1, 2]),
          t,
        )
      ).status,
      400,
    );
  assert.equal(f.objects.size, 0);
});
test('account deletion requires recent auth, typed email and no listings; other users cannot revoke sessions', async () => {
  const f = fixture(),
    t = await f.login(),
    b = await f.login('other@example.test');
  const account = await (await f.call('/account', 'GET', undefined, t)).json();
  await f.call(
    '/account/sessions',
    'DELETE',
    { id: account.sessions[0].id },
    b,
  );
  assert.equal((await f.call('/account', 'GET', undefined, t)).status, 200);
  assert.equal(
    (await f.call('/account', 'DELETE', { confirm: 'wrong' }, t)).status,
    400,
  );
  await create(f, t);
  assert.equal(
    (await f.call('/account', 'DELETE', { confirm: 'owner@example.test' }, t))
      .status,
    409,
  );
  assert.equal(
    (await f.call('/account', 'DELETE', { confirm: 'other@example.test' }, b))
      .status,
    200,
  );
  assert.equal((await f.call('/account', 'GET', undefined, b)).status, 401);
});
test('rate limits throttle resend and expiry fails closed; no wildcard CORS', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await f.call('/send-code', 'POST', { email: 'owner@example.test' }))
        .status,
      200,
    );
  assert.equal(
    (await f.call('/send-code', 'POST', { email: 'owner@example.test' }))
      .status,
    429,
  );
  assert.equal(
    (await f.call('/health')).headers.has('Access-Control-Allow-Origin'),
    false,
  );
});

test('expired codes/sessions and sensitive-action freshness fail closed', async () => {
  const f = fixture(),
    t = await f.login();
  const state = f.state();
  Object.values(state.sessions)[0].createdAt = Date.now() - 600001;
  assert.equal(
    (
      await f.call(
        '/account/email-code',
        'POST',
        { email: 'next@example.test' },
        t,
      )
    ).status,
    401,
  );
  Object.values(f.state().sessions)[0].expiresAt = Date.now() - 1;
  assert.equal((await f.call('/account', 'GET', undefined, t)).status, 401);
  await f.call('/send-code', 'POST', { email: 'expiry@example.test' });
  f.state().codes['login:expiry@example.test'].createdAt = Date.now() - 900001;
  assert.equal(
    (
      await f.call('/check-code', 'POST', {
        email: 'expiry@example.test',
        code: f.mail.at(-1).code,
      })
    ).status,
    400,
  );
});
test('authenticated Jerry resumes durable progress; required fields cannot skip; completion never publishes', async () => {
  const f = fixture(),
    a = await f.login(),
    b = await f.login('other@example.test');
  const message = async (text, t = a) =>
    f.call(
      '/intake',
      'POST',
      { messages: [{ role: 'user', content: text }] },
      t,
    );
  assert.equal(
    (
      await f.call('/intake', 'POST', {
        messages: [{ role: 'user', content: 'list my aircraft' }],
      })
    ).status,
    401,
  );
  assert.equal((await message('list my aircraft')).status, 200);
  assert.equal((await message('skip')).status, 400);
  assert.equal((await message('bad tail')).status, 400);
  await message('N123AB');
  f.restart();
  assert.match(
    (await (await message('I want to list my aircraft')).json()).reply,
    /Aircraft make/,
  );
  assert.match(
    (await (await message('list my aircraft', b)).json()).reply,
    /N-number/,
  );
  let r;
  for (const text of ['Synthetic', 'Model', '2000', '1', 'skip', 'skip'])
    r = await message(text);
  const d = await r.json();
  assert.equal(d.action.type, 'listing_draft');
  assert.equal(d.action.draft.make, 'Synthetic');
  assert.equal(Object.keys(f.state().listings).length, 0);
});
test('metadata interruption compensates uploaded object; public HTML escapes strings and never caches', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  f.storageFailure(true);
  assert.equal(
    (
      await f.call(
        '/upload?listingId=' + l.id + '&category=photos&filename=x.png',
        'POST',
        png,
        t,
      )
    ).status,
    503,
  );
  assert.equal(f.objects.size, 0);
  f.storageFailure(false);
  const edit = (
    await (
      await f.call(
        '/listings/' + l.id,
        'PUT',
        { description: '<script>alert(1)</script>' },
        t,
      )
    ).json()
  ).listing;
  await submit(f, t, edit);
  await approve(f, edit);
  const html = await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
    Accept: 'text/html',
  });
  assert.equal(html.headers.get('Cache-Control'), 'no-store');
  assert.match(await html.text(), /&lt;script&gt;/);
  await f.call(
    '/listing/' + l.id + '/status',
    'POST',
    { status: 'archived' },
    t,
  );
  assert.equal(
    (
      await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    401,
  );
});

test('public video supports bounded byte ranges; private records stay gated for ranges', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  const v = (
    await (
      await f.call(
        '/upload?listingId=' + l.id + '&category=videos&filename=clip.mp4',
        'POST',
        mp4,
        t,
      )
    ).json()
  ).file;
  const saved = f.state().listings[l.id];
  await submit(f, t, saved);
  await approve(f, saved);
  const response = await f.call(
    '/files/' + encodeURIComponent(v.key),
    'GET',
    undefined,
    undefined,
    { Range: 'bytes=4-7' },
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 4-7/20');
  assert.equal(await response.text(), 'ftyp');
  assert.equal(
    (
      await f.call(
        '/files/' + encodeURIComponent(v.key),
        'GET',
        undefined,
        undefined,
        { Range: 'bytes=999-' },
      )
    ).status,
    416,
  );
});

test('staff media review requires authorized reviewer and never exposes private documents publicly', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  const file = (
    await (
      await f.call(
        '/upload?listingId=' + l.id + '&category=airframe&filename=x.pdf',
        'POST',
        pdf,
        t,
      )
    ).json()
  ).file;
  assert.equal(
    (await f.call('/admin/files/' + encodeURIComponent(file.key))).status,
    403,
  );
  assert.equal(
    (
      await f.call(
        '/admin/files/' + encodeURIComponent(file.key),
        'GET',
        undefined,
        'fixture-reviewer',
      )
    ).status,
    200,
  );
});

test('review: chunked JSON is capped by bytes and cancelled before full consumption', async () => {
  const f = fixture();
  let reads = 0,
    cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new TextEncoder().encode('é'.repeat(20000)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request(
    'https://fixture.test/api/aircraft-sale/send-code',
    { method: 'POST', body, duplex: 'half' },
  );
  const response = await new (
    await import('../../workers/aircraft-sale/worker.mjs')
  ).SellerStore(f.ctx, f.env).fetch(request);
  assert.equal(response.status, 413);
  assert.ok(cancelled);
  assert.ok(reads <= 3);
  assert.equal(f.mail.length, 0);
});
test('review: failed mail attempts remain throttled and prior code survives failed resend', async () => {
  const f = fixture(),
    address = 'retry@example.test';
  await f.call('/send-code', 'POST', { email: address });
  const prior = f.mail.at(-1).code;
  let deliveries = 0;
  f.env.MAILER.fetch = async () => {
    deliveries++;
    return new Response(null, { status: 503 });
  };
  for (let n = 0; n < 4; n++)
    assert.equal(
      (await f.call('/send-code', 'POST', { email: address })).status,
      503,
    );
  assert.equal(
    (await f.call('/send-code', 'POST', { email: address })).status,
    429,
  );
  assert.equal(deliveries, 4);
  assert.equal(
    (await f.call('/check-code', 'POST', { email: address, code: prior }))
      .status,
    200,
  );
});
test('review: reorder never restores archive or trash', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  const file = (
    await (
      await f.call(
        '/upload?listingId=' + l.id + '&category=photos&filename=x.png',
        'POST',
        png,
        t,
      )
    ).json()
  ).file;
  for (const status of ['archived', 'deleted']) {
    await f.call('/listing/' + l.id + '/status', 'POST', { status }, t);
    assert.equal(
      (
        await f.call(
          '/listings/' + l.id + '/photos/order',
          'PUT',
          { order: [file.key] },
          t,
        )
      ).status,
      409,
    );
    assert.equal(f.state().listings[l.id].status, status);
    await f.call(
      '/listing/' + l.id + '/status',
      'POST',
      { status: 'restore' },
      t,
    );
  }
});
test('review: file deletion commits hidden intent before R2 and remains retryable after final save failure', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  const file = (
    await (
      await f.call(
        '/upload?listingId=' + l.id + '&category=photos&filename=x.png',
        'POST',
        png,
        t,
      )
    ).json()
  ).file;
  const del = () =>
    f.call(
      '/delete-file',
      'POST',
      { listingId: l.id, category: 'photos', fileKey: file.key },
      t,
    );
  f.storageFailure(true);
  assert.equal((await del()).status, 503);
  assert.ok(f.objects.has(file.key));
  assert.ok(!f.state().files[file.key].deleting);
  f.storageFailure(false);
  const originalDelete = f.env.MEDIA.delete;
  f.env.MEDIA.delete = async (k) => {
    await originalDelete(k);
    f.storageFailure(true);
  };
  assert.equal((await del()).status, 503);
  assert.ok(!f.objects.has(file.key));
  assert.ok(f.state().files[file.key].deleting);
  f.restart();
  f.storageFailure(false);
  assert.equal(
    (
      await f.call(
        '/files/' + encodeURIComponent(file.key),
        'GET',
        undefined,
        t,
      )
    ).status,
    404,
  );
  assert.equal((await submit(f, t, l)).status, 409);
  f.env.MEDIA.delete = originalDelete;
  assert.equal((await del()).status, 200);
  assert.ok(!f.state().files[file.key]);
});
test('review: paginated purge persists irreversible intent and cannot be restored after interruption', async () => {
  const f = fixture(),
    t = await f.login(),
    l = await create(f, t);
  for (let i = 0; i < 3; i++)
    await f.call(
      '/upload?listingId=' + l.id + '&category=photos&filename=' + i + '.png',
      'POST',
      png,
      t,
    );
  await f.call(
    '/listing/' + l.id + '/status',
    'POST',
    { status: 'deleted' },
    t,
  );
  const del = () => f.call('/listings/' + l.id, 'DELETE', { confirm: l.id }, t);
  f.storageFailure(true);
  assert.equal((await del()).status, 503);
  assert.equal(f.objects.size, 3);
  f.storageFailure(false);
  f.deleteFailure(true);
  assert.equal((await del()).status, 503);
  assert.ok(f.state().listings[l.id].purging);
  f.restart();
  assert.equal(
    (
      await f.call(
        '/listing/' + l.id + '/status',
        'POST',
        { status: 'restore' },
        t,
      )
    ).status,
    409,
  );
  f.deleteFailure(false);
  const snapshot = [...f.objects.keys()];
  let pages = 0;
  f.env.MEDIA.list = async ({ cursor }) => {
    pages++;
    const start = Number(cursor || 0);
    return {
      objects: snapshot.slice(start, start + 1).map((key) => ({ key })),
      truncated: start + 1 < snapshot.length,
      cursor: String(start + 1),
    };
  };
  assert.equal((await del()).status, 200);
  assert.equal(pages, 3);
  assert.equal(f.objects.size, 0);
  assert.ok(!f.state().listings[l.id]);
});

test('review: unavailable durable counters prevent mail delivery before any external side effect', async () => {
  const f = fixture();
  f.storageFailure(true);
  for (let i = 0; i < 7; i++)
    assert.equal(
      (
        await f.call('/send-code', 'POST', {
          email: 'unavailable@example.test',
        })
      ).status,
      503,
    );
  assert.equal(f.mail.length, 0);
  f.storageFailure(false);
  await f.call('/send-code', 'POST', { email: 'unavailable@example.test' });
  assert.equal(f.mail.length, 1);
  f.restart();
  assert.equal(f.state().rates['email:unavailable@example.test'].count, 1);
});
