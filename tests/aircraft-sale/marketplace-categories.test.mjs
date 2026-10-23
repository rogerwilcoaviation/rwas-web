import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanListing } from '../../workers/aircraft-sale/listing-fields.mjs';
import {
  categoryFields,
  listingCategories,
  listingFormValues,
  listingPayload,
  newListingFields,
} from '../../lib/marketplace/schema.mjs';
import { SellerStore } from '../../workers/aircraft-sale/worker.mjs';
import { fixture, png } from './fixture.mjs';

const complete = (category) => ({
  listingType: category.type,
  category: category.id,
  title: 'Synthetic listing',
  make: 'Synthetic',
  model: 'Fixture',
  year: 2000,
  condition: category.type === 'parts' ? 'Serviceable' : 'Used',
  quantity: '2',
  unitOfSale: 'each',
  partNumber: 'PN-123',
  hangarType: 'Box / rectangular',
  airport: 'Synthetic Airport',
  sellerLocation: 'Synthetic location',
  description: 'Synthetic test listing only.',
  transactionType: 'sale',
  currency: 'USD',
  priceMode: 'on-request',
  specifications: {},
});
const json = async (r, status = 200) => {
  assert.equal(r.status, status, await r.clone().text());
  return r.json();
};

test('all researched categories and seven tool categories have bounded, distinct schemas', () => {
  assert.equal(listingCategories.length, 87);
  assert.equal(new Set(listingCategories.map((c) => c.id)).size, 87);
  for (const c of listingCategories) {
    const values = complete(c);
    assert.equal(cleanListing(values, true).category, c.id);
    const fields = newListingFields(values, [
      { name: 'make', required: true },
      { name: 'model', required: true },
      { name: 'year', required: true },
      { name: 'sellerLocation', required: true },
      { name: 'description', required: true },
    ]);
    assert.equal(
      new Set(fields.map((f) => f.name)).size,
      fields.length,
      c.id + ' must not ask duplicate questions',
    );
    if (c.type === 'hangars')
      assert.ok(
        fields.every(
          (f) =>
            !['nNumber', 'engineTime', 'make', 'model', 'year'].includes(
              f.name,
            ),
        ),
      );
    for (const field of categoryFields(values))
      assert.ok(field.name.startsWith('spec:'));
  }
});
test('category, mandatory data, price, units and specification allowlists are validated by the service', () => {
  const hangar = complete(listingCategories.find((c) => c.type === 'hangars'));
  assert.throws(
    () => cleanListing({ ...hangar, airport: '' }, true),
    /airport is required/,
  );
  assert.throws(
    () => cleanListing({ ...hangar, category: 'jet-aircraft' }, true),
    /category/,
  );
  assert.throws(
    () =>
      cleanListing(
        { ...hangar, specifications: { 'engine-1-time': '100' } },
        true,
      ),
    /Unsupported/,
  );
  assert.throws(
    () => cleanListing({ ...hangar, currency: 'BAD' }, true),
    /Invalid currency/,
  );
  assert.throws(
    () => cleanListing({ ...hangar, priceMode: 'amount', price: 0 }, true),
    /required|positive/,
  );
  const key = categoryFields(hangar)[0].name.slice(5);
  const saved = cleanListing(
    { ...hangar, specifications: { [key]: '<script>test</script>' } },
    true,
  );
  assert.equal(saved.specifications[key], '<script>test</script>');
  const roundtrip = listingPayload(listingFormValues(saved, []));
  assert.deepEqual(roundtrip.specifications, saved.specifications);
  const part = complete(listingCategories.find((c) => c.type === 'parts'));
  assert.throws(
    () => cleanListing({ ...part, partNumber: '' }, true),
    /partNumber/,
  );
  assert.throws(
    () => cleanListing({ ...part, quantity: '-1' }, true),
    /quantity/,
  );
  assert.throws(
    () => cleanListing({ ...part, condition: 'Used' }, true),
    /condition/,
  );
});
test('each listing family saves, resumes, submits, and renders its approved public details', async () => {
  const f = fixture(),
    owner = await f.login();
  for (const type of ['aircraft', 'parts', 'tools', 'hangars', 'other']) {
    const c = listingCategories.find((c) => c.type === type),
      values = complete(c);
    const spec = categoryFields(values).find(
      (f) => !f.options && f.type !== 'number',
    );
    if (spec)
      values.specifications[spec.name.slice(5)] = '<b>Seller detail</b>';
    const l = (
      await json(
        await f.call('/listings', 'POST', values, owner, {
          'Idempotency-Key': crypto.randomUUID(),
        }),
        201,
      )
    ).listing;
    const resumed = (
      await json(await f.call('/my-listings', 'GET', undefined, owner))
    ).listings.find((item) => item.id === l.id);
    assert.deepEqual(resumed.specifications, values.specifications);
    await json(
      await f.call(
        '/listing/' + l.id + '/status',
        'POST',
        { status: 'pending' },
        owner,
      ),
    );
    assert.equal((await json(await f.call('/browse'))).listings.length, 0);
    await json(
      await f.call(
        '/admin/review',
        'POST',
        { listingId: l.id, revision: l.revision, decision: 'approve' },
        'fixture-reviewer',
      ),
    );
    const r = await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
      Accept: 'text/html',
    });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Price on request/);
    if (spec) assert.match(html, /&lt;b&gt;Seller detail&lt;\/b&gt;/);
    if (type === 'hangars') {
      assert.match(html, /Synthetic Airport/);
      assert.doesNotMatch(html, /<h3>Avionics/);
    }
    await json(
      await f.call(
        '/admin/listings/' + l.id,
        'DELETE',
        { revision: l.revision, confirm: l.id },
        'fixture-reviewer',
      ),
    );
    assert.equal(
      (
        await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
          Accept: 'text/html',
        })
      ).status,
      404,
    );
  }
});

async function adminFixture() {
  const f = fixture(),
    identities = new Map();
  Object.assign(f.env, {
    BETTER_AUTH_ENABLED: 'true',
    BETTER_AUTH_LOCAL: 'true',
    BETTER_AUTH_URL: 'http://localhost',
    BETTER_AUTH_SECRET: 'synthetic-fixture-secret-long-enough-123',
    BETTER_AUTH_ADMIN_USER_IDS: 'immutable-admin',
    ACCOUNT_ADMIN_SITE_ORIGIN: 'http://localhost',
    SELLER_AUTH_DB: {
      prepare() {
        throw Error('No real database');
      },
    },
  });
  for (const [cookie, subject, email] of [
    ['admin', 'immutable-admin', 'admin@rwas.team'],
    ['seller', 'seller-id', 'seller@example.test'],
    ['reserved', 'reserved-id', 'other@example.test'],
  ])
    identities.set(cookie, {
      issuer: 'rwas-better-auth',
      subject,
      providerSessionId: cookie + '-session',
      email,
      emailVerified: true,
      name: 'Synthetic',
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 86400000,
    });
  const store = new SellerStore(f.ctx, f.env, {
    readBetterAuthIdentity: async (_env, req) =>
      identities.get(req.headers.get('Cookie')) || null,
  });
  const call = (...args) => store.fetch(f.request(...args));
  const login = async (cookie) =>
    json(
      await call('/auth/better-auth', 'POST', {}, undefined, {
        Origin: 'http://localhost',
        Cookie: cookie,
      }),
    );
  const admin = await login('admin'),
    seller = await login('seller');
  const headers = (cookie) => ({
    Origin: 'http://localhost',
    Cookie: cookie,
    'X-RWAS-CSRF': (cookie === 'admin' ? admin : seller).csrf,
  });
  return { ...f, call, identities, admin, seller, headers };
}
test('immutable admin identity receives admin workspace access, cannot list, and sellers cannot escalate', async () => {
  const f = await adminFixture();
  assert.equal(
    (
      await json(
        await f.call(
          '/account/access',
          'GET',
          undefined,
          f.admin.session,
          f.headers('admin'),
        ),
      )
    ).role,
    'admin',
  );
  for (const path of ['/staff/listings','/staff/accounts','/staff/support']) {
    assert.equal((await f.call(path,'GET',undefined,f.admin.session,f.headers('admin'))).status,200);
    assert.equal((await f.call(path,'GET',undefined,f.seller.session,f.headers('seller'))).status,403);
    assert.equal((await f.call(path,'GET',undefined,'fixture-reviewer',{Origin:'http://localhost'})).status,403);
  }
  assert.equal((await f.call('/staff/listings','GET',undefined,undefined,{Cookie:'admin'})).status,403);
  assert.equal(
    (
      await json(
        await f.call(
          '/account/access',
          'GET',
          undefined,
          f.seller.session,
          f.headers('seller'),
        ),
      )
    ).role,
    'seller',
  );
  for (const [path, method, body] of [
    ['/listings', 'POST', {}],
    ['/draft', 'PUT', {}],
    [
      '/intake',
      'POST',
      { messages: [{ role: 'user', content: 'list my aircraft' }] },
    ],
    ['/my-listings', 'GET', undefined],
  ])
    assert.equal(
      (await f.call(path, method, body, f.admin.session, f.headers('admin')))
        .status,
      403,
    );
  for (const path of ['/admin/listings', '/admin/accounts', '/admin/support'])
    assert.equal(
      (
        await f.call(
          path,
          'GET',
          undefined,
          f.seller.session,
          f.headers('seller'),
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await f.call(
        '/admin/listings',
        'GET',
        undefined,
        f.admin.session,
        f.headers('admin'),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call('/admin/listings', 'GET', undefined, f.admin.session, {
        ...f.headers('admin'),
        'X-RWAS-CSRF': 'forged',
      })
    ).status,
    403,
  );
  f.identities.get('admin').providerSessionId = 'replaced';
  assert.equal(
    (
      await f.call(
        '/admin/listings',
        'GET',
        undefined,
        f.admin.session,
        f.headers('admin'),
      )
    ).status,
    401,
  );
});

test('private staff media requires the configured MFA identity and obeys local logout fences',async()=>{
  const f=await adminFixture(),values=complete(listingCategories.find(c=>c.type==='parts'));
  const l=(await json(await f.call('/listings','POST',values,f.seller.session,{...f.headers('seller'),'Idempotency-Key':'staff-file'}),201)).listing;
  const file=(await json(await f.call('/upload?listingId='+l.id+'&category=photos&filename=synthetic.png','POST',png,f.seller.session,f.headers('seller')))).file;
  const path='/staff/files/'+encodeURIComponent(file.key);
  assert.equal((await f.call(path,'GET',undefined,undefined,{Cookie:'admin'})).status,200);
  assert.equal((await f.call(path,'GET',undefined,undefined,{Cookie:'seller'})).status,403);
  assert.equal((await f.call(path,'GET',undefined,undefined,{Cookie:'admin','Sec-Fetch-Site':'cross-site'})).status,403);
  await json(await f.call('/logout','POST',{},f.admin.session,f.headers('admin')));
  assert.equal((await f.call(path,'GET',undefined,undefined,{Cookie:'admin'})).status,403);
});
test('admin edits invalidate publication and reject stale revisions; support replies stay within the owning account', async () => {
  const f = await adminFixture(),
    values = complete(listingCategories.find((c) => c.type === 'hangars'));
  const l = (
    await json(
      await f.call('/listings', 'POST', values, f.seller.session, {
        ...f.headers('seller'),
        'Idempotency-Key': 'create-hangar',
      }),
      201,
    )
  ).listing;
  await json(
    await f.call(
      '/listing/' + l.id + '/status',
      'POST',
      { status: 'pending' },
      f.seller.session,
      f.headers('seller'),
    ),
  );
  await json(
    await f.call(
      '/admin/review',
      'POST',
      { listingId: l.id, revision: l.revision, decision: 'approve' },
      f.admin.session,
      f.headers('admin'),
    ),
  );
  const edited = (
    await json(
      await f.call(
        '/admin/listings/' + l.id,
        'PUT',
        {
          revision: l.revision,
          fields: { ...values, title: 'Changed by support' },
        },
        f.admin.session,
        f.headers('admin'),
      ),
    )
  ).listing;
  assert.equal(edited.status, 'draft');
  assert.equal(edited.approvedRevision, null);
  assert.equal(
    (
      await f.call('/listing/' + l.id, 'GET', undefined, undefined, {
        Accept: 'text/html',
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call(
        '/admin/listings/' + l.id,
        'DELETE',
        { revision: l.revision, confirm: l.id },
        f.admin.session,
        f.headers('admin'),
      )
    ).status,
    409,
  );
  const ticket = (
    await json(
      await f.call(
        '/support',
        'POST',
        { subject: 'Synthetic request', message: 'Please help with my draft.' },
        f.seller.session,
        f.headers('seller'),
      ),
      201,
    )
  ).ticket;
  await json(
    await f.call(
      '/admin/support/' + ticket.id,
      'PATCH',
      {
        revision: ticket.revision,
        status: 'resolved',
        reply: 'Your draft is ready for review.',
      },
      f.admin.session,
      f.headers('admin'),
    ),
  );
  const own = await json(
    await f.call(
      '/support',
      'GET',
      undefined,
      f.seller.session,
      f.headers('seller'),
    ),
  );
  assert.equal(own.tickets[0].messages[1].from, 'support');
  assert.equal(
    (
      await f.call(
        '/admin/support/' + ticket.id,
        'PATCH',
        { revision: 1, status: 'resolved', reply: 'Stale' },
        f.admin.session,
        f.headers('admin'),
      )
    ).status,
    409,
  );
});
test('deleting a user revokes sessions, hides listings, is audited and can be restored without republishing', async () => {
  const f = await adminFixture(),
    values = complete(listingCategories.find((c) => c.type === 'parts'));
  const l = (
    await json(
      await f.call('/listings', 'POST', values, f.seller.session, {
        ...f.headers('seller'),
        'Idempotency-Key': 'delete-user-listing',
      }),
      201,
    )
  ).listing;
  const directory = await json(
    await f.call(
      '/admin/accounts',
      'GET',
      undefined,
      f.admin.session,
      f.headers('admin'),
    ),
  );
  const account = directory.accounts.find(
    (a) => a.email === 'seller@example.test',
  );
  const input = {
    id: crypto.randomUUID(),
    operation: 'delete-account',
    reasonCode: 'support-request',
  };
  const preview = await json(
    await f.call(
      '/admin/accounts/' + account.id + '/preview',
      'POST',
      input,
      f.admin.session,
      f.headers('admin'),
    ),
  );
  await json(
    await f.call(
      '/admin/accounts/' + account.id + '/apply',
      'POST',
      { ...input, confirmation: preview.confirmation },
      f.admin.session,
      f.headers('admin'),
    ),
  );
  assert.equal(
    (
      await f.call(
        '/account',
        'GET',
        undefined,
        f.seller.session,
        f.headers('seller'),
      )
    ).status,
    401,
  );
  assert.equal(f.state().listings[l.id].status, 'deleted');
  assert.ok(f.state().profiles[account.id].adminDeleted);
  assert.ok(f.state().audit.some((e) => e.operation === 'delete-account'));
  const restore = {
    id: crypto.randomUUID(),
    operation: 'restore-account',
    reasonCode: 'support-request',
  };
  const proposal = await json(
    await f.call(
      '/admin/accounts/' + account.id + '/preview',
      'POST',
      restore,
      f.admin.session,
      f.headers('admin'),
    ),
  );
  await json(
    await f.call(
      '/admin/accounts/' + account.id + '/apply',
      'POST',
      { ...restore, confirmation: proposal.confirmation },
      f.admin.session,
      f.headers('admin'),
    ),
  );
  assert.equal(f.state().profiles[account.id].adminDeleted, false);
  assert.equal(f.state().listings[l.id].status, 'deleted');
});
