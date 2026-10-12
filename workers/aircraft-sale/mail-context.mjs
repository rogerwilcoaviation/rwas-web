// This context travels only through Pages -> WorkerEntrypoint RPC, never a
// public HTTP header. Its proofs are used in memory and are not ticket data.
export const SELLER_MAIL_PRODUCTION_ORIGIN =
  'https://www.rogerwilcoaviation.com';

export function validateMailContext(context) {
  const keys = [
    'schema',
    'origin',
    'authorization',
    'clerkSessionToken',
    'csrf',
  ];
  if (
    !context ||
    Object.getPrototypeOf(context) !== Object.prototype ||
    Reflect.ownKeys(context).length !== keys.length ||
    keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(context, key);
      return !descriptor || !('value' in descriptor) || !descriptor.enumerable;
    }) ||
    context.schema !== 1 ||
    context.origin !== SELLER_MAIL_PRODUCTION_ORIGIN ||
    typeof context.authorization !== 'string' ||
    !/^Bearer [A-Za-z0-9_-]{20,256}$/.test(context.authorization) ||
    typeof context.csrf !== 'string' ||
    !/^[A-Za-z0-9_-]{20,256}$/.test(context.csrf) ||
    typeof context.clerkSessionToken !== 'string' ||
    context.clerkSessionToken.length > 16384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
      context.clerkSessionToken,
    )
  )
    throw Object.assign(new Error('Verification session proof rejected.'), {
      status: 403,
    });
  return Object.fromEntries(keys.map((key) => [key, context[key]]));
}

export function mailContextFromRequest(request) {
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
      'X-Clerk-Session-Token': proof.clerkSessionToken,
      'X-RWAS-CSRF': proof.csrf,
    },
  });
}
