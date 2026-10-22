import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const root = new URL('../../', import.meta.url).pathname;
const bundled = await build({
  stdin: { contents: 'export * from "./app/aircraft-for-sale/clerk-qa-cohort.ts"; export * from "./app/aircraft-for-sale/clerk-production-browser.ts";', resolveDir: root, loader: 'ts' },
  write: false, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'unused-local-ui', setup(builder) {
    builder.onResolve({ filter: /^\.\/clerk-production-ui$/ }, () => ({ path: 'fixture', namespace: 'qa-ui' }));
    builder.onLoad({ filter: /.*/, namespace: 'qa-ui' }, () => ({ contents: 'export function loadClerkProductionUi() { throw new Error("Unexpected UI load"); }' }));
  } }],
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const [emailA, emailB] = api.CLERK_QA_EMAILS;
const origin = 'https://www.rogerwilcoaviation.com';
const search = (email) => '?' + new URLSearchParams({ 'seller-qa-email': email });
const enable = (email = emailA) => api.configureClerkProductionQaCohort({ clerkQaOnly: true, clerkQaEmail: email }, search(email));
const location = { origin, hostname: 'www.rogerwilcoaviation.com', protocol: 'https:', port: '' };
globalThis.window = { location };

function fixture(email = emailA, accountEmail = email) {
  const state = { tokens: 0, requests: 0, profiles: 0, signOuts: 0, mounts: [] };
  const token = ['e30', Buffer.from(JSON.stringify({ azp: origin })).toString('base64url'), 'fixture'].join('.');
  const clerk = {
    session: { id: 'fixture-session', async getToken() { state.tokens++; return token; } },
    user: { primaryEmailAddress: { emailAddress: email } },
    mountSignUp(element, options) { state.mounts.push({ kind: 'sign-up', options }); },
    mountSignIn(element, options) { state.mounts.push({ kind: 'sign-in', options }); },
    unmountSignUp() {}, unmountSignIn() {},
    openUserProfile() { state.profiles++; }, closeUserProfile() {},
    async signOut() { state.signOuts++; },
  };
  const request = async (path) => {
    state.requests++;
    return new Response(JSON.stringify(path.endsWith('/start') ? { nonce: 'fixture-nonce' } : path.endsWith('/finish') ? { session: 'fixture-rwas-session', csrf: 'fixture-csrf' } : { profile: { email: accountEmail, name: 'Fixture' } }), { status: 200 });
  };
  return { state, clerk, client: new api.ClerkProductionBrowser(clerk, request) };
}

test.afterEach(() => api.configureClerkProductionQaCohort({}, ''));

test('only one exact explicit alias becomes a public methods selector', () => {
  for (const email of [emailA, emailB]) {
    assert.equal(api.clerkQaEmailFromSearch(search(email)), email);
    assert.deepEqual(api.clerkQaMethodsHeaders(search(email)), { 'X-RWAS-QA-Email': email });
  }
  for (const query of ['', search('customer@example.test'), search(emailA.toUpperCase()), search(' ' + emailA), search(emailA) + '&seller-qa-email=' + encodeURIComponent(emailB)]) {
    assert.equal(api.clerkQaEmailFromSearch(query), null);
    assert.equal(api.clerkQaMethodsHeaders(query), undefined);
  }
});

test('QA interface requires matching server acceptance and hint; production mode is unchanged', () => {
  assert.deepEqual(api.selectClerkQaCohort({}, search(emailA)), { qaOnly: false, email: null });
  assert.deepEqual(api.selectClerkQaCohort({ clerkQaOnly: true }, search(emailA)), { qaOnly: true, email: null });
  assert.deepEqual(api.selectClerkQaCohort({ clerkQaOnly: true, clerkQaEmail: emailB }, search(emailA)), { qaOnly: true, email: null });
  assert.deepEqual(api.selectClerkQaCohort({ clerkQaOnly: true, clerkQaEmail: emailA }, ''), { qaOnly: true, email: null });
  assert.deepEqual(enable(), { qaOnly: true, email: emailA });
});

test('both widget modes prefill the alias and preserve it on signup and recovery handoff', () => {
  for (const email of [emailA, emailB]) {
    enable(email);
    const { client, state } = fixture(email);
    client.mountAuthentication({}, search(email));
    client.mountAuthentication({}, search(email) + '&seller-auth=sign-up');
    assert.deepEqual(state.mounts.map(({ kind }) => kind), ['sign-in', 'sign-up']);
    for (const { options } of state.mounts) {
      assert.deepEqual(options.initialValues, { emailAddress: email });
      for (const [name, value] of Object.entries(options)) if (name.endsWith('Url')) {
        assert.equal(new URL(value).origin, origin);
        assert.equal(new URL(value).searchParams.get('seller-qa-email'), email);
      }
    }
    // Prefill is editable; provider policy is a separate signup restriction.
    assert.throws(() => client.mountAuthentication({}, search(email === emailA ? emailB : emailA)), /unavailable/);
  }
});

test('production widget redirects are preserved when acceptance is disabled', () => {
  api.configureClerkProductionQaCohort({}, '');
  const { client, state } = fixture('customer@example.test');
  client.mountAuthentication({}, '');
  assert.equal(state.mounts[0].options.forceRedirectUrl, origin + '/aircraft-for-sale?seller-auth=complete');
  assert.equal(state.mounts[0].options.signUpUrl, origin + '/aircraft-for-sale?seller-auth=sign-up');
  assert.equal(state.mounts[0].options.initialValues, undefined);
});

test('missing acceptance rejects before SDK construction or widget mounting', async () => {
  api.configureClerkProductionQaCohort({ clerkQaOnly: true }, '');
  let constructed = 0;
  await assert.rejects(api.getClerkProductionBrowser({ location, ClerkConstructor: class { constructor() { constructed++; } } }), /unavailable/);
  assert.equal(constructed, 0);
  const { client, state } = fixture();
  assert.throws(() => client.mountAuthentication({}, search(emailA)), /unavailable/);
  assert.equal(state.mounts.length, 0);
});

test('wrong cached provider identity cannot obtain token, handoff, profile or sign-out', async () => {
  enable();
  const { client, state } = fixture('customer@example.test');
  await assert.rejects(client.token(), /does not match/);
  await assert.rejects(client.connect(), /does not match/);
  assert.throws(() => client.openAccount({}), /does not match/);
  await assert.rejects(client.signOut(), /does not match/);
  assert.deepEqual(state, { tokens: 0, requests: 0, profiles: 0, signOuts: 0, mounts: [] });
});

test('matching QA fixture completes handoff but cannot enter owner-account linking', async () => {
  enable();
  const { client, state } = fixture();
  assert.equal((await client.connect()).email, emailA);
  assert.equal(state.requests, 3);
  await assert.rejects(client.link({ token: 'fixture-owner', email: emailA, name: '' }), /unavailable/);
  await assert.rejects(client.startOwnerReauthentication(), /unavailable/);
  await assert.rejects(client.finishOwnerReauthentication({}, null, null), /unavailable/);
  assert.equal(state.requests, 3);
  client.openAccount({});
  await client.signOut();
  assert.equal(state.profiles, 1);
  assert.equal(state.signOuts, 1);
});

test('QA handoff refuses a mismatched RWAS account response', async () => {
  enable();
  const { client, state } = fixture(emailA, 'customer@example.test');
  await assert.rejects(client.connect(), /account does not match/);
  assert.equal(state.requests, 3);
});
