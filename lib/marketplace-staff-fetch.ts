import { SELLER_API } from './seller-api';

export async function marketplaceStaffRequest(
  path: string,
  method = 'GET',
  body?: unknown,
) {
  const response = await marketplaceStaffFetch(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (
    response.redirected ||
    !response.headers.get('Content-Type')?.includes('application/json')
  )
    throw Error(
      'Sign in with your administrator account and load this section again.',
    );
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(data.error || 'The request could not be completed.'),
      { status: response.status },
    );
  return data;
}

// Authorization still comes from the service's immutable identity + MFA check.
// This helper only forwards the current session proof to same-origin staff APIs.
export function marketplaceStaffFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith('/admin/') || path.includes('..'))
    throw Error('Invalid staff destination.');
  let session: { provider?: string; token?: string; csrf?: string } | null =
    null;
  try {
    session = JSON.parse(sessionStorage.getItem('rwas_sale_v2') || 'null');
  } catch {}
  return fetch(
    SELLER_API +
      (session?.provider === 'better-auth'
        ? path.replace(/^\/admin\//, '/staff/')
        : path),
    {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(session?.provider === 'better-auth' && session.token && session.csrf
          ? {
              Authorization: 'Bearer ' + session.token,
              'X-RWAS-CSRF': session.csrf,
            }
          : {}),
        ...options.headers,
      },
    },
  );
}

export function marketplaceStaffMediaPath(key: string) {
  let modern = false;
  try {
    modern =
      JSON.parse(sessionStorage.getItem('rwas_sale_v2') || 'null')?.provider ===
      'better-auth';
  } catch {}
  return (
    SELLER_API +
    (modern ? '/staff/files/' : '/admin/files/') +
    encodeURIComponent(key)
  );
}
