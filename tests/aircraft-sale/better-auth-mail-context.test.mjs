import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mailContextFromRequest,
  mailAuthenticationRequest,
  validateMailContext,
} from '../../workers/aircraft-sale/mail-context.mjs';
const origin = 'https://www.rogerwilcoaviation.com';
const authorization = 'Bearer ' + 'a'.repeat(32);
const csrf = 'c'.repeat(32);
const cookie = '__Secure-rwas-seller.session_token=nonsecret.fixture%3D';
const request = (cookies = cookie, extra = {}) =>
  new Request(origin + '/api/aircraft-sale/account/email-code', {
    method: 'POST',
    headers: {
      Origin: origin,
      Authorization: authorization,
      'X-RWAS-CSRF': csrf,
      Cookie: cookies,
      ...extra,
    },
  });
test('mail RPC transports only the seller identity cookie and bound opaque/CSRF proofs', () => {
  const context = mailContextFromRequest(
    request('CF_Authorization=unrelated; ' + cookie + '; tracking=unrelated'),
  );
  assert.deepEqual(context, { schema: 2, origin, authorization, cookie, csrf });
  const authenticated = mailAuthenticationRequest(context, authorization);
  assert.equal(authenticated.headers.get('Cookie'), cookie);
  assert.equal(authenticated.headers.get('X-RWAS-CSRF'), csrf);
  assert.equal(authenticated.headers.has('X-Clerk-Session-Token'), false);
  assert.throws(() =>
    mailAuthenticationRequest(context, 'Bearer ' + 'b'.repeat(32)),
  );
});
test('mail context rejects absent, duplicate, unrelated and malformed session cookies', () => {
  for (const cookies of [
    '',
    'CF_Authorization=unrelated',
    cookie + '; ' + cookie,
    cookie + '; rwas-seller.session_token=other',
  ])
    assert.throws(() => mailContextFromRequest(request(cookies)));
  const context = mailContextFromRequest(request());
  assert.throws(() =>
    validateMailContext({ ...context, cookie: 'CF_Authorization=unrelated' }),
  );
  assert.throws(() => validateMailContext({ ...context, extra: 'unapproved' }));
  assert.throws(() =>
    validateMailContext({ ...context, origin: 'https://untrusted.example' }),
  );
});
test('mail context rejects property accessors without executing them', () => {
  let read = false;
  const candidate = { origin, authorization, cookie, csrf };
  Object.defineProperty(candidate, 'schema', {
    enumerable: true,
    get() {
      read = true;
      return 2;
    },
  });
  assert.throws(() => validateMailContext(candidate));
  assert.equal(read, false);
});
