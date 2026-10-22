import { createSellerAuth } from './better-auth-service.mjs';

export const IDENTITY_BASE_PATH = '/api/aircraft-sale/identity';

export function isSellerIdentityRequest(request) {
  const path = new URL(request.url).pathname;
  return (
    path === IDENTITY_BASE_PATH || path.startsWith(IDENTITY_BASE_PATH + '/')
  );
}

function secureResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}

// This is an ingress bound, not a second authentication implementation.
// Never log or retain the request, passwords, verification links or responses.
async function boundedRequest(request) {
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32768) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request, { body: bytes });
}

export async function handleSellerIdentityRequest(request, env) {
  if (env.BETTER_AUTH_ENABLED !== 'true')
    return secureResponse(
      Response.json({ error: 'Not found.' }, { status: 404 }),
    );
  try {
    const bounded = await boundedRequest(request);
    if (!bounded)
      return secureResponse(
        Response.json({ error: 'Request is too large.' }, { status: 413 }),
      );
    const auth = createSellerAuth(env);
    return secureResponse(await auth.handler(bounded));
  } catch (error) {
    if (error?.status === 403 && error?.code === 'TWO_FACTOR_REQUIRED')
      return secureResponse(
        Response.json(
          {
            error:
              'Verify your authenticator or backup code before continuing.',
            code: 'TWO_FACTOR_REQUIRED',
          },
          { status: 403 },
        ),
      );
    // Better Auth returns structured authentication errors itself. A thrown
    // configuration/runtime failure stays generic and carries no secret data.
    return secureResponse(
      Response.json(
        { error: 'Seller authentication is unavailable.' },
        { status: 503 },
      ),
    );
  }
}
