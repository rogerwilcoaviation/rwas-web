import { isIP } from 'node:net';
import { jerryAssert, jerryUuid } from './jerry-protocol.mjs';

// Derive purpose-separated, irreversible admission labels with the backend's
// existing identity secret. Neither that secret nor the edge address is sent
// to the response service, stored in its ledger, or transmitted to a provider.
export async function responseAdmission(
  env,
  { identity, proof, surface, operationId, issuedAt, payload, kind },
) {
  jerryAssert(
    typeof env.BETTER_AUTH_SECRET === 'string' &&
      env.BETTER_AUTH_SECRET.length >= 32,
    503,
    'Jerry admission identity is not configured.',
    'JERRY_ADMISSION_UNAVAILABLE',
  );
  jerryAssert(
    jerryUuid(operationId) && Number.isSafeInteger(issuedAt),
    400,
    'A stable response operation ID and timestamp are required.',
  );
  const category = identity ? 'account' : 'guest';
  if (!identity)
    jerryAssert(
      typeof proof.admissionAddress === 'string' &&
        isIP(proof.admissionAddress) > 0,
      503,
      'Trusted guest admission context is unavailable.',
      'JERRY_ADMISSION_UNAVAILABLE',
    );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sign = async (value) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode('jerry-admission-v1:' + value),
        ),
      ),
    )
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
  return {
    category,
    principal: await sign(
      category + ':' + (identity?.owner || proof.admissionAddress),
    ),
    surface,
    kind,
    operationId,
    issuedAt,
    fingerprint: await sign(JSON.stringify({ kind, surface, payload })),
  };
}
