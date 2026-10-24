export const JERRY_RETENTION_MS = 90 * 86400000;
export const JERRY_SURFACES = ['public', 'exchange'];
export const JERRY_LOCALES = ['en', 'pt-BR', 'es'];
export const jerryUuid = (value) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export function jerryError(status, message, code = 'JERRY_REQUEST_REJECTED') {
  return Object.assign(Error(message), { status, code });
}
export function jerryAssert(condition, status, message, code) {
  if (!condition) throw jerryError(status, message, code);
}
export function jerryKeys(value, allowed) {
  jerryAssert(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => allowed.includes(key)),
    400,
    'Invalid Jerry request.',
  );
}
export async function jerryJson(request, maximum = 48000) {
  jerryAssert(
    Number(request.headers.get('Content-Length') || 0) <= maximum,
    413,
    'Jerry request is too large.',
  );
  const reader = request.body?.getReader();
  let bytes = 0,
    result = '';
  const decoder = new TextDecoder();
  if (reader)
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw jerryError(413, 'Jerry request is too large.');
      }
      result += decoder.decode(part.value, { stream: true });
    }
  try {
    return JSON.parse(result + decoder.decode());
  } catch {
    throw jerryError(400, 'Invalid Jerry JSON.');
  }
}
export function jerryText(value, maximum = 4000) {
  jerryAssert(
    typeof value === 'string' &&
      value.trim() &&
      value.length <= maximum &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
    400,
    'Enter a shorter message.',
  );
  return value.trim();
}
export async function jerryHash(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          typeof value === 'string' ? value : JSON.stringify(value),
        ),
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export function jerryPage(value, surface, role = 'visitor') {
  jerryAssert(
    typeof value === 'string' &&
      value.startsWith('/') &&
      value.length < 400 &&
      !/[?#\\\u0000-\u0020%]/.test(value) &&
      !value.split('/').some((p) => p === '.' || p === '..') &&
      !/^\/\//.test(value),
    400,
    'Invalid page reference.',
  );
  const path = value.replace(/\/$/, '') || '/';
  jerryAssert(
    !/^\/(?:api|_next|_site-language|ops|work-order-system)(?:\/|$)/.test(path),
    403,
    'This page is outside Jerry website context.',
  );
  const exchange =
    /^\/aircraft-for-sale(?:\/|$)/.test(path) ||
    ['/seller-review', '/seller-accounts'].includes(path);
  jerryAssert(
    (surface === 'exchange') === exchange,
    403,
    'Conversation surface and page do not match.',
  );
  if (['/seller-review', '/seller-accounts'].includes(path))
    jerryAssert(
      ['admin', 'super-admin'].includes(role),
      403,
      'Administrator access required.',
    );
  return path;
}
export function jerryResult(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
