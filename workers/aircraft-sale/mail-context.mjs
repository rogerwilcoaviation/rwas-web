// This context travels only through Pages -> WorkerEntrypoint RPC, never a
// public HTTP header. Its proofs are used in memory and are not ticket data.
export const SELLER_MAIL_PRODUCTION_ORIGIN =
  'https://www.rogerwilcoaviation.com';

export function validateMailContext(context) {
  const modern =
    context &&
    typeof context === 'object' &&
    Object.getOwnPropertyDescriptor(context, 'schema')?.value === 2;
  const keys = modern
    ? ['schema', 'origin', 'authorization', 'cookie', 'csrf']
    : ['schema', 'origin', 'authorization', 'clerkSessionToken', 'csrf'];
  if (
    !context ||
    Object.getPrototypeOf(context) !== Object.prototype ||
    Reflect.ownKeys(context).length !== keys.length ||
    keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(context, key);
      return !descriptor || !('value' in descriptor) || !descriptor.enumerable;
    }) ||
    context.schema !== (modern ? 2 : 1) ||
    context.origin !== SELLER_MAIL_PRODUCTION_ORIGIN ||
    typeof context.authorization !== 'string' ||
    !/^Bearer [A-Za-z0-9_-]{20,256}$/.test(context.authorization) ||
    typeof context.csrf !== 'string' ||
    !/^[A-Za-z0-9_-]{20,256}$/.test(context.csrf) ||
    (modern
      ? typeof context.cookie !== 'string' ||
        context.cookie.length > 8192 ||
        !/^(?:__Secure-)?rwas-seller\.session_token=[A-Za-z0-9%._~+=\/-]+$/.test(
          context.cookie,
        )
      : typeof context.clerkSessionToken !== 'string' ||
        context.clerkSessionToken.length > 16384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
          context.clerkSessionToken,
        ))
  )
    throw Object.assign(new Error('Verification session proof rejected.'), {
      status: 403,
    });
  return Object.fromEntries(keys.map((key) => [key, context[key]]));
}

export function mailContextFromRequest(request) {
  if (!request.headers.has('X-Clerk-Session-Token')) {
    // Forward only this application's HttpOnly session cookie. Cloudflare
    // Access and unrelated site cookies never enter the private mail context.
    const cookies = (request.headers.get('Cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) =>
        /^(?:__Secure-)?rwas-seller\.session_token=/.test(part),
      );
    if (cookies.length !== 1)
      throw Object.assign(new Error('Verification session proof rejected.'), {
        status: 403,
      });
    return validateMailContext({
      schema: 2,
      origin: new URL(request.url).origin,
      authorization: request.headers.get('Authorization') || '',
      cookie: cookies[0],
      csrf: request.headers.get('X-RWAS-CSRF') || '',
    });
  }
  return validateMailContext({
    schema: 1,
    origin: new URL(request.url).origin,
    authorization: request.headers.get('Authorization') || '',
    clerkSessionToken: request.headers.get('X-Clerk-Session-Token') || '',
    csrf: request.headers.get('X-RWAS-CSRF') || '',
  });
}

export function mailAuthenticationRequest(context, authorization) {
  const proof = validateMailContext(context);
  if (proof.authorization !== authorization)
    throw Object.assign(new Error('Verification session proof rejected.'), {
      status: 403,
    });
  return new Request(proof.origin + '/api/aircraft-sale/account/email-code', {
    method: 'POST',
    headers: {
      Origin: proof.origin,
      Authorization: proof.authorization,
      ...(proof.schema === 1
        ? { 'X-Clerk-Session-Token': proof.clerkSessionToken }
        : {}),
      'X-RWAS-CSRF': proof.csrf,
      ...(proof.schema === 2 ? { Cookie: proof.cookie } : {}),
    },
  });
}
