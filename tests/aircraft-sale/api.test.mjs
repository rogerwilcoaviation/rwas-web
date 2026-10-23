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
  await message('hangars');
  f.restart();
  assert.match((await (await message('I want to list my aircraft')).json()).reply,/Listing category/);
  assert.match((await (await message('list my aircraft', b)).json()).reply,/What would you like to list/);
  let r;
  for (const text of ['hangars','Synthetic hangar','Box / rectangular','Synthetic Airport','skip','sale','USD','on-request','Synthetic location','Synthetic description']) {
    r=await message(text);
    assert.equal(r.status,200,await r.clone().text());
  }
  let d=await r.json();
  for(let i=0;i<40 && !d.action;i++) {
    assert.match(d.reply,/optional/);
    r=await message('skip');assert.equal(r.status,200,await r.clone().text());d=await r.json();
  }
  assert.equal(d.action.type,'listing_draft');
  assert.equal(d.action.draft.listingType,'hangars');
  assert.equal(d.action.draft.airport,'Synthetic Airport');
  assert.equal(d.action.draft.year,undefined);
  assert.equal(Object.keys(f.state().listings).length,0);
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
    404,
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

test('staff bounded acceptance publication is explicit and reversible', async () => {
  const f = fixture();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const t = await f.login(),
    ordinary = await create(f, t, fields, 'ordinary-active'),
    l = await create(f, t, fields, 'acceptance-pending');
  f.env.PUBLIC_LISTINGS_ENABLED = 'true';
  await submit(f, t, ordinary);
  assert.equal((await approve(f, ordinary)).status, 200);
  assert.equal(f.state().listings[ordinary.id].status, 'active');
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  await submit(f, t, l);
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({
    listingId: l.id,
    ownerId: f.state().listings[l.id].ownerId,
    revision: l.revision,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  assert.equal(
    (
      await f.call(
        '/admin/review',
        'POST',
        {
          listingId: l.id,
          revision: l.revision,
          decision: 'acceptance-approve',
        },
        'fixture-reviewer',
      )
    ).status,
    200,
  );
  assert.equal((await f.call('/listing/' + l.id)).status, 200);
  const visible = (await (await f.call('/browse')).json()).listings;
  assert.deepEqual(visible.map((item) => item.id), [l.id]);
  assert.equal(
    (
      await f.call('/listing/' + ordinary.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    404,
  );
  assert.equal(f.state().listings[l.id].status, 'pending');
  assert.equal(
    (
      await f.call(
        '/admin/review',
        'POST',
        {
          listingId: l.id,
          revision: l.revision,
          decision: 'acceptance-unpublish',
        },
        'fixture-reviewer',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    404,
  );
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
  assert.equal(f.state().listings[l.id].acceptancePublicUntil, undefined);
  assert.equal(f.state().listings[l.id].acceptanceApprovedRevision, undefined);

  const pending = f.state().listings[l.id];
  assert.equal(
    (
      await f.call(
        '/admin/review',
        'POST',
        {
          listingId: l.id,
          revision: pending.revision,
          decision: 'acceptance-approve',
        },
        'fixture-reviewer',
      )
    ).status,
    200,
  );
  const edited = (
    await (
      await f.call('/listings/' + l.id, 'PUT', { model: 'Edited after review' }, t)
    ).json()
  ).listing;
  assert.equal(edited.status, 'draft');
  assert.ok(f.state().listings[l.id].acceptancePublicUntil);
  assert.notEqual(
    f.state().listings[l.id].acceptanceApprovedRevision,
    f.state().listings[l.id].revision,
  );
  assert.deepEqual((await (await f.call('/browse')).json()).listings, []);
  assert.equal(
    (
      await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    404,
  );
  assert.equal((await f.call('/listing/' + l.id, 'GET', undefined, t)).status, 200);
  assert.equal(
    (
      await f.call(
        '/admin/review',
        'POST',
        {
          listingId: l.id,
          revision: edited.revision,
          decision: 'acceptance-unpublish',
        },
        'fixture-reviewer',
      )
    ).status,
    200,
  );
  assert.equal(f.state().listings[l.id].acceptancePublicUntil, undefined);
  assert.equal(f.state().listings[l.id].acceptanceApprovedRevision, undefined);
});

const publicationState = (f) =>
  structuredClone({
    listings: f.state().listings,
    files: f.state().files,
    outbox: f.state().outbox,
    audit: f.state().audit,
  });
const currentPublicationListing = (f, listing) =>
  structuredClone(f.state().listings[listing.id]);
function grantPublication(f, listing, overrides = {}) {
  const current = currentPublicationListing(f, listing);
  const scope = {
    listingId: current.id,
    ownerId: current.ownerId,
    revision: current.revision,
    expiresAt: Date.now() + 5 * 60 * 1000,
    ...overrides,
  };
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify(scope);
  return scope;
}
const reviewPublication = (
  f,
  listing,
  decision,
  session = 'fixture-reviewer',
  extra = {},
) =>
  f.call(
    '/admin/review',
    'POST',
    { listingId: listing.id, revision: listing.revision, decision, ...extra },
    session,
  );
async function publicationFixture(pending = true) {
  const f = fixture();
  const owner = await f.login();
  const listing = await create(f, owner);
  if (pending) assert.equal((await submit(f, owner, listing)).status, 200);
  return { f, owner, listing: currentPublicationListing(f, listing) };
}
async function publicationFile(f, owner, listing, category, name, bytes) {
  const response = await f.call(
    '/upload?listingId=' +
      listing.id +
      '&category=' +
      category +
      '&filename=' +
      name,
    'POST',
    bytes,
    owner,
  );
  assert.equal(response.status, 200);
  return (await response.json()).file;
}
async function assertPublicationPrivate(f, listing, files = []) {
  const browse = await f.call('/browse');
  assert.equal(browse.status, 200);
  assert.equal(
    (await browse.json()).listings.some((item) => item.id === listing.id),
    false,
  );
  assert.equal((await f.call('/listing/' + listing.id)).status, 401);
  assert.equal(
    (
      await f.call('/listing/' + listing.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    404,
  );
  for (const file of files)
    assert.equal(
      (await f.call('/files/' + encodeURIComponent(file.key))).status,
      401,
    );
}

test('bounded publication requires one closed server grant; malformed and wrong tuples never authorize', async (t) => {
  const { f, owner, listing } = await publicationFixture();
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const otherOwner = await f.login('other-publication-owner@example.test');
  const other = await create(f, otherOwner);
  assert.equal((await submit(f, otherOwner, other)).status, 200);
  const valid = grantPublication(f, listing);
  const invalid = [
    ['missing grant', undefined],
    ['non-string grant', valid],
    ['invalid JSON', '{'],
    ['oversized grant', ' '.repeat(2049)],
    ['null grant', 'null'],
    ['array grant', JSON.stringify([valid])],
    ['primitive grant', 'true'],
    ['missing field', JSON.stringify({ ...valid, ownerId: undefined })],
    ['extra field', JSON.stringify({ ...valid, eligible: true })],
    ['wrong listing', JSON.stringify({ ...valid, listingId: other.id })],
    [
      'wrong owner',
      JSON.stringify({ ...valid, ownerId: f.state().listings[other.id].ownerId }),
    ],
    ['listing ID object', JSON.stringify({ ...valid, listingId: {} })],
    ['invalid listing ID', JSON.stringify({ ...valid, listingId: '../listing' })],
    ['oversized owner ID', JSON.stringify({ ...valid, ownerId: 'a'.repeat(129) })],
    ['empty owner ID', JSON.stringify({ ...valid, ownerId: '' })],
    ['owner ID object', JSON.stringify({ ...valid, ownerId: {} })],
    ['stale revision', JSON.stringify({ ...valid, revision: valid.revision + 1 })],
    ['zero revision', JSON.stringify({ ...valid, revision: 0 })],
    ['fractional revision', JSON.stringify({ ...valid, revision: 1.5 })],
    ['string revision', JSON.stringify({ ...valid, revision: '1' })],
    [
      'unsafe revision',
      JSON.stringify({ ...valid, revision: Number.MAX_SAFE_INTEGER + 1 }),
    ],
    ['expired grant', JSON.stringify({ ...valid, expiresAt: Date.now() - 1 })],
    [
      'excessive window',
      JSON.stringify({ ...valid, expiresAt: Date.now() + 11 * 60 * 1000 }),
    ],
    ['string expiry', JSON.stringify({ ...valid, expiresAt: String(valid.expiresAt) })],
    ['fractional expiry', JSON.stringify({ ...valid, expiresAt: valid.expiresAt + 0.5 })],
    ['null expiry', JSON.stringify({ ...valid, expiresAt: null })],
    [
      'unsafe expiry',
      JSON.stringify({ ...valid, expiresAt: Number.MAX_SAFE_INTEGER + 1 }),
    ],
  ];
  for (const [name, scope] of invalid)
    await t.test(name, async () => {
      if (scope === undefined) delete f.env.CLERK_ACCEPTANCE_SCOPE;
      else f.env.CLERK_ACCEPTANCE_SCOPE = scope;
      const before = publicationState(f);
      assert.equal(
        (await reviewPublication(f, listing, 'acceptance-approve')).status,
        409,
      );
      assert.deepEqual(publicationState(f), before);
      const admin = await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer');
      assert.equal(admin.status, 200);
      assert.equal(
        (await admin.json()).listings
          .find((item) => item.id === listing.id)
          .reviewActions.includes('acceptance-approve'),
        false,
      );
    });
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify(valid);
  for (const mode of [undefined, false, 'false', '1'])
    await t.test('global acceptance flag ' + String(mode), async () => {
      f.env.CLERK_ACCEPTANCE_ENABLED = mode;
      const before = publicationState(f);
      assert.equal(
        (await reviewPublication(f, listing, 'acceptance-approve')).status,
        409,
      );
      assert.deepEqual(publicationState(f), before);
    });
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  f.env.PUBLIC_LISTINGS_ENABLED = 'true';
  assert.equal(
    (await reviewPublication(f, listing, 'acceptance-approve')).status,
    409,
  );
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  assert.equal((await approve(f, listing)).status, 409);
  assert.equal(
    (await reviewPublication(f, other, 'acceptance-approve')).status,
    409,
  );
  const beforeProjection = publicationState(f);
  const projection = await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer');
  const rows = (await projection.json()).listings;
  assert.deepEqual(rows.find((item) => item.id === listing.id).reviewActions, [
    'reject',
    'acceptance-approve',
  ]);
  assert.deepEqual(rows.find((item) => item.id === other.id).reviewActions, ['reject']);
  assert.deepEqual(publicationState(f), beforeProjection);
  assert.equal('reviewActions' in f.state().listings[listing.id], false);
  assert.equal(
    'reviewActions' in (await (await f.call('/listing/' + listing.id, 'GET', undefined, owner)).json()).listing,
    false,
  );
  assert.equal(
    (await reviewPublication(f, listing, 'acceptance-approve')).status,
    200,
  );
  assert.equal(f.state().listings[listing.id].status, 'pending');
  assert.equal(f.state().listings[listing.id].acceptancePublicUntil, valid.expiresAt);
});

test('client eligibility and approval forgeries cannot nominate a listing or change its owner', async () => {
  const { f, owner, listing } = await publicationFixture(false);
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const forged = {
    ownerId: 'forged-owner',
    acceptanceApprovedRevision: listing.revision,
    acceptancePublicUntil: Date.now() + 300000,
    reviewActions: ['acceptance-approve'],
    CLERK_ACCEPTANCE_SCOPE: JSON.stringify({
      listingId: listing.id,
      ownerId: listing.ownerId,
      revision: listing.revision,
      expiresAt: Date.now() + 300000,
    }),
  };
  for (const [key, value] of Object.entries(forged)) {
    const before = publicationState(f);
    assert.equal(
      (await f.call('/listings', 'POST', { ...fields, [key]: value }, owner)).status,
      400,
    );
    assert.equal(
      (await f.call('/listings/' + listing.id, 'PUT', { [key]: value }, owner)).status,
      400,
    );
    assert.deepEqual(publicationState(f), before);
  }
  assert.equal(
    (await f.call('/listing/' + listing.id + '/status', 'POST', { status: 'active', ...forged }, owner)).status,
    409,
  );
  assert.equal(
    (await f.call('/listing/' + listing.id + '/status', 'POST', { status: 'pending', ...forged }, owner)).status,
    200,
  );
  const before = publicationState(f);
  assert.equal(
    (await reviewPublication(f, listing, 'acceptance-approve', 'fixture-reviewer', forged)).status,
    409,
  );
  assert.deepEqual(publicationState(f), before);
  assert.equal(f.state().listings[listing.id].ownerId, listing.ownerId);
  assert.equal(f.state().listings[listing.id].acceptancePublicUntil, undefined);
  await assertPublicationPrivate(f, listing);
});

test('publication decisions retain staff authorization; seller ownership never grants staff access', async (t) => {
  for (const decision of ['approve', 'acceptance-approve', 'unpublish', 'acceptance-unpublish'])
    await t.test(decision, async () => {
      const { f, owner, listing } = await publicationFixture();
      const foreign = await f.login('foreign-reviewer@example.test');
      if (decision.startsWith('acceptance-')) {
        f.env.PUBLIC_LISTINGS_ENABLED = 'false';
        f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
        grantPublication(f, listing);
      }
      if (decision === 'unpublish') assert.equal((await approve(f, listing)).status, 200);
      if (decision === 'acceptance-unpublish')
        assert.equal((await reviewPublication(f, listing, 'acceptance-approve')).status, 200);
      const current = currentPublicationListing(f, listing);
      const before = publicationState(f);
      for (const session of ['', owner, foreign, 'forged-reviewer']) {
        assert.equal((await reviewPublication(f, current, decision, session)).status, 403);
        assert.equal((await f.call('/admin/listings', 'GET', undefined, session)).status, 403);
        assert.deepEqual(publicationState(f), before);
      }
      const authorize = f.env.ADMIN_AUTH;
      f.env.ADMIN_AUTH = { fetch: async () => new Response(null, { status: 503 }) };
      assert.equal((await reviewPublication(f, current, decision)).status, 503);
      assert.deepEqual(publicationState(f), before);
      f.env.ADMIN_AUTH = authorize;
      assert.equal((await reviewPublication(f, current, decision)).status, 200);
    });
});

test('wrong-owner listing and file mutations remain opaque and cannot affect publication', async () => {
  const { f, owner, listing } = await publicationFixture(false);
  const foreign = await f.login('foreign-listing-owner@example.test');
  const file = await publicationFile(f, owner, listing, 'photos', 'owned.png', png);
  await submit(f, owner, listing);
  assert.equal((await approve(f, currentPublicationListing(f, listing))).status, 200);
  const before = publicationState(f);
  const requests = [
    ['/listings/' + listing.id, 'PUT', { model: 'Foreign edit' }],
    ['/listing/' + listing.id + '/status', 'POST', { status: 'archived' }],
    ['/listing/' + listing.id + '/status', 'POST', { status: 'active' }],
    ['/upload?listingId=' + listing.id + '&category=photos&filename=foreign.png', 'POST', png],
    ['/listings/' + listing.id + '/photos/order', 'PUT', { order: [file.key] }],
    ['/delete-file', 'POST', { listingId: listing.id, category: 'photos', fileKey: file.key }],
  ];
  for (const [path, method, body] of requests) {
    assert.equal((await f.call(path, method, body, foreign)).status, 404);
    assert.deepEqual(publicationState(f), before);
    assert.equal((await f.call(path, method, body)).status, 401);
    assert.deepEqual(publicationState(f), before);
  }
  assert.ok(f.objects.has(file.key));
});

test('a bounded grant exposes only its selected listing and public media, never private review data', async () => {
  const { f, owner, listing } = await publicationFixture(false);
  const foreign = await f.login('other-visible-owner@example.test');
  const other = await create(f, foreign);
  const photo = await publicationFile(f, owner, listing, 'photos', 'selected.png', png);
  const video = await publicationFile(f, owner, listing, 'videos', 'selected.mp4', mp4);
  const doc = await publicationFile(f, owner, listing, 'airframe', 'private.pdf', pdf);
  const otherPhoto = await publicationFile(f, foreign, other, 'photos', 'other.png', png);
  await submit(f, foreign, other);
  await submit(f, owner, listing);
  let current = currentPublicationListing(f, listing);
  assert.equal(
    (await reviewPublication(f, current, 'reject', 'fixture-reviewer', { note: 'PRIVATE-REVIEW-NOTE' })).status,
    200,
  );
  await submit(f, owner, listing);
  current = currentPublicationListing(f, listing);
  f.env.PUBLIC_LISTINGS_ENABLED = 'false';
  f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
  const scope = grantPublication(f, current);
  assert.equal((await reviewPublication(f, current, 'acceptance-approve')).status, 200);
  const browse = (await (await f.call('/browse')).json()).listings;
  assert.deepEqual(browse.map((item) => item.id), [listing.id]);
  const detail = (await (await f.call('/listing/' + listing.id)).json()).listing;
  for (const publicItem of [browse[0], detail]) {
    for (const key of ['ownerId', 'revision', 'approvedRevision', 'acceptanceApprovedRevision', 'acceptancePublicUntil', 'reviewNote', 'reviewActions'])
      assert.equal(key in publicItem, false, key);
    assert.deepEqual(publicItem.logbooks.airframe, { count: 1 });
    assert.equal(JSON.stringify(publicItem).includes('PRIVATE-REVIEW-NOTE'), false);
    assert.equal(JSON.stringify(publicItem).includes(doc.key), false);
  }
  const html = await f.call('/listing/' + listing.id, 'GET', undefined, undefined, { Accept: 'text/html' });
  assert.equal(html.status, 200);
  assert.equal((await html.text()).includes('PRIVATE-REVIEW-NOTE'), false);
  for (const file of [photo, video]) {
    const response = await f.call('/files/' + encodeURIComponent(file.key));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const range = await f.call('/files/' + encodeURIComponent(video.key), 'GET', undefined, undefined, { Range: 'bytes=0-3' });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 4);
  assert.equal((await f.call('/files/' + encodeURIComponent(doc.key))).status, 401);
  assert.equal((await f.call('/files/' + encodeURIComponent(doc.key), 'GET', undefined, foreign)).status, 404);
  assert.equal((await f.call('/files/' + encodeURIComponent(doc.key), 'GET', undefined, owner)).status, 200);
  await assertPublicationPrivate(f, other, [otherPhoto]);
  const admin = (await (await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer')).json()).listings;
  assert.ok(admin.find((item) => item.id === listing.id).reviewActions.includes('acceptance-unpublish'));
  assert.equal(admin.find((item) => item.id === listing.id).reviewActions.includes('acceptance-approve'), false);
  assert.equal(admin.find((item) => item.id === other.id).reviewActions.includes('acceptance-approve'), false);
  assert.equal('reviewActions' in f.state().listings[listing.id], false);
  // Extending the server grant cannot extend a previously reviewed marker.
  f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({ ...scope, expiresAt: scope.expiresAt + 1 });
  await assertPublicationPrivate(f, listing, [photo, video]);
  assert.equal(f.state().listings[listing.id].acceptancePublicUntil, scope.expiresAt);
});

test('bounded rollback remains available after grant removal, flag disablement, edit or expiry', async (t) => {
  for (const change of ['grant removed', 'flag disabled', 'edited', 'expired'])
    await t.test(change, async () => {
      const { f, owner, listing } = await publicationFixture(false);
      const photo = await publicationFile(f, owner, listing, 'photos', 'retained.png', png);
      await submit(f, owner, listing);
      f.env.PUBLIC_LISTINGS_ENABLED = 'false';
      f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
      const original = currentPublicationListing(f, listing);
      const scope = grantPublication(f, original);
      assert.equal((await reviewPublication(f, original, 'acceptance-approve')).status, 200);
      if (change === 'grant removed') delete f.env.CLERK_ACCEPTANCE_SCOPE;
      if (change === 'flag disabled') f.env.CLERK_ACCEPTANCE_ENABLED = 'false';
      if (change === 'edited') {
        assert.equal((await f.call('/listings/' + listing.id, 'PUT', { model: 'After bounded review' }, owner)).status, 200);
        const beforeStale = publicationState(f);
        assert.equal((await reviewPublication(f, original, 'acceptance-unpublish')).status, 409);
        assert.deepEqual(publicationState(f), beforeStale);
      }
      if (change === 'expired') {
        // Seed an expired retained record, then reload the actual store.
        const expiresAt = Date.now() - 1;
        f.state().listings[listing.id].acceptancePublicUntil = expiresAt;
        f.env.CLERK_ACCEPTANCE_SCOPE = JSON.stringify({ ...scope, expiresAt });
        f.restart();
      }
      await assertPublicationPrivate(f, listing, [photo]);
      const current = currentPublicationListing(f, listing);
      const before = publicationState(f);
      assert.equal((await reviewPublication(f, current, 'acceptance-unpublish')).status, 200);
      const after = f.state().listings[listing.id];
      assert.equal(after.status, current.status);
      assert.equal(after.revision, current.revision);
      assert.deepEqual(after.fields, current.fields);
      assert.equal(after.acceptancePublicUntil, undefined);
      assert.equal(after.acceptanceApprovedRevision, undefined);
      assert.deepEqual(f.state().files, before.files);
      assert.ok(f.objects.has(photo.key));
      assert.equal(f.state().audit.at(-1).action, 'acceptance-publication-rollback');
      assert.equal((await reviewPublication(f, current, 'acceptance-unpublish')).status, 409);
      f.restart();
      await assertPublicationPrivate(f, listing, [photo]);
      assert.equal((await f.call('/listing/' + listing.id, 'GET', undefined, owner)).status, 200);
      assert.equal(f.state().listings[listing.id].acceptancePublicUntil, undefined);
    });
});

test('staff unpublish revokes active, paused and sold approval without deleting listing or media', async (t) => {
  for (const status of ['active', 'paused', 'sold'])
    await t.test(status, async () => {
      const { f, owner, listing } = await publicationFixture(false);
      const photo = await publicationFile(f, owner, listing, 'photos', 'preserved.png', png);
      const doc = await publicationFile(f, owner, listing, 'airframe', 'preserved.pdf', pdf);
      await submit(f, owner, listing);
      const approved = currentPublicationListing(f, listing);
      // Retain a genuine earlier bounded marker to prove ordinary removal clears both modes.
      f.env.PUBLIC_LISTINGS_ENABLED = 'false';
      f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
      grantPublication(f, approved);
      assert.equal((await reviewPublication(f, approved, 'acceptance-approve')).status, 200);
      f.env.PUBLIC_LISTINGS_ENABLED = 'true';
      assert.equal((await approve(f, approved)).status, 200);
      if (status !== 'active')
        assert.equal((await f.call('/listing/' + listing.id + '/status', 'POST', { status }, owner)).status, 200);
      const current = currentPublicationListing(f, listing);
      const before = publicationState(f);
      const objects = structuredClone([...f.objects]);
      f.env.PUBLIC_LISTINGS_ENABLED = 'false';
      delete f.env.CLERK_ACCEPTANCE_SCOPE;
      const admin = await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer');
      assert.ok((await admin.json()).listings.find((item) => item.id === listing.id).reviewActions.includes('unpublish'));
      assert.equal((await reviewPublication(f, current, 'unpublish')).status, 200);
      const removed = currentPublicationListing(f, listing);
      assert.equal(removed.status, 'draft');
      assert.equal(removed.revision, current.revision + 1);
      assert.equal(removed.approvedRevision, null);
      assert.equal(removed.acceptanceApprovedRevision, undefined);
      assert.equal(removed.acceptancePublicUntil, undefined);
      assert.deepEqual(removed.fields, current.fields);
      assert.deepEqual(f.state().files, before.files);
      assert.deepEqual([...f.objects], objects);
      assert.equal(f.state().audit.at(-1).action, 'unpublish');
      assert.equal(f.state().audit.at(-1).actor, 'fixture-admin');
      await assertPublicationPrivate(f, listing, [photo]);
      assert.equal((await f.call('/files/' + encodeURIComponent(doc.key), 'GET', undefined, owner)).status, 200);
      f.restart();
      await assertPublicationPrivate(f, listing, [photo]);
      assert.equal(f.state().listings[listing.id].approvedRevision, null);
      f.env.PUBLIC_LISTINGS_ENABLED = 'true';
      for (const requested of ['active', 'paused', 'sold'])
        assert.equal((await f.call('/listing/' + listing.id + '/status', 'POST', { status: requested }, owner)).status, 409);
      const unchanged = publicationState(f);
      assert.equal((await reviewPublication(f, current, 'unpublish')).status, 409);
      assert.equal((await approve(f, current)).status, 409);
      assert.equal((await reviewPublication(f, removed, 'unpublish')).status, 409);
      assert.equal((await approve(f, removed)).status, 409);
      assert.deepEqual(publicationState(f), unchanged);
      assert.equal((await submit(f, owner, removed)).status, 200);
      assert.equal((await approve(f, current)).status, 409);
      assert.equal((await approve(f, currentPublicationListing(f, listing))).status, 200);
      assert.equal((await f.call('/listing/' + listing.id)).status, 200);
    });
});

test('ordinary unpublish rejects private, unknown and purging states without mutation', async (t) => {
  for (const status of ['draft', 'pending', 'rejected', 'archived', 'deleted', 'missing', 'purging'])
    await t.test(status, async () => {
      const { f, owner, listing } = await publicationFixture(false);
      if (['pending', 'rejected', 'purging'].includes(status)) await submit(f, owner, listing);
      if (status === 'rejected') assert.equal((await reviewPublication(f, listing, 'reject')).status, 200);
      if (['archived', 'deleted'].includes(status))
        assert.equal((await f.call('/listing/' + listing.id + '/status', 'POST', { status }, owner)).status, 200);
      if (status === 'purging') {
        assert.equal((await approve(f, listing)).status, 200);
        f.state().listings[listing.id].purging = true;
        f.restart();
      }
      const current = currentPublicationListing(f, listing);
      const target = status === 'missing' ? { ...current, id: 'missing-listing' } : current;
      const before = publicationState(f);
      assert.equal((await reviewPublication(f, target, 'unpublish')).status, status === 'missing' ? 404 : 409);
      assert.deepEqual(publicationState(f), before);
      const admin = await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer');
      if (status !== 'missing')
        assert.equal((await admin.json()).listings.find((item) => item.id === listing.id).reviewActions.includes('unpublish'), false);
    });
});

test('field edits, uploads, reorders and file deletion invalidate ordinary and bounded publication', async (t) => {
  for (const mode of ['ordinary', 'bounded'])
    for (const mutation of ['edit', 'upload', 'reorder', 'delete-file'])
      await t.test(mode + ': ' + mutation, async () => {
        const { f, owner, listing } = await publicationFixture(false);
        const one = await publicationFile(f, owner, listing, 'photos', 'one.png', png);
        const two = await publicationFile(f, owner, listing, 'photos', 'two.png', png);
        await submit(f, owner, listing);
        const old = currentPublicationListing(f, listing);
        if (mode === 'bounded') {
          f.env.PUBLIC_LISTINGS_ENABLED = 'false';
          f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
          grantPublication(f, old);
        }
        const decision = mode === 'bounded' ? 'acceptance-approve' : 'approve';
        assert.equal((await reviewPublication(f, old, decision)).status, 200);
        assert.equal((await f.call('/listing/' + listing.id)).status, 200);
        let response;
        if (mutation === 'edit') response = await f.call('/listings/' + listing.id, 'PUT', { model: 'New revision' }, owner);
        if (mutation === 'upload') response = await f.call('/upload?listingId=' + listing.id + '&category=videos&filename=new.mp4', 'POST', mp4, owner);
        if (mutation === 'reorder') response = await f.call('/listings/' + listing.id + '/photos/order', 'PUT', { order: [two.key, one.key] }, owner);
        if (mutation === 'delete-file') response = await f.call('/delete-file', 'POST', { listingId: listing.id, category: 'photos', fileKey: one.key }, owner);
        assert.equal(response.status, 200);
        const current = currentPublicationListing(f, listing);
        assert.equal(current.revision, old.revision + 1);
        assert.equal(current.status, 'draft');
        await assertPublicationPrivate(f, listing, [two]);
        const beforeStale = publicationState(f);
        assert.equal((await reviewPublication(f, old, decision)).status, 409);
        assert.deepEqual(publicationState(f), beforeStale);
        assert.equal((await submit(f, owner, current)).status, 200);
        if (mode === 'bounded') {
          assert.equal((await reviewPublication(f, current, decision)).status, 409);
          grantPublication(f, current);
        }
        assert.equal((await reviewPublication(f, current, decision)).status, 200);
        assert.equal((await f.call('/listing/' + listing.id)).status, 200);
      });
});

test('publication and removal commit durably; failed saves cannot report or retain success', async (t) => {
  for (const decision of ['approve', 'acceptance-approve', 'unpublish', 'acceptance-unpublish'])
    await t.test(decision, async () => {
      const { f, listing } = await publicationFixture();
      if (decision.startsWith('acceptance-')) {
        f.env.PUBLIC_LISTINGS_ENABLED = 'false';
        f.env.CLERK_ACCEPTANCE_ENABLED = 'true';
        grantPublication(f, listing);
      }
      if (decision === 'unpublish') assert.equal((await approve(f, listing)).status, 200);
      if (decision === 'acceptance-unpublish')
        assert.equal((await reviewPublication(f, listing, 'acceptance-approve')).status, 200);
      const current = currentPublicationListing(f, listing);
      const before = publicationState(f);
      f.storageFailure(true);
      assert.equal((await reviewPublication(f, current, decision)).status, 503);
      assert.deepEqual(publicationState(f), before);
      f.storageFailure(false);
      f.restart();
      assert.equal((await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer')).status, 200);
      assert.deepEqual(publicationState(f), before);
      assert.equal((await reviewPublication(f, current, decision)).status, 200);
      const committed = publicationState(f);
      f.restart();
      assert.equal((await f.call('/admin/listings', 'GET', undefined, 'fixture-reviewer')).status, 200);
      assert.deepEqual(publicationState(f), committed);
      if (['unpublish', 'acceptance-unpublish'].includes(decision)) await assertPublicationPrivate(f, listing);
      else assert.equal((await f.call('/listing/' + listing.id)).status, 200);
    });
});
